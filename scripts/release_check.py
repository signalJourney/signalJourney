#!/usr/bin/env python3
"""The release rules of signalJourney, in one place (docs/RELEASING.md).

CI and the publish workflow both call this script, so a rule is written once.
It uses the standard library only and runs on Python 3.9 or newer.

    release_check.py tag TAG [--dist DIR]
        TAG is exactly vX.Y.Z, equals v + __version__, and names the newest dated
        CHANGELOG.md entry, whose body is not empty. With --dist, every wheel and
        source distribution in DIR is the distribution signalJourney at that version.
    release_check.py notes VERSION
        print the body of the CHANGELOG.md entry of VERSION (the release notes).
    release_check.py changelog --base SHA --head SHA [--label NAME]...
        a change to src/, pyproject.toml or MANIFEST.in must change CHANGELOG.md inside
        ## [Unreleased] (judged from the merge base), unless the label no-changelog is
        given; the changelog's structure is always checked, and the 0.1.0 section must
        stay as it was at the merge base (compared without its trailing newlines).
    release_check.py static
        the repository-wide rules: ## [Unreleased] is first, entries are in descending
        version order with real dates, __version__ equals the newest dated entry, and
        pyproject.toml takes its version from __version__ and states none of its own.

The one version source is `__version__` in src/signaljourney_validator/__init__.py.
The sections after 0.1.0 use the Keep a Changelog headings; the 0.1.0 section predates
that rule, is frozen, and is exempt from the heading check.

Exit status: 0 when every check passes, 1 when one fails (each failure is printed to
standard error), 2 for a usage error.
"""

from __future__ import annotations

import argparse
import datetime
import email
import re
import subprocess
import sys
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

CHANGELOG = "CHANGELOG.md"
PYPROJECT = "pyproject.toml"
MODULE = "src/signaljourney_validator/__init__.py"
DISTRIBUTION = "signaljourney"  # the normalized name of the distribution signalJourney
CHANGELOG_TRIGGERS = ("src/", "pyproject.toml", "MANIFEST.in")
WAIVER_LABEL = "no-changelog"

TAG_RE = re.compile(r"v[0-9]+\.[0-9]+\.[0-9]+")
VERSION_RE = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
HEADING_RE = re.compile(r"## \[(?P<name>[^\]]*)\](?: - (?P<date>\S+))?\s*")
KEEP_A_CHANGELOG = ("Added", "Changed", "Deprecated", "Removed", "Fixed", "Security")
FROZEN = "0.1.0"  # released before these rules; its section may not change


class Refusal(Exception):
    """One or more rules failed; `args[0]` is the list of messages."""


@dataclass
class Section:
    name: str  # "Unreleased" or "X.Y.Z"
    date: Optional[str]
    text: str  # the heading line and the body, exactly as written
    body: str  # everything after the heading line


def version_key(version: str) -> Tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def valid_date(text: str) -> bool:
    if not DATE_RE.fullmatch(text):
        return False
    try:
        datetime.date.fromisoformat(text)
    except ValueError:
        return False
    return True


def parse_changelog(text: str) -> Tuple[List[Section], List[str]]:
    """Split a changelog into `## [...]` sections; report malformed headings."""
    errors: List[str] = []
    starts: List[Tuple[int, str]] = []  # (offset, heading line)
    fenced = False
    offset = 0
    for line in text.splitlines(keepends=True):
        if line.lstrip().startswith("```"):
            fenced = not fenced
        elif not fenced and line.startswith("## "):
            starts.append((offset, line.rstrip("\r\n")))
        offset += len(line)
    sections: List[Section] = []
    for index, (start, heading) in enumerate(starts):
        end = starts[index + 1][0] if index + 1 < len(starts) else len(text)
        match = HEADING_RE.fullmatch(heading)
        name = match.group("name") if match else ""
        date = match.group("date") if match else None
        if name == "Unreleased" and date is None:
            pass
        elif VERSION_RE.fullmatch(name) and date is not None:
            if not valid_date(date):
                errors.append(
                    f"{CHANGELOG}: {heading!r} has a date that is not YYYY-MM-DD"
                )
        else:
            errors.append(
                f"{CHANGELOG}: malformed section heading {heading!r}; "
                "use '## [Unreleased]' or '## [X.Y.Z] - YYYY-MM-DD'"
            )
            continue
        block = text[start:end]
        body = (
            block[len(heading) :].lstrip("\r\n") if block.startswith(heading) else block
        )
        sections.append(Section(name, date, block, body))
    return sections, errors


def subsection_errors(section: Section) -> List[str]:
    errors = []
    fenced = False
    for line in section.body.splitlines():
        if line.lstrip().startswith("```"):
            fenced = not fenced
        elif not fenced and line.startswith("### "):
            title = line[4:].strip()
            if title not in KEEP_A_CHANGELOG:
                errors.append(
                    f"{CHANGELOG}: section [{section.name}] has the heading {line!r}; "
                    f"Keep a Changelog allows only {', '.join(KEEP_A_CHANGELOG)}"
                )
    return errors


