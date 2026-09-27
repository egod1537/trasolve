# 작업 규칙

- 텍스트 파일은 UTF-8 및 LF(`\n`) 줄바꿈으로 저장한다. Windows에서도 CRLF나 혼합 줄바꿈을 추가하지 않는다.
- 파일 생성, 이동, 수정 시 `.gitattributes`, `.editorconfig`, Prettier의 LF 설정을 따른다.
- 기존 파일에 CRLF가 있으면 수정하는 파일의 줄바꿈을 LF로 통일한다. 내용과 무관한 포맷 변경은 하지 않는다.
- 작업 완료 전에 변경한 텍스트 파일에 실제 CR 문자(`\r`, 편집기에서 `^M`으로 표시)가 남아 있지 않은지 확인한다. 새 파일과 이동한 파일도 포함한다.

## 코드 스타일

- TypeScript 클래스의 공개 생성자와 공개 메서드에는 `public`을 명시한다.
- 클래스 멤버는 공개 생성자, 공개 메서드, 비공개 멤버 순서로 배치한다. `public` 멤버는 `private` 및 `protected` 멤버보다 위에 둔다.

## 현지화 개발 규칙

### 기본 원칙

- 사용자에게 노출되는 정적 문자열은 localization 대상이면 `L('namespace:key')`, 의도적으로 번역하지 않는 문자열이면 `NL('literal')`을 사용한다.
- 사용자 노출 literal을 JSX text 또는 props/attribute에 직접 작성하지 않는다.
- JSX text, button/label, placeholder, tooltip/title, `aria-label`, `aria-description`, alt, validation/error, toast/dialog, progress message 및 사용자 노출 formatter 결과를 모두 사용자 노출 문자열로 본다.
- localization lint를 disable 주석으로 회피하지 않는다. 불가피한 예외는 중앙 ESLint config에서만 관리한다.

### `L()` 사용

- `L()`은 Google Sheets와 production resource에 등록된 localization key에만 사용한다. 예: `L('common:action.cancel')`.
- 한국어 문장 자체를 key로 사용하거나 `L('취소')`처럼 호출하지 않는다.
- 동적 key를 `L(dynamicKey)` 형태로 전달하지 않는다. key는 정적인 `namespace:key` literal이어야 한다.
- 버튼 액션, 상태명, 도움말, 오류·진행 문구, 화면 제목, 설명, placeholder 및 일반 UI 명사·동사는 localization 대상으로 분류한다.

### `NL()` 사용

- `NL()`은 `Trasolve`, `Google Maps`, `OAuth`, `GTFS`처럼 번역하지 않아야 하는 고유명사, 제품명, 프로토콜 또는 고유 기술 토큰에만 사용한다.
- 버튼 액션, 일반 UI 문구 또는 번역이 누락된 문구를 `NL()`로 우회하지 않는다. `NL('취소')`, `NL('장소 검색')`, `NL('경로 최적화')` 같은 사용은 금지한다.
- `NL()`에는 가능한 한 짧은 정적 literal 하나만 전달한다. 새 사용처를 추가할 때 실제로 번역 대상이 아닌지 확인하고 검색과 audit가 가능한 형태를 유지한다.

### 동적 사용자 데이터

- 사용자 입력, 장소명, 여행명, 메모, 사용자 생성 콘텐츠 및 API에서 반환된 실제 고유명사는 `L()` 또는 `NL()`로 감싸지 않고 원래 expression을 유지한다.
- 외부 데이터처럼 보여도 애플리케이션이 작성한 상태명, 오류, 설명 또는 formatter 결과라면 UI 경계에서 localization한다.

### 새 문구 추가 절차

1. 의미와 UI 문맥에 맞는 namespace와 semantic key를 정한다.
2. 지정된 Google Spreadsheet에 `ko`, `ja`, `en`, `context`, `status`를 추가한다.
3. `npm run localization:sync -- --production`으로 production resource를 생성한다.
4. 코드에서 정적 key를 `L(key)`로 사용한다.
5. localization lint와 관련 검증을 실행한다.

- 일반 기능 작업에서 Spreadsheet 수정 권한 또는 인증 환경이 없으면 의미가 정확히 같은 기존 key만 재사용한다.
- 재사용할 key가 없으면 literal hardcode, 부정확한 key 재사용, `NL()` 우회 또는 production JSON 수동 편집을 하지 않는다. 기능 로직은 가능한 범위까지 구현하되 새 문구의 Sheet 반영이 필요하다는 blocker를 보고하고, 사용자 노출 문자열이 미분류된 상태로 merge하거나 장기간 방치하지 않는다.

### Google Sheets와 production resource

- 일반 기능 구현 중 임의로 Google Spreadsheet를 수정하지 않는다.
- 사용자가 localization, localization migration, translation update 또는 localization sheet update를 명시적으로 요청한 경우에만 지정된 localization Spreadsheet의 key와 번역을 수정할 수 있다.
- Spreadsheet를 제목으로 검색하거나 임의의 문서를 선택하지 않는다. `infra/localization/opts.ts`의 Spreadsheet ID를 source of truth로 사용하고, `LOCALIZATION_SPREADSHEET_ID` 환경변수가 있으면 그 값을 우선한다.
- 기존 key, 번역, context, status를 불필요하게 덮어쓰지 않는다. 실제 credential이나 secret은 `AGENTS.md` 또는 저장소에 기록하지 않는다.
- Google Sheets가 localization 원본이다. production build는 Git-tracked JSON snapshot을 사용하며, JSON을 primary source로 수동 편집하거나 runtime에서 Google Sheets를 직접 조회하지 않는다.

### UI와 domain 경계

- i18n helper는 presentation/UI 레이어 중심으로 사용한다.
- domain, entity, schema, algorithm, map adapter, persistence/repository 계층은 가능한 한 raw enum, code, data를 반환하고 UI 경계에서 `L()`로 번역한다.
- 동적 문장은 문자열 concat 또는 template literal로 조립하지 않고 i18next interpolation을 사용한다. 예: `L('place:count', { count })`.

### 검증

- localization 관련 변경 후 필요한 범위에서 다음을 실행한다: `npm run localization:sync -- --production`, `npm run localization:lint`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Sheet 또는 production resource가 바뀌면 production sync와 생성 JSON의 Git 추적 여부를 확인한다. 인증 부재로 sync할 수 없으면 이를 숨기지 않고 blocker로 보고한다.
- 현지화 migration inventory가 필요한 작업은 사용자 노출 문자열을 `LOCALIZED`, `NON_LOCALIZED`, `DYNAMIC_DATA`로 분류하고 분류 이유를 기록한다.

## UI 스타일 규칙

- 지도 위에 떠 있는 팝업, 카드, 드롭다운, 설정 패널 등 floating surface는 모두 전역 `--shadow-map-overlay` 토큰을 사용한다.
- map floating surface에 개별 `box-shadow` 값을 직접 작성하거나 `--shadow-floating-*` 토큰을 임의로 선택하지 않는다.
- 새로운 map overlay UI를 추가할 때 기존 floating surface와 동일한 shadow가 적용되었는지 확인한다.
- marker, focus ring, selection halo, timeline handle처럼 상태 표현 목적의 shadow는 이 규칙의 대상이 아니다.

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
