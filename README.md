# trasolve / JJS

Vite + TypeScript frontend, Node.js backend, shared API 계약을 유지하면서 Mac mini에서
branch별 Docker 배포를 수행하는 프로젝트입니다. GitHub Actions는 CD 실행기로 사용하지
않습니다. Mac mini가 `origin`의 remote branch를 polling하고 exact commit SHA를 직접
배포합니다.

## Architecture

Frontend는 `app`, `pages`, `map`, `api`, `shared`, `assets`로 구성합니다.
[소스 구조와 파일 이동 목록](docs/frontend-source-layout.md)을 참고하세요.

### TripMap persistence

`/map`은 backend에서 내 여행 목록을 불러오며 여행 생성·열기·제목/순서 저장·삭제를 지원합니다.
`TripMapHttpService → TripMapController → TripMapRepository`로 처리하고,
`instances.ts`에서 `LocalFileTripMapRepository`를 주입합니다. shared TripMap 계약을 사용하며
기본 저장 위치는 `backend/data/users/local-user/trips/<tripId>.json`입니다.
`TRASOLVE_DATA_DIR`와 `TRASOLVE_LOCAL_USER_ID`로 저장 루트와 임시 사용자를 설정합니다.
파일은 검증 후 임시 파일에 쓰고 rename하며 사용자 범위를 분리합니다. 실제 인증은 아직 없고
같은 서버의 클라이언트는 설정된 local user를 공유합니다.
배포는 branch별 named volume에 저장합니다. [API·저장소·PostgreSQL 교체 안내](docs/trip-maps.md)를 참고하세요.

### AI chat

`MapAiPanel → frontend/src/api/chat.ts → POST /api/chat → ChatService → ChatProvider`
경로로 채팅을 처리합니다. 공용 계약은 `shared/schemas/chat.ts`와 `shared/types/chat.ts`에 있습니다.

```json
{ "messages": [{ "role": "user", "content": "도쿄 일정 추천해줘" }] }
```

```json
{ "message": { "role": "assistant", "content": "주변 장소를 함께 묶으면 이동 시간을 줄일 수 있어요." } }
```

요청 메시지는 `user` 또는 `assistant`이며, 내용은 공백 제거 후 1~4000자입니다.
요청은 1~100개의 메시지와 최대 2MiB JSON 본문을 허용합니다. 응답 역할은 항상 `assistant`입니다.
오류는 기존 API와 같은 `{ error: { code, message } }` 형태이며, 400 `INVALID_CHAT_REQUEST`,
405 `METHOD_NOT_ALLOWED`, 413 `REQUEST_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`,
502 `CHAT_UNAVAILABLE`를 사용합니다. 응답은 JSON이고 `Cache-Control: no-store`를 설정합니다.

`backend/src/instances.ts`에서 `new RandomChatProvider()`를 `new ChatService(chatProvider)`에
주입하고 `API.Chat`으로 노출합니다. RandomChatProvider는 실제 개발 환경에서 동작하는
기본 provider로, 요청마다 0.5~3초의 무작위 지연 후 준비된 문장 중 하나를 무작위로 반환합니다.
대기는 비동기로 처리하며 실제 LLM 호출이나 일정 변경은 하지 않습니다.
`ChatService`는 HTTP 처리·검증·오류 정규화를 맡으며 provider 구현을 생성하지 않습니다.

향후 Ollama를 연결할 때는 `backend/src/ai/providers/ollamaChatProvider.ts`에서
`ChatProvider.chat(request): Promise<ChatResponse>`를 구현하고 `instances.ts`의 provider 생성만
교체합니다. frontend와 HTTP 계약은 그대로 사용합니다. 현재 provider 선택 환경변수는 없습니다.

패널의 환영 문구는 전송하지 않습니다. 실제 대화 중 최근 100개 메시지만 서버로 보내며
화면의 대화 이력은 유지합니다. 닫기·열기는 이력과 진행 중 요청을 유지하고, `/map`을 떠나
컴포넌트가 unmount되면 요청을 취소합니다. 오류가 나도 보낸 메시지와 입력 중인 초안은 유지됩니다.
지도·일정 상태는 요청에 포함하지 않으며 대화는 DB에 저장하지 않습니다.

