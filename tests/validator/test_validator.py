"""Unit tests for the signaljourney_validator.validator module."""

import pytest
from pathlib import Path

from signaljourney_validator.errors import ValidationErrorDetail
from signaljourney_validator.validator import SignalJourneyValidationError, Validator

# from pathlib import Path # Unused
# from jsonschema import ValidationError # Unused

# Test cases use fixtures 'validator' and 'load_json_example' from conftest.py


def test_validator_init_default_schema(main_schema):
    """Test initializing Validator with the default schema."""
    validator_instance = Validator()  # Uses default schema loaded internally
    # Check if loaded schema matches expected, accounting for potentially injected $id
    # We expect the validator to inject the absolute file URI as $id
    expected_schema = main_schema.copy()
    # Determine the expected absolute URI based on the default path
    default_schema_path = (
        Path(__file__).parent.parent / "src/signaljourney_validator/validator.py"
    ).parent.parent.parent / "schema" / "signalJourney.schema.json"
    if default_schema_path.exists():
        expected_schema["$id"] = default_schema_path.resolve().as_uri()
    else:
        # Fallback if default schema path logic is wrong, just check core keys exist
        assert "$schema" in validator_instance._schema
        assert "properties" in validator_instance._schema
        return

    assert validator_instance._schema == expected_schema


def test_validator_init_custom_schema(main_schema_path):
    """Test initializing Validator with a custom schema path."""
    validator_instance = Validator(schema=main_schema_path)
    # Check internal schema object is loaded
    assert isinstance(validator_instance._schema, dict)
    assert validator_instance._schema["$id"]  # Check if a common key exists


def test_validate_valid(validator, load_json_example):
    """Test validate method with a valid data dictionary."""
    valid_data = load_json_example("valid/minimal_valid.json")
    errors = validator.validate(valid_data, raise_exceptions=False)
    assert errors == []


def test_validate_invalid_raises(validator, load_json_example):
    """Test validate raises SignalJourneyValidationError for invalid data."""
    invalid_data = load_json_example("invalid/missing_required_top_level.json")
    with pytest.raises(SignalJourneyValidationError) as excinfo:
        validator.validate(invalid_data, raise_exceptions=True)
    assert "Validation failed." in str(excinfo.value)
    assert isinstance(excinfo.value.errors, list)
    assert len(excinfo.value.errors) > 0
    assert isinstance(excinfo.value.errors[0], ValidationErrorDetail)


def test_validate_invalid_returns_errors(validator, load_json_example):
    """Test validate returns a list of errors when raise_exceptions=False."""
    invalid_data = load_json_example("invalid/missing_required_top_level.json")
    errors = validator.validate(invalid_data, raise_exceptions=False)
    assert isinstance(errors, list)
    assert len(errors) > 0
    assert isinstance(errors[0], ValidationErrorDetail)
    # Check a specific error detail
    assert errors[0].message == "'sj_version' is a required property"
    assert errors[0].validator == "required"
    assert "sj_version" in errors[0].validator_value
    assert errors[0].suggestion  # Check suggestion was generated


def test_validate_suggestions(validator, load_json_example):
    """Check that suggestions are generated for various error types."""
    # Type error
    errors_type = validator.validate(
        load_json_example("invalid/wrong_type.json"), False
    )
    assert errors_type[0].suggestion == "Change value type from 'float' to 'string'."

    # Pattern error
    errors_pattern = validator.validate(
        load_json_example("invalid/bad_pattern.json"), False
    )
    assert "matches the required regex pattern" in errors_pattern[0].suggestion

    # Required error
    errors_req = validator.validate(
        load_json_example("invalid/step_missing_required.json"), False
    )
    # Check that *all* missing required properties are mentioned
    # Split assertion string for length
    expected_suggestion_part = (
        "Ensure required property or properties "
        "('stepId', 'name', 'description', 'software') are present."
    )
    assert expected_suggestion_part in errors_req[0].suggestion

    # minItems error
    errors_min = validator.validate(
        load_json_example("invalid/processing_steps_empty.json"), False
    )
    assert (
        "Ensure array has at least 1 items (currently 0)." in errors_min[0].suggestion
    )


# TODO: Add tests for BIDS context validation (when implemented)
# def test_validate_bids_context(validator, tmp_path):
#     # ... setup mock BIDS dir and file ...
#     # result = validator.validate(mock_file, bids_context=tmp_path)
#     pass

def test_validator_init_schema_path(main_schema_path):
    """Test initializing Validator with a schema path."""
