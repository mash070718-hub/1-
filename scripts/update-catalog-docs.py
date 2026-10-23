#!/usr/bin/env python3
"""Refresh deployed catalog provenance and artifact hashes after a verified build."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def refresh(root: Path = ROOT) -> None:
    catalog = json.loads((root / "src/data/catalog.json").read_text())
    meta = catalog["metadata"]
    path = root / "docs/manifest.json"
    manifest = json.loads(path.read_text())
    html = (root / "docs/index.html").read_bytes()
    thumbnails = {entry["thumbnail"] for entry in catalog["entries"]}
    thumbnails.update(art["thumbnail"] for entry in catalog["entries"] for art in entry.get("artworks", {}).values())
    image_count = len(json.loads((root / "public/images/catalog/manifest.json").read_text())["images"])
    manifest["artifact"].update(bytes=len(html), sha256=hashlib.sha256(html).hexdigest(), embeddedArtworks=len(thumbnails))
    manifest["catalog"] = {key: meta[key] for key in ["asOf", "verifiedAt", "latestReleaseDate", "gameVersion", "counts", "sourceCommit", "localizationCommit"]}
    manifest["features"]["automaticCatalogUpdates"] = {
        "intervalHours": 2, "policy": meta.get("automaticUpdatePolicy"),
        "personalEvaluationsUntouched": True, "newEntriesUnrated": True,
    }
    manifest["features"]["identityArtwork"] = {
        "choices": ["uptie1", "uptie3"], "administratorSelection": True,
        "publishedAndBackedUp": True, "legacyAppearancePreserved": True,
        "sharedAcrossListsDetailsFormationsAndDeckCovers": True,
        "baseIdentitiesShareArtwork": True,
    }
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    table = "\n".join(f"| {row['sinner']} | {row['identity']} | {row['ego']} |" for row in meta["sinnerCounts"])
    sources = "\n".join(f"- [{source['label']}]({source['url']})" for source in meta["sources"])
    (root / "docs/CATALOG_SOURCES.md").write_text(f"""# Library of Limbus 자료 출처

{meta['asOf']} 기준 **인격 {meta['counts']['identity']}개, E.G.O {meta['counts']['ego']}개**를 수록했습니다.
최신 수록 출시일은 {meta['latestReleaseDate']}이며 한국어 자료 버전 표기는 `{meta['gameVersion']}`입니다.
자료 확인 시각: `{meta['verifiedAt']}`. 미러 자료 갱신 시각: `{meta['sourceUpdatedAt']}`.

| 수감자 | 인격 | E.G.O |
|---|---:|---:|
{table}

## 확인한 자료

{sources}

한국어 이름은 `Characters.json`, `Personalities.json`, `Egos.json`을 사용하며 게임 UI의 줄바꿈만 공백으로 바꿉니다.
출시 여부는 `data/identities.json`, `data/egos.json`, `data/upcoming.json`을 함께 확인합니다.
한국 날짜보다 미래인 출시일, 출시 예정·테스트·적 전용 기록은 자동으로 추가하지 않습니다.
게임 출시와 커뮤니티 미러 반영 사이에는 시차가 있을 수 있습니다.

## 이미지와 평가 보존

{image_count}개의 원화·썸네일은 공식 게임 원화의 WebP 변환본이며 커뮤니티 미러에서 가져왔습니다.
인격별 1동기화·3동기화 일러스트를 함께 수록합니다. 별도 3동기화 원화가 없는 기본 인격은 같은 이미지를 사용합니다.
`public/images/catalog/manifest.json`에 각 파일의 실제 원본 URL, SHA-256, 치수와 크기를 기록합니다.
이미 검증된 기존 이미지는 고정된 원본 출처와 함께 재사용하고, 새 이미지는 내려받아 검사합니다.
{meta['copyright']}

도감 갱신은 개인 평가 저장소에 접근하지 않습니다. 점수·종합 티어·콘텐츠별 티어·메모·덱 편성은 보존됩니다.
새 인격과 E.G.O는 미평가로 나타나며 자동 평가나 자동 게시를 하지 않습니다.

## 자동 확인과 수동 재실행

[도감 자동 갱신 실행 기록](https://github.com/mash070718-hub/1-/actions/workflows/update-catalog.yml)

GitHub Actions가 2시간 간격으로 확인합니다. 예약 작업은 GitHub 사정에 따라 지연될 수 있습니다.
새 자료가 없으면 배포하지 않습니다. 이름·이미지 누락, 기존 항목 누락, 검사 실패가 있으면 이전 사이트를 유지하고 다음 실행에서 다시 확인합니다.
워크플로는 기본 브랜치 `main`에서 예약되며 실제 코드·배포 대상은 `library-of-limbus` 브랜치의 `/docs`입니다.
수동으로 즉시 확인하려면 위 실행 기록에서 **Run workflow**를 선택합니다.
GitHub에서 예약 실행을 비활성화한 경우 같은 화면에서 **Enable workflow**로 다시 활성화합니다.

```sh
python3 scripts/update-catalog.py --check
python3 scripts/update-catalog.py --latest --automatic --if-changed --dry-run
python3 scripts/update-catalog.py --latest --automatic --if-changed
npm test
npm run build
npm run build:standalone -- docs/index.html
python3 scripts/update-catalog-docs.py
```

`--dry-run`은 출시·이름 자료만 확인하며 파일을 변경하지 않습니다. 실제 갱신 때 새 이미지도 검증합니다.
Supabase 비밀번호·관리자 세션·서비스 키·Cloudflare API 키는 자동 갱신 작업에 필요하지 않습니다.
""")


if __name__ == "__main__":
    refresh()
