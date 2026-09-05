#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=deploy-lib.sh
source "$SCRIPT_DIR/deploy-lib.sh"
cd "$REPO_ROOT"

usage() {
  printf 'Usage: %s <branch> [full-commit-sha]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 && $# -le 2 ]] || usage

branch="$1"
requested_commit="${2:-}"
LOG_BRANCH="$branch"
validate_branch "$branch"

slug="$(slug_for_branch "$branch")"
hostname="$(hostname_for_slug "$branch" "$slug")"
environment="$(environment_for_branch "$branch" "$slug")"
deployment_url="https://$hostname"
status_context="deploy/jjs/$slug"
project="jjs-$slug"
unit_dir="$DEPLOYMENTS_DIR/$slug"
route_file="$ROUTES_DIR/$slug.caddy"
deployment_id=""
commit=""
previous_commit=""
previous_env="$unit_dir/compose.env"
next_env="$unit_dir/.compose.next.env"
worktree=""
app_update_attempted=false
route_changed=false
route_had_previous=false
route_backup=""

mkdir -p "$unit_dir" "$LOGS_DIR"
exec > >(tee -a "$LOGS_DIR/deploy-$slug.log") 2>&1

cleanup() {
  release_lock
}

rollback_application() {
  [[ "$app_update_attempted" == true ]] || return 0
  if [[ -f "$previous_env" && -n "$previous_commit" ]]; then
    log "event=rollback target=$previous_commit result=started"
    if docker compose --env-file "$previous_env" -p "$project" -f "$DEPLOY_COMPOSE" \
      up -d --no-build --wait --wait-timeout "$HEALTH_TIMEOUT"; then
      log "event=rollback target=$previous_commit result=success"
    else
      log "event=rollback target=$previous_commit result=failed"
    fi
  elif [[ -f "$next_env" ]]; then
    docker compose --env-file "$next_env" -p "$project" -f "$DEPLOY_COMPOSE" down \
      --remove-orphans >/dev/null 2>&1 || true
  fi
}

restore_route() {
  [[ "$route_changed" == true ]] || return 0
  if [[ "$route_had_previous" == true && -f "$route_backup" ]]; then
    cp "$route_backup" "$route_file"
  else
    rm -f "$route_file"
  fi
  reload_caddy || log "event=caddy-restore result=failed"
}

report_failure() {
  [[ -n "$commit" ]] || return 0
  if [[ -n "$deployment_id" ]]; then
    if github_deployment_status "$deployment_id" failure "$environment" \
      "$deployment_url" "Deployment failed"; then
      log "event=github-deployment state=failure id=$deployment_id result=success"
    else
      log "event=github-deployment state=failure id=$deployment_id result=failed"
    fi
  fi
  if github_token_available; then
    if github_commit_status "$commit" failure "$status_context" \
      "$deployment_url" "Deployment failed"; then
      log "event=github-commit-status state=failure result=success"
    else
      log "event=github-commit-status state=failure result=failed"
    fi
  fi
}

on_error() {
  local code="$1" line="$2"
  trap - ERR
  set +e
  log "event=deployment state=failure commit=${commit:-unknown} line=$line exit=$code"
  write_state "$unit_dir" status failure
  [[ -z "$commit" ]] || write_state "$unit_dir" failed-commit "$commit"
  restore_route
  rollback_application
  report_failure
  cleanup
  exit "$code"
}

trap cleanup EXIT

need_command git
need_command docker
need_command python3
need_command curl
acquire_lock "deploy-$slug"

if [[ -f "$unit_dir/branch" ]]; then
  recorded_branch="$(read_state "$unit_dir" branch)"
  [[ "$recorded_branch" == "$branch" ]] \
    || die "slug collision: $slug already belongs to branch $recorded_branch"
fi
write_state "$unit_dir" branch "$branch"

log "event=deployment state=started requested=${requested_commit:-remote-head}"
commit="$(resolve_remote_commit "$branch" "$requested_commit")"
previous_commit="$(read_state "$unit_dir" commit 2>/dev/null || true)"
previous_status="$(read_state "$unit_dir" status 2>/dev/null || true)"
log "event=commit-resolved commit=$commit"

if [[ "$previous_commit" == "$commit" && "$previous_status" == success ]]; then
  log "event=deployment state=unchanged commit=$commit"
  exit 0
fi

write_state "$unit_dir" target-commit "$commit"
write_state "$unit_dir" status deploying
trap 'on_error $? $LINENO' ERR

if github_token_available; then
  if deployment_id="$(github_create_deployment "$commit" "$environment" "$branch")"; then
    write_state "$unit_dir" deployment-id "$deployment_id"
    log "event=github-deployment state=created id=$deployment_id"
    if github_deployment_status "$deployment_id" in_progress "$environment" \
      "$deployment_url" "Deploying $branch"; then
      log "event=github-deployment state=in_progress id=$deployment_id result=success"
    else
      reporting_failure "deployment in_progress"
    fi
  else
    deployment_id=""
    reporting_failure "deployment create"
  fi
  if github_commit_status "$commit" pending "$status_context" \
    "$deployment_url" "Deploying $branch"; then
    log "event=github-commit-status state=pending result=success"
  else
    reporting_failure "commit pending"
  fi
else
  log "event=github-report result=skipped reason=token-not-configured"
  [[ "$GITHUB_REPORTING_REQUIRED" != true ]] || die "GitHub token is required"
fi

worktree="$WORKTREES_DIR/$slug/$commit"
prepare_worktree "$commit" "$worktree"
write_compose_env "$next_env" "$branch" "$slug" "$commit" "$worktree"
ensure_edge_network

log "event=docker-build commit=$commit result=started"
docker compose --env-file "$next_env" -p "$project" -f "$DEPLOY_COMPOSE" build --pull
log "event=docker-build commit=$commit result=success"

app_update_attempted=true
log "event=docker-up commit=$commit result=started"
docker compose --env-file "$next_env" -p "$project" -f "$DEPLOY_COMPOSE" \
  up -d --no-build --remove-orphans --wait --wait-timeout "$HEALTH_TIMEOUT"
log "event=health-check scope=containers result=success"

ensure_cloudflare_dns "$hostname"
log "event=cloudflare-dns hostname=$hostname result=success"

route_backup="$(mktemp "$unit_dir/.route.previous.XXXXXX")"
if [[ -f "$route_file" ]]; then
  cp "$route_file" "$route_backup"
  route_had_previous=true
fi
route_tmp="$(mktemp "$ROUTES_DIR/.${slug}.XXXXXX")"
render_route "$hostname" "$slug" "$route_tmp"
mv "$route_tmp" "$route_file"
route_changed=true

reload_caddy
log "event=caddy-reload result=success hostname=$hostname"
verify_routed_health "$hostname"
log "event=health-check scope=route result=success url=$deployment_url"

mv "$next_env" "$previous_env"
if [[ -z "$deployment_id" ]]; then
  rm -f "$unit_dir/deployment-id"
fi
write_state "$unit_dir" commit "$commit"
write_state "$unit_dir" hostname "$hostname"
write_state "$unit_dir" environment "$environment"
write_state "$unit_dir" deployed-at "$(timestamp)"
write_state "$unit_dir" status success
rm -f "$unit_dir/failed-commit" "$unit_dir/target-commit" "$route_backup"
route_changed=false
app_update_attempted=false

if [[ -n "$previous_commit" && "$previous_commit" != "$commit" ]]; then
  previous_worktree="$WORKTREES_DIR/$slug/$previous_commit"
  if [[ -d "$previous_worktree" ]]; then
    git worktree remove --force "$previous_worktree" >/dev/null 2>&1 || true
  fi
  docker image rm "jjs-$slug-backend:$previous_commit" \
    "jjs-$slug-frontend:$previous_commit" >/dev/null 2>&1 || true
fi
git worktree prune

if [[ -n "$deployment_id" ]]; then
  if github_deployment_status "$deployment_id" success "$environment" \
    "$deployment_url" "Deployment succeeded"; then
    log "event=github-deployment state=success id=$deployment_id result=success"
  else
    log "event=github-deployment state=success id=$deployment_id result=failed"
  fi
fi
if github_token_available; then
  if github_commit_status "$commit" success "$status_context" \
    "$deployment_url" "Deployment succeeded"; then
    log "event=github-commit-status state=success result=success"
  else
    log "event=github-commit-status state=success result=failed"
  fi
fi

log "event=deployment state=success commit=$commit url=$deployment_url"
printf 'Deployed %s (%s) to %s\n' "$branch" "$commit" "$deployment_url"
