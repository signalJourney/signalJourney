"""Shared fixtures for pytest tests."""

import pytest
import json
from pathlib import Path
from jsonschema import Draft7Validator, RefResolver
from urllib.parse import urljoin

# Define the root directory of the project
PROJECT_ROOT = Path(__file__).parent.parent
SCHEMA_DIR = PROJECT_ROOT / "schema"
DEFINITIONS_DIR = SCHEMA_DIR / "definitions"
EXTENSIONS_DIR = SCHEMA_DIR / "extensions"

@pytest.fixture(scope="session")
def schema_base_uri():
    """Return the base URI for resolving schema references (local file path)."""
    return SCHEMA_DIR.as_uri() + "/" # Ensure trailing slash for urljoin

@pytest.fixture(scope="session")
def main_schema_path():
    """Path to the main signalJourney schema file."""
    return SCHEMA_DIR / "signalJourney.schema.json"

@pytest.fixture(scope="session")
def main_schema(main_schema_path):
    """Load the main signalJourney schema JSON object."""
    with open(main_schema_path, 'r', encoding='utf-8') as f:
        schema = json.load(f)
    # Optional: Pre-validate the schema itself upon loading
    # try:
    #     Draft7Validator.check_schema(schema)
    # except Exception as e:
    #     pytest.fail(f"Main schema ({main_schema_path}) is invalid: {e}")
    return schema

@pytest.fixture(scope="session")
def all_schemas(main_schema, main_schema_path, schema_base_uri):
    """Loads all schema fragments into a store keyed by their resolved URI."""
    store = {}
    main_schema_id = main_schema.get("$id", schema_base_uri)
    store[main_schema_id] = main_schema

    # Determine the base URL for relative refs from the main schema's $id
    # If $id is file based, use that, otherwise assume web URL structure
    if main_schema_id.startswith("file://"):
        base_resolve_uri = schema_base_uri
    else:
        # Construct base assuming $id is like 'https://.../schema/signalJourney.schema.json'
        base_resolve_uri = main_schema_id.rsplit('/', 1)[0] + "/"

    # Load definitions
    for schema_file in DEFINITIONS_DIR.glob("*.schema.json"):
        with open(schema_file, 'r', encoding='utf-8') as f:
            schema_content = json.load(f)
        # Key should be the absolute URI the $ref will resolve to
        resolved_uri = urljoin(base_resolve_uri + "definitions/", schema_file.name)
        store[resolved_uri] = schema_content

    # Load extensions
    for schema_file in EXTENSIONS_DIR.glob("*.schema.json"):
        with open(schema_file, 'r', encoding='utf-8') as f:
            schema_content = json.load(f)
        resolved_uri = urljoin(base_resolve_uri + "extensions/", schema_file.name)
        store[resolved_uri] = schema_content

    return store

@pytest.fixture(scope="session")
def schema_resolver(main_schema, schema_base_uri, all_schemas):
    """Create a RefResolver pre-filled with all local schemas."""
    # The resolver uses the store to find schemas by their resolved URI
    return RefResolver(base_uri=schema_base_uri, referrer=main_schema, store=all_schemas)

@pytest.fixture(scope="session")
def validator(main_schema, schema_resolver):
    """Provides a configured Draft7Validator instance."""
    # Pass the pre-filled resolver to the validator
    return Draft7Validator(main_schema, resolver=schema_resolver)

# Example fixture to load data - adjust as needed
@pytest.fixture
def load_json_example():
    """Factory fixture to load a JSON example file from tests/schemas/examples/."""
    example_dir = PROJECT_ROOT / "tests" / "schemas" / "examples"
    def _loader(filename):
        file_path = example_dir / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Example file not found: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError as e:
                pytest.fail(f"Failed to parse JSON example {filename}: {e}")
    return _loader 