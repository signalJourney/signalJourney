import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import jsonschema
from jsonschema import Draft202012Validator

from .errors import SignalJourneyValidationError, ValidationErrorDetail
from .schema_registry import SchemaVersionRegistry

# Type alias for JSON dictionary
JsonDict = Dict[str, Any]

DEFAULT_SCHEMA_PATH = (
    Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"
)

# --- Helper Function for Inlining Refs ---


def inline_refs(
    schema: Union[Dict, list], base_path: Path, loaded_schemas_cache: Dict[str, Dict]
):
    """Recursively replace $ref keys with the content of the referenced file.
    Uses a cache (loaded_schemas_cache) to avoid infinite loops with circular refs
    and redundant file loading.
    Cache keys should be absolute POSIX paths of the schema files.
    """
    if isinstance(schema, dict):
        if (
            "$ref" in schema
            and isinstance(schema["$ref"], str)
            and not schema["$ref"].startswith("#")
        ):
            ref_path_str = schema["$ref"]
            # Resolve relative ref path against the current base path
            ref_path = (base_path / ref_path_str).resolve()

            # Cache key based on resolved absolute path
            cache_key = ref_path.as_posix()

            # Check cache first
            if cache_key in loaded_schemas_cache:
                # Return a copy to prevent modification issues during recursion
                return loaded_schemas_cache[cache_key].copy()

            # If not cached, load the file
            if ref_path.exists() and ref_path.is_file():
                try:
                    # print(
                    #     f"[Inline] Loading $ref: {ref_path_str} "
                    #     f"(from {base_path}) -> {ref_path}"
                    # )
                    with open(ref_path, "r", encoding="utf-8") as f:
                        ref_content = json.load(f)
                    # Store in cache BEFORE recursion to handle circular refs
                    loaded_schemas_cache[cache_key] = ref_content
                    # Recursively resolve refs *within* the loaded content
                    # Use the directory of the *referenced* file as the new base path
                    resolved_content = inline_refs(
                        ref_content, ref_path.parent, loaded_schemas_cache
                    )
                    # Update cache with the fully resolved content
                    loaded_schemas_cache[cache_key] = resolved_content
                    # Return a copy of the resolved content
                    return resolved_content.copy()
                except Exception as e:
                    print(
                        f"Warning: Failed to load or parse $ref: {ref_path_str} "
                        f"from {ref_path}. Error: {e}"
                    )
                    return schema  # Keep original $ref on error
            else:
                print(
                    f"Warning: $ref path does not exist or is not a file: "
                    f"{ref_path_str} -> {ref_path}"
                )
                return schema  # Keep original $ref if file not found
        else:
            # Recursively process other keys in the dictionary
            new_schema = {}
            for key, value in schema.items():
                new_schema[key] = inline_refs(value, base_path, loaded_schemas_cache)
            return new_schema
    elif isinstance(schema, list):
        # Recursively process items in the list
        return [inline_refs(item, base_path, loaded_schemas_cache) for item in schema]
    else:
        # Return non-dict/list items as is
        return schema


