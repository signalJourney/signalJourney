import json
from pathlib import Path
from typing import Any, Dict, Union, Optional, List

import jsonschema
from jsonschema import Draft7Validator

from .errors import ValidationErrorDetail

# Type alias for JSON data
JsonDict = Dict[str, Any]

DEFAULT_SCHEMA_PATH = Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"


class SignalJourneyValidationError(Exception):
    """Custom exception for validation errors."""
    def __init__(self, message: str, errors: Optional[List[ValidationErrorDetail]] = None):
        super().__init__(message)
        self.errors = errors or []


class Validator:
    """
    Validates signalJourney JSON data against the official schema.
    """

    def __init__(self, schema: Optional[Union[Path, str, JsonDict]] = None):
        """
        Initializes the Validator.

        Args:
            schema: Path to the schema file, the schema dictionary, or None to use the default schema.
        """
        self._schema = self._load_schema(schema)
        self._validator = Draft7Validator(self._schema)

    def _load_schema(self, schema_input: Optional[Union[Path, str, JsonDict]]) -> JsonDict:
        """Loads the JSON schema from a file or uses the provided dictionary."""
        if schema_input is None:
            schema_path = DEFAULT_SCHEMA_PATH
            if not schema_path.exists():
                raise FileNotFoundError(f"Default schema file not found at {schema_path}")
            try:
                with open(schema_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                raise SignalJourneyValidationError(f"Error decoding default schema JSON: {e}") from e
            except Exception as e:
                raise SignalJourneyValidationError(f"Error loading default schema file: {e}") from e
        elif isinstance(schema_input, (Path, str)):
            schema_path = Path(schema_input)
            if not schema_path.exists():
                raise FileNotFoundError(f"Schema file not found at {schema_path}")
            try:
                with open(schema_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                raise SignalJourneyValidationError(f"Error decoding schema JSON from {schema_path}: {e}") from e
            except Exception as e:
                raise SignalJourneyValidationError(f"Error loading schema file from {schema_path}: {e}") from e
        elif isinstance(schema_input, dict):
            # TODO: Add basic validation to ensure it looks like a schema?
            return schema_input
        else:
            raise TypeError("Schema must be a Path, string, dictionary, or None.")

    def validate(
        self, data: Union[Path, str, JsonDict], raise_exceptions: bool = True
    ) -> Union[bool, List[ValidationErrorDetail]]:
        """
        Validates the given signalJourney data against the loaded schema.

        Args:
            data: Path to the JSON file, the JSON string, or a dictionary representing the data.
            raise_exceptions: If True, raises SignalJourneyValidationError on failure,
                              containing detailed errors.
                              If False, returns an empty list if valid, or a list
                              of ValidationErrorDetail objects if invalid.

        Returns:
            True if raise_exceptions is True and data is valid.
            Empty list if raise_exceptions is False and data is valid.
            List of ValidationErrorDetail objects if raise_exceptions is False and data is invalid.

        Raises:
            SignalJourneyValidationError: If validation fails and raise_exceptions is True.
                                         The exception contains a list of detailed errors.
            FileNotFoundError: If data is a path and the file does not exist.
            SignalJourneyValidationError: If data is a string and cannot be parsed as JSON,
                                         or if other loading/unexpected validation errors occur.
            TypeError: If data is not a Path, string, or dictionary.
        """
        instance: JsonDict
        if isinstance(data, (Path, str)):
            file_path = Path(data)
            if not file_path.exists():
                raise FileNotFoundError(f"Data file not found at {file_path}")
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    instance = json.load(f)
            except json.JSONDecodeError as e:
                raise SignalJourneyValidationError(f"Error decoding data JSON from {file_path}: {e}") from e
            except Exception as e:
                raise SignalJourneyValidationError(f"Error loading data file from {file_path}: {e}") from e
        elif isinstance(data, dict):
            instance = data
        else:
            raise TypeError("Data must be a Path, string, or dictionary.")

        errors: List[ValidationErrorDetail] = []
        try:
            for error in sorted(self._validator.iter_errors(instance), key=str):
                error_path = list(error.path)
                schema_error_path = list(error.schema_path)

                nested_errors = []
                if error.context:
                    nested_errors = [
                        ValidationErrorDetail(
                            message=sub_error.message,
                            path=list(sub_error.path),
                            schema_path=list(sub_error.schema_path),
                            validator=sub_error.validator,
                            validator_value=sub_error.validator_value,
                            instance_value=sub_error.instance
                        ) for sub_error in error.context
                    ]

                errors.append(
                    ValidationErrorDetail(
                        message=error.message,
                        path=error_path,
                        schema_path=schema_error_path,
                        validator=error.validator,
                        validator_value=error.validator_value,
                        instance_value=error.instance,
                        context=nested_errors
                    )
                )

            if errors:
                if raise_exceptions:
                    raise SignalJourneyValidationError("Validation failed.", errors=errors)
                else:
                    return errors
            else:
                if raise_exceptions:
                    return True
                else:
                    return []

        except jsonschema.SchemaError as e:
            raise SignalJourneyValidationError(f"Invalid schema: {e}") from e
        except Exception as e:
            raise SignalJourneyValidationError(f"An unexpected error occurred during validation: {e}") from e


# Example usage (optional, for quick testing)
if __name__ == '__main__':
    # Assumes schema and example files are in the correct relative paths
    schema_file = Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"
    # Use an invalid example for testing errors
    invalid_example_dict = {
        "sj_version": "0.1.0",
        "schema_version": "invalid-version",
        "description": 123,
        # Missing required fields: pipelineInfo, processingSteps
    }
    valid_example_file = Path(__file__).parent.parent.parent / "schema" / "examples" / "simple_pipeline.json"

    if schema_file.exists():
        print(f"Using schema: {schema_file}\n")
        try:
            validator = Validator(schema_file)

            # --- Test valid example (raise_exceptions=False) ---
            print(f"Validating valid example (no exceptions): {valid_example_file}")
            validation_result_valid = validator.validate(valid_example_file, raise_exceptions=False)
            if isinstance(validation_result_valid, list) and not validation_result_valid:
                print("VALID example validation successful (returned empty list).\n")
            else:
                print(f"VALID example validation FAILED (unexpected result): {validation_result_valid}\n")

            # --- Test invalid example (raise_exceptions=False) ---
            print("Validating invalid example (no exceptions)...")
            validation_result_invalid = validator.validate(invalid_example_dict, raise_exceptions=False)
            if isinstance(validation_result_invalid, list) and validation_result_invalid:
                print(f"INVALID example validation failed as expected. Found {len(validation_result_invalid)} errors:")
                for err in validation_result_invalid:
                    print(f"- {err}")
                print("\n")
            else:
                print(f"INVALID example validation FAILED (unexpected result): {validation_result_invalid}\n")

            # --- Test invalid example (raise_exceptions=True) ---
            print("Validating invalid example (expecting exception)...")
            try:
                validator.validate(invalid_example_dict, raise_exceptions=True)
                print("INVALID example validation FAILED (no exception raised)\n")
            except SignalJourneyValidationError as e:
                print(f"INVALID example validation failed as expected. Exception caught: {e}")
                print(f"Contained {len(e.errors)} detailed errors:")
                for err_detail in e.errors:
                    print(f"- {err_detail}")
                print("\n")

        except FileNotFoundError as e:
            print(f"Setup Error: {e}")
        except SignalJourneyValidationError as e:
            print(f"Setup or Validation Error: {e}")
        except Exception as e:
            print(f"An unexpected setup error occurred: {e}")

    else:
        print("Could not find schema file for basic test.")