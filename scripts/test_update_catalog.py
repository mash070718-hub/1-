"""Exercise scheduled updates without network access or personal storage access."""
from contextlib import redirect_stdout
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("catalog_update", Path(__file__).with_name("update-catalog.py"))
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)
REPO = Path(__file__).resolve().parents[1]
ART = (REPO / "public/images/catalog/identity-10101-thumb.webp").read_bytes()


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sources = {
            "data/identities.json": {"10101": {"rank": 1, "sinnerId": 1, "date": "2023-02-27", "season": 1, "skillKeywordList": ["Burn"]}},
            "data/egos.json": {"20101": {"rank": "ZAYIN", "sinnerId": 1, "date": "2023-02-27", "season": 1, "awakeningType": {"affinity": "gloom"}}},
            "data/upcoming.json": {"identities": {}, "egos": {}},
            "meta.json": {"datetime": "2026-10-15T03:00:00Z"},
            "Personalities.json": {"dataList": [{"id": 10101, "title": "LCB 수감자", "name": "이상"}]},
            "Egos.json": {"dataList": [{"id": 20101, "name": "오감도"}]},
            "Characters.json": {"dataList": [{"id": i + 1, "name": name} for i, name in enumerate(["이상", "파우스트", "돈키호테", "료슈", "뫼르소", "홍루", "히스클리프", "이스마엘", "로쟈", "싱클레어", "오티스", "그레고르"])]},
            "BattleKeywords.json": {"dataList": [{"id": "Burn", "name": "화상"}]},
        }
        self.args = ["update", "--as-of", "2026-10-15", "--assets-commit", "a" * 40, "--locale-commit", "b" * 40, "--automatic", "--if-changed", "--workers", "1"]
        (self.root / "personal-evaluations.json").write_text('{"score":18,"overallTier":"A","story":"S","note":"보존"}')

    def run_update(self, extra=(), image=ART):
        with patch.object(updater, "ROOT", self.root), patch.object(updater, "get_json", side_effect=lambda repo, sha, path: copy.deepcopy(self.sources[path])), patch.object(updater, "get_bytes", return_value=image) as download, patch("sys.argv", self.args + list(extra)), redirect_stdout(io.StringIO()):
            updater.main()
            return download.call_count

    def files(self):
        return {str(path.relative_to(self.root)): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}

    def catalog(self):
        return json.loads((self.root / "src/data/catalog.json").read_text())

    def add_identity(self, date="2026-10-15"):
        self.sources["data/identities.json"]["10202"] = {"rank": 3, "sinnerId": 2, "date": date, "season": 8, "skillKeywordList": ["NewKeyword"]}
        self.sources["Personalities.json"]["dataList"].append({"id": 10202, "title": "새 인격\n공식 이름", "name": "파우스트"})

    def test_new_identity_and_ego_add_only_when_released_and_keep_personal_files(self):
        self.run_update()
        before = (self.root / "personal-evaluations.json").read_bytes()
        self.add_identity()
        self.sources["data/egos.json"]["20202"] = {**self.sources["data/egos.json"]["20101"], "sinnerId": 2, "date": "2026-10-15"}
        self.sources["Egos.json"]["dataList"].append({"id": 20202, "name": "새 E.G.O"})
        self.assertEqual(self.run_update(), 4)
        self.assertEqual(self.catalog()["metadata"]["counts"], {"identity": 2, "ego": 2})
        self.assertEqual(self.catalog()["entries"][1]["name"], "새 인격 공식 이름")
        self.assertEqual((self.root / "personal-evaluations.json").read_bytes(), before)
        for entry in self.catalog()["entries"]:
            self.assertNotIn("tiers", entry)
            self.assertNotIn("scores", entry)

    def test_future_and_upcoming_entries_do_not_publish_and_unchanged_heads_do_not_write(self):
        self.run_update()
        before = self.files()
        self.add_identity(date="2026-10-16")
        self.assertEqual(self.run_update(), 0)
        self.assertEqual(self.files(), before)
        self.sources["data/identities.json"]["10202"]["date"] = "2026-10-15"
        self.sources["data/upcoming.json"]["identities"]["10202"] = {"upcoming": True}
        self.assertEqual(self.run_update(), 0)
        self.assertEqual(self.files(), before)

    def test_incomplete_localization_or_image_leaves_previous_files_unchanged(self):
        self.run_update()
        before = self.files()
        self.add_identity()
        self.sources["Personalities.json"]["dataList"].pop()
        with self.assertRaisesRegex(ValueError, "Missing official Korean"):
            self.run_update()
        self.assertEqual(self.files(), before)
        self.sources["Personalities.json"]["dataList"].append({"id": 10202, "title": "새 인격", "name": "파우스트"})
        with self.assertRaisesRegex(ValueError, "WebP"):
            self.run_update(image=b"invalid downloaded image")
        self.assertEqual(self.files(), before)

    def test_missing_existing_ids_refuse_a_destructive_refresh(self):
        self.run_update()
        before = self.files()
        self.sources["data/identities.json"] = {}
        with self.assertRaisesRegex(ValueError, "missing existing records"):
            self.run_update()
        self.assertEqual(self.files(), before)

    def test_reused_images_retain_pinned_provenance_and_no_op_refresh_is_identical(self):
        self.run_update()
        before = self.files()
        self.sources["meta.json"]["datetime"] = "2026-10-15T05:00:00Z"
        self.args[self.args.index("--assets-commit") + 1] = "c" * 40
        self.args[self.args.index("--locale-commit") + 1] = "d" * 40
        self.assertEqual(self.run_update(), 0)
        self.assertEqual(self.files(), before)
        self.sources["Personalities.json"]["dataList"][0]["title"] = "수정된 공식 이름"
        self.assertEqual(self.run_update(), 0)
        manifest = json.loads((self.root / "public/images/catalog/manifest.json").read_text())
        self.assertTrue(all("/" + "a" * 40 + "/" in item["sourceUrl"] for item in manifest["images"]))

    def test_dry_run_never_downloads_art_or_writes_files(self):
        before = self.files()
        self.assertEqual(self.run_update(["--dry-run"]), 0)
        self.assertEqual(self.files(), before)


if __name__ == "__main__":
    unittest.main()
