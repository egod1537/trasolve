#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=deploy-lib.sh
source "$SCRIPT_DIR/deploy-lib.sh"
cd "$REPO_ROOT"

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s <branch>\n' "$0" >&2
  exit 2
fi

branch="$1"
LOG_BRANCH="$branch"
validate_branch "$branch"
slug="$(slug_for_branch "$branch")"
unit_dir="$DEPLOYMENTS_DIR/$slug"
route_file="$ROUTES_DIR/$slug.caddy"
project="jjs-$slug"

mkdir -p "$LOGS_DIR"
exec > >(tee -a "$LOGS_DIR/deploy-$slug.log") 2>&1
trap release_lock EXIT
acquire_lock "deploy-$slug"

[[ -d "$unit_dir" ]] || die "deployment state not found for branch: $branch"
recorded_branch="$(read_state "$unit_dir" branch)"
[[ "$recorded_branch" == "$branch" ]] || die "deployment belongs to a different branch: $recorded_branch"

commit="$(read_state "$unit_dir" commit 2>/dev/null || true)"
deployment_id="$(read_state "$unit_dir" deployment-id 2>/dev/null || true)"
environment="$(read_state "$unit_dir" environment 2>/dev/null || environment_for_branch "$branch" "$slug")"
hostname="$(read_state "$unit_dir" hostname 2>/dev/null || hostname_for_slug "$branch" "$slug")"
compose_env="$unit_dir/compose.env"

log "event=undeploy state=started commit=${commit:-unknown}"
if [[ -f "$compose_env" ]]; then
  docker compose --env-file "$compose_env" -p "$project" -f "$DEPLOY_COMPOSE" \
    down --remove-orphans
else
  log "event=docker-down result=skipped reason=compose-state-missing"
fi

route_backup="$(mktemp "$unit_dir/.route.XXXXXX")"
route_existed=false
if [[ -f "$route_file" ]]; then
  cp "$route_file" "$route_backup"
  rm "$route_file"
  route_existed=true
fi
if ! reload_caddy; then
  [[ "$route_existed" == false ]] || cp "$route_backup" "$route_file"
  reload_caddy || true
  if [[ -f "$compose_env" ]]; then
    docker compose --env-file "$compose_env" -p "$project" -f "$DEPLOY_COMPOSE" \
      up -d --no-build --wait --wait-timeout "$HEALTH_TIMEOUT" || true
  fi
  die "Caddy reload failed; route was restored"
fi
rm -f "$route_backup"
log "event=caddy-reload result=success"

if [[ -n "$deployment_id" ]] && github_token_available; then
  if github_deployment_status "$deployment_id" inactive "$environment" \
    "https://$hostname" "Deployment removed"; then
    log "event=github-deployment state=inactive id=$deployment_id result=success"
  else
    log "event=github-deployment state=inactive id=$deployment_id result=failed"
  fi
fi

if [[ -n "$commit" ]]; then
  worktree="$WORKTREES_DIR/$slug/$commit"
  [[ ! -d "$worktree" ]] || git worktree remove --force "$worktree" >/dev/null 2>&1 || true
fi
rm -rf "$unit_dir"
git worktree prune
log "event=undeploy state=success"
printf 'Undeployed %s. Named volumes and databases were not deleted.\n' "$branch"
