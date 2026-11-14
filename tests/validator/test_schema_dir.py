"""Tests for what Validator(schema_dir=...) does with a directory that is wrong."""

import logging
import shutil
from importlib import resources
from pathlib import Path

import pytest

from signaljourney_validator import SchemaResolutionError, Validator

EXAMPLE = "examples/simple_pipeline.json"


def packaged_schema_root() -> Path:
    return Path(str(resources.files("signaljourney_validator") / "schema"))


def test_nonexistent_schema_dir_raises(tmp_path):
    with pytest.raises(SchemaResolutionError) as excinfo:
        Validator(schema_dir=tmp_path / "typo")
    assert "typo" in str(excinfo.value)


def test_schema_dir_that_is_a_file_raises(tmp_path):
    a_file = tmp_path / "schema"
    a_file.write_text("{}", encoding="utf-8")
    with pytest.raises(SchemaResolutionError):
        Validator(schema_dir=a_file)


def test_corrupt_schema_file_in_schema_dir_raises(tmp_path):
    copy = tmp_path / "schema"
    shutil.copytree(packaged_schema_root(), copy)
    (copy / "versions" / "0.1.0" / "signalJourney.schema.json").write_text(
        "{not json", encoding="utf-8"
    )
    with pytest.raises(SchemaResolutionError):
        Validator(schema_dir=copy)


def test_corrupt_schema_file_with_a_named_version_raises(tmp_path):
    copy = tmp_path / "schema"
    shutil.copytree(packaged_schema_root(), copy)
    (copy / "versions" / "0.1.0" / "signalJourney.schema.json").write_text(
        "{not json", encoding="utf-8"
    )
    with pytest.raises(SchemaResolutionError):
        Validator(schema_version="0.1.0", schema_dir=copy)


def test_existing_schema_dir_without_versions_uses_the_packaged_schema(
    tmp_path, caplog
):
    empty = tmp_path / "schema"
    empty.mkdir()
    with caplog.at_level(logging.WARNING, logger="signaljourney_validator"):
        validator = Validator(schema_dir=empty)
    assert any("packaged schema" in r.getMessage() for r in caplog.records)
    assert validator.get_supported_versions() == []
    example = packaged_schema_root() / EXAMPLE
    assert validator.validate(example, auto_detect_version=False) == []
