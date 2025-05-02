import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import jsonschema
from jsonschema import Draft7Validator

from .errors import ValidationErrorDetail

# Type alias for JSON dictionary
JsonDict = Dict[str, Any]

DEFAULT_SCHEMA_PATH = (
    Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"
)


class SignalJourneyValidationError(Exception):
    """Custom exception for validation errors."""

    def __init__(
        self, message: str, errors: Optional[List[ValidationErrorDetail]] = None
    ):
        super().__init__(message)
        self.errors = errors or []


class Validator:
    """
    Validates a signalJourney JSON file or dictionary against the schema.
    Optionally performs BIDS context validation.
    """

    def __init__(
        self,
        schema: Optional[Union[Path, str, JsonDict]] = None,
        resolver: Optional[jsonschema.RefResolver] = None,
    ):
        """
        Initializes the Validator.

        Args:
            schema: Path to the schema file, the schema dictionary, or None
                    to use the default schema.
            resolver: An optional pre-configured RefResolver instance.
        """
        self._schema = self._load_schema(schema)
        # Pass the resolver during Draft7Validator instantiation
        self._validator = Draft7Validator(self._schema, resolver=resolver)

    def _load_schema(
        self, schema_input: Optional[Union[Path, str, JsonDict]]
    ) -> JsonDict:
        """Loads the JSON schema from a file or uses the provided dictionary."""
        if schema_input is None:
            schema_path = DEFAULT_SCHEMA_PATH
            if not schema_path.exists():
                raise FileNotFoundError(
                    f"Default schema file not found at {schema_path}"
                )
            try:
                with open(schema_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                raise SignalJourneyValidationError(
                    f"Error decoding default schema JSON: {e}"
                ) from e
            except Exception as e:
                raise SignalJourneyValidationError(
                    f"Error loading default schema file: {e}"
                ) from e
        elif isinstance(schema_input, (Path, str)):
            schema_path = Path(schema_input)
            if not schema_path.exists():
                raise FileNotFoundError(f"Schema file not found: {schema_path}")
            try:
                with open(schema_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except json.JSONDecodeError as e:
                raise SignalJourneyValidationError(
                    f"Error decoding schema JSON from {schema_path}: {e}"
                ) from e
            except Exception as e:
                raise SignalJourneyValidationError(
                    f"Error loading schema file from {schema_path}: {e}"
                ) from e
        elif isinstance(schema_input, dict):
            # TODO: Add basic validation to ensure it looks like a schema?
            return schema_input
        else:
            raise TypeError("Schema input must be a Path, string, dictionary, or None.")

    def validate(
        self,
        data: Union[Path, str, JsonDict],
        raise_exceptions: bool = True,
        bids_context: Optional[Path] = None,
    ) -> List[ValidationErrorDetail]:
        """
        Validates the given data against the loaded signalJourney schema.

        Args:
            data: Path to the JSON file, the JSON string, a dictionary
                  representing the JSON data.
            raise_exceptions: If True (default), raises SignalJourneyValidationError
                              on the first failure. If False, returns a list of
                              all validation errors found.
            bids_context: Optional Path to the BIDS dataset root directory.
                          If provided, enables BIDS context validation checks
                          (e.g., file existence relative to the root).

        Returns:
            A list of ValidationErrorDetail objects if raise_exceptions is False
            and validation fails. Returns an empty list if validation succeeds.

        Raises:
            SignalJourneyValidationError: If validation fails and
                                      raise_exceptions is True.
            FileNotFoundError: If data file/path does not exist.
            TypeError: If data is not a Path, string, or dictionary.
        """
        instance: JsonDict
        file_path_context: Optional[Path] = None  # For BIDS checks

        if isinstance(data, (Path, str)):
            file_path = Path(data)
            file_path_context = file_path  # Store for BIDS checks
            if not file_path.exists():
                raise FileNotFoundError(f"Data file not found: {file_path}")
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    instance = json.load(f)
            except json.JSONDecodeError as e:
                raise SignalJourneyValidationError(
                    f"Error decoding data JSON from {file_path}: {e}"
                ) from e
            except Exception as e:
                raise SignalJourneyValidationError(
                    f"Error loading data file from {file_path}: {e}"
                ) from e
        elif isinstance(data, dict):
            instance = data
        else:
            raise TypeError("Data must be a Path, string, or dictionary.")

        schema_errors: List[ValidationErrorDetail] = []
        bids_errors: List[ValidationErrorDetail] = []

        # --- Schema Validation ---
        try:
            errors = sorted(self._validator.iter_errors(instance), key=lambda e: e.path)
            if errors:
                for error in errors:
                    detail = ValidationErrorDetail(
                        message=error.message,
                        path=list(error.path),
                        schema_path=list(error.schema_path),
                        validator=error.validator,
                        validator_value=error.validator_value,
                        instance_value=error.instance,
                        context=[  # Recursively convert context errors
                            ValidationErrorDetail(
                                message=sub_error.message,
                                path=list(sub_error.path),
                                schema_path=list(sub_error.schema_path),
                                validator=sub_error.validator,
                                validator_value=sub_error.validator_value,
                                instance_value=sub_error.instance,
                            )
                            for sub_error in error.context
                        ],
                    )
                    # Suggestion generated in __post_init__
                    schema_errors.append(detail)

        except jsonschema.SchemaError as e:
            # Indicates a problem with the schema itself
            raise SignalJourneyValidationError(f"Invalid schema: {e}") from e
        except Exception as e:
            # Catch other unexpected errors during validation
            raise SignalJourneyValidationError(
                f"An unexpected error occurred during schema validation: {e}"
            ) from e

        # --- BIDS Context Validation (Optional) ---
        if bids_context:
            bids_errors = self._validate_bids_context(
                instance, file_path_context, bids_context
            )

        all_errors = schema_errors + bids_errors

        # --- Result Handling ---
        if all_errors:
            if raise_exceptions:
                raise SignalJourneyValidationError(
                    "Validation failed.", errors=all_errors
                )
            else:
                return all_errors
        else:
            return []  # Success

    def _validate_bids_context(
        self, instance: JsonDict, file_path: Optional[Path], bids_root: Path
    ) -> List[ValidationErrorDetail]:
        """Placeholder for BIDS context validation logic."""
        errors: List[ValidationErrorDetail] = []
        print(
            f"[INFO] BIDS context validation requested for {file_path} "
            f"within {bids_root} (Not implemented)"
        )

        # TODO: Implement BIDS checks using file_path and bids_root
        # Examples:
        # - Check if file_path is correctly placed within bids_root derivatives
        # - Check naming convention against BIDS standards (might need pybids)
        # - Check if files referenced in inputSources/outputTargets exist
        #   relative to bids_root
        # - Differentiate rules for root-level vs derivative-level journey files

        # Example error:
        # if some_bids_check_fails:
        #     errors.append(ValidationErrorDetail(
        #         message="BIDS Check Failed: Reason...",
        #         path=['relevant', 'path']
        #     ))

        return errors


# Example usage when run directly
if __name__ == "__main__":
    # Assumes schema and example files are in the correct relative paths
    schema_file = (
        Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"
    )
    # Use an invalid example for testing errors
    invalid_example_dict = {
        "sj_version": "0.1",  # Invalid pattern
        "description": "Invalid example for direct run",
        "pipelineInfo": {"projectName": "Test"},
        # Missing processingSteps
    }
    valid_example_file = (
        Path(__file__).parent.parent.parent
        / "schema"
        / "examples"
        / "simple_pipeline.json"
    )
    # Example BIDS context (adjust path as needed for your system)
    example_bids_root = (
        Path(__file__).parent.parent.parent / "tests" / "data" / "bids_dataset"
    )  # Assuming tests/data exists

    if schema_file.exists():
        print(f"Using schema: {schema_file}\n")
        try:
            validator = Validator(schema=schema_file)

            # --- Test valid example (no BIDS) ---
            print(f"Validating valid example (no BIDS): {valid_example_file}")
            validation_result_valid = validator.validate(
                valid_example_file, raise_exceptions=False
            )
            if (
                isinstance(validation_result_valid, list)
                and not validation_result_valid
            ):
                print("VALID example validation successful (returned empty list).\n")
            else:
                print(
                    f"VALID example validation FAILED (unexpected result): "
                    f"{validation_result_valid}\n"
                )

            # --- Test invalid example (no BIDS) ---
            print("Validating invalid example (no BIDS)...")
            validation_result_invalid = validator.validate(
                invalid_example_dict, raise_exceptions=False
            )
            if (
                isinstance(validation_result_invalid, list)
                and validation_result_invalid
            ):
                print(
                    f"INVALID example validation failed as expected. "
                    f"Found {len(validation_result_invalid)} errors:"
                )
                for err in validation_result_invalid:
                    print(f"- {err}")
                print("\n")
            else:
                print(
                    f"INVALID example validation FAILED (unexpected result): "
                    f"{validation_result_invalid}\n"
                )

            # --- Test valid example (with BIDS context) ---
            print(
                f"Validating valid example (with BIDS context at {example_bids_root}): "
                f"{valid_example_file}"
            )
            # Note: This will just print the INFO message currently
            validation_result_bids = validator.validate(
                valid_example_file,
                raise_exceptions=False,
                bids_context=example_bids_root,
            )
            if isinstance(validation_result_bids, list) and not validation_result_bids:
                print(
                    "VALID example BIDS context validation successful "
                    "(returned empty list - placeholder).\n"
                )
            elif isinstance(validation_result_bids, list) and validation_result_bids:
                print(
                    f"VALID example BIDS context validation FAILED "
                    f"(placeholder errors): {validation_result_bids}\n"
                )
            else:
                print(
                    f"VALID example BIDS context validation FAILED "
                    f"(unexpected result): {validation_result_bids}\n"
                )

        except FileNotFoundError as e:
            print(f"Error finding file: {e}\n")
        except SignalJourneyValidationError as e:
            print(f"Validation Error: {e}\nDetails: {e.errors}\n")
        except Exception as e:
            print(f"An unexpected error occurred: {e}\n")

    else:
        print(f"Default schema file not found: {schema_file}")
