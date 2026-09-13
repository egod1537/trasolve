# 작업 규칙

- 텍스트 파일은 UTF-8 및 LF(`\n`) 줄바꿈으로 저장한다. Windows에서도 CRLF나 혼합 줄바꿈을 추가하지 않는다.
- 파일 생성, 이동, 수정 시 `.gitattributes`, `.editorconfig`, Prettier의 LF 설정을 따른다.
- 기존 파일에 CRLF가 있으면 수정하는 파일의 줄바꿈을 LF로 통일한다. 내용과 무관한 포맷 변경은 하지 않는다.
- 작업 완료 전에 변경한 텍스트 파일에 실제 CR 문자(`\r`, 편집기에서 `^M`으로 표시)가 남아 있지 않은지 확인한다. 새 파일과 이동한 파일도 포함한다.

## 코드 스타일

- TypeScript 클래스의 공개 생성자와 공개 메서드에는 `public`을 명시한다.
- 클래스 멤버는 공개 생성자, 공개 메서드, 비공개 멤버 순서로 배치한다. `public` 멤버는 `private` 및 `protected` 멤버보다 위에 둔다.

## 검증 방식

- 자동 unit / integration 테스트 파일(`*.test.*`, `*.spec.*`), 실행 스크립트, 테스트 전용 의존성·fixture·helper를 추가하거나 유지하지 않는다.
- 애플리케이션에 테스트 전용 분기, mock injection, fake Google SDK 또는 mock API 응답을 추가하지 않는다.
- 타입 검사, 빌드, 린트와 실제 UI를 통한 수동 확인으로 변경을 검증한다.
- `/testbed/google-maps`의 Google Maps Test Bed는 실제 API를 실행하는 개발용 React 페이지로 유지한다. 자동 테스트 제거 대상이 아니다.
- Test Bed는 공용 `GoogleMap`, `GooglePlaceSearch`, `api/routes`의 `getDirections`를 조합하며 SDK 초기화나 Adapter 생성을 직접 구현하지 않는다. 일반 서비스 메뉴에 진입 링크를 추가하지 않는다.

## Google Maps 경계

- `google.maps` 객체 및 타입의 직접 사용은 `frontend/src/map/runtime/`와 `frontend/src/map/adapters/`에 둔다. 컴포넌트·페이지·도메인은 provider-neutral 타입과 `MapRuntime` 계약을 사용한다.
- `map/runtime/`는 브라우저 SDK 로딩과 지도 렌더링만 담당한다. HTTP 요청은 공용 `frontend/src/api/` 또는 페이지 전용 `frontend/src/pages/map/api/`에 두고 React 컴포넌트에서 직접 `fetch`하지 않는다.
- Routes 계산과 Places 조회는 Trasolve backend를 경유한다. Google 원본 응답은 도메인 데이터로 사용하지 않으며, 기존 Test Bed의 Routes 원본 응답은 Debug 표시 용도로만 사용한다.
- 브라우저 키는 Maps JavaScript API 전용이며 HTTP referrer 제한을 적용한다. Routes·Places 서버 키와 공유하거나 서버 키를 `VITE_` 환경변수에 넣지 않는다.
