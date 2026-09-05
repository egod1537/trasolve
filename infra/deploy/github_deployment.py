#!/usr/bin/env python3
"""Small GitHub Deployments and Commit Status API client for JJS."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any


DEFAULT_API_URL = "https://api.github.com"
DEFAULT_API_VERSION = "2022-11-28"
REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
COMMIT_PATTERN = re.compile(r"^[0-9a-fA-F]{40}$")
DEPLOYMENT_STATES = ("in_progress", "success", "failure", "inactive")
COMMIT_STATES = ("pending", "success", "failure", "error")


class GitHubApiError(RuntimeError):
    """A sanitized API failure safe to write to deployment logs."""


def create_deployment_payload(
    commit: str,
    environment: str,
    description: str,
    production_environment: bool,
) -> dict[str, Any]:
    return {
        "ref": commit,
        "task": "deploy",
        "auto_merge": False,
        "required_contexts": [],
        "environment": environment,
        "description": description[:140],
        "transient_environment": not production_environment,
        "production_environment": production_environment,
    }


def deployment_status_payload(
    state: str,
    environment: str,
    description: str,
    environment_url: str | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "state": state,
        "environment": environment,
        "description": description[:140],
        "auto_inactive": state == "success",
    }
    if environment_url:
        payload["environment_url"] = environment_url
    return payload


def commit_status_payload(
    state: str,
    context: str,
    description: str,
    target_url: str | None,
) -> dict[str, Any]:
    if not 1 <= len(context) <= 100:
        raise ValueError("commit status context must contain 1-100 characters")
    payload: dict[str, Any] = {
        "state": state,
        "context": context,
        "description": description[:140],
    }
    if target_url:
        payload["target_url"] = target_url
    return payload


def _http_error_message(error: urllib.error.HTTPError) -> str:
    message = ""
    try:
        body = json.loads(error.read().decode("utf-8", errors="replace"))
        if isinstance(body, dict) and isinstance(body.get("message"), str):
            message = " ".join(body["message"].split())[:200]
    except (json.JSONDecodeError, OSError):
        pass
    return f"GitHub API returned HTTP {error.code}" + (f": {message}" if message else "")


def api_request(
    method: str,
    path: str,
    payload: dict[str, Any] | None,
    *,
    token: str,
    api_url: str,
    api_version: str,
) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}{path}",
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "jjs-deployment-reporter",
            "X-GitHub-Api-Version": api_version,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise GitHubApiError(_http_error_message(error)) from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        reason = " ".join(str(getattr(error, "reason", error)).split())[:200]
        raise GitHubApiError(f"GitHub API request failed: {reason}") from error
    except json.JSONDecodeError as error:
        raise GitHubApiError("GitHub API returned invalid JSON") from error
    if not isinstance(result, dict):
        raise GitHubApiError("GitHub API returned an unexpected response")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--api-url", default=os.getenv("JJS_GITHUB_API_URL", DEFAULT_API_URL))
    parser.add_argument("--api-version", default=os.getenv("JJS_GITHUB_API_VERSION", DEFAULT_API_VERSION))
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create")
    create.add_argument("--commit", required=True)
    create.add_argument("--environment", required=True)
    create.add_argument("--description", required=True)
    create.add_argument("--production-environment", action="store_true")

    status = commands.add_parser("status")
    status.add_argument("--deployment-id", required=True, type=int)
    status.add_argument("--state", required=True, choices=DEPLOYMENT_STATES)
    status.add_argument("--environment", required=True)
    status.add_argument("--environment-url")
    status.add_argument("--description", required=True)

    commit = commands.add_parser("status-commit")
    commit.add_argument("--commit", required=True)
    commit.add_argument("--state", required=True, choices=COMMIT_STATES)
    commit.add_argument("--context", required=True)
    commit.add_argument("--target-url")
    commit.add_argument("--description", required=True)

    verify = commands.add_parser("verify-status")
    verify.add_argument("--commit", required=True)
    verify.add_argument("--state", required=True, choices=COMMIT_STATES)
    verify.add_argument("--context", required=True)
    return parser


def validate_common(repository: str, commit: str | None = None) -> None:
    if not REPOSITORY_PATTERN.fullmatch(repository):
        raise ValueError("repository must use owner/name format")
    if commit is not None and not COMMIT_PATTERN.fullmatch(commit):
        raise ValueError("commit must be a full 40-character SHA")


def validate_environment(environment: str) -> None:
    if not 1 <= len(environment) <= 255:
        raise ValueError("environment must contain 1-255 characters")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    token = os.getenv("JJS_GITHUB_TOKEN") or os.getenv("GITHUB_TOKEN")
    if not token:
        print("error: GitHub token is not configured", file=sys.stderr)
        return 2
    try:
        validate_common(args.repository, getattr(args, "commit", None))
        common = {
            "token": token,
            "api_url": args.api_url,
            "api_version": args.api_version,
        }
        if args.command == "create":
            validate_environment(args.environment)
            payload = create_deployment_payload(
                args.commit, args.environment, args.description, args.production_environment
            )
            result = api_request(
                "POST", f"/repos/{args.repository}/deployments", payload, **common
            )
            deployment_id = result.get("id")
            if not isinstance(deployment_id, int) or deployment_id <= 0:
                raise GitHubApiError("deployment response did not include a valid id")
            print(deployment_id)
            return 0
        if args.command == "status":
            validate_environment(args.environment)
            if args.deployment_id <= 0:
                raise ValueError("deployment id must be positive")
            payload = deployment_status_payload(
                args.state, args.environment, args.description, args.environment_url
            )
            api_request(
                "POST",
                f"/repos/{args.repository}/deployments/{args.deployment_id}/statuses",
                payload,
                **common,
            )
            return 0
        if args.command == "status-commit":
            payload = commit_status_payload(
                args.state, args.context, args.description, args.target_url
            )
            api_request(
                "POST",
                f"/repos/{args.repository}/statuses/{args.commit}",
                payload,
                **common,
            )
            return 0

        result = api_request(
            "GET", f"/repos/{args.repository}/commits/{args.commit}/status", None, **common
        )
        statuses = result.get("statuses")
        if not isinstance(statuses, list) or not any(
            isinstance(item, dict)
            and item.get("context") == args.context
            and item.get("state") == args.state
            for item in statuses
        ):
            raise GitHubApiError("requested commit status was not found")
        return 0
    except (GitHubApiError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
