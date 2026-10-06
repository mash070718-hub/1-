# Library of Limbus 자료 출처

## 1차 카탈로그 범위

2026년 10월 6일 기준 공개 게임 데이터에서 확인한 **인격 189개, E.G.O 116개, 합계 305개**를 포함합니다. 최신 출시일은 **2026년 10월 1일**, 한국어 로컬라이징은 **Ver. 1.116.0 Hotfix**입니다.

| 수감자 | 인격 | E.G.O |
|---|---:|---:|
| 이상 | 16 | 9 |
| 파우스트 | 16 | 11 |
| 돈키호테 | 15 | 10 |
| 료슈 | 16 | 9 |
| 뫼르소 | 15 | 10 |
| 홍루 | 16 | 10 |
| 히스클리프 | 16 | 9 |
| 이스마엘 | 16 | 10 |
| 로쟈 | 17 | 10 |
| 싱클레어 | 15 | 9 |
| 오티스 | 15 | 9 |
| 그레고르 | 16 | 10 |

공개 미러의 출시 목록을 이름 및 이미지 ID와 대조했습니다. 출시일이 미래인 기록, `upcoming` 목록, 적·테스트·연출 전용 기록은 제외합니다. 현재 미출시 인격 `11016`도 제외했습니다. 한정 및 과거 시즌 기록은 포함하며, 지금 추출 가능한지 여부와 출시 여부는 별개입니다. 공식 웹사이트가 전체 자료 API를 제공하는 것은 아니므로, 이는 아래 커뮤니티 미러를 대조한 자료 기준의 목록입니다.

티어, 장단점, 운영 방법, 추천 E.G.O와 사용 덱은 평가 자료를 추정해 채우지 않습니다. 빈 기록에서 사용자가 직접 작성할 수 있습니다.

## 한국어 이름

- 출처: [x1bViolet/Limbus-Localization-Files, Korean](https://github.com/x1bViolet/Limbus-Localization-Files/tree/1924dfa59154736cd07a1e7d27ed7dd2e45f2391)
- 고정 커밋: `1924dfa59154736cd07a1e7d27ed7dd2e45f2391`
- 커밋 날짜: 2026-10-01, 커밋 설명 `01.10.2026 Ver. 1.116.0 Hotfix (19:30 (KST))`
- `Characters.json`: 수감자 이름
- `Personalities.json`: 인격의 `title` 및 수감자 이름
- `Egos.json`: E.G.O 이름
- `BattleKeywords.json`: 화상, 출혈, 진동, 파열, 침잠, 호흡, 충전의 게임 한국어 명칭

한국어 원문을 직접 사용합니다. 인격 이름에서 게임 UI의 줄바꿈만 공백으로 바꾸고 문장부호, 한자 및 철자는 보존합니다. 인격의 소속·직함은 이름 필드, 수감자 이름은 별도 필드로 저장합니다. 평가를 편집해도 원본 카탈로그와 출처는 별도 유지합니다.

## 출시 목록과 이미지

- 출처: [eldritchtools/limbus-assets](https://github.com/eldritchtools/limbus-assets/tree/045dbb7679792fc4e5397fa53ecaf7e7ca0405b7)
- 고정 커밋: `045dbb7679792fc4e5397fa53ecaf7e7ca0405b7`
- 자료 갱신 시각: `2026-10-06T12:08:41Z` (`meta.json`과 커밋 날짜 일치)
- `data/identities.json`, `data/egos.json`: 출시일, 수감자 ID, 등급, 시즌 및 주요 키워드
- `data/upcoming.json`: 미출시 기록 제외에 사용
- `assets/identities/*_gacksung.webp`: 통상 인격의 동기화 후 원화
- `assets/identities/*_normal.webp`: 기본 인격 원화
- `assets/identities/*_gacksung_profile.webp`: 인격 썸네일
- `assets/egos/*_cg.webp`, `*_awaken_profile.webp`: E.G.O 원화 및 썸네일

이미지는 **공식 게임 원화의 WebP 변환본을 커뮤니티 미러에서 받은 것**입니다. 공식 사이트에서 직접 호스팅하는 파일이나 새로 만든 이미지가 아닙니다. 원문과 이미지의 권리는 **Project Moon**에 있으며, 미러도 `All rights reserved to Project Moon`으로 명시합니다. 이 사이트는 개인 기록용 팬 프로젝트입니다.

305개 모두 원화와 썸네일을 로컬에 저장합니다. 총 610개, 약 75.40 MiB입니다. 이미지 원격 호출에 의존하지 않으므로 실행 중 외부 자료 요청 없이 표시됩니다. `public/images/catalog/manifest.json`에 원본 URL, SHA-256, 크기, 파일 용량을 기록했습니다.

## 재현 및 갱신

Python 3.10 이상과 Git을 사용하며, 추가 Python 패키지가 필요하지 않습니다.

```sh
# 저장된 카탈로그와 610개 이미지 무결성 검사: 네트워크 불필요
python scripts/update-catalog.py --check

# 이번 1차 완성본의 고정 커밋으로 재현
python scripts/update-catalog.py

# 두 미러의 최신 브랜치를 조회하고 새 출시 자료를 추가
# 게임 버전은 한국어 미러의 커밋 설명을 확인해 지정
python scripts/update-catalog.py --latest --game-version 1.116.0
```

갱신은 `src/data/catalog.json`, `public/images/catalog/manifest.json` 및 이미지 파일에만 적용됩니다. 사용자가 브라우저에 기록한 티어와 메모는 카탈로그와 다른 저장 공간에 있으므로 갱신 스크립트가 수정하지 않습니다. 최신 버전 번호를 지정하지 않았는데 한국어 커밋이 바뀌었으면 버전란은 `업데이트 후 확인 필요`로 표시합니다. `--as-of YYYY-MM-DD`, `--assets-commit SHA`, `--locale-commit SHA`로 검증 범위를 고정할 수 있습니다.

필요한 네트워크 목적지는 `github.com`, `raw.githubusercontent.com`입니다. GitHub API 토큰은 요구하지 않으며 기존 HTTPS Git 연결로 브랜치 커밋을 확인합니다. 기본 TLS 검증을 유지합니다. 파일을 다운로드할 때 WebP 형식·치수·SHA-256을 검증하고, 이름이 누락되거나 이미지가 깨진 경우 새 카탈로그 저장을 중단합니다. 기존 이미지 해시가 맞으면 다시 다운로드하지 않습니다.
