"""Tests for validating Signal Journey JSON files against the schema."""

import jsonschema
import pytest

# Import our custom exception
from signaljourney_validator.validator import SignalJourneyValidationError

VALID_EXAMPLES = [
    "valid/minimal_valid.json",
    # Add more valid example filenames here as they are created
]

# Define sets of invalid examples and the core error message expected
INVALID_EXAMPLES_FAILURES = [
    (
        "invalid/missing_required_top_level.json",
        "is a required property",
        "'sj_version' is a required property",
    ),
    (
        "invalid/wrong_type.json",
        "is not of type 'string'",
        "0.1 is not of type 'string'",
    ),  # Check type error for sj_version
    (
        "invalid/bad_pattern.json",
        "does not match pattern",
        "'0.1' does not match",
    ),
    (
        "invalid/processing_steps_empty.json",
        "should be non-empty",
        "[] should be non-empty",
    ),  # Adjusted expected message for minItems
    (
        "invalid/step_missing_required.json",
        "is a required property",
        "'name' is a required property",
    ),  # Check required 'name' in step
    # Add more invalid examples and expected error substrings here
]


@pytest.mark.parametrize("filename", VALID_EXAMPLES)
def test_valid_examples(validator, load_json_example, filename):
    """Test that valid example files pass validation."""
    data = load_json_example(filename)
    try:
        validator.validate(data)
    except SignalJourneyValidationError as e:  # Check for our custom exception
        pytest.fail(
            f"Validation failed unexpectedly for {filename}:\n{e}\nErrors: {e.errors}"
        )
    except jsonschema.ValidationError as e:  # Keep original check
        pytest.fail(
            f"Validation failed unexpectedly with base jsonschema error "
            f"for {filename}:\n{e}"
        )


@pytest.mark.parametrize(
    "filename, error_part, expected_message", INVALID_EXAMPLES_FAILURES
)
def test_invalid_examples(
    validator, load_json_example, filename, error_part, expected_message
):
    """Test that invalid example files fail validation with expected errors."""
    data = load_json_example(filename)
    # Expect our custom exception now
    with pytest.raises(SignalJourneyValidationError) as excinfo:
        validator.validate(data)
    # Check if the specific error message part is present within the wrapped errors
    # Access the list of ValidationErrorDetail objects via excinfo.value.errors
    found_error = False
    actual_errors_str = []
    for error_detail in excinfo.value.errors:
        actual_errors_str.append(str(error_detail))
        # Use 'in' for substring matching instead of exact match
        if expected_message in error_detail.message:
            found_error = True
            break
    # Assert message split for length
    assert found_error, (
        f"Expected error containing '{expected_message}' not found in errors: "
        f"{actual_errors_str}"
    )


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
# def test_other_invalid_examples(
#     validator, load_json_example, filename, expected_error_part
# ):
#     data = load_json_example(filename)
#     with pytest.raises(jsonschema.ValidationError) as excinfo:
#         validator.validate(data)
#     assert expected_error_part in str(excinfo.value)