class Validator:
    """
    Validates a signalJourney JSON file or dictionary against the schema.
    Optionally performs BIDS context validation.
    Supports version-based schema validation.
    """

    _schema: JsonDict
    _validator: Draft202012Validator
    _registry: SchemaVersionRegistry
    _schema_version: Optional[str]

    def __init__(
        self,
        schema: Optional[Union[Path, str, JsonDict]] = None,
        schema_version: Optional[str] = None,
        schema_dir: Optional[Path] = None,
    ):
        """
        Initializes the Validator.

        Args:
            schema: Path to the schema file, the schema dictionary, or None
                    to use version-based schema loading. External file $refs will be
                    automatically inlined during initialization.
            schema_version: Specific schema version to use (e.g., "0.1.0"). 
                           If None, will auto-detect from data during validation.
            schema_dir: Custom schema directory path. If None, uses default.
        """
        self._registry = SchemaVersionRegistry(schema_dir)
        self._schema_version = schema_version
        
        if schema is not None:
            # Use provided schema (legacy behavior)
            schema_path = self._get_schema_path(schema)
            initial_schema = self._load_schema_dict(schema, schema_path)
            base_resolve_path = (
                schema_path.parent if schema_path else DEFAULT_SCHEMA_PATH.parent
            )
        elif schema_version is not None:
            # Use specific version from registry
            if not self._registry.is_version_supported(schema_version):
                raise ValueError(
                    f"Schema version '{schema_version}' is not supported. "
                    f"Available versions: {self._registry.get_supported_versions()}"
                )
            schema_path = self._registry.get_schema_path(schema_version)
            initial_schema = self._registry.load_schema(schema_version)
            base_resolve_path = schema_path.parent
        else:
            # Use latest version as default
            try:
                latest_version = self._registry.get_latest_version()
                self._schema_version = latest_version
                schema_path = self._registry.get_schema_path(latest_version)
                initial_schema = self._registry.load_schema(latest_version)
                base_resolve_path = schema_path.parent
            except Exception as e:
                # Fallback to legacy schema path if registry fails
                schema_path = DEFAULT_SCHEMA_PATH
                initial_schema = self._load_schema_dict(None, schema_path)
                base_resolve_path = schema_path.parent

        # Inline external $refs
        print("\n--- Inlining schema refs within Validator ---")
        loaded_cache = {}
        self._schema = inline_refs(initial_schema, base_resolve_path, loaded_cache)
        print("--- Inlining complete --- \n")

        # Initialize the validator with the resolved schema.
        try:
            # Check if schema is valid before creating validator
            Draft202012Validator.check_schema(self._schema)
            self._validator = Draft202012Validator(
                schema=self._schema,
            )
        except jsonschema.SchemaError as e:
            raise SignalJourneyValidationError(f"Invalid schema provided: {e}") from e

    def _get_schema_path(
        self, schema_input: Optional[Union[Path, str, JsonDict]]
    ) -> Optional[Path]:
        """Determines the Path object if schema is given as Path or str."""
        if schema_input is None:
            return DEFAULT_SCHEMA_PATH
        if isinstance(schema_input, Path):
            return schema_input
        if isinstance(schema_input, str):
            return Path(schema_input)
        return None

    def _load_schema_dict(
        self,
        schema_input: Optional[Union[Path, str, JsonDict]],
        schema_path: Optional[Path],
    ) -> JsonDict:
        """Loads the schema into a dictionary."""
        if isinstance(schema_input, dict):
            return schema_input.copy()  # Return a copy

        # Determine path to load from
        load_path = schema_path if schema_path else DEFAULT_SCHEMA_PATH

        if not load_path or not load_path.exists():
            raise FileNotFoundError(f"Schema file not found: {load_path}")
        try:
            with open(load_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise IOError(f"Error reading schema file {load_path}: {e}") from e

    def _create_validator_for_version(self, version: str) -> Draft202012Validator:
        """
        Create a validator for a specific schema version.
        
        Args:
            version: Schema version string
            
        Returns:
            Configured validator for the specified version
        """
        if not self._registry.is_version_supported(version):
            raise ValueError(
                f"Schema version '{version}' is not supported. "
                f"Available versions: {self._registry.get_supported_versions()}"
            )
        
        schema_path = self._registry.get_schema_path(version)
        schema_dict = self._registry.load_schema(version)
        
        # Inline external $refs
        loaded_cache = {}
        resolved_schema = inline_refs(schema_dict, schema_path.parent, loaded_cache)
        
        # Create and return validator
        Draft202012Validator.check_schema(resolved_schema)
        return Draft202012Validator(schema=resolved_schema)

    def validate(
        self,
        data: Union[Path, str, JsonDict],
        raise_exceptions: bool = True,
        bids_context: Optional[Path] = None,
        auto_detect_version: bool = True,
    ) -> List[ValidationErrorDetail]:
        """
        Validates the given data against the appropriate signalJourney schema.

        Args:
            data: Path to the JSON file, the JSON string, a dictionary
                  representing the JSON data.
            raise_exceptions: If True (default), raises SignalJourneyValidationError
                              on the first failure. If False, returns a list of
                              all validation errors found.
            bids_context: Optional Path to the BIDS dataset root directory.
                          If provided, enables BIDS context validation checks
                          (e.g., file existence relative to the root).
            auto_detect_version: If True (default), automatically detects the schema
                                version from the data and uses the appropriate schema.
                                If False, uses the validator's configured schema.

        Returns:
            A list of ValidationErrorDetail objects if raise_exceptions is False
            and validation fails. Returns an empty list if validation succeeds.

        Raises:
            SignalJourneyValidationError: If validation fails and
                                      raise_exceptions is True.
            FileNotFoundError: If data file/path does not exist.
            TypeError: If data is not a Path, string, or dictionary.
            ValueError: If detected schema version is not supported.
        """
        instance: JsonDict
        file_path_context: Optional[Path] = None  # For BIDS checks

        # --- Load Instance ---
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

        # --- Version Detection and Validator Selection ---
        validator_to_use = self._validator
        detected_version = None
        
        if auto_detect_version:
            try:
                detected_version = self._registry.detect_schema_version(instance)
                if detected_version:
                    if not self._registry.is_version_supported(detected_version):
                        error_msg = (
                            f"Detected schema version '{detected_version}' is not supported. "
                            f"Available versions: {self._registry.get_supported_versions()}"
                        )
                        if raise_exceptions:
                            raise SignalJourneyValidationError(error_msg)
                        else:
                            # Return a validation error
                            return [ValidationErrorDetail(
                                message=error_msg,
                                path=["schema_version"],
                                schema_path=[],
                                validator="version_support",
                                validator_value=self._registry.get_supported_versions(),
                                instance_value=detected_version,
                            )]
                    
                    # Use version-specific validator if different from current
                    if detected_version != self._schema_version:
                        validator_to_use = self._create_validator_for_version(detected_version)
                        
                elif self._schema_version is None:
                    # No version detected and no default configured
                    error_msg = (
                        "No schema_version field found in data and no default version configured. "
                        "Please specify a schema_version in your signalJourney file."
                    )
                    if raise_exceptions:
                        raise SignalJourneyValidationError(error_msg)
                    else:
                        return [ValidationErrorDetail(
                            message=error_msg,
                            path=["schema_version"],
                            schema_path=[],
                            validator="required",
                            validator_value=True,
                            instance_value=None,
                        )]
                        
            except (FileNotFoundError, IOError) as e:
                # Re-raise file system errors
                raise e
            except Exception as e:
                # Handle version detection errors
                error_msg = f"Error during schema version detection: {e}"
                if raise_exceptions:
                    raise SignalJourneyValidationError(error_msg) from e
                else:
                    return [ValidationErrorDetail(
                        message=error_msg,
                        path=["schema_version"],
                        schema_path=[],
                        validator="version_detection",
                        validator_value=None,
                        instance_value=instance.get("schema_version"),
                    )]

        schema_errors: List[ValidationErrorDetail] = []
        bids_errors: List[ValidationErrorDetail] = []

        # --- Schema Validation ---
        # Use the selected validator's iter_errors method
        try:
            errors = sorted(validator_to_use.iter_errors(instance), key=lambda e: e.path)
            if errors:
                for error in errors:
                    # Convert jsonschema error to our custom format
                    detail = ValidationErrorDetail(
                        message=error.message,
                        path=list(error.path),
                        schema_path=list(error.schema_path),
                        validator=error.validator,
                        validator_value=error.validator_value,
                        instance_value=error.instance,
                        # suggestion is added by ValidationErrorDetail constructor
                    )
                    schema_errors.append(detail)
        except jsonschema.RefResolutionError as e:
            # This shouldn't happen if schema is fully resolved, but handle defensively
            print(f"DEBUG: Unexpected RefResolutionError: {e}")
            failed_ref = getattr(e, "ref", "[unknown ref]")
            raise SignalJourneyValidationError(
                f"Schema validation failed: Unexpectedly could not resolve "
                f"reference '{failed_ref}'"
            ) from e
        except jsonschema.SchemaError as e:
            # Catch schema errors separately from resolution errors
            raise SignalJourneyValidationError(f"Invalid schema: {e}") from e
        except Exception as e:
            # Capture the actual exception type for better debugging
            print(
                f"DEBUG: Unexpected validation error type: "
                f"{type(e).__name__}, Error: {e}"
            )
            # Reraise or wrap depending on desired behavior
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
    
    def get_supported_versions(self) -> List[str]:
        """Get list of supported schema versions."""
        return self._registry.get_supported_versions()
    
    def get_current_version(self) -> Optional[str]:
        """Get the currently configured schema version."""
        return self._schema_version
    
    def get_latest_version(self) -> Optional[str]:
        """Get the latest available schema version."""
        return self._registry.get_latest_version()


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
