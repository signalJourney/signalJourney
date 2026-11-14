import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from urllib.parse import unquote

import jsonschema
from jsonschema import Draft202012Validator

from .errors import (
    SchemaResolutionError,
    SignalJourneyValidationError,
    ValidationErrorDetail,
)
from .schema_registry import DEFAULT_SCHEMA_DIR, SchemaVersionRegistry

logger = logging.getLogger("signaljourney_validator")

# Type alias for JSON dictionary
JsonDict = Dict[str, Any]

DEFAULT_SCHEMA_PATH = DEFAULT_SCHEMA_DIR / "signalJourney.schema.json"

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
            if not (ref_path.exists() and ref_path.is_file()):
                raise SchemaResolutionError(
                    f"$ref path does not exist or is not a file: "
                    f"{ref_path_str} -> {ref_path}"
                )
            try:
                with open(ref_path, "r", encoding="utf-8") as f:
                    ref_content = json.load(f)
            except (OSError, ValueError) as e:
                raise SchemaResolutionError(
                    f"Failed to load or parse $ref: {ref_path_str} "
                    f"from {ref_path}. Error: {e}"
                ) from e
            logger.debug("Loading $ref %s -> %s", ref_path_str, ref_path)
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


def _check_local_refs(root: JsonDict) -> None:
    """Raise SchemaResolutionError for a ``#/...`` $ref that points nowhere.

    External file refs are inlined (or refused) by ``inline_refs``; what is
    left after inlining are pointers into a schema document.
    A pointer is resolved against the nearest enclosing ``$id`` (the sub-schema
    that declares one is its own document, as jsonschema treats it), or against
    ``root`` when no ``$id`` encloses it.
    A pointer that does not resolve would otherwise only fail while validating
    a document.
    """

    def resolve(document: Any, pointer: str) -> bool:
        node: Any = document
        for token in pointer.split("/")[1:]:
            token = unquote(token).replace("~1", "/").replace("~0", "~")
            if isinstance(node, dict) and token in node:
                node = node[token]
            elif isinstance(node, list) and token.isdigit() and int(token) < len(node):
                node = node[int(token)]
            else:
                return False
        return True

    def walk(node: Any, document: Any) -> None:
        if isinstance(node, dict):
            if isinstance(node.get("$id"), str):
                document = node  # this sub-schema is its own document
            ref = node.get("$ref")
            if (
                isinstance(ref, str)
                and (ref == "#" or ref.startswith("#/"))
                and not resolve(document, ref[1:])
            ):
                raise SchemaResolutionError(
                    f"$ref '{ref}' does not resolve within the schema"
                )
            for value in node.values():
                walk(value, document)
        elif isinstance(node, list):
            for item in node:
                walk(item, document)

    walk(root, root)


