# 작업 규칙

- 텍스트 파일은 UTF-8 및 LF(`\n`) 줄바꿈으로 저장한다. Windows에서도 CRLF나 혼합 줄바꿈을 추가하지 않는다.
- 파일 생성, 이동, 수정 시 `.gitattributes`, `.editorconfig`, Prettier의 LF 설정을 따른다.
- 기존 파일에 CRLF가 있으면 수정하는 파일의 줄바꿈을 LF로 통일한다. 내용과 무관한 포맷 변경은 하지 않는다.
- 작업 완료 전에 변경한 텍스트 파일에 실제 CR 문자(`\r`, 편집기에서 `^M`으로 표시)가 남아 있지 않은지 확인한다. 새 파일과 이동한 파일도 포함한다.

## 검증 방식

- 자동 unit / integration 테스트 파일(`*.test.*`, `*.spec.*`), 실행 스크립트, 테스트 전용 의존성·fixture·helper를 추가하거나 유지하지 않는다.
- 애플리케이션에 테스트 전용 분기, mock injection, fake Google SDK 또는 mock API 응답을 추가하지 않는다.
- 타입 검사, 빌드, 린트와 실제 UI를 통한 수동 확인으로 변경을 검증한다.
- `/dev/google-maps`의 Google Maps Test Bed는 실제 API를 실행하는 개발용 React 페이지로 유지한다. 자동 테스트 제거 대상이 아니다.
- Test Bed는 공용 `GoogleMap`, `GooglePlaceSearch`, `googleDirections`를 조합하며 SDK 초기화나 Adapter 생성을 직접 구현하지 않는다. 일반 서비스 메뉴에 진입 링크를 추가하지 않는다.
