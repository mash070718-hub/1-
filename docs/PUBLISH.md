# Library of Limbus를 웹 주소로 사용하기

`docs/index.html`은 사이트와 공식 이미지 305개를 모두 포함하는 배포 파일입니다. 외부 JavaScript, 이미지 서버, 설치 과정 없이 사용할 수 있습니다. 별도 서버나 데이터베이스는 필요하지 않습니다.

## GitHub Pages 활성화

저장소에 로그인한 뒤 **Settings → Pages**에서 다음을 선택합니다.

1. **Source:** Deploy from a branch
2. **Branch:** library-of-limbus
3. **Folder:** /docs
4. **Save**

배포가 완료되면 같은 설정 화면에 표시되는 **Visit site**로 접속합니다. 이 문서는 배포가 성공하기 전에 사이트가 공개되었다고 가정하지 않습니다.

비공개 저장소에서 Pages 사용이 제한된다는 안내가 나오면 GitHub 계정 요금제와 정책을 확인해야 합니다. 저장소를 공개로 바꾸는 것은 별도의 결정이며, 이 작업으로 자동 변경하지 않습니다.

## 기록 보관

이 버전은 로그인이 없으며 개인 기록을 접속한 브라우저에 저장합니다. 공개되는 사이트 파일에는 사용자가 작성한 평가가 들어 있지 않습니다. 다른 기기로 옮기거나 브라우저 데이터를 지우기 전에는 **백업과 복원**에서 JSON 백업을 저장하세요.

## 다시 빌드하기

앱이나 카탈로그가 바뀌면 저장소 루트에서 다음 명령으로 배포 HTML을 갱신합니다.

```sh
npm ci
npm run build
npm test
node scripts/build-standalone.mjs docs/index.html
```

갱신한 파일을 배포 브랜치에 반영하면 GitHub Pages가 다시 배포합니다. `manifest.json`의 파일 해시와 바이트 크기는 갱신한 HTML 기준으로 함께 수정해야 합니다.

공식 문자열·이미지의 출처는 [CATALOG_SOURCES.md](CATALOG_SOURCES.md)를 참고하세요.
