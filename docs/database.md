# PostgreSQL 개발 환경과 migration

Trasolve production backend는 PostgreSQL 16 이상을 사용하며 `DATABASE_URL`을
필수로 읽습니다. 연결 문자열과 자격증명은 backend 환경에만 두고 `VITE_`
환경변수로 전달하지 않습니다. `npm run dev`는 기본적으로
`TRASOLVE_PERSISTENCE_MODE=local`과 같은 동작을 하며 PostgreSQL에 사용자 정보를
쓰지 않습니다. 로컬 user/session/Trip은 `.local/trasolve`에 저장됩니다.

## 로컬 실행

Docker가 있는 환경에서는 repository root에서 전체 개발 stack을 실행할 수 있습니다.

```sh
cp compose.dev.env.example .env
docker compose -f compose.dev.yaml up --build
```

Windows PowerShell에서는 첫 명령 대신
`Copy-Item compose.dev.env.example .env`를 사용합니다. `.env`의 DB 이름, 사용자,
비밀번호 또는 port를 변경하면 `DATABASE_URL`도 같은 값에 맞춥니다. 연결 문자열은
compose 파일이나 application code에 하드코딩하지 않습니다.

기본 endpoint는 frontend `http://127.0.0.1:4173`, backend
`http://127.0.0.1:43127`, PostgreSQL `127.0.0.1:5432`입니다. PostgreSQL과
기존 file repository와 내부 job 데이터는 named volume에 남으므로 container 재시작
후에도 유지됩니다. Trip production source of truth는 PostgreSQL이며 file repository에는
dual-write하지 않습니다.

개발 compose도 기본값은 `TRASOLVE_PERSISTENCE_MODE=local`이므로 backend가 DB를
기다리거나 사용자 정보를 DB에 기록하지 않습니다. migration과 production repository를
확인할 때는 `.env`의 값을 `TRASOLVE_PERSISTENCE_MODE=postgres`로 변경합니다. 이 경우
PostgreSQL이 준비되기 전에 migration이 실패하면 compose의 restart policy가 backend를
재시도합니다.

host에서 backend를 debug 실행할 때는 PostgreSQL 설정이 필요하지 않습니다.
PostgreSQL 경로를 검증하려면 `backend/.env.example`을 `backend/.env.local`로
복사하고 `TRASOLVE_PERSISTENCE_MODE=postgres` 및 `DATABASE_URL`을 실제 로컬 DB에
맞게 설정합니다.

## Migration

backend 시작 시 HTTP listener를 열기 전에 migration이 자동으로 실행됩니다. 별도로
실행하려면 다음 명령을 사용합니다.

```sh
npm run db:migrate
```

배포 image 안에서는 `npm run db:migrate:production -w @trasolve/backend`를 사용할
수 있습니다. migration 파일은 `backend/migrations/NNN_name.sql`에 순서대로
추가합니다. 한번 적용된 파일은 수정하거나 이름을 바꾸지 않습니다. runner는
`public.trasolve_schema_migrations`에 version, filename, SHA-256 checksum과 적용
시각을 저장하고, 불일치가 있으면 backend 시작을 중단합니다. 각 파일과 metadata
기록은 하나의 transaction으로 적용되며 advisory lock으로 동시 실행을 직렬화합니다.

## 초기화와 backup

개발 DB 전체를 초기화하면 모든 개발 데이터가 삭제됩니다. 필요한 경우 먼저 backup을
만듭니다.

```sh
docker compose -f compose.dev.yaml exec -T postgres \
  pg_dump -U trasolve -d trasolve -Fc > trasolve.dump
docker compose -f compose.dev.yaml down -v
```

초기화 후 `up --build`를 다시 실행하면 fresh database에 migration이 순서대로
적용됩니다. dump 복구는 빈 DB에 대해 다음처럼 실행합니다.

```sh
docker compose -f compose.dev.yaml exec -T postgres \
  pg_restore -U trasolve -d trasolve --clean --if-exists < trasolve.dump
```

