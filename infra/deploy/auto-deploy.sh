#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=deploy-lib.sh
source "$SCRIPT_DIR/deploy-lib.sh"
cd "$REPO_ROOT"

CRON_TAG="# jjs-auto-deploy"
AUTO_LOG="$LOGS_DIR/auto-deploy.log"
AUTO_DEPLOY_MAIN="${JJS_AUTO_DEPLOY_MAIN:-true}"
RETRY_SECONDS="${JJS_AUTO_DEPLOY_RETRY_SEC:-300}"
EXCLUDED_BRANCHES="${JJS_AUTO_DEPLOY_EXCLUDED_BRANCHES:-}"

branch_is_excluded() {
  case ",$EXCLUDED_BRANCHES," in
    *",$1,"*) return 0 ;;
    *) return 1 ;;
  esac
}

validate_auto_config() {
  [[ "$AUTO_DEPLOY_MAIN" == true || "$AUTO_DEPLOY_MAIN" == false ]] \
    || die "JJS_AUTO_DEPLOY_MAIN must be true or false"
  [[ "$RETRY_SECONDS" =~ ^[0-9]+$ ]] \
    || die "JJS_AUTO_DEPLOY_RETRY_SEC must be a non-negative integer"
}

run_once() {
  local heads_file branch ref sha slug unit_dir deployed status attempted attempted_at now
  LOG_BRANCH=watcher
  validate_auto_config
  need_command git
  need_command python3
  mkdir -p "$LOGS_DIR"
  exec > >(tee -a "$AUTO_LOG") 2>&1

  acquire_lock auto-deploy
  heads_file="$(mktemp "${TMPDIR:-/tmp}/jjs-heads.XXXXXX")"
  trap 'rm -f "$heads_file"; release_lock' EXIT

  log "event=poll state=started"
  git ls-remote --heads origin >"$heads_file"
  now="$(date +%s)"
  while IFS=$'\t' read -r sha ref; do
    [[ "$ref" == refs/heads/* ]] || continue
    [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || continue
    branch="${ref#refs/heads/}"
    if branch_is_excluded "$branch"; then
      continue
    fi
    if [[ "$branch" == "$MAIN_BRANCH" && "$AUTO_DEPLOY_MAIN" != true ]]; then
      continue
    fi

    validate_branch "$branch"
    slug="$(slug_for_branch "$branch")"
    unit_dir="$DEPLOYMENTS_DIR/$slug"
    deployed="$(read_state "$unit_dir" commit 2>/dev/null || true)"
    status="$(read_state "$unit_dir" status 2>/dev/null || true)"
    [[ "$deployed" != "$sha" || "$status" != success ]] || continue

    attempted="$(read_state "$unit_dir" auto-attempted-commit 2>/dev/null || true)"
    attempted_at="$(read_state "$unit_dir" auto-attempted-at 2>/dev/null || true)"
    if [[ "$attempted" == "$sha" && "$attempted_at" =~ ^[0-9]+$ ]] \
      && (( now - attempted_at < RETRY_SECONDS )); then
      continue
    fi

    LOG_BRANCH="$branch"
    log "event=change-detected commit=$sha"
    mkdir -p "$unit_dir"
    write_state "$unit_dir" auto-attempted-commit "$sha"
    write_state "$unit_dir" auto-attempted-at "$now"
    if "$SCRIPT_DIR/deploy.sh" "$branch" "$sha"; then
      rm -f "$unit_dir/auto-attempted-commit" "$unit_dir/auto-attempted-at"
      log "event=auto-deploy commit=$sha result=success"
    else
      log "event=auto-deploy commit=$sha result=failed retry-after=${RETRY_SECONDS}s"
    fi
  done <"$heads_file"

  LOG_BRANCH=watcher
  log "event=poll state=complete"
  rm -f "$heads_file"
  release_lock
  trap - EXIT
}

install_watcher() {
  local current next script_q env_q line
  validate_auto_config
  need_command crontab
  printf -v script_q '%q' "$SCRIPT_DIR/auto-deploy.sh"
  printf -v env_q '%q' "$JJS_DEPLOY_ENV_FILE"
  current="$(mktemp "${TMPDIR:-/tmp}/jjs-crontab.current.XXXXXX")"
  next="$(mktemp "${TMPDIR:-/tmp}/jjs-crontab.next.XXXXXX")"
  trap 'rm -f "$current" "$next"' EXIT
  crontab -l >"$current" 2>/dev/null || true
  grep -Fv "$CRON_TAG" "$current" >"$next" || true
  line="* * * * * HOME=$HOME PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin JJS_DEPLOY_ENV_FILE=$env_q /bin/bash $script_q --once $CRON_TAG"
  printf '%s\n' "$line" >>"$next"
  crontab "$next"
  rm -f "$current" "$next"
  trap - EXIT
  printf 'JJS auto-deploy installed (every minute, main=%s).\n' "$AUTO_DEPLOY_MAIN"
  printf 'Log: %s\n' "$AUTO_LOG"
}

show_status() {
  local entry
  entry="$(crontab -l 2>/dev/null | grep -F "$CRON_TAG" || true)"
  if [[ -z "$entry" ]]; then
    printf 'JJS auto-deploy is not installed.\n'
    return 1
  fi
  printf 'JJS auto-deploy: installed (every minute)\n'
  printf 'Automatic main deployment: %s\n' "$AUTO_DEPLOY_MAIN"
  printf 'GitHub reporting token: '
  if github_token_available; then printf 'configured\n'; else printf 'not configured\n'; fi
  printf 'State: %s\nLog: %s\n' "$STATE_ROOT" "$AUTO_LOG"
  if [[ -f "$AUTO_LOG" ]]; then
    printf '\nRecent activity:\n'
    tail -n 20 "$AUTO_LOG"
  fi
}

uninstall_watcher() {
  local current next
  need_command crontab
  current="$(mktemp "${TMPDIR:-/tmp}/jjs-crontab.current.XXXXXX")"
  next="$(mktemp "${TMPDIR:-/tmp}/jjs-crontab.next.XXXXXX")"
  trap 'rm -f "$current" "$next"' EXIT
  crontab -l >"$current" 2>/dev/null || true
  grep -Fv "$CRON_TAG" "$current" >"$next" || true
  crontab "$next"
  rm -f "$current" "$next"
  trap - EXIT
  printf 'JJS auto-deploy removed. Existing deployments remain running.\n'
}

case "${1:-}" in
  --once)
    [[ $# -eq 1 ]] || exit 2
    run_once
    ;;
  --install)
    [[ $# -eq 1 ]] || exit 2
    install_watcher
    ;;
  --status)
    [[ $# -eq 1 ]] || exit 2
    show_status
    ;;
  --uninstall)
    [[ $# -eq 1 ]] || exit 2
    uninstall_watcher
    ;;
  *)
    printf 'Usage: %s --install|--status|--once|--uninstall\n' "$0" >&2
    exit 2
    ;;
esac