def is_empty(body: str) -> bool:
    """True when the body holds nothing but blank lines and headings."""
    return not any(
        line.strip() and not line.lstrip().startswith("#") for line in body.splitlines()
    )


def dated(sections: Sequence[Section]) -> List[Section]:
    return [section for section in sections if section.name != "Unreleased"]


def section_named(sections: Sequence[Section], name: str) -> Optional[Section]:
    return next((section for section in sections if section.name == name), None)


def unreleased_body(sections: Sequence[Section]) -> Optional[str]:
    """The Unreleased body without surrounding blank lines; None when absent."""
    section = section_named(sections, "Unreleased")
    return None if section is None else section.body.strip()


def structure_errors(sections: Sequence[Section]) -> List[str]:
    """Rules that hold for every CHANGELOG.md, before and after any release."""
    errors = []
    names = [section.name for section in sections]
    if names.count("Unreleased") != 1:
        errors.append(f"{CHANGELOG} must hold exactly one '## [Unreleased]' section")
    elif names[0] != "Unreleased":
        errors.append(f"{CHANGELOG}: '## [Unreleased]' must be the first section")
    versions = [version_key(name) for name in names if name != "Unreleased"]
    if any(a <= b for a, b in zip(versions, versions[1:])):
        errors.append(f"{CHANGELOG}: entries must be in descending version order")
    for section in sections:
        if section.name != FROZEN:
            errors.extend(subsection_errors(section))
    return errors


def run_git(root: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, check=False
    )
    if done.returncode != 0:
        raise Refusal([f"git {' '.join(args)} failed: {done.stderr.strip()}"])
    return done.stdout


def read_text(root: Path, name: str) -> str:
    try:
        return (root / name).read_text(encoding="utf-8")
    except OSError as error:
        raise Refusal([f"cannot read {name}: {error}"]) from error


def module_version(root: Path) -> str:
    match = re.search(
        r'^__version__\s*=\s*"([^"]+)"', read_text(root, MODULE), re.MULTILINE
    )
    if match is None:
        raise Refusal([f'{MODULE} has no __version__ = "..." line'])
    return match.group(1)


def read_changelog(root: Path) -> Tuple[List[Section], List[str]]:
    return parse_changelog(read_text(root, CHANGELOG))