운영 backup/restore는 운영 DB 제공자의 snapshot 및 point-in-time recovery 정책을
우선합니다. schema 변경 전에는 DB backup과 복구 절차를 먼저 확인합니다.

## 사용자와 로그인 세션

Google 로그인은 검증된 issuer와 `sub` 조합으로 `auth_identities`를 찾습니다. 최초
로그인에서만 Google 이름과 사진으로 `users.display_name` 및 `avatar_url`을 만들고,
이후 로그인에서는 사용자가 변경할 수 있는 두 필드를 덮어쓰지 않습니다. 외부 email과
검증 여부, 마지막 로그인 시각만 identity 정보로 갱신합니다.

로그인 cookie에는 매 로그인마다 새로 생성한 32-byte random secret의 base64url 값이
들어갑니다. DB에는 UTF-8 cookie 문자열의 SHA-256 digest만 저장하며 secret이나 digest를
로그에 기록하지 않습니다. `/auth/me`는 만료·폐기 여부와 삭제된 사용자를 DB에서 함께
검사하므로 backend가 재시작되어도 유효한 세션은 유지됩니다.

Trip처럼 사용자별 데이터가 필요한 API는 공용 `CurrentUserResolver`로 같은 session
cookie를 해석합니다. 인증되지 않은 요청에는 401을 반환하며, 현재 owner-only Trip
repository는 actor의 저장 경로만 조회해 다른 사용자의 자원 존재 여부를 404로 숨깁니다.
요청 body/query나 환경변수의 user ID는 actor 결정에 사용하지 않습니다.

## Trip 저장

`trips`의 ownership, title, date, schema version, revision과 timestamp는 column에
저장하고, days/place/polyline/layerItems 등 편집 본문은 `document` JSONB에 저장합니다.
현재 문서 버전은 `StoredTripV1`이며 최상위에는 `days`만 허용합니다. 읽기와 쓰기 양쪽에서
중첩 ID, 참조, 순서까지 검증하고, 최신 문서에 legacy normalization이 다시 적용될 입력은
거부합니다.

update와 soft delete는 `id + owner_user_id + expected revision + deleted_at IS NULL`
조건을 모두 사용합니다. PostgreSQL trigger가 성공한 변경의 revision을 증가시키며 0-row
update는 성공으로 처리하지 않습니다. 기본 list/get은 soft-delete row를 반환하지 않습니다.

단일 Trip GET/POST/PUT 응답은 bigint revision을 `ETag: "<revision>"`으로 전달합니다.
PUT/DELETE는 동일한 strong ETag 형식의 `If-Match`를 요구하며 누락은 428, 접근 가능한
Trip의 stale revision은 412입니다. DELETE 성공 응답도 trigger가 증가시킨 revision을
ETag로 반환합니다. revision은 JavaScript number로 변환하지 않고 문자열로 유지합니다.

## Trip 공유 저장과 public read-only 조회

Trip 저장소와 공유 저장소는 composition root에서 하나의 persistence mode로 함께
선택합니다. 서로 다른 mode의 repository를 섞거나 dual-write하지 않습니다.

공유 domain의 `TripShare`는 `tripId`, `ownerUserId`, opaque `token`, `searchable`,
`createdAt`, `updatedAt`만 보유하며 Trip document 안에 포함하지 않습니다. Controller가
의존하는 `TripShareRepository` 계약은 `getByTrip`, `getByToken`, `enable`, `update`,
`disable`로 한정됩니다. local/PostgreSQL 구현체 선택과 무관하게 owner mutation과 public
token 조회는 동일한 controller/service 경로를 사용합니다.

| mode       | Trip repository           | Share repository               | 공유 저장 위치                  |
| ---------- | ------------------------- | ------------------------------ | ------------------------------- |
| `local`    | `LocalFileTripRepository` | `LocalFileTripShareRepository` | `<data-root>/shares/by-trip`, `<data-root>/shares/by-token` |
| `postgres` | `PostgresTripRepository`  | `PostgresTripShareRepository`  | `trasolve.trip_shares`          |

