# User Guide: Python Validator Library

This guide provides comprehensive details on using the `signaljourney-validator` Python library for validating signalJourney JSON files against the official schema.

## Installation

```bash
pip install signaljourney-validator
```

To include optional suggestion features based on fuzzy string matching (which requires `python-Levenshtein` for optimal performance), install the `suggestions` extra:

```bash
pip install signaljourney-validator[suggestions]
```

## Core Components

The library primarily revolves around two classes:

*   `signaljourney_validator.Validator`: The main class used to load schemas and perform validation.
*   `signaljourney_validator.errors.ValidationErrorDetail`: A dataclass representing a single validation error, including its message, location, and potential suggestions.
*   `signaljourney_validator.validator.SignalJourneyValidationError`: A custom exception raised by the `Validator` when validation fails (if `raise_exceptions=True`). It contains a list of `ValidationErrorDetail` objects.

## Usage

### Initialization

Create an instance of the `Validator` class. By default, it loads the schema bundled with the package.

```python
from signaljourney_validator import Validator

# Use the default bundled schema
validator = Validator()
```

You can also provide a path to a custom schema file or a dictionary containing the schema during initialization:

```python
from pathlib import Path

# Use a custom schema file
custom_schema_file = Path('./path/to/your_schema.json')
validator_custom_file = Validator(schema=custom_schema_file)

# Use a schema loaded into a dictionary
import json
with open('./path/to/your_schema.json', 'r') as f:
    custom_schema_dict = json.load(f)
validator_custom_dict = Validator(schema=custom_schema_dict)
```

### Performing Validation

The `validate()` method is used to check data against the loaded schema. It accepts:

*   A `pathlib.Path` object pointing to the JSON file.
*   A string containing the path to the JSON file.
*   A string containing the JSON data itself (this is discouraged for large files).
*   A Python dictionary representing the loaded JSON data.

**Validation Modes:**

1.  **Raise Exception on Failure (Default):**
    If `raise_exceptions=True` (the default), the method returns `True` if the data is valid, and raises a `SignalJourneyValidationError` if it's invalid. The exception object has an `errors` attribute containing a list of `ValidationErrorDetail` objects.

    ```python
    from signaljourney_validator import Validator, SignalJourneyValidationError
    
    validator = Validator()
    data_to_validate = 'path/to/your_file.signalJourney.json' # or a dict
    
    try:
        is_valid = validator.validate(data_to_validate)
        print("Data is valid!")
    except SignalJourneyValidationError as e:
        print(f"Validation Failed: {e}")
        for error in e.errors:
            print(f"  - Path: {error.path}, Message: {error.message}")
            if error.suggestion:
                print(f"    Suggestion: {error.suggestion}")
    except FileNotFoundError:
        print("Input file not found.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    ```

2.  **Return Errors on Failure:**
    If `raise_exceptions=False`, the method returns an empty list (`[]`) if the data is valid, or a list of `ValidationErrorDetail` objects if it's invalid.

    ```python
    validator = Validator()
    data_to_validate = {"sj_version": "invalid"} # Example invalid data
    
    errors = validator.validate(data_to_validate, raise_exceptions=False)
    
    if not errors: # Empty list means valid
        print("Data is valid!")
    else:
        print(f"Validation Failed. Found {len(errors)} errors:")
        for error in errors:
            print(f"  - Path: {error.path}, Message: {error.message}")
            if error.suggestion:
                print(f"    Suggestion: {error.suggestion}")
    ```

### BIDS Context Validation (Experimental)

To enable experimental checks related to BIDS structure (like file placement and referencing), provide the path to the BIDS dataset root using the `bids_context` argument.

```python
from pathlib import Path

validator = Validator()
bids_root = Path('/data/my_bids_dataset')
journey_file = bids_root / 'derivatives' / 'pipeline' / 'sub-01_signalJourney.json'

errors = validator.validate(journey_file, bids_context=bids_root, raise_exceptions=False)

if errors:
    print("Validation failed (possibly BIDS context issues):")
    # ... process errors ...
```

Currently, BIDS context validation is primarily a placeholder and will print an informational message. Future versions will implement more specific checks.

## Error Details (`ValidationErrorDetail`)

Each object in the list returned by `validate(..., raise_exceptions=False)` or contained in `SignalJourneyValidationError.errors` provides details about a specific validation failure:

*   `message` (str): The error message from the underlying `jsonschema` validator.
*   `path` (List[Union[str, int]]): A list representing the path to the failing element within the JSON data (e.g., `['processingSteps', 0, 'parameters', 'cutoff']`).
*   `schema_path` (List[Union[str, int]]): The path within the JSON schema that defines the rule that failed.
*   `validator` (str): The name of the JSON schema keyword that failed (e.g., 'required', 'type', 'pattern').
*   `validator_value` (Any): The value of the schema keyword that failed (e.g., the required property name, the expected type, the regex pattern).
*   `instance_value` (Any): The actual value in the data that caused the failure.
*   `context` (List['ValidationErrorDetail']): For complex validation failures (like `anyOf`), this may contain sub-errors providing more context.
*   `suggestion` (Optional[str]): An optional suggestion generated by the library to help fix the error. Requires the `[suggestions]` extra to be installed for some suggestion types (like enum fuzzy matching).

The `ValidationErrorDetail` class also has a `__str__` method that provides a basic formatted error message including the path and suggestion if available.

## Suggestions

The library attempts to generate helpful suggestions for common errors:

*   **`required`:** Suggests adding the missing property/properties.
*   **`type`:** Suggests changing the value to the expected type(s).
*   **`pattern`:** Reminds the user to match the specified regex pattern.
*   **`enum`:** Lists the allowed values. If `[suggestions]` extra is installed, it may suggest the closest match using fuzzy string matching for string values.
*   **`format`:** Reminds the user to conform to the format (e.g., 'date-time', 'uri') and may provide examples.
*   **Length/Numeric Constraints:** Suggests ensuring the value meets the minimum/maximum length, item count, or numeric value.

Suggestions are best-effort and may not cover all cases.

## Error Handling

Besides `SignalJourneyValidationError`, the validator might raise:

*   `FileNotFoundError`: If a specified file path (for data or schema) does not exist.
*   `json.JSONDecodeError` (via `SignalJourneyValidationError`): If a file contains invalid JSON.
*   `TypeError`: If invalid argument types are passed (e.g., providing a number as the schema).
*   `jsonschema.SchemaError` (via `SignalJourneyValidationError`): If the provided schema itself is invalid.

It's recommended to wrap validation calls in appropriate try-except blocks. 