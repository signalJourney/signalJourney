"""Tests for scripts/release_check.py, the one place the release rules live.

Every test runs the script as a command against a temporary git repository
that holds copies of the real CHANGELOG.md, pyproject.toml and package
`__init__.py`, so the rules are proven against the files they guard.
"""

import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path
from typing import Union

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "release_check.py"
INIT = Path("src/signaljourney_validator/__init__.py")


def current_version() -> str:
    text = (ROOT / INIT).read_text(encoding="utf-8")
    return re.search(r'^__version__ = "([^"]+)"', text, re.M).group(1)


VERSION = current_version()
TAG = f"v{VERSION}"


def git(repo: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", *args], cwd=repo, capture_output=True, text=True, check=True
    )
    return done.stdout.strip()


def commit(repo: Path, message: str) -> str:
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


def run(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--root", str(repo), *args],
        capture_output=True,
        text=True,
    )


def read(repo: Path, name: Union[str, Path]) -> str:
    return (repo / name).read_text(encoding="utf-8")


def write(repo: Path, name: Union[str, Path], text: str) -> None:
    path = repo / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


@pytest.fixture
def repo(tmp_path) -> Path:
    """A committed temporary repository holding copies of the real files."""
    root = tmp_path / "repo"
    (root / INIT).parent.mkdir(parents=True)
    for name in ("CHANGELOG.md", "pyproject.toml", str(INIT)):
        shutil.copy(ROOT / name, root / name)
    # Whatever is unreleased on the real branch, the copy is as it is at tag time.
    text = read(root, "CHANGELOG.md")
    write(root, "CHANGELOG.md", replace_entry_body(text, "Unreleased", "\n"))
    write(root, "docs/index.md", "docs\n")
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.email", "test@example.invalid")
    git(root, "config", "user.name", "Test")
    commit(root, "base")
    return root


def entry_span(text: str, heading: str) -> tuple:
    """Start and end offsets of the section whose heading line starts with `heading`."""
    start = text.index(f"## [{heading}]")
    following = re.search(r"^## \[", text[start + 3 :], re.M)
    end = start + 3 + following.start() if following else len(text)
    return start, end


def replace_entry_body(text: str, heading: str, body: str) -> str:
    start, end = entry_span(text, heading)
    first_line_end = text.index("\n", start) + 1
    return text[:first_line_end] + body + text[end:]


# ---------------------------------------------------------------------------
# tag
# ---------------------------------------------------------------------------


def test_a_good_tag_passes(repo):
    done = run(repo, "tag", TAG)
    assert done.returncode == 0, done.stderr


@pytest.mark.parametrize(
    "bad",
    [
        "v0.2",
        VERSION,
        f"v{VERSION}-rc1",
        f"{TAG}.1",
        f"V{VERSION}",
        "vx.y.z",
        f"{TAG}\n",
        "",
    ],
)
def test_a_tag_that_is_not_vXYZ_is_refused(repo, bad):
    done = run(repo, "tag", bad)
    assert done.returncode == 1
    assert "vX.Y.Z" in done.stderr


def test_a_tag_that_differs_from_the_module_version_is_refused(repo):
    write(repo, INIT, read(repo, INIT).replace(f'"{VERSION}"', '"9.9.9"'))
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "__version__" in done.stderr


