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
    Also includes experimental support for BIDS context validation.
    """

    def __init__(self, schema: Optional[Union[Path, str, JsonDict]] = None,
                 resolver: Optional[jsonschema.RefResolver] = None):
        """
        Initializes the Validator.

        Args:
            schema: Path to the schema file, the schema dictionary, or None to use the default schema.
            resolver: An optional pre-configured RefResolver instance.
        """
        self._schema = self._load_schema(schema)
        self._validator = Draft7Validator(self._schema, resolver=resolver)

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
        self,
        data: Union[Path, str, JsonDict],
        raise_exceptions: bool = True,
        bids_context: Optional[Path] = None
    ) -> Union[bool, List[ValidationErrorDetail]]:
        """
        Validates the given signalJourney data against the loaded schema,
        optionally considering BIDS context.

        Args:
            data: Path to the JSON file, the JSON string, or a dictionary
                  representing the data.
            raise_exceptions: If True, raises SignalJourneyValidationError on failure.
                              If False, returns a list of errors or an empty list.
            bids_context: Optional Path to the root of the BIDS dataset.
                          If provided, performs additional BIDS-related checks.
                          (Currently placeholder).

        Returns:
            True or List[ValidationErrorDetail] based on raise_exceptions and validity.

        Raises:
            SignalJourneyValidationError: If validation fails and raise_exceptions is True.
            FileNotFoundError: If data file/path does not exist.
            TypeError: If data is not a Path, string, or dictionary.
        """
        instance: JsonDict
        file_path_context: Optional[Path] = None

        if isinstance(data, (Path, str)):
            file_path = Path(data)
            file_path_context = file_path
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

        schema_errors: List[ValidationErrorDetail] = []
        bids_errors: List[ValidationErrorDetail] = []

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
                error_detail = ValidationErrorDetail(
                    message=error.message,
                    path=error_path,
                    schema_path=schema_error_path,
                    validator=error.validator,
                    validator_value=error.validator_value,
                    instance_value=error.instance,
                    context=nested_errors
                )
                error_detail.generate_suggestion()
                schema_errors.append(error_detail)

        except jsonschema.SchemaError as e:
            raise SignalJourneyValidationError(f"Invalid schema: {e}") from e
        except Exception as e:
            raise SignalJourneyValidationError(f"An unexpected error occurred during schema validation: {e}") from e

        if bids_context:
            bids_errors = self._validate_bids_context(instance, file_path_context, bids_context)

        all_errors = schema_errors + bids_errors

        if all_errors:
            if raise_exceptions:
                raise SignalJourneyValidationError("Validation failed.", errors=all_errors)
            else:
                return all_errors
        else:
            if raise_exceptions:
                return True
            else:
                return []

    def _validate_bids_context(
        self, instance: JsonDict, file_path: Optional[Path], bids_root: Path
    ) -> List[ValidationErrorDetail]:
        """Placeholder for BIDS context validation logic."""
        errors: List[ValidationErrorDetail] = []
        print(f"[INFO] BIDS context validation requested for {file_path} within {bids_root} (Not implemented)")

        # TODO: Implement BIDS checks using file_path and bids_root
        # - Check if file_path is correctly placed within bids_root derivatives
        # - Check naming convention against BIDS standards (might need pybids)
        # - Check if files referenced in inputSources/outputTargets exist relative to bids_root
        # - Differentiate rules for root-level vs derivative-level journey files

        # Example placeholder error:
        # if file_path and "derivatives" not in file_path.parts:
        #     errors.append(ValidationErrorDetail(
        #         message="File does not appear to be in a BIDS derivatives directory.",
        #         path=["filepath"]
        #     ))

        return errors


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
        "pipelineInfo": {
             "type": "Procesing"
        }
    }
    valid_example_file = Path(__file__).parent.parent.parent / "schema" / "examples" / "simple_pipeline.json"
    # Example BIDS context (adjust path as needed for your system)
    example_bids_root = Path(__file__).parent.parent.parent / "tests" / "data" / "bids_dataset" # Assuming tests/data exists

    if schema_file.exists():
        print(f"Using schema: {schema_file}\n")
        try:
            validator = Validator(schema_file)

            # --- Test valid example (no BIDS) ---
            print(f"Validating valid example (no BIDS): {valid_example_file}")
            validation_result_valid = validator.validate(valid_example_file, raise_exceptions=False)
            if isinstance(validation_result_valid, list) and not validation_result_valid:
                print("VALID example validation successful (returned empty list).\n")
            else:
                print(f"VALID example validation FAILED (unexpected result): {validation_result_valid}\n")

            # --- Test invalid example (no BIDS) ---
            print("Validating invalid example (no BIDS)...")
            validation_result_invalid = validator.validate(invalid_example_dict, raise_exceptions=False)
            if isinstance(validation_result_invalid, list) and validation_result_invalid:
                print(f"INVALID example validation failed as expected. Found {len(validation_result_invalid)} errors:")
                for err in validation_result_invalid:
                    print(f"- {err}")
                print("\n")
            else:
                print(f"INVALID example validation FAILED (unexpected result): {validation_result_invalid}\n")

            # --- Test valid example (with BIDS context) ---
            print(f"Validating valid example (with BIDS context at {example_bids_root}): {valid_example_file}")
            # Note: This will just print the INFO message currently
            validation_result_bids = validator.validate(valid_example_file, raise_exceptions=False, bids_context=example_bids_root)
            if isinstance(validation_result_bids, list) and not validation_result_bids:
                 print("VALID example BIDS context validation successful (returned empty list - placeholder).\n")
            elif isinstance(validation_result_bids, list) and validation_result_bids:
                 print(f"VALID example BIDS context validation FAILED (placeholder errors): {validation_result_bids}\n")
            else:
                 print(f"VALID example BIDS context validation FAILED (unexpected result): {validation_result_bids}\n")

        except FileNotFoundError as e:
            print(f"Setup Error: {e}")
        except SignalJourneyValidationError as e:
            print(f"Setup or Validation Error: {e}")
        except Exception as e:
            print(f"An unexpected setup error occurred: {e}")

    else:
        print("Could not find schema file for basic test.")