def normalize(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def metadata_errors(label: str, text: str, version: str) -> List[str]:
    """Check the Name and Version headers of a METADATA or PKG-INFO text."""
    headers = email.message_from_string(text)
    errors = []
    name = headers.get("Name", "")
    if normalize(name) != DISTRIBUTION:
        errors.append(f"{label}: the distribution is {name!r}, not signalJourney")
    if headers.get("Version") != version:
        errors.append(
            f"{label}: the version is {headers.get('Version')!r}, expected {version}"
        )
    return errors


def dist_errors(directory: Path, version: str) -> List[str]:
    wheels = sorted(directory.glob("*.whl"))
    sdists = sorted(directory.glob("*.tar.gz"))
    if not wheels:
        return [f"{directory} holds no wheel"]
    errors: List[str] = []
    for wheel in wheels:
        try:
            with zipfile.ZipFile(wheel) as archive:
                names = [
                    n
                    for n in archive.namelist()
                    if re.fullmatch(r"[^/]+\.dist-info/METADATA", n)
                ]
                if len(names) != 1:
                    errors.append(f"wheel {wheel.name} has {len(names)} METADATA files")
                    continue
                text = archive.read(names[0]).decode("utf-8")
        except (OSError, zipfile.BadZipFile) as error:
            errors.append(f"wheel {wheel.name} cannot be read: {error}")
            continue
        errors.extend(metadata_errors(f"wheel {wheel.name}", text, version))
    for sdist in sdists:
        try:
            with tarfile.open(sdist) as archive:
                members = [
                    m
                    for m in archive.getmembers()
                    if re.fullmatch(r"[^/]+/PKG-INFO", m.name)
                ]
                if len(members) != 1:
                    errors.append(
                        f"sdist {sdist.name} has {len(members)} PKG-INFO files"
                    )
                    continue
                handle = archive.extractfile(members[0])
                text = handle.read().decode("utf-8") if handle else ""
        except (OSError, tarfile.TarError) as error:
            errors.append(f"sdist {sdist.name} cannot be read: {error}")
            continue
        errors.extend(metadata_errors(f"sdist {sdist.name}", text, version))
    return errors


def pyproject_errors(root: Path) -> List[str]:
    text = read_text(root, PYPROJECT)
    table = re.search(r"^\[project\]\n(.*?)(?=^\[|\Z)", text, re.DOTALL | re.MULTILINE)
    if table is None:
        return [f"{PYPROJECT} has no [project] table"]
    errors = []
    if re.search(r"^version\s*=", table.group(1), re.MULTILINE):
        errors.append(
            f"{PYPROJECT} states its own version; "
            f"the only source is __version__ in {MODULE}"
        )
    if not re.search(r'^dynamic\s*=\s*\[[^\]]*"version"', table.group(1), re.MULTILINE):
        errors.append(f'{PYPROJECT}: [project] must declare dynamic = ["version"]')
    if not re.search(
        r'^\[tool\.setuptools\.dynamic\]\s*\nversion\s*=\s*\{\s*attr\s*=\s*"signaljourney_validator\.__version__"\s*\}',
        text,
        re.MULTILINE,
    ):
        errors.append(
            f"{PYPROJECT}: [tool.setuptools.dynamic] must read the version from "
            "signaljourney_validator.__version__"
        )
    return errors


# ---------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------


def check_tag(root: Path, tag: str, dist: Optional[Path]) -> List[str]:
    if not TAG_RE.fullmatch(tag):
        return [f"the tag {tag!r} is not exactly vX.Y.Z (digits only, no suffix)"]
    version = tag[1:]
    errors: List[str] = []
    module = module_version(root)
    if module != version:
        errors.append(f"the tag is {tag} but __version__ is {module!r}")
    sections, parse_errors = read_changelog(root)
    errors.extend(parse_errors)
    entries = dated(sections)
    if not entries:
        errors.append(f"{CHANGELOG} has no dated entry")
    else:
        newest = entries[0]
        if newest.name != version:
            errors.append(
                f"the tag is {tag} but the newest dated entry of {CHANGELOG} "
                f"is [{newest.name}]"
            )
        elif is_empty(newest.body):
            errors.append(f"the {CHANGELOG} entry [{version}] is empty")
    if dist is not None:
        errors.extend(dist_errors(dist, version))
    return errors


def release_notes(root: Path, version: str) -> str:
    if not VERSION_RE.fullmatch(version):
        raise Refusal([f"{version!r} is not X.Y.Z"])
    sections, parse_errors = read_changelog(root)
    section = section_named(dated(sections), version)
    if section is None:
        raise Refusal(parse_errors + [f"{CHANGELOG} has no entry [{version}]"])
    if is_empty(section.body):
        raise Refusal([f"the {CHANGELOG} entry [{version}] is empty"])
    return section.body.strip("\n") + "\n"


def check_changelog(
    root: Path, base: str, head: str, labels: Sequence[str]
) -> List[str]:
    merge_base = run_git(root, "merge-base", base, head).strip()
    changed = [
        path
        for path in run_git(root, "diff", "--name-only", "-z", merge_base, head).split(
            "\0"
        )
        if path
    ]
    head_text = run_git(root, "show", f"{head}:{CHANGELOG}")
    try:
        base_text = run_git(root, "show", f"{merge_base}:{CHANGELOG}")
    except Refusal:
        base_text = ""
    head_sections, errors = parse_changelog(head_text)
    base_sections, _ = parse_changelog(base_text)
    errors.extend(structure_errors(head_sections))

    frozen_base = section_named(base_sections, FROZEN)
    if frozen_base is not None:
        frozen_head = section_named(head_sections, FROZEN)
        if frozen_head is None or (
            frozen_head.text.rstrip("\n") != frozen_base.text.rstrip("\n")
        ):
            errors.append(f"the [{FROZEN}] section of {CHANGELOG} must stay as it was")

    touched = [
        p
        for p in changed
        if p.startswith(CHANGELOG_TRIGGERS[0]) or p in CHANGELOG_TRIGGERS[1:]
    ]
    if touched and WAIVER_LABEL not in labels:
        if unreleased_body(base_sections) == unreleased_body(head_sections):
            shown = ", ".join(touched[:3]) + (" and more" if len(touched) > 3 else "")
            errors.append(
                f"the change touches {shown}, so {CHANGELOG} must change inside "
                "'## [Unreleased]'; add an entry, or give the pull request "
                f"the label {WAIVER_LABEL}"
            )
    return errors


def check_static(root: Path) -> List[str]:
    sections, errors = read_changelog(root)
    errors.extend(structure_errors(sections))
    entries = dated(sections)
    module = module_version(root)
    if not entries:
        errors.append(f"{CHANGELOG} has no dated entry")
    elif entries[0].name != module:
        errors.append(
            f"__version__ is {module!r} but the newest dated entry of {CHANGELOG} "
            f"is [{entries[0].name}]"
        )
    errors.extend(pyproject_errors(root))
    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="the repository to check (default: the one holding this script)",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    tag = commands.add_parser("tag", help="check a release tag")
    tag.add_argument("tag")
    tag.add_argument("--dist", type=Path, help="directory of built distributions")
    notes = commands.add_parser("notes", help="print the release notes of a version")
    notes.add_argument("version")
    changelog = commands.add_parser(
        "changelog", help="check a pull request's changelog"
    )
    changelog.add_argument("--base", required=True)
    changelog.add_argument("--head", required=True)
    changelog.add_argument("--label", action="append", default=[])
    commands.add_parser("static", help="check the repository-wide rules")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "notes":
            sys.stdout.write(release_notes(args.root, args.version))
            return 0
        if args.command == "tag":
            errors = check_tag(args.root, args.tag, args.dist)
        elif args.command == "changelog":
            errors = check_changelog(args.root, args.base, args.head, args.label)
        else:
            errors = check_static(args.root)
    except Refusal as refusal:
        errors = refusal.args[0]
    for message in errors:
        print(f"error: {message}", file=sys.stderr)
    if not errors:
        print(f"ok: {args.command}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
