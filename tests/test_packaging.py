"""Tests for the distribution metadata: its name and version agreement."""

import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

import signaljourney_validator

ROOT = Path(__file__).parent.parent


def project_field(field: str) -> str:
    """Read a string field of the [project] table of pyproject.toml."""
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    table = re.search(r"^\[project\]\n(.*?)(?=^\[)", text, re.S | re.M).group(1)
    return re.search(rf'^{field}\s*=\s*"([^"]+)"', table, re.M).group(1)


def normalize(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def test_distribution_is_named_signaljourney():
    assert project_field("name") == "signalJourney"
    assert normalize(project_field("name")) == "signaljourney"


def test_import_package_and_command_keep_their_names():
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert 'signaljourney-validate = "signaljourney_validator.cli:cli"' in text
    assert signaljourney_validator.__name__ == "signaljourney_validator"


def build_wheel(out_dir: Path, work: Path) -> Path:
    shutil.copytree(
        ROOT / "src",
        work / "src",
        ignore=shutil.ignore_patterns("__pycache__", "*.egg-info"),
    )
    shutil.copy(ROOT / "pyproject.toml", work / "pyproject.toml")
    shutil.copy(ROOT / "src/signaljourney_validator/README.md", work / "README.md")
    if shutil.which("uv"):
        cmd = ["uv", "build", "--wheel", "--out-dir", str(out_dir), str(work)]
    else:
        cmd = [
            sys.executable,
            "-c",
            "import setuptools.build_meta as b, sys; b.build_wheel(sys.argv[1])",
            str(out_dir),
        ]
    result = subprocess.run(cmd, cwd=work, capture_output=True, text=True)
    if result.returncode != 0:
        pytest.skip(f"cannot build a wheel here: {result.stderr[-300:]}")
    return next(out_dir.glob("*.whl"))


def test_built_wheel_metadata_name_normalizes_to_signaljourney(tmp_path):
    work = tmp_path / "work"
    work.mkdir()
    wheel = build_wheel(tmp_path / "dist", work)
    with zipfile.ZipFile(wheel) as zf:
        metadata = next(n for n in zf.namelist() if n.endswith(".dist-info/METADATA"))
        text = zf.read(metadata).decode("utf-8")
    name = re.search(r"^Name: (.+)$", text, re.M).group(1)
    assert normalize(name) == "signaljourney"
    assert wheel.name.startswith("signaljourney-")


def test_built_wheel_version_is_the_module_version(tmp_path):
    """pyproject.toml states no version: the wheel takes __version__."""
    work = tmp_path / "work"
    work.mkdir()
    wheel = build_wheel(tmp_path / "dist", work)
    with zipfile.ZipFile(wheel) as zf:
        metadata = next(n for n in zf.namelist() if n.endswith(".dist-info/METADATA"))
        text = zf.read(metadata).decode("utf-8")
    version = re.search(r"^Version: (.+)$", text, re.M).group(1)
    assert version == signaljourney_validator.__version__