def test_a_tag_that_is_not_the_newest_changelog_entry_is_refused(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", text.replace(f"## [{VERSION}]", "## [9.9.9]", 1))
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "CHANGELOG.md" in done.stderr


def test_a_tag_with_an_empty_changelog_entry_is_refused(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", replace_entry_body(text, VERSION, "\n\n"))
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "empty" in done.stderr


def test_an_entry_of_bare_headings_is_empty(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", replace_entry_body(text, VERSION, "\n### Added\n\n"))
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "empty" in done.stderr


def make_wheel(directory: Path, version: str, name: str = "signalJourney") -> Path:
    directory.mkdir(exist_ok=True)
    dist_info = f"{name}-{version}.dist-info"
    wheel = directory / f"{name}-{version}-py3-none-any.whl"
    with zipfile.ZipFile(wheel, "w") as archive:
        archive.writestr(
            f"{dist_info}/METADATA",
            f"Metadata-Version: 2.4\nName: {name}\nVersion: {version}\n\nbody\n",
        )
    return wheel


def test_a_wheel_of_the_tagged_version_passes(repo):
    make_wheel(repo / "dist", VERSION)
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 0, done.stderr


def test_a_wheel_of_another_version_is_refused(repo):
    make_wheel(repo / "dist", "9.9.9")
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "wheel" in done.stderr


def test_a_wheel_of_another_distribution_is_refused(repo):
    make_wheel(repo / "dist", VERSION, name="something_else")
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "signaljourney" in done.stderr.lower()


def test_a_dist_directory_without_a_wheel_is_refused(repo):
    (repo / "dist").mkdir()
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "wheel" in done.stderr


@pytest.mark.skipif(shutil.which("uv") is None, reason="uv is needed to build")
def test_a_real_build_carries_the_module_version(repo, tmp_path):
    shutil.copytree(
        ROOT / "src",
        repo / "src",
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("__pycache__", "*.egg-info"),
    )
    built = subprocess.run(
        ["uv", "build", "--out-dir", str(tmp_path / "out"), str(repo)],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    assert built.returncode == 0, built.stderr
    assert list((tmp_path / "out").glob("*.whl")), "no wheel was built"
    assert list((tmp_path / "out").glob("*.tar.gz")), "no sdist was built"
    done = run(repo, "tag", TAG, "--dist", str(tmp_path / "out"))
    assert done.returncode == 0, done.stderr
    other = run(repo, "tag", "v9.9.9", "--dist", str(tmp_path / "out"))
    assert other.returncode == 1


# ---------------------------------------------------------------------------
# notes
# ---------------------------------------------------------------------------


MARKER = "- A marker line that only this test writes."


def with_marker_entry(repo: Path) -> None:
    text = read(repo, "CHANGELOG.md")
    body = f"\n### Added\n{MARKER}\n\n"
    write(repo, "CHANGELOG.md", replace_entry_body(text, VERSION, body))


def test_notes_print_the_entry_and_only_the_entry(repo):
    with_marker_entry(repo)
    done = run(repo, "notes", VERSION)
    assert done.returncode == 0, done.stderr
    assert MARKER in done.stdout
    assert "## [" not in done.stdout
    assert "Initial release" not in done.stdout


def test_notes_work_for_an_older_entry(repo):
    with_marker_entry(repo)
    done = run(repo, "notes", "0.1.0")
    assert done.returncode == 0, done.stderr
    assert "Initial release" in done.stdout
    assert MARKER not in done.stdout


def test_notes_for_a_missing_entry_fail(repo):
    done = run(repo, "notes", "9.9.9")
    assert done.returncode == 1
    assert "9.9.9" in done.stderr
    assert done.stdout == ""


@pytest.mark.parametrize("bad", ["Unreleased", f"v{VERSION}", "0.2"])
def test_notes_refuse_a_malformed_version(repo, bad):
    done = run(repo, "notes", bad)
    assert done.returncode == 1
    assert "X.Y.Z" in done.stderr
    assert done.stdout == ""


def test_notes_for_an_empty_entry_fail(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", replace_entry_body(text, VERSION, "\n\n"))
    done = run(repo, "notes", VERSION)
    assert done.returncode == 1
    assert "empty" in done.stderr
    assert done.stdout == ""


# ---------------------------------------------------------------------------
# changelog
# ---------------------------------------------------------------------------


def changelog_check(repo: Path, base: str, head: str, *labels: str):
    args = ["changelog", "--base", base, "--head", head]
    for label in labels:
        args += ["--label", label]
    return run(repo, *args)


def edit_unreleased(repo: Path) -> None:
    text = read(repo, "CHANGELOG.md")
    marker = "## [Unreleased]\n"
    assert marker in text
    write(
        repo,
        "CHANGELOG.md",
        text.replace(marker, marker + "\n### Fixed\n- A change.\n", 1),
    )


def test_a_source_change_without_a_changelog_edit_fails(repo):
    base = git(repo, "rev-parse", "HEAD")
    write(repo, "src/signaljourney_validator/new.py", "x = 1\n")
    head = commit(repo, "code")
    done = changelog_check(repo, base, head)
    assert done.returncode == 1
    assert "Unreleased" in done.stderr


def test_the_no_changelog_label_waives_the_edit(repo):
    base = git(repo, "rev-parse", "HEAD")
    write(repo, "src/signaljourney_validator/new.py", "x = 1\n")
    head = commit(repo, "code")
    done = changelog_check(repo, base, head, "bug", "no-changelog")
    assert done.returncode == 0, done.stderr


def test_a_docs_only_change_passes(repo):
    base = git(repo, "rev-parse", "HEAD")
    write(repo, "docs/index.md", "changed\n")
    head = commit(repo, "docs")
    done = changelog_check(repo, base, head)
    assert done.returncode == 0, done.stderr


@pytest.mark.parametrize("name", ["pyproject.toml", "MANIFEST.in"])
def test_a_packaging_change_needs_a_changelog_edit(repo, name):
    base = git(repo, "rev-parse", "HEAD")
    path = repo / name
    write(repo, name, (path.read_text() if path.exists() else "") + "\n# changed\n")
    head = commit(repo, "packaging")
    done = changelog_check(repo, base, head)
    assert done.returncode == 1
    assert "Unreleased" in done.stderr


def test_a_source_change_with_an_unreleased_edit_passes(repo):
    base = git(repo, "rev-parse", "HEAD")
    write(repo, "src/signaljourney_validator/new.py", "x = 1\n")
    edit_unreleased(repo)
    head = commit(repo, "code and changelog")
    done = changelog_check(repo, base, head)
    assert done.returncode == 0, done.stderr


def test_an_edit_outside_unreleased_does_not_count(repo):
    base = git(repo, "rev-parse", "HEAD")
    write(repo, "src/signaljourney_validator/new.py", "x = 1\n")
    text = read(repo, "CHANGELOG.md")
    start, end = entry_span(text, VERSION)
    section = text[start:end].rstrip("\n") + "\n- One more line.\n\n"
    write(repo, "CHANGELOG.md", text[:start] + section + text[end:])
    head = commit(repo, "code and a wrong entry")
    done = changelog_check(repo, base, head)
    assert done.returncode == 1
    assert "Unreleased" in done.stderr


def test_a_branch_behind_its_base_is_judged_from_the_merge_base(repo):
    fork = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-q", "-b", "feature")
    write(repo, "docs/index.md", "feature docs\n")
    head = commit(repo, "docs on the branch")
    git(repo, "checkout", "-q", "main")
    write(repo, "src/signaljourney_validator/new.py", "x = 1\n")
    base = commit(repo, "code on main")
    assert fork != base
    done = changelog_check(repo, base, head)
    assert done.returncode == 0, done.stderr


def test_an_edit_of_the_frozen_0_1_0_section_is_refused(repo):
    base = git(repo, "rev-parse", "HEAD")
    text = read(repo, "CHANGELOG.md")
    assert "Initial release of signalJourney" in text
    write(
        repo,
        "CHANGELOG.md",
        text.replace(
            "Initial release of signalJourney", "First release of signalJourney"
        ),
    )
    head = commit(repo, "rewrite history")
    done = changelog_check(repo, base, head, "no-changelog")
    assert done.returncode == 1
    assert "0.1.0" in done.stderr


def test_a_missing_unreleased_section_is_refused_even_for_docs(repo):
    base = git(repo, "rev-parse", "HEAD")
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", text.replace("## [Unreleased]", "## [Pending]"))
    head = commit(repo, "rename")
    done = changelog_check(repo, base, head)
    assert done.returncode == 1


def test_a_non_standard_subsection_heading_is_refused(repo):
    base = git(repo, "rev-parse", "HEAD")
    text = read(repo, "CHANGELOG.md")
    marker = "## [Unreleased]\n"
    write(repo, "CHANGELOG.md", text.replace(marker, marker + "\n### Misc\n- x\n", 1))
    head = commit(repo, "bad heading")
    done = changelog_check(repo, base, head)
    assert done.returncode == 1
    assert "Misc" in done.stderr


def test_the_legacy_headings_of_0_1_0_are_tolerated(repo):
    text = read(repo, "CHANGELOG.md")
    assert "### Features" in text and "### Technical Details" in text
    assert run(repo, "static").returncode == 0


def test_an_unknown_commit_is_reported_not_passed(repo):
    done = changelog_check(repo, "0" * 40, git(repo, "rev-parse", "HEAD"))
    assert done.returncode == 1


# ---------------------------------------------------------------------------
# static
# ---------------------------------------------------------------------------


def test_static_passes_on_the_real_repository():
    done = subprocess.run(
        [sys.executable, str(SCRIPT), "static"],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert done.returncode == 0, done.stderr


def test_static_refuses_a_missing_unreleased_section(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", text.replace("## [Unreleased]\n", "", 1))
    done = run(repo, "static")
    assert done.returncode == 1
    assert "Unreleased" in done.stderr


def test_static_refuses_two_unreleased_sections(repo):
    text = read(repo, "CHANGELOG.md")
    write(
        repo,
        "CHANGELOG.md",
        text.replace("## [Unreleased]\n", "## [Unreleased]\n\n## [Unreleased]\n", 1),
    )
    done = run(repo, "static")
    assert done.returncode == 1
    assert "exactly one" in done.stderr


def test_static_refuses_unreleased_below_an_entry(repo):
    text = read(repo, "CHANGELOG.md")
    moved = text.replace("## [Unreleased]\n\n", "", 1)
    start, end = entry_span(moved, VERSION)
    write(repo, "CHANGELOG.md", moved[:end] + "## [Unreleased]\n\n" + moved[end:])
    done = run(repo, "static")
    assert done.returncode == 1
    assert "first section" in done.stderr


def test_static_refuses_entries_out_of_order(repo):
    text = read(repo, "CHANGELOG.md")
    start, end = entry_span(text, VERSION)
    older_start, older_end = entry_span(text, "0.1.0")
    newer = text[start:end].rstrip("\n") + "\n\n"
    older = text[older_start:older_end].rstrip("\n") + "\n"
    write(repo, "CHANGELOG.md", text[:start] + older + "\n" + newer)
    done = run(repo, "static")
    assert done.returncode == 1
    assert "descending" in done.stderr


def test_static_refuses_a_module_version_that_trails_the_changelog(repo):
    write(repo, INIT, read(repo, INIT).replace(f'"{VERSION}"', '"0.1.0"'))
    done = run(repo, "static")
    assert done.returncode == 1
    assert "__version__" in done.stderr


def test_static_refuses_a_second_version_source(repo):
    text = read(repo, "pyproject.toml")
    write(
        repo,
        "pyproject.toml",
        text.replace(
            'name = "signalJourney"\n', 'name = "signalJourney"\nversion = "0.0.1"\n', 1
        ),
    )
    done = run(repo, "static")
    assert done.returncode == 1
    assert "pyproject.toml" in done.stderr


def test_static_refuses_an_impossible_date(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", text.replace("2025-08-20", "2025-13-45"))
    done = run(repo, "static")
    assert done.returncode == 1
    assert "date" in done.stderr


# ---------------------------------------------------------------------------
# the tag command also holds the structure rules
# ---------------------------------------------------------------------------


def test_a_tag_with_unreleased_entries_is_refused(repo):
    edit_unreleased(repo)
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "Unreleased" in done.stderr and "not empty" in done.stderr


def test_an_unreleased_section_of_bare_headings_is_empty_at_tag_time(repo):
    text = read(repo, "CHANGELOG.md")
    write(
        repo, "CHANGELOG.md", replace_entry_body(text, "Unreleased", "\n### Added\n\n")
    )
    done = run(repo, "tag", TAG)
    assert done.returncode == 0, done.stderr


def test_a_tag_runs_the_changelog_order_check(repo):
    text = read(repo, "CHANGELOG.md")
    start, end = entry_span(text, VERSION)
    write(repo, "CHANGELOG.md", text[:end] + text[start:end] + text[end:])
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "descending" in done.stderr


def test_a_tag_runs_the_single_unreleased_check(repo):
    text = read(repo, "CHANGELOG.md")
    write(repo, "CHANGELOG.md", text.replace("## [Unreleased]\n", "", 1))
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "Unreleased" in done.stderr


def test_a_tag_runs_the_pyproject_check(repo):
    text = read(repo, "pyproject.toml")
    marker = 'name = "signalJourney"\n'
    write(
        repo, "pyproject.toml", text.replace(marker, marker + 'version = "0.0.1"\n', 1)
    )
    done = run(repo, "tag", TAG)
    assert done.returncode == 1
    assert "pyproject.toml" in done.stderr


# ---------------------------------------------------------------------------
# every distribution file is checked
# ---------------------------------------------------------------------------


def make_sdist(directory: Path, version: str, pkg_infos: int = 1) -> Path:
    directory.mkdir(exist_ok=True)
    path = directory / f"signaljourney-{version}.tar.gz"
    with tarfile.open(path, "w:gz") as archive:
        for index in range(pkg_infos):
            head = "Metadata-Version: 2.4\nName: signalJourney\n"
            data = f"{head}Version: {version}\n".encode()
            info = tarfile.TarInfo(f"signaljourney-{version}{'x' * index}/PKG-INFO")
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
    return path


def test_a_good_wheel_and_sdist_pass(repo):
    make_wheel(repo / "dist", VERSION)
    make_sdist(repo / "dist", VERSION)
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 0, done.stderr


def test_an_sdist_of_another_version_is_refused(repo):
    make_wheel(repo / "dist", VERSION)
    make_sdist(repo / "dist", "9.9.9")
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "sdist" in done.stderr


def test_an_sdist_with_two_pkg_info_files_is_refused(repo):
    make_wheel(repo / "dist", VERSION)
    make_sdist(repo / "dist", VERSION, pkg_infos=2)
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "PKG-INFO" in done.stderr


def test_a_wheel_with_two_metadata_files_is_refused(repo):
    wheel = make_wheel(repo / "dist", VERSION)
    with zipfile.ZipFile(wheel, "a") as archive:
        archive.writestr(
            "other-1.0.dist-info/METADATA",
            f"Name: signalJourney\nVersion: {VERSION}\n\n",
        )
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "METADATA" in done.stderr


def test_every_wheel_is_checked_not_only_the_first(repo):
    make_wheel(repo / "dist", VERSION)
    make_wheel(repo / "dist", "9.9.9")
    done = run(repo, "tag", TAG, "--dist", str(repo / "dist"))
    assert done.returncode == 1
    assert "9.9.9" in done.stderr


# ---------------------------------------------------------------------------
# pyproject.toml and CHANGELOG.md details
# ---------------------------------------------------------------------------


def test_static_refuses_a_project_that_is_not_dynamic(repo):
    text = read(repo, "pyproject.toml")
    kept = [
        line
        for line in text.splitlines(keepends=True)
        if not line.startswith("dynamic")
    ]
    write(repo, "pyproject.toml", "".join(kept))
    done = run(repo, "static")
    assert done.returncode == 1
    assert "dynamic" in done.stderr


def test_static_refuses_a_missing_dynamic_version_table(repo):
    text = read(repo, "pyproject.toml")
    table = (
        "[tool.setuptools.dynamic]\n"
        'version = { attr = "signaljourney_validator.__version__" }\n'
    )
    assert table in text
    write(repo, "pyproject.toml", text.replace(table, ""))
    done = run(repo, "static")
    assert done.returncode == 1
    assert "tool.setuptools.dynamic" in done.stderr


def test_static_refuses_a_duplicated_version(repo):
    text = read(repo, "CHANGELOG.md")
    start, end = entry_span(text, VERSION)
    write(repo, "CHANGELOG.md", text[:end] + text[start:end] + text[end:])
    done = run(repo, "static")
    assert done.returncode == 1
    assert "descending" in done.stderr


def test_a_fenced_block_is_not_parsed_as_sections_or_headings(repo):
    text = read(repo, "CHANGELOG.md")
    block = "\n### Added\n- Quote:\n```\n## not a section\n### Misc\n```\n"
    write(repo, "CHANGELOG.md", replace_entry_body(text, "Unreleased", block + "\n"))
    done = run(repo, "static")
    assert done.returncode == 0, done.stderr


# ---------------------------------------------------------------------------
# a move out of src/ is a change of src/
# ---------------------------------------------------------------------------


def test_moving_a_file_out_of_src_needs_a_changelog_entry(repo):
    write(repo, "src/signaljourney_validator/module.py", "x = 1\n" * 20)
    base = commit(repo, "add a module")
    git(repo, "mv", "src/signaljourney_validator/module.py", "docs/module.py")
    head = commit(repo, "move it out of src")
    done = changelog_check(repo, base, head)
    assert done.returncode == 1
    assert "src/signaljourney_validator/module.py" in done.stderr


# ---------------------------------------------------------------------------
# digests: TestPyPI must hold the bytes that PyPI will receive
# ---------------------------------------------------------------------------


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def index_answer(repo: Path, files, changes=None) -> Path:
    """What an index's JSON API says about `files`; `changes` alters a sha256."""
    changes = changes or {}
    urls = [
        {"filename": f.name, "digests": {"sha256": changes.get(f.name, sha256(f))}}
        for f in files
    ]
    answer = repo / "answer.json"
    answer.write_text(json.dumps({"urls": urls}), encoding="utf-8")
    return answer


@pytest.fixture
def built(repo):
    wheel = make_wheel(repo / "dist", VERSION)
    sdist = make_sdist(repo / "dist", VERSION)
    return repo, wheel, sdist


def digests(repo: Path, answer: Path):
    return run(repo, "digests", "--dist", str(repo / "dist"), "--json", str(answer))


def test_identical_digests_pass(built):
    repo, wheel, sdist = built
    done = digests(repo, index_answer(repo, [wheel, sdist]))
    assert done.returncode == 0, done.stderr


def test_a_file_with_another_digest_fails_closed(built):
    repo, wheel, sdist = built
    answer = index_answer(repo, [wheel, sdist], {sdist.name: "0" * 64})
    done = digests(repo, answer)
    assert done.returncode == 1
    assert sdist.name in done.stderr and "sha256" in done.stderr


def test_a_file_the_index_does_not_list_yet_asks_for_a_retry(built):
    repo, wheel, sdist = built
    done = digests(repo, index_answer(repo, [wheel]))
    assert done.returncode == 3
    assert sdist.name in done.stderr


def test_a_mismatch_wins_over_a_missing_file(built):
    repo, wheel, sdist = built
    done = digests(repo, index_answer(repo, [wheel], {wheel.name: "0" * 64}))
    assert done.returncode == 1


def test_an_unreadable_index_answer_asks_for_a_retry(built):
    repo, _, _ = built
    answer = repo / "answer.json"
    answer.write_text("<html>not json</html>", encoding="utf-8")
    assert digests(repo, answer).returncode == 3


def test_an_answer_without_files_asks_for_a_retry(built):
    repo, _, _ = built
    answer = repo / "answer.json"
    answer.write_text(json.dumps({"info": {}}), encoding="utf-8")
    assert digests(repo, answer).returncode == 3


def test_extra_files_on_the_index_are_ignored(built):
    repo, wheel, sdist = built
    other = repo / "signaljourney-0.0.9.tar.gz"
    other.write_bytes(b"x")
    done = digests(repo, index_answer(repo, [wheel, sdist, other]))
    assert done.returncode == 0, done.stderr


def test_nothing_to_compare_fails(repo):
    (repo / "dist").mkdir()
    answer = index_answer(repo, [])
    assert digests(repo, answer).returncode == 1


def test_hex_case_does_not_matter_for_digests(built):
    repo, wheel, sdist = built
    answer = index_answer(
        repo,
        [wheel, sdist],
        {wheel.name: sha256(wheel).upper(), sdist.name: sha256(sdist).upper()},
    )
    done = digests(repo, answer)
    assert done.returncode == 0, done.stderr


def test_a_file_listed_without_a_digest_cannot_be_verified(built):
    repo, wheel, sdist = built
    urls = [
        {"filename": wheel.name, "digests": {"sha256": sha256(wheel)}},
        {"filename": sdist.name, "digests": {}},
    ]
    answer = repo / "answer.json"
    answer.write_text(json.dumps({"urls": urls}), encoding="utf-8")
    done = digests(repo, answer)
    assert done.returncode == 1
    assert "without a sha256" in done.stderr
    assert "bump" not in done.stderr


# ---------------------------------------------------------------------------
# the Changelog workflow's use of the script
# ---------------------------------------------------------------------------


def test_a_label_that_starts_with_a_dash_is_a_value_not_an_option(repo):
    base = git(repo, "rev-parse", "HEAD")
    write(repo, "docs/index.md", "changed\n")
    head = commit(repo, "docs")
    done = run(repo, "changelog", "--base", base, "--head", head, "--label=-x")
    assert done.returncode == 0, done.stderr


def test_the_changelog_workflow_passes_labels_as_values_and_runs_isolated():
    text = (ROOT / ".github/workflows/changelog.yml").read_text(encoding="utf-8")
    assert '"--label=${name}"' in text
    calls = [
        line.strip()
        for line in text.splitlines()
        if "python3" in line and not line.lstrip().startswith("#")
    ]
    assert calls, "the workflow runs no python3"
    assert all("python3 -I" in line for line in calls), calls
