"""Shared fixtures for pytest tests."""

import json
from pathlib import Path
from urllib.parse import urljoin

import pytest
from jsonschema import RefResolver

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
    """Return the standard base URI for resolving schema references."""
    # Use the defined standard URI, not the local file path
    return "https://signaljourney.neurodata.io/schema/"


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
def all_schemas(main_schema, main_schema_path, schema_base_uri):
    """Loads all schema files into a dictionary suitable for RefResolver store.
    
    Uses the schema's internal '$id' as the key for the store, which is the
    standard mechanism for jsonschema resolution.
    """
    store = {}
    # Add main schema using its $id if present, otherwise fall back to base URI logic
    if "$id" in main_schema:
        store[main_schema["$id"]] = main_schema
    else:
        # Fallback if $id is missing, though it shouldn't be for the main schema
        store[schema_base_uri + main_schema_path.name] = main_schema


    def load_schemas_from_dir(directory):
        if not directory.exists():
            return
        for schema_file in directory.glob("*.schema.json"):
            try:
                with open(schema_file, "r", encoding="utf-8") as f:
                    schema_content = json.load(f)
                # Use the $id within the schema file as the key
                if "$id" in schema_content:
                    store[schema_content["$id"]] = schema_content
                else:
                    print(f"Warning: Schema file {schema_file} is missing '$id'. Skipping.")
            except json.JSONDecodeError:
                print(f"Warning: Could not decode JSON from {schema_file}. Skipping.")
            except Exception as e:
                 print(f"Warning: Could not load schema {schema_file}: {e}. Skipping.")

    load_schemas_from_dir(SCHEMA_DIR) # Load top-level schemas like signalJourney.schema.json if needed (already added though)
    load_schemas_from_dir(DEFINITIONS_DIR)
    load_schemas_from_dir(EXTENSIONS_DIR)

    # Debug: Print the store keys to verify
    # print("\\nResolver Store Keys:")
    # for key in store.keys():
    #     print(f"- {key}")
    # print("\\n")

    return store


@pytest.fixture(scope="session")
def schema_resolver(schema_base_uri, main_schema, all_schemas):
    """Create a RefResolver pre-filled with all local schemas.
    
    The resolver uses the store (keyed by $id) to find schemas.
    The base_uri here helps if any $refs *inside* schemas are relative,
    but primarily resolution happens via the absolute $id URIs in the store.
    """
    # The resolver uses the store (keyed by $id) to find schemas.
    # The base_uri here helps if any $refs *inside* schemas are relative,
    # but primarily resolution happens via the absolute $id URIs in the store.
    return RefResolver(
        base_uri=schema_base_uri, # Use the standard URI
        referrer=main_schema,
        store=all_schemas
    )


@pytest.fixture(scope="session")
def validator(main_schema, schema_resolver):
    """Provides a configured SignalJourneyValidator instance."""
    # Instantiate our custom validator, passing the loaded main schema
    # and the pre-configured resolver.
    sj_validator = SignalJourneyValidator(schema=main_schema, resolver=schema_resolver)
    return sj_validator


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
