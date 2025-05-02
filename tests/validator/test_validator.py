"""Unit tests for the signaljourney_validator.validator module."""

import pytest
from pathlib import Path
from jsonschema import ValidationError

from signaljourney_validator.validator import Validator, SignalJourneyValidationError

# Test cases use fixtures 'validator' and 'load_json_example' from conftest.py

def test_validator_init_default_schema(main_schema):
    """Test initializing Validator with the default schema."""
    validator_instance = Validator() # Uses default schema loaded internally
    assert validator_instance._schema == main_schema # Check if loaded schema matches expected

def test_validator_init_custom_schema(main_schema_path):
    """Test initializing Validator with a custom schema path."""
    validator_instance = Validator(schema=main_schema_path)
    # Check if the loaded schema seems correct (basic check)
    assert "$schema" in validator_instance._schema
    assert validator_instance._schema["title"] == "Signal Journey Schema"

def test_validator_init_invalid_path():
    """Test initializing Validator with a non-existent schema path."""
    with pytest.raises(FileNotFoundError):
        Validator(schema="non_existent_schema.json")

def test_validate_valid_file(validator, load_json_example):
    """Test validate method with a known valid file."""
    data = load_json_example("valid/minimal_valid.json")
    result = validator.validate(data, raise_exceptions=True)
    assert result is True

def test_validate_valid_file_no_raise(validator, load_json_example):
    """Test validate method with valid file, not raising exceptions."""
    data = load_json_example("valid/minimal_valid.json")
    result = validator.validate(data, raise_exceptions=False)
    assert isinstance(result, list)
    assert len(result) == 0

def test_validate_invalid_file_raise(validator, load_json_example):
    """Test validate method with invalid file, raising exception."""
    data = load_json_example("invalid/missing_required_top_level.json")
    with pytest.raises(SignalJourneyValidationError) as excinfo:
        validator.validate(data, raise_exceptions=True)
    assert len(excinfo.value.errors) > 0
    assert "'sj_version' is a required property" in str(excinfo.value.errors[0].message)

def test_validate_invalid_file_no_raise(validator, load_json_example):
    """Test validate method with invalid file, not raising exceptions."""
    data = load_json_example("invalid/missing_required_top_level.json")
    result = validator.validate(data, raise_exceptions=False)
    assert isinstance(result, list)
    assert len(result) > 0
    # Check the detail of the first error
    first_error = result[0]
    assert first_error.message == "'sj_version' is a required property"
    assert first_error.path == []
    assert "required" in first_error.schema_path

# TODO: Add tests for BIDS context validation (currently placeholder)
# def test_validate_bids_context(validator, tmp_path):
#     # ... setup mock BIDS dir and file ...
#     # result = validator.validate(mock_file, bids_context=tmp_path)
#     pass 