"""Tests for validating Signal Journey JSON files against the schema."""

import pytest
import jsonschema

VALID_EXAMPLES = [
    "valid/minimal_valid.json",
    # Add more valid example filenames here as they are created
]

INVALID_EXAMPLES_FAILURES = [
    ("invalid/missing_required_top_level.json", "is a required property", "'sj_version' is a required property"),
    ("invalid/wrong_type.json", "is not of type \'string\'", "0.1 is not of type 'string'"), # Check type error for sj_version
    ("invalid/bad_pattern.json", "does not match pattern", "'0.1' does not match '^[0-9]+\\\\.[0-9]+\\\\.[0-9]+$'"), # Adjusted expected message for pattern
    ("invalid/processing_steps_empty.json", "should be non-empty", "[] should be non-empty"), # Adjusted expected message for minItems
    ("invalid/step_missing_required.json", "is a required property", "'name' is a required property"), # Check required 'name' in step
    # Add more invalid examples and expected error substrings here
]


@pytest.mark.parametrize("filename", VALID_EXAMPLES)
def test_valid_examples(validator, load_json_example, filename):
    """Test that valid example files pass validation."""
    data = load_json_example(filename)
    try:
        validator.validate(data)
    except jsonschema.ValidationError as e:
        pytest.fail(f"Validation failed unexpectedly for {filename}:\n{e}")


@pytest.mark.parametrize("filename, error_part, expected_message", INVALID_EXAMPLES_FAILURES)
def test_invalid_examples(validator, load_json_example, filename, error_part, expected_message):
    """Test that invalid example files fail validation with expected errors."""
    data = load_json_example(filename)
    with pytest.raises(jsonschema.ValidationError) as excinfo:
        validator.validate(data)
    # Check if the specific error message part is present
    # Using the full expected message for stricter checking now
    assert expected_message in str(excinfo.value)

# Future tests can add parametrization for more examples
# @pytest.mark.parametrize("filename", [
#     "valid/example1.json",
#     "valid/example2.json",
# ])
# def test_other_valid_examples(validator, load_json_example, filename):
#     data = load_json_example(filename)
#     validator.validate(data)

# @pytest.mark.parametrize("filename, expected_error_part", [
#     ("invalid/wrong_type.json", "is not of type 'string'"),
#     ("invalid/bad_pattern.json", "does not match"),
# ])
# def test_other_invalid_examples(validator, load_json_example, filename, expected_error_part):
#     data = load_json_example(filename)
#     with pytest.raises(jsonschema.ValidationError) as excinfo:
#         validator.validate(data)
#     assert expected_error_part in str(excinfo.value) 