assistant 응답은 `react-markdown`과 `remark-gfm`으로 렌더링하며 user 메시지는 일반
텍스트로 표시합니다. raw HTML은 `skipHtml`로 제외하고 외부 링크는 새 탭에서 안전하게 엽니다.
패널 헤더의 “Markdown으로 저장” 버튼은 실제 대화 전체를 브라우저 현지 날짜 기준
`trasolve-ai-chat-YYYY-MM-DD.md`로 다운로드합니다. 환영 문구·로딩·오류 표시는 제외하고,
응답 대기 중에도 이미 전송된 메시지를 저장할 수 있습니다. Markdown 생성과 다운로드는
`frontend/src/shared/utils/chatMarkdown.ts`에서 처리하며 backend 계약은 `content: string` 그대로입니다.
RandomChatProvider의 응답 두 개는 Markdown 일정 예시입니다.

### Google Maps

로컬 경로 조회는 `frontend → POST /api/routes → Google Routes API`를 사용합니다.
장소 조회는 `frontend → /api/google/maps/places/* → Google Places API (New)`를 사용합니다.
브라우저 키는 `frontend/.env.local`의 `VITE_GOOGLE_MAPS_API_KEY`에 설정하며
Maps JavaScript API 전용으로 HTTP referrer 제한을 적용합니다.
서버 키는 `backend/.env.local`의 `GOOGLE_ROUTES_API_KEY`와 `GOOGLE_PLACES_API_KEY`에
각각 설정한 뒤 `npm run dev`를 실행합니다. 각각 Routes API와 Places API (New)를
활성화하고 서버용 제한을 적용합니다. 배포 시에는 `~/.config/jjs/deploy.env`의
두 서버 키가 백엔드 컨테이너에만 전달되며 프런트엔드 빌드 인자로 사용되지 않습니다.
요청·응답 계약은 `shared/schemas/routes.ts`, `shared/schemas/places.ts`에 있으며, Google Maps 백엔드 구현은
`backend/src/google/maps/`에 모여 있습니다.

프런트엔드의 두 Google 연결 경로는 분리합니다.

- `src/api/health.ts`, `routes.ts`, `places.ts`는 Trasolve backend에만 HTTP 요청을
  보내며, 공용 스키마로 응답을 검증합니다. 경로 계산과 장소 조회는 서버가 담당합니다.
- `src/map/runtime/googleMaps.ts`는 브라우저 SDK 로딩·키·Map ID·인증 이벤트만 담당합니다.
  `createGoogleMapRuntime.ts`와 `src/map/adapters/Google*.ts`는 지도 생성,
  카메라·이벤트·투영·오버레이 렌더링과 해제를 담당합니다.
- `MapRuntime.objects`의 `MapObjectController`는 지도 객체의 생성·갱신·삭제를 담당합니다.
  `GoogleMapObjectController`가 native AdvancedMarkerElement와 Polyline을 지도에 바인딩합니다.
  frontend `TripMapController → TripMapStore → TripMapLayer`를 통해 handle setter를 호출합니다.
  Controller는 렌더링 객체를 모르며, Layer는 ID 기준으로 마커와 선을 동기화합니다.
  객체는 layer별 삭제와 반복 삭제를 지원하고 runtime dispose 시 정리됩니다.
  Polygon/Circle은 확장용 계약만 정의합니다. 자세한 사용법은 `frontend/README.md`에 있습니다.
- React 컴포넌트는 `src/map/adapters/MapRuntime.ts`의 계약과
  `src/map/types/mapTypes.ts`의 좌표·장소·경계·polyline 타입을 사용합니다.
  Google SDK 타입은 runtime/adapter 내부에서만 사용합니다.

`GoogleMap`은 runtime 생성 함수와 loader 설정을 사용하는 조립 지점입니다.
지도 provider를 교체할 때 renderer/adapter 구현과 이 조립 지점을 교체하며,
일정 도메인과 페이지의 지도 데이터 계약은 유지합니다.