명시적인 `TRASOLVE_PERSISTENCE_MODE=local|postgres`가 항상 우선합니다. override가
없으면 `NODE_ENV=production`은 `postgres`, 그 외 환경은 `local`입니다. local 공유
저장소는 Trip 및 local auth와 동일한 `resolveBackendDataRoot()`를 사용하므로 별도 공유
경로 환경변수는 없습니다. 기본 data root는 `.local/trasolve`입니다.

PostgreSQL mode에서는 HTTP listener를 열기 전에 모든 migration을 적용합니다.
`002_trip_shares.sql`을 포함한 migration 하나라도 실패하면 database connection을 닫고
backend 시작을 중단합니다. `trip_shares.trip_id`는 `trips.id`를 `ON DELETE CASCADE`로
참조합니다. Trip soft delete는 row를 물리적으로 지우지 않지만 public 조회가 항상
`trips.deleted_at IS NULL`을 검사하므로 남은 공유 row로 삭제된 Trip을 읽을 수 없습니다.
local mode에서도 공유 token을 찾은 뒤 owner의 Trip 파일을 다시 조회하므로 Trip 파일이
삭제되면 public 요청은 404입니다.

공유 token lifecycle은 다음과 같습니다.

1. 공유가 꺼진 Trip의 owner settings는 `enabled=false`, `searchable=false`, `token=null`을
   반환합니다.
2. OFF에서 ON으로 전환할 때 새 UUID token을 발급합니다. backend에는 origin이나 완성된
   URL을 저장하지 않습니다.
3. ON 상태의 `searchable` 변경은 현재 token을 유지합니다.
4. OFF 요청은 local document와 `trip_shares`에서 해당 공유 record를 삭제합니다. 기존
   token은 즉시 404가 됩니다.
5. 다시 ON으로 전환하면 이전 token을 재사용하지 않고 새 token을 발급합니다.

같은 backend process에서 동일 Trip의 설정 변경은 owner/Trip 단위로 직렬화합니다.
PostgreSQL upsert도 충돌한 기존 row의 token을 덮어쓰지 않아 여러 backend instance에서
동시에 ON 요청이 들어와도 먼저 저장된 token을 유지합니다. token unique constraint
충돌은 다른 Trip의 token을 overwrite하지 않고 새 token으로 재시도합니다. local file의
read-modify-write와 atomic rename도 하나의 write queue에서 처리합니다. owner 설정은
`by-trip/<ownerUserId>/<tripId>.json`, public index는 `by-token/<token>.json`에 저장하며
모든 lookup에서 두 파일의 identity를 교차 검증합니다. 한쪽 파일이 없거나 값이 다르면
잘못된 공유를 허용하거나 자동 복구하지 않고 storage error로 처리합니다.

Owner API는 session actor로 ownership을 결정하며 request body는 `enabled`와
`searchable`만 허용합니다. 인증이 없으면 401, actor가 소유하지 않은 Trip은 404입니다.
public `GET /api/shared-trips/:token`은 로그인 없이 사용할 수 있지만, 비활성·잘못된 token과
soft-deleted Trip은 모두 404로 처리합니다. public endpoint의 GET 이외 method는 405이며
응답 owner summary에는 display name과 선택적 avatar만 포함하고 email은 포함하지 않습니다.
public frontend는 write repository 없이 `TripSession mode="readonly"`를 사용합니다. token,
완성된 공유 URL 및 owner email을 backend log에 기록하지 않습니다.

개발 환경에서는 owner 화면 `http://127.0.0.1:4173/map`에서 공유를 켠 뒤 생성된
`http://127.0.0.1:4173/share/<token>`을 로그아웃 브라우저에서 열어 확인합니다. backend를
재시작한 뒤에도 같은 URL이 열리는지, 공유를 끈 뒤에는 기존 URL이 404가 되는지 함께
확인합니다. production smoke도 동일하게 owner login, ON, incognito public viewer, OFF,
기존 URL 무효화 순서로 수행합니다.

## 기존 file Trip 이관

