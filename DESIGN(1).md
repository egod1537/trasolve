# Trasolve 사용자·여행 저장 DB 설계안

작성일: 2026-09-27 / 검토 대상: egod1537/trasolve의 impl 브랜치

**상태: 설계와 초기 SQL 초안입니다. 저장소 수정, DB 적용, 실제 PostgreSQL 실행 검증은 하지 않았습니다.**

## 1. 결정

PostgreSQL에 안정적인 관계는 컬럼으로, 변경이 잦은 여행 본문과 사용자 설정은 JSONB로 저장합니다. 목표는 SQL 스키마 변경을 줄이는 것이지, 도메인 스키마와 데이터 마이그레이션을 없애는 것이 아닙니다.

현재처럼 여행 하나를 전체 스냅샷으로 읽고 저장하는 방식, 개인 편집 위주의 규모를 전제로 합니다. 다수 사용자의 실시간 공동 편집이나 장소별 대규모 검색이 핵심이 되면 문서 분할 또는 별도 검색 모델이 필요할 수 있습니다. PostgreSQL도 JSON 문서 갱신 시 행 전체에 잠금을 잡습니다. [P1]

## 2. 테이블

| 테이블 | 핵심 데이터 | 설계 의도 |
|---|---|---|
| users | 내부 UUID, 표시 이름, 사진 URL, settings, 설정 형식 버전, revision, 생성·수정·삭제 시각 | 서비스 계정. Google ID와 별개 |
| auth_identities | user_id, issuer, subject, email, email_verified, 로그인 시각 | 외부 로그인 계정 연결. UNIQUE(issuer, subject) |
| auth_sessions | token_hash, user_id, 만료·폐기 시각 | 재시작 뒤에도 로그인 유지 |
| trips | id, owner_user_id, title, 날짜, document, schema_version, revision, 시각 | 여행 저장 단위 |
| trip_members | trip_id, user_id, viewer/editor | 향후 공유 기능을 위한 관계. 처음에는 비워둠 |

`users → auth_identities`, `users → auth_sessions`, `users → trips`는 1:N입니다. `users ↔ trips`의 공유 관계만 trip_members로 표현합니다. 소유자는 trips.owner_user_id 한 곳에서 결정합니다.

Google 이메일은 계정 식별키가 아닙니다. Google은 바뀌지 않는 sub를 계정 식별자로 사용하도록 안내합니다. issuer와 subject는 서버가 검증한 외부 인증 결과에서만 가져옵니다. 다른 로그인 수단에서 동일 이메일이 나와도 자동으로 계정을 합치지 않습니다. [P2]

## 3. 컬럼과 JSONB의 경계

컬럼에는 ID, 소유권, 로그인 연결, 공유 권한, 만료일, 제목, 검색·정렬할 날짜와 시각을 둡니다. JSONB에는 days, places, polylines, layerItems, 메모, 영업시간, 체류시간, 스타일, 사용자 선호 등을 둡니다.

저장 예시:

```json
{
  "days": [
    {
      "id": "a-server-issued-day-id",
      "title": "Day 1",
      "date": "2026-10-01",
      "color": "#2563eb",
      "places": [],
      "polylines": [],
      "layerItems": []
    }
  ]
}
```

문서에는 title, userId, createdAt 등의 컬럼 값을 중복 저장하지 않습니다. Repository가 조회 시 기존 Trip DTO로 합칩니다. `owner_user_id → Trip.userId`, `start_date → startDate`, `document.days → days`로 매핑하고 NULL 날짜는 기존 계약처럼 필드 생략으로 변환합니다. 날짜는 YYYY-MM-DD, 시각은 UTC ISO 문자열로 반환합니다.

DB는 JSON 최상위 형태만 검사합니다. 중첩 객체, 고유 ID, 장소 참조, layerItems 순서, 최대 크기 등은 별도의 저장용 Zod 스키마로 검증합니다. 현재 shared/schemas/trip.ts의 제약과 변환 로직을 무시해서는 안 됩니다. [R3]

