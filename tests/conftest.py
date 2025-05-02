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
    """Return the base URI for resolving schema references (local file path)."""
    return SCHEMA_DIR.as_uri() + "/"  # Ensure trailing slash for urljoin


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
    """Loads all schema files into a dictionary suitable for RefResolver store."""
    store = {schema_base_uri + main_schema_path.name: main_schema}

    def load_schemas_from_dir(directory, prefix):
        if not directory.exists():
            return
        base_resolve_uri = schema_base_uri  # Use overall base for resolving
        for schema_file in directory.glob("*.schema.json"):
            with open(schema_file, "r", encoding="utf-8") as f:
                schema_content = json.load(f)
            # Construct URI using the prefix (definitions/ or extensions/)
            resolved_uri = urljoin(base_resolve_uri + prefix, schema_file.name)
            store[resolved_uri] = schema_content

    load_schemas_from_dir(DEFINITIONS_DIR, "definitions/")
    load_schemas_from_dir(EXTENSIONS_DIR, "extensions/")

    return store


@pytest.fixture(scope="session")
def schema_resolver(schema_base_uri, main_schema, all_schemas):
    """Create a RefResolver pre-filled with all local schemas."""
    # The resolver uses the store to find schemas by their resolved URI
    return RefResolver(
        base_uri=schema_base_uri, referrer=main_schema, store=all_schemas
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
