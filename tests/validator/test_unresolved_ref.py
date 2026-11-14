"""Tests that an unresolved $ref is refused when the Validator is built."""

import json
import shutil
from importlib import resources
from pathlib import Path

import pytest

from signaljourney_validator import SchemaResolutionError, Validator
from signaljourney_validator.errors import SignalJourneyValidationError


def packaged_schema_root() -> Path:
    return Path(str(resources.files("signaljourney_validator") / "schema"))


def write_schema(path: Path, schema: dict) -> Path:
    path.write_text(json.dumps(schema), encoding="utf-8")
    return path


def test_missing_ref_file_raises_at_construction(tmp_path):
    schema_path = write_schema(
        tmp_path / "root.schema.json",
        {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {"a": {"$ref": "missing.schema.json"}},
        },
    )
    with pytest.raises(SchemaResolutionError) as excinfo:
        Validator(schema=schema_path)
    assert "missing.schema.json" in str(excinfo.value)


def test_unparseable_ref_file_raises_at_construction(tmp_path):
    (tmp_path / "broken.schema.json").write_text("{not json", encoding="utf-8")
    schema_path = write_schema(
        tmp_path / "root.schema.json",
        {"type": "object", "properties": {"a": {"$ref": "broken.schema.json"}}},
    )
    with pytest.raises(SchemaResolutionError) as excinfo:
        Validator(schema=schema_path)
    assert "broken.schema.json" in str(excinfo.value)


def test_dangling_local_ref_raises_at_construction(tmp_path):
    schema_path = write_schema(
        tmp_path / "root.schema.json",
        {"type": "object", "properties": {"a": {"$ref": "#/$defs/nope"}}},
    )
    with pytest.raises(SchemaResolutionError) as excinfo:
        Validator(schema=schema_path)
    assert "#/$defs/nope" in str(excinfo.value)


def test_resolvable_local_ref_is_accepted(tmp_path):
    schema_path = write_schema(
        tmp_path / "root.schema.json",
        {
            "type": "object",
            "properties": {"a": {"$ref": "#/$defs/thing"}},
            "$defs": {"thing": {"type": "string"}},
        },
    )
    validator = Validator(schema=schema_path, schema_version=None)
    assert validator.validate(
        {"a": 1}, raise_exceptions=False, auto_detect_version=False
    )


def test_deleted_definition_in_schema_dir_raises(tmp_path):
    copy = tmp_path / "schema"
    shutil.copytree(packaged_schema_root(), copy)
    (
        copy / "versions" / "0.1.0" / "definitions" / "processingStep.schema.json"
    ).unlink()
    with pytest.raises(SchemaResolutionError):
        Validator(schema_dir=copy)


def test_schema_resolution_error_is_a_validation_error():
    assert issubclass(SchemaResolutionError, SignalJourneyValidationError)