처음에는 document 전체 GIN 인덱스를 만들지 않습니다. 조회는 소유자·회원·여행 ID 인덱스로 처리하고, JSON 조건 검색이 실제 필요할 때 대상 경로에 인덱스를 추가합니다. JSONB는 인덱싱이 가능하지만 이것이 관계·권한을 JSON에 넣을 이유는 아닙니다. [P1]

## 4. 두 가지 버전

**schema_version**은 저장된 JSON 구조의 버전입니다. **revision**은 저장 충돌 확인용 카운터입니다. 둘은 별개입니다.

저장 형식은 `StoredTripV1 → StoredTripV2 → 현재 형식`으로 변환합니다. 의미 변경, 이름 변경, 필수 필드 추가처럼 호환성이 깨질 때 문서 버전을 올립니다. 이전 버전도 올바르게 읽을 수 있는 선택 필드 추가는 규약에 따라 같은 버전에서 허용할 수 있습니다.

새 코드가 구버전을 읽고 변환하되, 지원하지 않는 미래 버전은 거부합니다. 구버전 앱이 새 필드를 버리고 덮어쓰게 두지 않습니다. 위험한 형식 전환 때는 구버전 writer를 중단하거나 최소 허용 writer 버전을 강제해야 합니다. lazy migration만으로 롤백·혼합 배포가 자동 해결되지는 않습니다.

현재 trip.ts에는 durationMinutes, 체류시간, layerItems 등의 preprocess가 있습니다. 특히 두 체류시간 필드를 맞추는 동작이 있어 기존 데이터를 어떤 의미로 해석할지 확인해야 합니다. 파일 이관 전 원본을 백업하고 변환 전후 차이를 검사합니다. 이미 최신인 데이터에 레거시 보정을 무조건 재적용하지 않도록 버전별 저장 스키마로 분리합니다. [R3]

users.settings도 같은 원칙으로 settings_schema_version을 관리합니다. 설정에 권한, 세션, 비밀키, 결제 상태를 넣지 않습니다.

## 5. 저장 충돌과 API 계약

초기 구현은 기존 API 본문을 유지하고 단일 여행 GET/POST/PUT 응답에 `ETag: "<revision>"`을 붙이는 방식을 권장합니다. PUT/DELETE에는 `If-Match`를 요구합니다. 프런트엔드 Repository가 Trip 본문과 revision을 함께 보관해야 합니다.

권한과 revision을 함께 조건으로 건 UPDATE만 성공으로 처리합니다. 첨부 SQL 끝에 owner-only 예시를 넣었습니다. 인증 실패는 401, 권한 없는 대상은 404, If-Match 누락은 428, 접근 가능한 대상의 오래된 revision은 412로 처리하도록 설계합니다. 실패 시 최신 revision만 끼워 넣고 오래된 본문을 자동 재저장하지 않습니다. 최신 내용을 다시 읽고 사용자 의도를 재적용해야 합니다.

users의 설정·프로필 변경도 동일한 조건부 갱신 패턴을 사용합니다. bigint revision은 JavaScript number로 무조건 변환하지 말고 문자열로 다루는 편이 안전합니다.

기존 TripRepository.save(userId, trip): Promise<void>는 생성·수정을 구분하거나 저장 옵션을 확장해야 합니다. create는 INSERT, update는 expected revision을 필수로 받는 조건부 UPDATE입니다. 저장 결과의 새로운 revision도 반환해야 합니다. 단순히 파일 Repository만 DB 구현으로 바꾸면 충돌 처리는 해결되지 않습니다. [R4]

공유를 켤 때는 Repository의 actorUserId와 Trip의 ownerUserId를 구분합니다. editor가 저장해도 소유권은 바뀌지 않습니다. owner만 공유 변경·소유권 이전·삭제를 허용하고, editor는 내용 편집만, viewer는 읽기만 허용하도록 제안합니다. 일반 TripInput에 ownerUserId나 role을 노출하지 않습니다.

