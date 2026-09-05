# trasolve / JJS

Vite + TypeScript frontend, Node.js backend, shared API 계약을 유지하면서 Mac mini에서
branch별 Docker 배포를 수행하는 프로젝트입니다. GitHub Actions는 CD 실행기로 사용하지
않습니다. Mac mini가 `origin`의 remote branch를 polling하고 exact commit SHA를 직접
배포합니다.

## Architecture

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
