"""Tests for the documentation workflow and the rules it must keep.

The workflows are read as text, as test_release_check.py reads changelog.yml,
because the project does not depend on a YAML parser.
Job blocks are found by their two-space indentation under `jobs:`.
"""

import re
from pathlib import Path
from typing import Dict

import pytest

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / ".github" / "workflows"
DOCS = WORKFLOWS / "docs.yml"
CI = WORKFLOWS / "ci.yml"

# The jobs that may hold each write permission, and nothing else.
ISSUE_WRITERS = {"token-watch", "alert", "recovered"}
ACTIONS_WRITERS = {"keepalive"}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def jobs_of(text: str) -> Dict[str, str]:
    """Map each job id to the text of its block."""
    _, _, after = text.partition("\njobs:\n")
    parts = re.split(r"^  ([A-Za-z0-9_-]+):[ \t]*$", after, flags=re.MULTILINE)
    return dict(zip(parts[1::2], parts[2::2]))


def uncommented(text: str) -> str:
    return "\n".join(
        line for line in text.splitlines() if not line.lstrip().startswith("#")
    )


def permissions_of(block: str) -> Dict[str, str]:
    match = re.search(r"^    permissions:[ \t]*\n((?:      [^\n]*\n)+)", block, re.M)
    if match is None:
        return {}
    pairs = re.findall(r"^\s+([a-z-]+):\s*([a-z]+)", match.group(1), re.M)
    return dict(pairs)


def test_the_workflow_has_all_three_triggers():
    text = read(DOCS)
    head = text.split("\njobs:\n")[0]
    on = head[head.index("\non:\n") :]
    assert re.search(r"^  push:\n    branches: \[ main \]", on, re.M)
    assert re.search(r"^  schedule:\n    - cron: '[^']+'", on, re.M)
    assert re.search(r"^  workflow_dispatch:", on, re.M)


def test_the_schedule_is_weekly():
    text = read(DOCS)
    found = re.search(r"cron: '([^']+)'", text)
    assert found, "the workflow has no schedule"
    cron = found.group(1).split()
    assert len(cron) == 5
    minute, hour, day_of_month, month, day_of_week = cron
    assert (day_of_month, month) == ("*", "*")
    assert re.fullmatch(r"[0-6]", day_of_week), "one weekday: a weekly run"


@pytest.mark.parametrize("path", sorted(WORKFLOWS.glob("*.yml")), ids=lambda p: p.name)
def test_every_action_is_pinned_by_a_commit_sha(path):
    uses = re.findall(r"^\s*(?:-\s+)?uses:\s*(\S+)", uncommented(read(path)), re.M)
    assert uses, f"{path.name} uses no action"
    for reference in uses:
        assert re.fullmatch(r"[\w./-]+@[0-9a-f]{40}", reference), reference


def test_workflow_level_permissions_are_read_only():
    text = read(DOCS)
    head = text.split("\njobs:\n")[0]
    assert re.search(r"^permissions:\n  contents: read\n", head, re.M)
    block = re.search(r"^permissions:\n((?:  [^\n]*\n)+)", head, re.M)
    assert block, "the workflow states no permissions"
    assert "write" not in block.group(1)


def test_write_permissions_sit_only_on_the_jobs_that_need_them():
    jobs = jobs_of(read(DOCS))
    assert set(jobs) == {
        "keepalive",
        "token-watch",
        "deploy",
        "alert",
        "recovered",
    }
    for name, block in jobs.items():
        permissions = permissions_of(block)
        assert permissions, f"{name} states no permissions of its own"
        assert (permissions.get("issues") == "write") == (name in ISSUE_WRITERS), name
        assert (permissions.get("actions") == "write") == (name in ACTIONS_WRITERS), (
            name
        )
        others = {k for k, v in permissions.items() if v == "write"}
        assert others <= {"issues", "actions"}, (name, others)


def test_no_other_workflow_writes_issues_or_actions():
    for path in WORKFLOWS.glob("*.yml"):
        if path == DOCS:
            continue
        text = uncommented(read(path))
        assert "issues: write" not in text, path.name
        assert "actions: write" not in text, path.name