엄격한 권한 철회가 필요하면 내용 저장과 회원 추가·권한 변경·삭제 모두 동일 여행 행을 FOR UPDATE로 잠근 뒤 권한을 확인하는 트랜잭션 규약을 사용합니다. 공유 테이블만 만들었다고 현재 코드에 공유 기능이 생기는 것은 아닙니다.

## 6. 로그인과 사용자 격리

현재 GoogleOAuthUser.id는 Google sub이고, 세션은 메모리 Map이며, 여행 API는 TRASOLVE_LOCAL_USER_ID를 사용합니다. 따라서 DB 도입의 필수 작업은 다음 연결입니다. [R1][R2][R5]

```text
검증된 Google 사용자 정보
→ (issuer, subject)로 auth_identities 조회
→ 내부 users.id 결정
→ auth_sessions에 세션 저장
→ 요청 쿠키에서 현재 사용자 결정
→ TripHttpService와 모든 사용자 데이터 API에서 권한 확인
```

최초 로그인 시 users와 auth_identities를 하나의 트랜잭션으로 만듭니다. 같은 외부 계정이 동시에 가입하면 UNIQUE 충돌 트랜잭션 전체를 롤백하고 기존 identity를 다시 조회합니다. 로그인마다 identity의 user_id를 새 계정으로 덮어쓰는 UPSERT는 금지합니다. 사용자 수정 이름·사진을 외부 프로필로 매번 강제로 덮어쓰지도 않습니다.

세션은 32바이트 난수의 base64url 문자열을 쿠키에 전달하고 SHA-256 해시만 DB에 저장하는 안입니다. expires_at, revoked_at, users.deleted_at을 조회마다 확인합니다. 로그아웃은 서버 세션 폐기와 쿠키 삭제를 함께 합니다. 운영 HTTPS에서 HttpOnly/Secure/SameSite 설정과 상태 변경 요청의 CSRF 방어를 적용합니다. OAuth 리다이렉트에 필요한 쿠키 동작도 함께 검증합니다. OWASP도 세션 저장소 보호와 서버측 세션 관리를 강조합니다. [P3]

서비스 로그인만 한다면 Google access/refresh token은 이 스키마에 저장하지 않습니다. 나중에 사용자 Google Drive 등에 접근해야 하면 별도의 암호화된 credential 저장소를 추가합니다.

인증되지 않은 요청을 local-user로 fallback하지 않습니다. local-user의 기존 여행은 소유자를 명시한 일회성 관리 이관으로 옮깁니다. 첫 로그인 사용자에게 전체 데이터를 자동 귀속시키지 않습니다.

GoogleOAuthHttpFlow 내부의 짧은 OAuth transaction/result 저장소는 여전히 메모리입니다. 로그인 세션만 DB로 옮겨도 멀티 인스턴스 OAuth가 완성되지는 않습니다. 다중 서버 운영 시 일회성 consume이 가능한 공유 transaction 저장소를 별도로 마련해야 합니다. [R2]

## 7. 기존 코드 적용 순서

1. 별도 DB와 최소 권한 런타임 계정을 준비하고 첨부 SQL을 migration runner로 적용합니다. migration 버전 기록·체크섬은 runner가 관리하며, 이미 적용한 SQL은 수정하지 않습니다.
2. AuthRepository/SessionRepository와 요청 기반 CurrentUserResolver를 구현하고 instances.ts에 주입합니다. GoogleOAuthHttpFlow의 세션 저장도 이 경계로 옮깁니다.
3. PostgresTripRepository를 구현합니다. 기존 여행 API의 소유자 필터를 유지하고 controller/HTTP/frontend에 조건부 저장 계약을 연결합니다.
4. 기존 파일을 백업한 뒤 소유자 매핑을 명시하여 이관합니다. 문자열 ID는 유지하고 저장 문서 버전을 부여합니다. 중복 ID, JSON 보정, 건수·내용 차이를 검사합니다.
5. 이관 중 기존 writer를 멈추거나 일관된 스냅샷을 보장합니다. 검증 후 DB로 전환하며 운영 중 파일과 DB를 독립적으로 이중 쓰기하지 않습니다.

