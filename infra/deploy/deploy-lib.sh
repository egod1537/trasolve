#!/usr/bin/env bash

set -Eeuo pipefail

DEPLOY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "$DEPLOY_SCRIPT_DIR/../.." && pwd -P)"

JJS_DEPLOY_ENV_FILE="${JJS_DEPLOY_ENV_FILE:-${HOME:?HOME is required}/.config/jjs/deploy.env}"
if [[ -f "$JJS_DEPLOY_ENV_FILE" ]]; then
  # This is a trusted, operator-owned host configuration file.
  set -a
  # shellcheck disable=SC1090
  source "$JJS_DEPLOY_ENV_FILE"
  set +a
fi

STATE_ROOT="${JJS_STATE_DIR:-$HOME/.local/state/jjs}"
DEPLOYMENTS_DIR="$STATE_ROOT/deployments"
WORKTREES_DIR="$STATE_ROOT/worktrees"
ROUTES_DIR="$STATE_ROOT/routes"
LOCKS_DIR="$STATE_ROOT/locks"
LOGS_DIR="$STATE_ROOT/logs"

DOMAIN="${JJS_DOMAIN:-mangagaki.net}"
SERVICE_NAME="${JJS_SERVICE_NAME:-jjs}"
MAIN_BRANCH="${JJS_MAIN_BRANCH:-main}"
MAIN_HOSTNAME="${JJS_MAIN_HOSTNAME:-$SERVICE_NAME.$DOMAIN}"
GITHUB_REPOSITORY="${JJS_GITHUB_REPOSITORY:-egod1537/trasolve}"
GITHUB_REPORTING_REQUIRED="${JJS_GITHUB_REPORTING_REQUIRED:-false}"
HEALTH_TIMEOUT="${JJS_HEALTH_TIMEOUT_SEC:-120}"
EXTERNAL_HEALTHCHECK="${JJS_EXTERNAL_HEALTHCHECK:-false}"
CLOUDFLARED_CONFIG_PATH="${JJS_CLOUDFLARED_CONFIG_PATH:-}"
CLOUDFLARED_ORIGIN_CERT="${JJS_CLOUDFLARED_ORIGIN_CERT:-$HOME/.cloudflared/cert.pem}"
CLOUDFLARE_TUNNEL_ID="${JJS_CLOUDFLARE_TUNNEL_ID:-}"
AUTO_PROVISION_DNS="${JJS_AUTO_PROVISION_DNS:-false}"

EDGE_COMPOSE="$REPO_ROOT/infra/edge/compose.yaml"
DEPLOY_COMPOSE="$REPO_ROOT/infra/templates/compose.deploy.yaml"
ROUTE_TEMPLATE="$REPO_ROOT/infra/templates/branch.caddy.template"
GITHUB_HELPER="$REPO_ROOT/infra/deploy/github_deployment.py"

LOG_BRANCH="${LOG_BRANCH:--}"
DEPLOY_LOCK_DIR=""

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

log() {
  printf '%s branch=%s %s\n' "$(timestamp)" "$LOG_BRANCH" "$*"
}

