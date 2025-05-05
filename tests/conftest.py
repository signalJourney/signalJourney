"""Shared fixtures for pytest tests."""

import json
from pathlib import Path
from typing import Dict, Union

import pytest

# Removed jsonschema imports as validator handles it
# Removed RefResolver
# Import our custom Validator
from signaljourney_validator.validator import Validator as SignalJourneyValidator

# Define the root directory of the project
PROJECT_ROOT = Path(__file__).parent.parent
SCHEMA_DIR = PROJECT_ROOT / "schema"
DEFINITIONS_DIR = SCHEMA_DIR / "definitions"
EXTENSIONS_DIR = SCHEMA_DIR / "extensions"
EXAMPLES_DIR = PROJECT_ROOT / "tests" / "schemas" / "examples"


@pytest.fixture(scope="session")
def schema_base_uri():
    """Return the base URI for resolving schema references using file scheme."""
    # Use the directory containing the main schema as the base URI
    schema_dir = SCHEMA_DIR.resolve()
    return schema_dir.as_uri() + "/"  # Ensure trailing slash for directory URI


@pytest.fixture(scope="session")
def main_schema_path():
    """Path to the main signalJourney schema file."""
    return SCHEMA_DIR / "signalJourney.schema.json"


@pytest.fixture(scope="session")
def main_schema(main_schema_path):
    """Load the main signalJourney schema JSON object."""
    with open(main_schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)
    # Optional: Pre-validate the schema itself upon loading
    # try:
    #     Draft7Validator.check_schema(schema)
    # except Exception as e:
    #     pytest.fail(f"Main schema ({main_schema_path}) is invalid: {e}")
    return schema


@pytest.fixture(scope="session")
def all_schemas(main_schema, main_schema_path):
    """Loads all schema files into a dictionary keyed by paths relative
    to schema dir.
    """
    store = {}
    # Key main schema by its filename
    store[main_schema_path.name] = main_schema

    def load_schemas_from_dir(directory, prefix):
        if not directory.exists():
            return
        for schema_file in directory.glob("*.schema.json"):
            # Calculate the relative path key (e.g., definitions/file.schema.json)
            relative_key = prefix + schema_file.name
            try:
                with open(schema_file, "r", encoding="utf-8") as f:
                    schema_content = json.load(f)
                store[relative_key] = schema_content
            except json.JSONDecodeError:
                print(f"Warning: Could not decode JSON from {schema_file}. Skipping.")
            except Exception as e:
                print(f"Warning: Could not load schema {schema_file}: {e}. Skipping.")

    # Load definition and extension schemas using relative path prefixes
    load_schemas_from_dir(DEFINITIONS_DIR, "definitions/")
    load_schemas_from_dir(EXTENSIONS_DIR, "extensions/")
    return store


# --- Helper Function for Inlining Refs ---
def inline_refs(
    schema: Union[Dict, list],
    base_path: Path,
    loaded_schemas_cache: Dict[str, Dict]
):
    """Recursively replace $ref keys with the content of the referenced file."""
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
                    print(
                        f"[Inline] Loading $ref: {ref_path_str} "
                        f"(from {base_path}) -> {ref_path}"
                    )
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


@pytest.fixture(scope="session")
def validator(main_schema):
    """Provides a Validator instance initialized with the main schema content.
    The Validator class itself handles ref inlining now.
    """
    print("\n--- Initializing Validator for Test ---")
    # Initialize our custom validator, passing the main schema dictionary.
    # The Validator class will handle inlining internally.
    try:
        sj_validator = SignalJourneyValidator(
            schema=main_schema,  # Pass the main schema dict
        )
        print("--- Validator Initialized --- \n")
        return sj_validator
    except Exception as e:
        pytest.fail(f"Failed to initialize SignalJourneyValidator: {e}")


@pytest.fixture(scope="session")
def load_json_example():
    """Fixture to load a JSON example file from the tests/schemas/examples dir."""

    def _loader(filename):
        filepath = EXAMPLES_DIR / filename
        if not filepath.exists():
            pytest.fail(f"Example JSON file not found: {filepath}")
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            pytest.fail(f"Error decoding JSON from {filepath}: {e}")
        except Exception as e:
            pytest.fail(f"Error loading file {filepath}: {e}")

    return _loader