운영 runtime은 `PostgresTripRepository`만 사용하며 file repository와 dual-write하지
않습니다. debug의 local persistence와 별개로, 기존
`TRASOLVE_DATA_DIR/users/<legacy-owner>/trips/*.json`은 아래 일회성 도구로
명시적인 내부 사용자에게 이관합니다. 먼저 schema migration과 DB backup을 완료합니다.

```sh
npm run db:migrate
pg_dump "$DATABASE_URL" -Fc -f before-trip-migration.dump
```

destination owner는 추측하지 않습니다. 운영자가 로그인 완료된 사용자를 확인하고 정확한
`trasolve.users.id` UUID를 선택해야 합니다. email이나 첫 로그인 순서로 자동 연결하지 않습니다.

```sql
SELECT id, display_name, created_at
FROM trasolve.users
WHERE deleted_at IS NULL
ORDER BY created_at;
```

먼저 dry-run으로 source schema, owner, 기존 destination ID 충돌 및 normalization diff를
확인합니다. dry-run도 destination owner 존재와 DB 중복을 검사하므로 `DATABASE_URL`이
필요합니다.

```sh
npm run trip:migrate -- \
  --source-owner local-user \
  --destination-owner <internal-users-uuid> \
  --dry-run \
  --report ./backups/trip-migration-dry-run.json
```

실제 이관 중에는 backend를 중지해 legacy writer가 완전히 멈춘 상태를 확보합니다. 새
backup 경로를 지정하고 확인 flag를 함께 전달합니다.

```sh
npm run trip:migrate -- \
  --source-owner local-user \
  --destination-owner <internal-users-uuid> \
  --backup-dir ./backups/legacy-trips-YYYYMMDD-HHMMSS \
  --confirm-writer-stopped
```

`--source-root`를 생략하면 `TRASOLVE_DATA_DIR`, 그 값도 없으면 `.local/trasolve`를
사용합니다. 실제 실행은 source owner 전체를 먼저 backup하고 모든 파일의 SHA-256을
재검증한 뒤 그 snapshot만 읽습니다. backup 경로는 새 경로여야 하며 source data root
밖에 있어야 합니다. symlink는 거부합니다.

빌드된 production image에서는 동일한 option을 다음 command에 전달합니다.

```sh
npm run trip:migrate:production -w @trasolve/backend -- <options>
```

도구는 기존 Trip schema를 적용해 legacy 값을 normalize하고 `StoredTripV1`으로 변환한 뒤,
하나의 DB transaction에서 다음을 수행합니다.

- destination user 존재 및 삭제 여부 확인
- active/soft-deleted row를 포함한 동일 Trip ID 사전검사
- 기존 ID와 timestamp를 유지한 insert
- metadata column과 JSONB document 분리 및 schema version 설정
- 각 Trip 재조회 round-trip과 owner/count/revision 검증

동일 ID가 하나라도 있거나 source 파일 하나가 잘못되면 overwrite/skip하지 않고 전체 DB
transaction을 rollback합니다. 오류에는 source 파일과 가능한 경우 Trip ID가 포함됩니다.
기본 report는 backup의 `migration-report.json`이며 title/date/day/place/polyline/layerItems
수, duration/time field, normalization 전후 diff와 insert/검증 통계를 기록합니다. 원본과
backup은 자동 삭제하지 않습니다.

rollback은 먼저 backend를 중지한 뒤 DB provider snapshot 또는 위 `pg_dump`를
`pg_restore`하여 수행합니다. file snapshot을 복원해야 한다면 backup manifest의 SHA-256을
확인하고 `users/<legacy-owner>`를 원래 data root로 복사합니다. 이 작업은 PostgreSQL runtime
binding을 자동으로 file repository로 되돌리지 않으므로, application rollback과 DB restore를
같은 배포 절차에서 명시적으로 수행해야 합니다.

이관 후에는 backend 재시작과 session 유지, owner 접근, 다른 사용자 404, 두 client의 412,
soft-delete 후 update 404를 실제 환경에서 확인합니다.
