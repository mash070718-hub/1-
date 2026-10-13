# GitHub Pages 배포

사이트 주소: https://mash070718-hub.github.io/1-/
관리자 설정 안내: https://mash070718-hub.github.io/1-/ADMIN_SETUP.html

GitHub Settings → Pages에서 Source는 Deploy from a branch, Branch는 `library-of-limbus`, Folder는 `/docs`입니다. `docs/index.html`이 사이트 코드이고 `docs/cloud-config.json`이 Supabase 공개 연결 설정입니다. `docs/ADMIN_SETUP.html`은 가입·SQL 설치·계정 등록·백업 가져오기 안내입니다.

방문자는 공용 데이터베이스의 게시된 기록을 읽습니다. 사이트 코드 배포와 관리자 기록 게시는 별개입니다. Supabase 프로젝트가 연결되지 않으면 관리자 로그인과 공용 게시를 사용할 수 없습니다. 로그인·공용 데이터 읽기에는 인터넷이 필요합니다.

기존 브라우저 기록은 그대로 보존합니다. 사용하던 PC 브라우저에서 백업과 복원 → 저장소 원본 다운로드로 JSON을 보관한 뒤, 프로젝트 연결 후 관리자 로그인 → 백업 가져오기 → 내용 확인 → 게시하기로 옮깁니다.

배포 HTML은 다음으로 갱신합니다:

```sh
npm ci
npm run build
npm test
npm run test:e2e -- --workers=2
node scripts/build-standalone.mjs docs/index.html
```

`manifest.json`의 해시·바이트 크기를 함께 갱신하고 브랜치에 푸시합니다. 연결된 `docs/cloud-config.json`은 빌드 때문에 빈 값으로 덮어쓰지 않습니다. 로컬 개발 설정 `public/cloud-config.json`도 실제 연결 정보와 일치하게 유지하세요. Publishable 또는 anon public 키만 사용하며 privileged 키나 관리자 비밀번호는 커밋하지 않습니다.
