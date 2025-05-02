# Tutorial: Validating signalJourney Files

Validating your signalJourney files ensures they conform to the official specification, promoting interoperability and preventing errors when tools consume the files.

There are two main ways to validate:

1.  **Using the CLI:** Quick checks from the command line.
2.  **Using the Python Library:** Programmatic validation within scripts.

**Prerequisites:**

*   The `signaljourney-validator` package installed (`pip install signaljourney-validator`).
*   signalJourney JSON files to validate.

## 1. Using the Command-Line Interface (CLI)

The `signaljourney-validate` command provides a simple way to validate files.

**Validate a Single File:**

```bash
signaljourney-validate path/to/your_pipeline.signalJourney.json
```

*   If valid, it prints: `✓ path/to/your_pipeline.signalJourney.json is valid` and exits with code 0.
*   If invalid, it prints: `✗ path/to/your_pipeline.signalJourney.json has validation errors:` followed by details, and exits with code 1.

**Validate All Files in a Directory:**

```bash
# Validate files directly in the directory
signaljourney-validate path/to/directory/

# Validate recursively through subdirectories
signaljourney-validate -r path/to/directory/
```

**Getting More Detail (Verbose):**

Use the `-v` or `--verbose` flag to see more details about errors, including suggestions.

```bash
signaljourney-validate -v path/to/invalid_file.signalJourney.json
```

**JSON Output:**

For machine-readable output, use the `-o json` flag.

```bash
signaljourney-validate -o json path/to/directory/
```

This will output a JSON object summarizing the validation status and errors for each file found.

**Using a Custom Schema:**

Specify a different schema file using `--schema`.

```bash
signaljourney-validate --schema path/to/my_schema.json path/to/your_pipeline.signalJourney.json
```

**BIDS Context Validation (Experimental):**

To enable BIDS-specific checks (like file placement), use the `--bids` flag and provide the dataset root with `--bids-root`.

```bash
signaljourney-validate --bids --bids-root /path/to/bids_dataset /path/to/bids_dataset/derivatives/...
```

Refer to the CLI user guide ([`validator_cli.md`](../guides/validator_cli.md)) or run `signaljourney-validate --help` for all options.

## 2. Using the Python Library

For validation within Python scripts, use the `Validator` class.

```python
from pathlib import Path
from signaljourney_validator import Validator, SignalJourneyValidationError

validator = Validator() # Uses default schema
file_to_check = Path('path/to/your_pipeline.signalJourney.json')

try:
    # Option 1: Raise exception on failure
    validator.validate(file_to_check)
    print(f"{file_to_check.name} is valid.")

except SignalJourneyValidationError as e:
    print(f"{file_to_check.name} validation failed: {e}")
    if e.errors:
        print("Errors:")
        for err in e.errors:
            print(f"  - {err}") # ValidationErrorDetail has __str__ method
            # Access err.path, err.message, err.suggestion etc.

# Option 2: Get errors as a list
validation_errors = validator.validate(file_to_check, raise_exceptions=False)
if validation_errors: # List is not empty
    print(f"{file_to_check.name} validation failed:")
    for err in validation_errors:
         print(f"  - {err}")
else:
    print(f"{file_to_check.name} is valid.")
```

See the [Python Library Tutorial](./python_lib.md) and the [Python Validator Guide](../guides/validator_python.md) for more details on programmatic validation.

Regular validation is crucial for maintaining high-quality, interoperable signalJourney provenance records. 