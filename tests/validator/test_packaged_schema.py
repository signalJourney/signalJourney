"""Tests for the packaged schema, unresolved $ref handling and logging."""

import hashlib
import json
import shutil
from importlib import resources
from pathlib import Path

from signaljourney_validator import Validator
from signaljourney_validator.schema_registry import DEFAULT_SCHEMA_DIR

PACKAGE = "signaljourney_validator"
MANIFEST = Path(__file__).parent.parent / "schemas" / "packaged_schema_sha256.json"
EXAMPLE = "examples/simple_pipeline.json"


def packaged_schema_root() -> Path:
    return Path(str(resources.files(PACKAGE) / "schema"))


def packaged_files(root: Path):
    return sorted(
        p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()
    )


def test_default_schema_dir_is_the_packaged_directory():
    assert DEFAULT_SCHEMA_DIR == packaged_schema_root()
    assert (DEFAULT_SCHEMA_DIR / "signalJourney.schema.json").is_file()
    assert (DEFAULT_SCHEMA_DIR / "versions" / "0.1.0").is_dir()


def test_default_validator_uses_packaged_schema_and_validates_example():
    validator = Validator()
    assert validator.get_supported_versions() == ["0.1.0"]
    example = packaged_schema_root() / EXAMPLE
    assert validator.validate(example, raise_exceptions=False) == []


def test_default_validator_rejects_invalid_document():
    validator = Validator()
    errors = validator.validate({"schema_version": "0.1.0"}, raise_exceptions=False)
    assert errors


def test_schema_dir_still_overrides_the_default(tmp_path):
    copy = tmp_path / "schema"
    shutil.copytree(packaged_schema_root(), copy)
    (copy / "versions" / "0.1.0").rename(copy / "versions" / "9.9.9")
    validator = Validator(schema_dir=copy)
    assert validator.get_supported_versions() == ["9.9.9"]


def test_packaged_schema_bytes_match_the_base_commit():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))["sha256"]
    root = packaged_schema_root()
    assert packaged_files(root) == sorted(manifest)
    for rel, expected in manifest.items():
        actual = hashlib.sha256((root / rel).read_bytes()).hexdigest()
        assert actual == expected, f"{rel} differs from the base commit"