```text
backend/src/google/maps/
├── routes.ts  # Routes: 요청 검증, Google API 호출·변환, HTTP 처리
├── places.ts  # Places: 자동완성·상세 조회, 검증·변환, HTTP 처리
└── errors.ts  # ApiError: 공통 API 오류
```

`backend/src/instances.ts`에서 환경 변수를 읽은 뒤 클래스 인스턴스를 한 번 생성합니다.
다른 백엔드 모듈은 이 파일에서 `API`만 import해서 사용합니다.
`API.Route`는 생성한 `Routes` 인스턴스를 직접 참조합니다.
공용 인스턴스는 Node.js 프로세스마다 하나이며, 서버 재시작 시 새로 생성됩니다.
`API.Place`는 같은 방식으로 생성한 `Places` 인스턴스이며 `searchAutocomplete`,
`getPlace`, `handleAutocomplete`, `handlePlace`를 제공합니다.
`instances.ts`에서 `new Routes(apiKey)` 한 번으로 경로 객체를 생성합니다.
`Routes`는 키와 타임아웃을 보관하며, 공개 메서드는 `queryRoutes`와 `handle`입니다.
JSON 읽기, Google 요청 생성·호출, 응답 변환은 private 메서드로 캡슐화합니다.
요청별 데이터는 메서드 내부에서만 관리합니다.

```ts
import { API } from './instances.js';

// HTTP 요청: API.Route.handle(request, response)
// 다른 백엔드 로직에서 경로 조회: API.Route.queryRoutes(request)
```

`queryRoutes(request: DirectionsRequest)`는 타입이 지정된 요청 객체를 받습니다.
HTTP JSON 입력은 `handle`에서 스키마로 검증한 뒤 전달합니다.
프런트엔드와 백엔드에서 공용 `DirectionsRequestBuilder`로 요청을 구성할 수도 있습니다.

```ts
import { DirectionsRequestBuilder, TravelMode } from '@trasolve/shared';
import { API } from './instances.js';

const request = new DirectionsRequestBuilder()
  .setOrigin({ type: 'address', address: '도쿄역' })
  .setDestination({ type: 'address', address: '신주쿠역' })
  .setTravelMode(TravelMode.TRANSIT)
  .setComputeAlternativeRoutes(false)
  .build();

const result = await API.Route.queryRoutes(request);
```

`setIntermediates(locations)`로 경유지를 설정하며, 빈 배열을 전달하면 제거합니다.
이동 수단은 문자열 대신 `TravelMode.DRIVING`, `TravelMode.WALKING`,
`TravelMode.BICYCLING`, `TravelMode.TRANSIT` enum 멤버를 사용합니다.
`build()`는 출발지·도착지 누락, 좌표 범위와 최대 25개의 경유지 제한을
공용 스키마로 검증하고, 잘못된 설정이면 `ZodError`를 던집니다.
반환 객체는 빌더 상태와 독립적입니다. 이동 수단을 생략하면 서버에서 자동차로 조회합니다.