die() {
  log "level=error message=$*" >&2
  return 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

init_state() {
  mkdir -p "$DEPLOYMENTS_DIR" "$WORKTREES_DIR" "$ROUTES_DIR" "$LOCKS_DIR" "$LOGS_DIR"
  if [[ ! -e "$ROUTES_DIR/_empty.caddy" ]]; then
    printf '# Keeps the Caddy import valid before the first deployment.\n' >"$ROUTES_DIR/_empty.caddy"
  fi
}

validate_config() {
  [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])$ && "$DOMAIN" == *.* ]] \
    || die "invalid JJS_DOMAIN: $DOMAIN"
  [[ "$SERVICE_NAME" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] \
    || die "invalid JJS_SERVICE_NAME: $SERVICE_NAME"
  [[ "$MAIN_HOSTNAME" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])$ ]] \
    || die "invalid JJS_MAIN_HOSTNAME: $MAIN_HOSTNAME"
  [[ "$HEALTH_TIMEOUT" =~ ^[0-9]+$ && "$HEALTH_TIMEOUT" -gt 0 ]] \
    || die "JJS_HEALTH_TIMEOUT_SEC must be a positive integer"
  [[ "$GITHUB_REPORTING_REQUIRED" == true || "$GITHUB_REPORTING_REQUIRED" == false ]] \
    || die "JJS_GITHUB_REPORTING_REQUIRED must be true or false"
  [[ "$EXTERNAL_HEALTHCHECK" == true || "$EXTERNAL_HEALTHCHECK" == false ]] \
    || die "JJS_EXTERNAL_HEALTHCHECK must be true or false"
  [[ "$AUTO_PROVISION_DNS" == true || "$AUTO_PROVISION_DNS" == false ]] \
    || die "JJS_AUTO_PROVISION_DNS must be true or false"
  if [[ "$AUTO_PROVISION_DNS" == true ]]; then
    [[ "$CLOUDFLARE_TUNNEL_ID" =~ ^[0-9a-fA-F-]{36}$ ]] \
      || die "JJS_CLOUDFLARE_TUNNEL_ID must be a tunnel UUID"
    [[ -r "$CLOUDFLARED_CONFIG_PATH" ]] \
      || die "JJS_CLOUDFLARED_CONFIG_PATH must be readable for DNS provisioning"
    [[ -r "$CLOUDFLARED_ORIGIN_CERT" ]] \
      || die "JJS_CLOUDFLARED_ORIGIN_CERT must be readable for DNS provisioning"
  fi
  [[ "$GITHUB_REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
    || die "JJS_GITHUB_REPOSITORY must use owner/name format"
}

validate_branch() {
  local branch="$1"
  [[ -n "$branch" ]] || die "branch is required"
  git check-ref-format --branch "$branch" >/dev/null 2>&1 \
    || die "invalid git branch name: $branch"
}

slug_for_branch() {
  python3 - "$1" "$MAIN_BRANCH" <<'PY'
import hashlib
import re
import sys

branch, main = sys.argv[1:]
if branch == main:
    print("main")
    raise SystemExit

normalized = re.sub(r"[^a-z0-9-]+", "-", branch.lower())
normalized = re.sub(r"-+", "-", normalized).strip("-")
changed = normalized != branch
if not normalized:
    normalized = "branch"
    changed = True
if len(normalized) > 48:
    normalized = normalized[:48].rstrip("-")
    changed = True
if normalized == "main":
    changed = True
if changed:
    digest = hashlib.sha256(branch.encode("utf-8")).hexdigest()[:8]
    normalized = f"{normalized[:39].rstrip('-')}-{digest}"
print(normalized)
PY
}

hostname_for_slug() {
  local branch="$1" slug="$2"
  if [[ "$branch" == "$MAIN_BRANCH" ]]; then
    printf '%s\n' "$MAIN_HOSTNAME"
  else
    printf '%s-%s.%s\n' "$slug" "$SERVICE_NAME" "$DOMAIN"
  fi
}

environment_for_branch() {
  if [[ "$1" == "$MAIN_BRANCH" ]]; then
    printf 'production\n'
  else
    printf '%s\n' "$2"
  fi
}

acquire_lock() {
  local name="$1" pid=""
  DEPLOY_LOCK_DIR="$LOCKS_DIR/$name.lock"
  if mkdir "$DEPLOY_LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" >"$DEPLOY_LOCK_DIR/pid"
    return 0
  fi
  if [[ -r "$DEPLOY_LOCK_DIR/pid" ]]; then
    pid="$(sed -n '1p' "$DEPLOY_LOCK_DIR/pid")"
  fi
  if [[ "$pid" =~ ^[0-9]+$ ]] && ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$DEPLOY_LOCK_DIR/pid"
    rmdir "$DEPLOY_LOCK_DIR" 2>/dev/null || true
    mkdir "$DEPLOY_LOCK_DIR" || die "could not replace stale lock: $name"
    printf '%s\n' "$$" >"$DEPLOY_LOCK_DIR/pid"
    return 0
  fi
  die "another operation holds lock: $name${pid:+ (pid $pid)}"
}

release_lock() {
  if [[ -n "$DEPLOY_LOCK_DIR" && -d "$DEPLOY_LOCK_DIR" ]]; then
    rm -f "$DEPLOY_LOCK_DIR/pid"
    rmdir "$DEPLOY_LOCK_DIR" 2>/dev/null || true
  fi
  DEPLOY_LOCK_DIR=""
}

read_state() {
  local unit_dir="$1" key="$2"
  [[ -f "$unit_dir/$key" ]] || return 1
  sed -n '1p' "$unit_dir/$key"
}

write_state() {
  local unit_dir="$1" key="$2" value="$3" tmp
  mkdir -p "$unit_dir"
  tmp="$(mktemp "$unit_dir/.${key}.XXXXXX")"
  printf '%s\n' "$value" >"$tmp"
  mv "$tmp" "$unit_dir/$key"
}

resolve_remote_commit() {
  local branch="$1" requested="${2:-}" remote_ref="refs/remotes/origin/$branch" resolved
  git fetch --no-tags origin "+refs/heads/$branch:$remote_ref" >/dev/null
  resolved="$(git rev-parse --verify "$remote_ref^{commit}")"
  [[ "$resolved" =~ ^[0-9a-f]{40}$ ]] || die "could not resolve full commit SHA for origin/$branch"
  if [[ -n "$requested" ]]; then
    requested="$(printf '%s' "$requested" | tr '[:upper:]' '[:lower:]')"
    [[ "$requested" =~ ^[0-9a-f]{40}$ ]] || die "commit must be a full 40-character SHA"
    [[ "$requested" == "$resolved" ]] \
      || die "requested commit is not the current origin/$branch head (requested=$requested remote=$resolved)"
  fi
  printf '%s\n' "$resolved"
}

prepare_worktree() {
  local commit="$1" path="$2"
  if [[ -d "$path" ]]; then
    [[ "$(git -C "$path" rev-parse HEAD 2>/dev/null || true)" == "$commit" ]] \
      || die "existing worktree does not match $commit: $path"
    return 0
  fi
  mkdir -p "$(dirname "$path")"
  git worktree add --detach "$path" "$commit" >/dev/null
}

write_compose_env() {
  local path="$1" branch="$2" slug="$3" commit="$4" worktree="$5"
  {
    # Compose env-file syntax has interpolation characters that valid Git refs
    # may contain. The full branch is already preserved in runtime state.
    printf 'JJS_BRANCH=%s\n' "$slug"
    printf 'JJS_BRANCH_SLUG=%s\n' "$slug"
    printf 'JJS_COMMIT_SHA=%s\n' "$commit"
    printf 'JJS_WORKTREE=%s\n' "$worktree"
    printf 'JJS_BACKEND_IMAGE=jjs-%s-backend:%s\n' "$slug" "$commit"
    printf 'JJS_FRONTEND_IMAGE=jjs-%s-frontend:%s\n' "$slug" "$commit"
  } >"$path"
}

ensure_edge_network() {
  docker network inspect jjs-edge >/dev/null 2>&1 \
    || die "Docker network jjs-edge is missing; start infra/edge first"
}

edge_compose() {
  JJS_STATE_DIR="$STATE_ROOT" docker compose -p jjs-edge -f "$EDGE_COMPOSE" "$@"
}

reload_caddy() {
  edge_compose exec -T caddy caddy validate --config /etc/caddy/jjs-edge/Caddyfile --adapter caddyfile >/dev/null
  edge_compose exec -T caddy caddy reload --config /etc/caddy/jjs-edge/Caddyfile --adapter caddyfile >/dev/null
}

render_route() {
  local hostname="$1" slug="$2" output="$3"
  sed -e "s/__HOSTNAME__/$hostname/g" -e "s/__SLUG__/$slug/g" \
    "$ROUTE_TEMPLATE" >"$output"
}

verify_routed_health() {
  local hostname="$1"
  edge_compose exec -T caddy wget -q -O /dev/null \
    --header="Host: $hostname" http://127.0.0.1/api/health
  edge_compose exec -T caddy wget -q -O /dev/null \
    --header="Host: $hostname" http://127.0.0.1/
  if [[ "$EXTERNAL_HEALTHCHECK" == true ]]; then
    curl --fail --silent --show-error --max-time 20 "https://$hostname/api/health" >/dev/null
    curl --fail --silent --show-error --max-time 20 "https://$hostname/" >/dev/null
  fi
}

ensure_cloudflare_dns() {
  local hostname="$1"
  [[ "$AUTO_PROVISION_DNS" == true ]] || return 0
  need_command cloudflared
  cloudflared --config "$CLOUDFLARED_CONFIG_PATH" \
    --origincert "$CLOUDFLARED_ORIGIN_CERT" tunnel route dns \
    "$CLOUDFLARE_TUNNEL_ID" "$hostname"
}

github_auth_token() {
  if [[ -n "${JJS_GITHUB_TOKEN:-}" ]]; then
    printf '%s\n' "$JJS_GITHUB_TOKEN"
  elif [[ -n "${GITHUB_TOKEN:-}" ]]; then
    printf '%s\n' "$GITHUB_TOKEN"
  elif command -v gh >/dev/null 2>&1; then
    gh auth token 2>/dev/null
  else
    return 1
  fi
}

github_token_available() {
  [[ -n "$(github_auth_token 2>/dev/null || true)" ]]
}

github_command() {
  local token
  token="$(github_auth_token)" || return 2
  JJS_GITHUB_TOKEN="$token" \
    python3 "$GITHUB_HELPER" --repository "$GITHUB_REPOSITORY" "$@"
}

github_create_deployment() {
  local commit="$1" environment="$2" branch="$3"
  github_token_available || return 2
  if [[ "$environment" == production ]]; then
    github_command create --commit "$commit" --environment "$environment" \
      --description "Deploy $branch" --production-environment
  else
    github_command create --commit "$commit" --environment "$environment" \
      --description "Deploy $branch"
  fi
}

github_deployment_status() {
  local id="$1" state="$2" environment="$3" url="$4" description="$5"
  github_token_available || return 2
  github_command status --deployment-id "$id" --state "$state" \
    --environment "$environment" --environment-url "$url" --description "$description"
}

github_commit_status() {
  local commit="$1" state="$2" context="$3" url="$4" description="$5"
  github_token_available || return 2
  github_command status-commit --commit "$commit" --state "$state" \
    --context "$context" --target-url "$url" --description "$description"
}

reporting_failure() {
  local action="$1"
  log "event=github-report result=failed action=$action"
  [[ "$GITHUB_REPORTING_REQUIRED" != true ]] \
    || die "GitHub reporting is required and failed: $action"
}

init_state
validate_config