def run_scripts(text: str) -> str:
    """The shell of every `run:` step, comments removed."""
    lines = uncommented(text).splitlines()
    shell = []
    index = 0
    while index < len(lines):
        match = re.match(r"^(\s*)(?:-\s+)?run:\s*(.*)$", lines[index])
        index += 1
        if match is None:
            continue
        indent, rest = len(match.group(1)), match.group(2)
        if rest not in ("|", ">", "|-", ">-"):
            shell.append(rest)
            continue
        while index < len(lines) and (
            not lines[index].strip()
            or len(lines[index]) - len(lines[index].lstrip()) > indent
        ):
            shell.append(lines[index])
            index += 1
    return "\n".join(shell)


def test_the_token_is_only_ever_a_secret_reference_in_an_env_or_with():
    text = read(DOCS)
    mentions = [line for line in text.splitlines() if "GH_PAGES_TOKEN" in line]
    assert any("secrets.GH_PAGES_TOKEN" in line for line in mentions)
    for line in mentions:
        if line.lstrip().startswith("#"):
            continue
        if "secrets." in line or "${{" in line:
            assert re.fullmatch(
                r"\s+[A-Za-z_]+: \$\{\{ secrets\.GH_PAGES_TOKEN \}\}( #.*)?", line
            ), line
    assert "GH_PAGES_TOKEN" not in run_scripts(text), "a run step names the secret"
    assert "secrets." not in run_scripts(text), "a run step reads a secret directly"
    for path in WORKFLOWS.glob("*.yml"):
        if path != DOCS:
            assert "GH_PAGES_TOKEN" not in read(path), path.name


def test_no_step_prints_the_token_or_traces_commands():
    text = read(DOCS)
    shell = run_scripts(text)
    assert "set -x" not in uncommented(text) and "xtrace" not in uncommented(text)
    # A command may carry the token only as a curl header; no line may print it.
    for line in shell.splitlines():
        if re.search(r"\$\{?TOKEN\b", line):
            assert not re.search(r"\b(echo|printf|cat|env|printenv)\b", line), line
    assert re.search(r'-H "Authorization: Bearer \$\{TOKEN\}"', shell)
    # Only the value of the expiry header is printed.
    assert 'echo "Token expiration header: ${value}"' in shell


def test_the_deploy_step_keeps_its_pinned_action_inputs_and_secret():
    deploy = jobs_of(read(DOCS))["deploy"]
    assert (
        "peaceiris/actions-gh-pages@84c30a85c19949d7eee79c4ff27748b70285e453" in deploy
    )
    for line in (
        "personal_token: ${{ secrets.GH_PAGES_TOKEN }}",
        "external_repository: signalJourney/signalJourney.github.io",
        "publish_branch: main",
        "publish_dir: ./site",
    ):
        assert line in deploy, line


def test_the_keepalive_re_enables_this_workflow():
    keepalive = jobs_of(read(DOCS))["keepalive"]
    assert "--method PUT" in keepalive
    assert "/actions/workflows/docs.yml/enable" in keepalive


def test_the_alert_runs_on_failure_after_the_deploy_and_the_recovery_after_success():
    jobs = jobs_of(read(DOCS))
    assert re.search(r"^    needs: \[[^\]]*\bdeploy\b[^\]]*\]", jobs["alert"], re.M)
    assert re.search(r"^    if: failure\(\)\s*$", jobs["alert"], re.M)
    assert "Docs deploy is failing" in jobs["alert"]
    assert "docs-deploy" in jobs["alert"]
    assert re.search(r"^    if: success\(\)\s*$", jobs["recovered"], re.M)
    assert "recovered" in jobs["recovered"]


def test_the_token_watch_warns_30_days_ahead():
    watch = jobs_of(read(DOCS))["token-watch"]
    assert "github-authentication-token-expiration" in watch
    assert '[ "$days" -lt 30 ]' in watch
    assert "Docs deploy token expires on " in watch


def test_ci_no_longer_deploys_and_builds_the_docs_on_every_change():
    text = read(CI)
    jobs = jobs_of(text)
    assert "deploy-docs" not in jobs
    assert "peaceiris" not in text and "GH_PAGES_TOKEN" not in text
    assert "docs-build" in jobs
    assert re.search(r"^    name: Docs build\s*$", jobs["docs-build"], re.M)
    assert "mkdocs build" in jobs["docs-build"]
    assert "if:" not in jobs["docs-build"], "the docs build runs on pull requests too"
    head = text.split("\njobs:\n")[0]
    assert "pull_request:" in head and "push:" in head
