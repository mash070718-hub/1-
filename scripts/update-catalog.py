#!/usr/bin/env python3
"""Reproduce or refresh the released Limbus catalog from pinned public game mirrors.

Python 3.10+; standard library only. TLS verification remains enabled. Existing
catalog files are replaced only after all names and images have been verified.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
ASSET_REPO = "eldritchtools/limbus-assets"
LOCALE_REPO = "x1bViolet/Limbus-Localization-Files"
ASSET_COMMIT = "045dbb7679792fc4e5397fa53ecaf7e7ca0405b7"
LOCALE_COMMIT = "1924dfa59154736cd07a1e7d27ed7dd2e45f2391"
SNAPSHOT_DATE = "2026-10-06"
GAME_VERSION = "1.116.0"
KEYWORD_IDS = {
    "Bleed": "Laceration", "Burn": "Burn", "Charge": "Charge",
    "Poise": "Breath", "Rupture": "Burst", "Sinking": "Sinking",
    "Tremor": "Vibration",
}
AFFINITIES = {
    "wrath": "분노", "lust": "색욕", "sloth": "나태", "gluttony": "탐식",
    "gloom": "우울", "pride": "오만", "envy": "질투",
}


def raw_url(repo: str, commit: str, path: str) -> str:
    return f"https://raw.githubusercontent.com/{repo}/{commit}/{path}"


def get_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "Library-of-Limbus-Catalog/1.0"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def get_json(repo: str, commit: str, path: str):
    return json.loads(get_bytes(raw_url(repo, commit, path)))


def head_commit(repo: str, branch: str) -> str:
    result = subprocess.run(
        ["git", "ls-remote", f"https://github.com/{repo}.git", f"refs/heads/{branch}"],
        check=True, capture_output=True, text=True, timeout=60,
    )
    commit = result.stdout.split()[0]
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError(f"Invalid source commit for {repo}")
    return commit


def normalize_name(text: str) -> str:
    # Official UI line wraps become spaces; punctuation and Korean spelling stay intact.
    return re.sub(r"\s+", " ", text).strip()


def webp_dimensions(data: bytes) -> tuple[int, int]:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("Image is not WebP")
    if struct.unpack_from("<I", data, 4)[0] + 8 != len(data):
        raise ValueError("Incomplete WebP image")
    offset = 12
    while offset + 8 <= len(data):
        kind, length = data[offset:offset + 4], struct.unpack_from("<I", data, offset + 4)[0]
        body = data[offset + 8:offset + 8 + length]
        if len(body) != length:
            raise ValueError("Truncated WebP chunk")
        if kind == b"VP8X" and len(body) >= 10:
            return int.from_bytes(body[4:7], "little") + 1, int.from_bytes(body[7:10], "little") + 1
        if kind == b"VP8 " and len(body) >= 10 and body[3:6] == b"\x9d\x01\x2a":
            return struct.unpack_from("<H", body, 6)[0] & 0x3FFF, struct.unpack_from("<H", body, 8)[0] & 0x3FFF
        if kind == b"VP8L" and len(body) >= 5 and body[0] == 0x2F:
            bits = int.from_bytes(body[1:5], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        offset += 8 + length + (length % 2)
    raise ValueError("WebP dimensions not found")


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temp:
        temp.write(data)
        temp_path = Path(temp.name)
    temp_path.replace(path)


def encode_json(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def image_requests(entry: dict, asset_data: dict, asset_commit: str) -> list[dict]:
    game_id, kind = entry["gameId"], entry["kind"]
    if kind == "identity":
        base = asset_data["rank"] == 1
        paths = [f"assets/identities/{game_id}_{'normal' if base else 'gacksung'}.webp",
                 f"assets/identities/{game_id}_gacksung_profile.webp"]
    else:
        paths = [f"assets/egos/{game_id}_cg.webp", f"assets/egos/{game_id}_awaken_profile.webp"]
    return [
        {"kind": kind, "gameId": game_id, "role": "artwork" if i == 0 else "thumbnail",
         "file": f"{kind}-{game_id}{'' if i == 0 else '-thumb'}.webp",
         "sourceUrl": raw_url(ASSET_REPO, asset_commit, path)}
        for i, path in enumerate(paths)
    ]


def save_image(item: dict, image_dir: Path, old_images: dict) -> dict:
    path = image_dir / item["file"]
    previous = old_images.get(item["file"], {})
    data = path.read_bytes() if path.exists() else b""
    reusable = previous.get("sourceUrl") == item["sourceUrl"] and previous.get("sha256") == hashlib.sha256(data).hexdigest()
    if not reusable:
        data = get_bytes(item["sourceUrl"])
    width, height = webp_dimensions(data)
    if width < 200 or height < 200:
        raise ValueError(f"Unexpected image dimensions: {item['file']}")
    if not reusable:
        atomic_write(path, data)
    return {**item, "sha256": hashlib.sha256(data).hexdigest(), "width": width, "height": height, "size": len(data)}


def check_existing() -> None:
    catalog = json.loads((ROOT / "src/data/catalog.json").read_text())
    image_dir = ROOT / "public/images/catalog"
    manifest = json.loads((image_dir / "manifest.json").read_text())
    images = {item["file"]: item for item in manifest["images"]}
    seen = set()
    counts = {"identity": 0, "ego": 0}
    for entry in catalog["entries"]:
        if entry["id"] in seen or not re.search(r"[가-힣]", entry["sinner"]):
            raise ValueError("Duplicate ID or missing Korean sinner name")
        seen.add(entry["id"])
        if not entry["name"] or entry["releaseDate"] > catalog["metadata"]["asOf"]:
            raise ValueError("Missing official name or future release")
        counts[entry["kind"]] += 1
        for key in ("image", "thumbnail"):
            path = ROOT / "public" / entry[key].lstrip("/")
            info = images[path.name]
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() != info["sha256"] or webp_dimensions(data) != (info["width"], info["height"]):
                raise ValueError(f"Invalid local artwork: {path}")
    if counts != catalog["metadata"]["counts"]:
        raise ValueError("Catalog counts do not match metadata")
    print(f"Verified {len(seen)} catalog entries and {len(seen) * 2} local images: {counts}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--latest", action="store_true", help="Resolve current source branches before refreshing")
    parser.add_argument("--as-of", help="Exclude releases after this YYYY-MM-DD date")
    parser.add_argument("--assets-commit", default=ASSET_COMMIT)
    parser.add_argument("--locale-commit", default=LOCALE_COMMIT)
    parser.add_argument("--game-version", help="Verified official game version for this snapshot")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--check", action="store_true", help="Verify saved data and image hashes without network")
    args = parser.parse_args()
    if args.check:
        check_existing()
        return
    asset_commit, locale_commit = args.assets_commit, args.locale_commit
    if args.latest:
        asset_commit, locale_commit = head_commit(ASSET_REPO, "main"), head_commit(LOCALE_REPO, "Korean")
    for commit in (asset_commit, locale_commit):
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            parser.error("Source commits must be complete 40-character Git hashes")
    as_of = args.as_of or (date.today().isoformat() if args.latest else SNAPSHOT_DATE)
    date.fromisoformat(as_of)
    game_version = args.game_version or (GAME_VERSION if locale_commit == LOCALE_COMMIT else "업데이트 후 확인 필요")
    identities = get_json(ASSET_REPO, asset_commit, "data/identities.json")
    egos = get_json(ASSET_REPO, asset_commit, "data/egos.json")
    upcoming = get_json(ASSET_REPO, asset_commit, "data/upcoming.json")
    source_meta = get_json(ASSET_REPO, asset_commit, "meta.json")
    names = {
        "identity": {str(item["id"]): item for item in get_json(LOCALE_REPO, locale_commit, "Personalities.json")["dataList"]},
        "ego": {str(item["id"]): item for item in get_json(LOCALE_REPO, locale_commit, "Egos.json")["dataList"]},
    }
    sinners = {int(item["id"]): item["name"] for item in get_json(LOCALE_REPO, locale_commit, "Characters.json")["dataList"] if 1 <= int(item["id"]) <= 12}
    keyword_names = {item["id"]: item["name"] for item in get_json(LOCALE_REPO, locale_commit, "BattleKeywords.json")["dataList"]}
    entries, requests, excluded = [], [], []
    for kind, data, upcoming_kind in (("identity", identities, "identities"), ("ego", egos, "egos")):
        for game_id, item in sorted(data.items()):
            if not re.fullmatch(r"[12]\d{4}", game_id) or item.get("sinnerId") not in sinners:
                raise ValueError(f"Unexpected player record: {kind}/{game_id}")
            release = item.get("date", "")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", release):
                raise ValueError(f"Missing verified release date: {game_id}")
            if release > as_of or game_id in upcoming.get(upcoming_kind, {}) or item.get("upcoming"):
                excluded.append(game_id)
                continue
            if game_id not in names[kind]:
                raise ValueError(f"Missing official Korean localization: {kind}/{game_id}")
            localization = names[kind][game_id]
            official_name = normalize_name(localization["title"] if kind == "identity" else localization["name"])
            sinner = sinners[item["sinnerId"]]
            if kind == "identity" and localization["name"] != sinner:
                raise ValueError(f"Sinner localization mismatch: {game_id}")
            tags = [keyword_names[KEYWORD_IDS[key]] for key in item.get("skillKeywordList", [])]
            if kind == "ego":
                tags = [str(item["rank"])]
            entry = {
                "id": f"catalog-{kind}-{game_id}", "gameId": game_id, "kind": kind,
                "name": official_name, "sinner": sinner, "sinnerId": item["sinnerId"],
                "rarity": "0" * item["rank"] if kind == "identity" else str(item["rank"]),
                "releaseDate": release, "season": item["season"], "tags": tags,
                "image": f"/images/catalog/{kind}-{game_id}.webp",
                "thumbnail": f"/images/catalog/{kind}-{game_id}-thumb.webp",
                "sourceUrl": f"https://github.com/{LOCALE_REPO}/blob/{locale_commit}/{'Personalities' if kind == 'identity' else 'Egos'}.json",
            }
            if kind == "ego":
                entry["affinity"] = AFFINITIES[item["awakeningType"]["affinity"]]
            entries.append(entry)
            requests.extend(image_requests(entry, item, asset_commit))
    counts = {kind: sum(entry["kind"] == kind for entry in entries) for kind in ("identity", "ego")}
    metadata = {
        "verifiedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "asOf": as_of, "sourceUpdatedAt": source_meta["datetime"],
        "sourceCommit": asset_commit, "localizationCommit": locale_commit,
        "latestReleaseDate": max(entry["releaseDate"] for entry in entries),
        "gameVersion": game_version, "counts": counts,
        "coverageNote": "공개 게임 데이터 미러의 출시 목록을 공식 한국어 로컬라이징 및 이미지와 대조했습니다. 미출시·테스트·적·연출 전용 기록은 제외하며, 평가는 사용자가 직접 작성합니다.",
        "sources": [
            {"label": "공식 게임 한국어 로컬라이징 공개 미러", "url": f"https://github.com/{LOCALE_REPO}/tree/{locale_commit}"},
            {"label": "출시 목록 및 공식 게임 이미지 공개 미러", "url": f"https://github.com/{ASSET_REPO}/tree/{asset_commit}"},
        ],
        "excludedUpcomingIds": sorted(set(excluded) | set(upcoming.get("identities", {})) | set(upcoming.get("egos", {}))),
        "sinnerCounts": [{"sinner": sinners[i], "identity": sum(e["kind"] == "identity" and e["sinnerId"] == i for e in entries), "ego": sum(e["kind"] == "ego" and e["sinnerId"] == i for e in entries)} for i in range(1, 13)],
        "copyright": "게임 이미지 및 원문 © Project Moon. 커뮤니티 미러에서 가져온 공식 게임 자료이며 공식 호스팅이 아닙니다.",
    }
    image_dir = ROOT / "public/images/catalog"
    image_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = image_dir / "manifest.json"
    old_manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    old_images = {item["file"]: item for item in old_manifest.get("images", [])}
    images = []
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 16))) as pool:
        futures = [pool.submit(save_image, item, image_dir, old_images) for item in requests]
        for future in as_completed(futures):
            images.append(future.result())
    manifest = {
        "sourceRepository": f"https://github.com/{ASSET_REPO}", "sourceCommit": asset_commit,
        "sourceMetadataTimestamp": source_meta["datetime"],
        "copyright": "Artwork © Project Moon. Source repository: All rights reserved to Project Moon.",
        "provenance": "Official game artwork converted to WebP and distributed through a third-party mirror; not official hosting.",
        "images": sorted(images, key=lambda item: item["file"]),
    }
    atomic_write(manifest_path, encode_json(manifest))
    atomic_write(ROOT / "src/data/catalog.json", encode_json({"metadata": metadata, "entries": entries}))
    print(f"Saved {len(entries)} entries ({counts}) and verified {len(images)} images.")
    check_existing()


if __name__ == "__main__":
    main()
