import json
from pathlib import Path
from typing import Any, Dict, Union, Optional

import jsonschema

# Type alias for JSON data
JsonDict = Dict[str, Any]

DEFAULT_SCHEMA_PATH = Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"

class SignalJourneyValidationError(Exception):
    """Custom exception for validation errors."""
    pass

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

    def validate(self, data: Union[Path, str, JsonDict], raise_exceptions: bool = True) -> bool:
        """
        Validates the given signalJourney data against the loaded schema.

        Args:
            data: Path to the JSON file, the JSON string, or a dictionary representing the data.
            raise_exceptions: If True, raises jsonschema.ValidationError on failure.
                               If False, returns False on failure.

        Returns:
            True if the data is valid, False otherwise (if raise_exceptions is False).

        Raises:
            jsonschema.ValidationError: If validation fails and raise_exceptions is True.
            FileNotFoundError: If data is a path and the file does not exist.
            SignalJourneyValidationError: If data is a string and cannot be parsed as JSON.
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

        try:
            jsonschema.validate(instance=instance, schema=self._schema)
            return True
        except jsonschema.ValidationError as e:
            if raise_exceptions:
                raise e
            return False
        except Exception as e:
            # Catch other potential errors during validation
            if raise_exceptions:
                 raise SignalJourneyValidationError(f"An unexpected error occurred during validation: {e}") from e
            return False

# Example usage (optional, for quick testing)
if __name__ == '__main__':
    # Assumes schema and example files are in the correct relative paths
    # You might need to adjust paths depending on how you run this
    schema_file = Path(__file__).parent.parent.parent / "schema" / "signalJourney.schema.json"
    example_file = Path(__file__).parent.parent.parent / "schema" / "examples" / "simple_pipeline.json"

    if schema_file.exists() and example_file.exists():
        print(f"Using schema: {schema_file}")
        print(f"Validating example: {example_file}")
        try:
            validator = Validator(schema_file)
            is_valid = validator.validate(example_file, raise_exceptions=False)
            if is_valid:
                print("Validation successful!")
            else:
                 print("Validation failed.")
                 # Reraise with exception for details
                 try:
                     validator.validate(example_file, raise_exceptions=True)
                 except jsonschema.ValidationError as e:
                     print(f"Validation Error: {e.message}")
                     print(f"Path: {list(e.path)}")


        except FileNotFoundError as e:
            print(f"Error: {e}")
        except SignalJourneyValidationError as e:
            print(f"Error: {e}")
        except jsonschema.ValidationError as e:
             print(f"Validation Error: {e.message}")
             print(f"Path: {list(e.path)}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

    else:
        print("Could not find schema or example file for basic test.")
        print(f"Schema path check: {schema_file} {'exists' if schema_file.exists() else 'does not exist'}")
        print(f"Example path check: {example_file} {'exists' if example_file.exists() else 'does not exist'}") 