확인할 항목: 서로 다른 계정 간 읽기·쓰기 격리, 재시작 후 세션, 로그아웃·만료·탈퇴 계정 차단, 동시 가입 중복 방지, 오래된 revision 거부, 구버전 JSON 변환, 삭제된 여행이 PUT으로 부활하지 않음, 백업 복구. 실제 프로젝트에서 lint/typecheck/build와 HTTP 시나리오를 실행해야 합니다.

## 8. 확장과 한계

언어·지도 설정·새 장소 속성은 JSON 스키마와 코드 변경으로 처리하는 것이 목표입니다. 다른 로그인 provider는 identity 행과 adapter로 추가합니다. 채팅 이력, 예약, 결제 등 수명·권한·조회 패턴이 다른 데이터는 나중에 별도 테이블로 추가합니다. 이들을 users.settings나 trips.document 안에 무제한 누적하지 않습니다.

공유가 잦은 실시간 편집, 큰 경로 geometry, 장소별 분석 수요가 커지면 측정 후 별도 저장 단위 또는 읽기 전용 검색 projection을 추가합니다. 모든 미래 요구를 JSON으로 흡수할 수 있다는 보장은 하지 않습니다.

deleted_at은 서비스상 삭제 표시일 뿐 개인정보의 실제 제거가 아닙니다. 실제 계정 제거 시 여행 소유권을 이전하거나 명시적으로 영구 삭제한 후 계정을 제거합니다. owner FK는 이를 실수로 자동 삭제하지 않도록 RESTRICT로 뒀습니다. 보관·정리·백업 만료 정책은 별도로 정해야 합니다.

DB 자격증명은 서버 전용입니다. 이 SQL에는 RLS 정책이나 애플리케이션 권한 검사 구현이 들어 있지 않습니다. DB를 프런트엔드에 직접 노출해서는 안 되며, 아래 원칙과 구현을 완료하기 전 사용자별 격리가 구현됐다고 판단하지 않습니다.

## 근거

[R1] backend/src/instances.ts — LocalFileTripRepository와 localUserId 주입:
https://github.com/egod1537/trasolve/blob/impl/backend/src/instances.ts

[R2] backend/src/googleOAuthHttp.ts, backend/src/auth/sessionStore.ts — OAuth/세션 흐름:
https://github.com/egod1537/trasolve/blob/impl/backend/src/googleOAuthHttp.ts
https://github.com/egod1537/trasolve/blob/impl/backend/src/auth/sessionStore.ts

[R3] shared/schemas/trip.ts — 실제 Trip 필드, validation, 레거시 보정:
https://github.com/egod1537/trasolve/blob/impl/shared/schemas/trip.ts

[R4] backend/src/trip/tripRepository.ts 및 docs/trip-maps.md — persistence 계약:
https://github.com/egod1537/trasolve/blob/impl/backend/src/trip/tripRepository.ts
https://github.com/egod1537/trasolve/blob/impl/docs/trip-maps.md

[R5] backend/src/googleOAuth.ts — sub → GoogleOAuthUser.id 변환:
https://github.com/egod1537/trasolve/blob/impl/backend/src/googleOAuth.ts

[P1] PostgreSQL JSON Types — JSONB·관계형 혼합, 문서 크기/행 잠금, 인덱스:
https://www.postgresql.org/docs/current/datatype-json.html

[P2] Google OpenID Connect — sub와 email 식별 특성:
https://developers.google.com/identity/openid-connect/openid-connect

[P3] OWASP Session Management Cheat Sheet:
https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