대중교통도 `setIntermediates()`로 경유지를 지정할 수 있습니다.
[Google 대중교통 API](https://developers.google.com/maps/documentation/routes/transit-route)는
경유지를 직접 지원하지 않으므로, 서버에서 인접 지점 사이를 각각 조회합니다.
경유지가 N개이면 Google 요청은 N+1개이며, 전체 구간이 하나의 타임아웃을 공유합니다.
각 구간의 첫 번째 경로를 순서대로 연결하고 거리·소요 시간을 합산합니다.
어느 구간의 거리나 시간이 없으면 해당 합계도 `null`이며, 경로가 없는 구간이 있으면
전체 `routes`는 빈 배열입니다. API 호출 오류가 나면 전체 요청을 실패 처리합니다.
구간별 독립 조회이므로 시간표 연결·구간 사이 환승 대기·체류 시간을 반영하지 않으며,
`computeAlternativeRoutes`를 지정해도 전체 대체 경로는 생성하지 않습니다.
이 제한은 결과의 `warnings`에도 포함됩니다. 구간별 요청과 원본 응답은
`rawResponse.segments`에 순서대로 보관합니다.

`npm run lint`는 호출부의 Google Maps 구현 직접 import/re-export를 금지합니다.
`Routes` 생성용 import는 `instances.ts`에서 수행합니다.
구현 내부에서 `instances.ts`를 가져오는 것도 금지합니다.

### Places API

- `POST /api/google/maps/places/autocomplete`: JSON 본문 `{ "input": "Tokyo tower" }`.
  `languageCode`, `regionCode`, `sessionToken`, `locationBias: { lat, lng, radiusMeters }`는
  선택값입니다. 검색어는 공백 제거 후 2~1024자, 반경은 0~50000m를 허용합니다.
  응답은 `{ suggestions: [{ placeId, text, secondaryText }] }`입니다.
- `GET /api/google/maps/places/:placeId`: 선택적인 query parameter로 `languageCode`,
  `regionCode`, `sessionToken`을 받습니다. 응답은 `{ id, name, address?, location: { lat, lng } }`입니다.

언어와 지역의 기본값은 기존 지도 설정과 같은 `ko`, `JP`입니다. 지역 코드는 검색 국가를
제한하지 않습니다. 자동완성에는 Google의 place ID와 이름·보조 설명만 요청하고,
상세 조회에는 `id,displayName,formattedAddress,location`만 요청합니다.
Google 원본 응답은 서버에서 검증·변환하며, Google 오류 본문과 키는 클라이언트에 전달하지 않습니다.
모든 Places HTTP 응답은 `Cache-Control: no-store`를 사용합니다.
공식 형식은 [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/place-autocomplete)와
[Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)를 따릅니다.

오류 형식은 Routes와 같은 `{ error: { code, message } }`입니다.

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `INVALID_PLACE_REQUEST` | 잘못된 JSON·검색어·ID·옵션 또는 Google의 요청 거부 |
| 404 | `PLACE_NOT_FOUND` | Google 상세 조회에서 장소를 찾지 못함 |
| 405 | `METHOD_NOT_ALLOWED` | 잘못된 HTTP method (`Allow` 헤더 포함) |
| 413 | `REQUEST_TOO_LARGE` | JSON 본문이 16KB 초과 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 자동완성 요청의 Content-Type이 JSON이 아님 |
| 502 | `PLACES_UNAVAILABLE` | Google 권한·쿼터·연결 오류 또는 잘못된 응답 |
| 503 | `PLACES_NOT_CONFIGURED` | 서버 Places 키 미설정 |
| 504 | `PLACES_TIMEOUT` | Google 요청 제한 시간 초과 (기본 15초) |

수동 확인은 `/testbed/google-maps`에서 검색어 입력, 결과 클릭 또는 ↑/↓/Enter 선택,
지도 이동과 장소 정보 확인, 선택 장소를 경로의 출발지·도착지로 지정하는 순서로 진행합니다.
빠른 연속 입력, 상세 조회 중 새 입력, Escape, 입력창 포커스 이동, 한글 조합 입력도 확인합니다.
네트워크 패널에서 Places 데이터 요청 대상이 위 backend endpoint인지 확인합니다.
`/map`의 일정 검색은 기존의 비활성 placeholder이며 이번 이전의 대상이 아닙니다.

```text
developer: git push origin <branch>
                 |
                 v
GitHub <-- deployment/status reporting -- Mac mini polling watcher
                                            |
                                            v
Internet -> Cloudflare Tunnel -> Caddy -> jjs-<slug>-frontend:3000
                                     \----> jjs-<slug>-backend:3000
```

- `infra/edge`: 재부팅 후에도 `unless-stopped`로 살아나는 Caddy와 cloudflared
- `infra/deploy`: polling, exact-SHA 배포, 제거, GitHub reporting
- `infra/templates`: branch별 Compose와 Caddy route 템플릿
- `infra/docker`: application image 정의
- `frontend`, `backend`, `shared`: 기존 application 경계

외부에 Mac mini host port를 publish하지 않습니다. cloudflared, Caddy, 모든 branch
container는 external Docker network `jjs-edge`에서 이름으로 통신합니다.

## URL 및 이름 규칙

| Branch | Compose project | URL | GitHub environment |
| --- | --- | --- | --- |
| `main` | `jjs-main` | `https://jjs.mangagaki.net` | `production` |
| `w1` | `jjs-w1` | `https://w1-jjs.mangagaki.net` | `w1` |
| `feat-auth` | `jjs-feat-auth` | `https://feat-auth-jjs.mangagaki.net` | `feat-auth` |

이미 DNS/Docker-safe인 소문자 branch는 그대로 사용합니다. `/`, 대문자, 비 ASCII 문자,
길이 초과 또는 `main` 충돌이 있으면 정규화한 뒤 branch SHA-256의 앞 8자를 붙입니다.
따라서 서로 다른 branch가 같은 container/hostname을 공유하지 않습니다.

## Mac mini 최초 준비

필수 도구는 Git, Docker Desktop(Compose v2), Bash, Python 3, curl입니다. Docker Desktop의
`Start Docker Desktop when you sign in`을 켜고, Mac mini 사용자 로그인이 재부팅 후
복원되도록 운영 정책을 설정합니다. private repository라면 host의 SSH key 또는 GitHub
credential helper로 다음 명령이 비대화식으로 성공해야 합니다.

```sh
git ls-remote --heads origin
```

실제 설정과 state를 repository 밖에 만듭니다.

```sh
mkdir -p ~/.config/jjs/cloudflared ~/.local/state/jjs/routes
cp .env.example ~/.config/jjs/deploy.env
chmod 600 ~/.config/jjs/deploy.env
```

`~/.config/jjs/deploy.env`의 `/Users/you`를 Mac mini의 절대 경로로 바꾸고 GitHub token,
Cloudflare 파일 경로, `JJS_GOOGLE_MAPS_API_KEY`를 설정합니다.
`JJS_GOOGLE_MAPS_MAP_ID`는 별도 Map ID가 없을 때 `DEMO_MAP_ID`를 사용할 수 있습니다.
Google Maps 브라우저 키는 Maps JavaScript API와 실제 production/preview HTTP referrer로
제한합니다. 이 파일은 shell 문법으로 읽는 운영자 소유 파일이므로 신뢰할 수 있는 내용만
넣고 repository에 commit하지 않습니다.

## Cloudflare Tunnel

Cloudflare Pages나 공개 host port는 사용하지 않습니다. Tunnel credential을 새로 만들거나
기존 Tunnel에서 발급한 JSON을 다음처럼 둡니다.

```text
~/.config/jjs/cloudflared/
├── config.yml       # chmod 600 권장
└── credentials.json # chmod 600 필수
```

[`infra/edge/cloudflared/config.example.yml`](infra/edge/cloudflared/config.example.yml)을
host의 `config.yml`로 복사하고 tunnel UUID를 바꿉니다. container 안에서 credential은
항상 `/etc/cloudflared/credentials.json`이므로 host 절대 경로를 config 안에 쓰지 않습니다.

Cloudflare DNS/Public Hostname에는 다음 경로가 필요합니다.

- `jjs.mangagaki.net` → 해당 Tunnel
- preview를 위한 wildcard `*.mangagaki.net` → 해당 Tunnel
- Tunnel origin service → `http://caddy:80`

Cloudflare wildcard는 DNS label 전체를 대상으로 하므로 `*-jjs.mangagaki.net`만 선택하는
partial wildcard로 격리할 수 없습니다. 기존 exact DNS record는 wildcard보다 우선하지만,
zone-wide wildcard가 이미 다른 Tunnel 소유라면 그 Tunnel config에 JJS origin을 연결하거나
`JJS_AUTO_PROVISION_DNS=true`와 Tunnel UUID/origin cert를 설정해 deploy 시 branch의 exact
DNS record를 안전하게 생성할 수 있습니다. 기존 record는 강제로 덮어쓰지 않습니다.
저장소의 Caddy는 생성된 정확한 JJS hostname만 받고 나머지는 응답하지 않습니다.

설정 검증:

```sh
cloudflared --config ~/.config/jjs/cloudflared/config.yml tunnel ingress validate
```

Cloudflare edge가 TLS를 종료하고 cloudflared→Caddy는 private Docker network의 HTTP를
사용하므로 Origin CA key/certificate를 repository나 container에 넣지 않습니다.

## Edge infrastructure 시작

`deploy.env`를 현재 shell에 적용한 뒤 edge를 시작합니다.

```sh
set -a
. ~/.config/jjs/deploy.env
set +a

mkdir -p "$JJS_STATE_DIR/routes"
touch "$JJS_STATE_DIR/routes/_empty.caddy"
docker compose -p jjs-edge -f infra/edge/compose.yaml up -d
docker compose -p jjs-edge -f infra/edge/compose.yaml ps
docker compose -p jjs-edge -f infra/edge/compose.yaml logs --tail=100
```

`restart: unless-stopped`이므로 Docker daemon이 복구되면 Caddy와 cloudflared가 다시
시작됩니다. 처음에는 route가 없어 cloudflared origin 요청이 실패할 수 있으며 첫 배포가
route를 생성하면 정상화됩니다.

## 수동 배포와 제거

```sh
./infra/deploy/deploy.sh w1
./infra/deploy/deploy.sh w1 0123456789abcdef0123456789abcdef01234567
./infra/deploy/undeploy.sh w1
```

SHA를 생략하면 현재 `origin/<branch>` head를 resolve합니다. SHA를 주면 반드시 40자 full
SHA이고 현재 remote branch head와 일치해야 합니다. deploy script는 remote ref를 fetch한
뒤 detached worktree에서 이미지를 build합니다.

배포 순서:

1. branch/slug와 exact remote SHA 검증
2. GitHub Deployment 생성, `in_progress`, commit `pending`
3. detached worktree 준비, 배포 호스트의 Google Maps 설정 주입과 SHA-tagged
   frontend/backend image build
4. 독립 Compose project를 `--wait`로 기동하고 container health 확인
5. branch Caddy route를 atomic 교체하고 Caddy validate/reload
6. Caddy 경유 frontend 및 `/api/health` 확인
7. state 저장, GitHub Deployment와 commit status를 `success`로 전환

image build 실패 전에는 실행 중인 container를 건드리지 않습니다. 새 container 기동이나
route 검증이 실패하면 기존 state의 image로 best-effort rollback하고 GitHub에는 `failure`를
기록합니다. `undeploy.sh`는 container/network만 제거하며 volume이나 database를 삭제하지
않습니다.

## Pull-based auto deploy

```sh
./infra/deploy/auto-deploy.sh --install
./infra/deploy/auto-deploy.sh --status
./infra/deploy/auto-deploy.sh --once
./infra/deploy/auto-deploy.sh --uninstall
```

설치 명령은 기존 crontab을 보존하면서 태그가 붙은 항목 하나를 추가합니다. 매분
`git ls-remote --heads origin` 결과와 성공 배포 SHA를 비교하고 달라진 branch만
`deploy.sh <branch> <full-sha>`로 실행합니다. `JJS_AUTO_DEPLOY_MAIN=false`이면 production은
건너뜁니다. 실패한 같은 SHA는 기본 300초 후 재시도합니다. `mkdir` 기반 watcher lock과
branch별 lock으로 cron 중복 실행 및 같은 branch 동시 배포를 막습니다. 배포 인프라가 없는
legacy branch는 `JJS_AUTO_DEPLOY_EXCLUDED_BRANCHES=legacy,w0`처럼 정확한 branch 이름을
쉼표로 구분해 제외할 수 있습니다.

초기 구현은 삭제된 remote branch를 자동 제거하지 않습니다. 24시간 grace 정책을 자동화하기
전까지는 다음 명령으로 명시적으로 제거합니다.

```sh
./infra/deploy/undeploy.sh deleted-branch
```

## GitHub Deployment reporting

standalone client [`infra/deploy/github_deployment.py`](infra/deploy/github_deployment.py)는
Deployments API와 Commit Status API만 호출합니다. context는 branch별
`deploy/jjs/<slug>`이고 `environment_url`/`target_url`은 실제 HTTPS URL입니다.

Fine-grained personal access token은 대상 repository만 선택하고 다음 최소 권한을 줍니다.

- Contents: Read (private repository fetch credential로 함께 쓸 때)
- Deployments: Read and write
- Commit statuses: Read and write

`JJS_GITHUB_TOKEN`이 없으면 reporting을 명시적으로 skip하고 application 배포는 계속합니다.
별도 token 변수가 없어도 Mac mini의 `gh auth token`이 사용 가능하면 그 credential을
fallback으로 사용합니다.
API reporting 실패도 기본적으로 서비스 성공/rollback 여부에 영향을 주지 않습니다.
reporting 자체가 운영 필수라면 `JJS_GITHUB_REPORTING_REQUIRED=true`로 시작 reporting만
fail-closed로 만들 수 있습니다. 성공한 application의 마지막 success reporting 실패는
로그만 남기며 서비스를 rollback하지 않습니다.

client 직접 확인 예:

```sh
python3 infra/deploy/github_deployment.py \
  --repository egod1537/trasolve \
  status-commit \
  --commit 0123456789abcdef0123456789abcdef01234567 \
  --state pending \
  --context deploy/jjs/w1 \
  --target-url https://w1-jjs.mangagaki.net \
  --description "Deploying w1"
```

## Runtime state와 로그

기본 위치는 Git 밖의 `~/.local/state/jjs/`입니다.

```text
~/.local/state/jjs/
├── deployments/<slug>/{branch,commit,status,deployment-id,compose.env,...}
├── worktrees/<slug>/<commit>/
├── routes/<slug>.caddy
├── locks/
└── logs/{auto-deploy.log,deploy-main.log,deploy-w1.log,...}
```

확인 명령:

```sh
tail -f ~/.local/state/jjs/logs/auto-deploy.log
tail -f ~/.local/state/jjs/logs/deploy-w1.log
docker compose \
  --env-file ~/.local/state/jjs/deployments/w1/compose.env \
  -p jjs-w1 -f infra/templates/compose.deploy.yaml ps
docker logs --tail=100 jjs-w1-backend
docker logs --tail=100 jjs-edge-cloudflared
```

로그에는 UTC timestamp, branch, commit, build/up/health/Caddy 결과, GitHub deployment ID와
최종 상태가 기록됩니다. token이나 credential 내용은 출력하지 않습니다.

## 장애 확인과 재부팅 복구

1. `docker info`로 Docker Desktop이 실행 중인지 확인합니다.
2. edge `ps`/logs에서 Caddy와 cloudflared 상태를 확인합니다.
3. `cloudflared tunnel ingress validate`와 Dashboard의 Tunnel connection을 확인합니다.
4. `auto-deploy.sh --status`와 `git ls-remote --heads origin`으로 cron/Git 인증을 확인합니다.
5. branch container health와 `~/.local/state/jjs/logs/deploy-<slug>.log`를 확인합니다.
6. 필요하면 edge를 다시 `up -d`하고 `auto-deploy.sh --once`를 실행합니다.

재부팅 뒤 Docker가 자동 실행되면 existing edge/application container는
`unless-stopped`로 복구됩니다. cron은 다음 분에 remote SHA를 다시 비교합니다. macOS에서
사용자 crontab이 운영 정책상 실행되지 않는 환경이면 로그인 세션과 cron 권한을 먼저
복구해야 합니다.

## Local development

Node.js 24 이상에서:

```sh
npm install
npm run dev
npm run typecheck
npm run build
```

- frontend: `http://localhost:5173`
- backend: `http://127.0.0.1:3000/api/health`

frontend와 backend는 HTTP로만 통신하며 shared는 양쪽의 API 계약만 제공합니다.