def resolve_schema_refs(
    schema: JsonDict, base_path: Path, loaded_schemas_cache: Dict[str, Dict]
) -> JsonDict:
    """Inline every external $ref of ``schema`` and check the local ones.

    Raises:
        SchemaResolutionError: If any $ref cannot be resolved.
    """
    resolved = inline_refs(schema, base_path, loaded_schemas_cache)
    _check_local_refs(resolved)
    return resolved


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
            schema_dir: Custom schema directory path. If None, uses the schema
                        packaged with the library. A directory that does not
                        exist, or a schema file in it that cannot be read or
                        parsed, raises SchemaResolutionError. The one fallback:
                        a directory that exists but holds no schema version
                        (no ``versions/`` entry) uses the packaged schema and
                        logs a warning.
        """
        if schema_dir is not None and not Path(schema_dir).is_dir():
            raise SchemaResolutionError(
                f"schema_dir does not exist or is not a directory: {schema_dir}"
            )
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
            initial_schema = self._load_registry_schema(schema_version)
            base_resolve_path = schema_path.parent
        else:
            # Use latest version as default
            latest_version = self._registry.get_latest_version()
            if latest_version is None:
                # The one documented fallback: the directory exists but holds
                # no schema version, so the packaged schema is used.
                logger.warning(
                    "No schema version found in %s; using the packaged schema",
                    self._registry.schema_dir,
                )
                schema_path = DEFAULT_SCHEMA_PATH
                initial_schema = self._load_schema_dict(None, schema_path)
                base_resolve_path = schema_path.parent
            else:
                self._schema_version = latest_version
                schema_path = self._registry.get_schema_path(latest_version)
                initial_schema = self._load_registry_schema(latest_version)
                base_resolve_path = schema_path.parent

        # Inline external $refs; an unresolved one raises SchemaResolutionError.
        logger.debug("Inlining schema refs within Validator")
        loaded_cache = {}
        self._schema = resolve_schema_refs(
            initial_schema, base_resolve_path, loaded_cache
        )
        logger.debug("Inlining complete")

        # Initialize the validator with the resolved schema.
        try:
            # Check if schema is valid before creating validator
            Draft202012Validator.check_schema(self._schema)
            self._validator = Draft202012Validator(
                schema=self._schema,
            )
        except jsonschema.SchemaError as e:
            raise SignalJourneyValidationError(f"Invalid schema provided: {e}") from e

    def _load_registry_schema(self, version: str) -> JsonDict:
        """Load a registered schema version; an unreadable file is an error."""
        try:
            return self._registry.load_schema(version)
        except OSError as e:
            raise SchemaResolutionError(
                f"Cannot load schema version '{version}': {e}"
            ) from e

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
        schema_dict = self._load_registry_schema(version)

        # Inline external $refs
        loaded_cache = {}
        resolved_schema = resolve_schema_refs(
            schema_dict, schema_path.parent, loaded_cache
        )

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
                            f"Detected schema version '{detected_version}' is not "
                            f"supported. Available versions: "
                            f"{self._registry.get_supported_versions()}"
                        )
                        if raise_exceptions:
                            raise SignalJourneyValidationError(error_msg)
                        else:
                            # Return a validation error
                            return [
                                ValidationErrorDetail(
                                    message=error_msg,
                                    path=["schema_version"],
                                    schema_path=[],
                                    validator="version_support",
                                    validator_value=self._registry.get_supported_versions(),
                                    instance_value=detected_version,
                                )
                            ]

                    # Use version-specific validator if different from current
                    if detected_version != self._schema_version:
                        validator_to_use = self._create_validator_for_version(
                            detected_version
                        )

                elif self._schema_version is None:
                    # No version detected and no default configured
                    error_msg = (
                        "No schema_version field found in data and no default version "
                        "configured. Please specify a schema_version in your "
                        "signalJourney file."
                    )
                    if raise_exceptions:
                        raise SignalJourneyValidationError(error_msg)
                    else:
                        return [
                            ValidationErrorDetail(
                                message=error_msg,
                                path=["schema_version"],
                                schema_path=[],
                                validator="required",
                                validator_value=True,
                                instance_value=None,
                            )
                        ]

            except (FileNotFoundError, IOError) as e:
                # Re-raise file system errors
                raise e
            except Exception as e:
                # Handle version detection errors
                error_msg = f"Error during schema version detection: {e}"
                if raise_exceptions:
                    raise SignalJourneyValidationError(error_msg) from e
                else:
                    return [
                        ValidationErrorDetail(
                            message=error_msg,
                            path=["schema_version"],
                            schema_path=[],
                            validator="version_detection",
                            validator_value=None,
                            instance_value=instance.get("schema_version"),
                        )
                    ]

        schema_errors: List[ValidationErrorDetail] = []
        bids_errors: List[ValidationErrorDetail] = []

        # --- Schema Validation ---
        # Use the selected validator's iter_errors method
        try:
            errors = sorted(
                validator_to_use.iter_errors(instance), key=lambda e: e.path
            )
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
            logger.debug("Unexpected RefResolutionError: %s", e)
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
            logger.debug(
                "Unexpected validation error type: %s, Error: %s",
                type(e).__name__,
                e,
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
        logger.info(
            "BIDS context validation requested for %s within %s (Not implemented)",
            file_path,
            bids_root,
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
