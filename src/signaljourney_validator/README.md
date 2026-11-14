# signalJourney

[![PyPI version](https://badge.fury.io/py/signaljourney.svg)](https://badge.fury.io/py/signaljourney)
<!-- [![Build Status](https://travis-ci.org/signal-journey/specification.svg?branch=main)](https://travis-ci.org/signal-journey/specification) --> <!-- TODO: Add CI badge -->
<!-- [![Coverage Status](https://coveralls.io/repos/github/signal-journey/specification/badge.svg?branch=main)](https://coveralls.io/github/signal-journey/specification?branch=main) --> <!-- TODO: Add coverage badge -->

Python library for validating signalJourney JSON files against the [official schema](https://github.com/signal-journey/specification/blob/main/schema/signalJourney.schema.json).

This validator helps ensure that your signalJourney files conform to the specification, promoting reproducibility and interoperability.

## Installation

```bash
pip install signalJourney
# or
uv add signalJourney
```

The distribution is named `signalJourney` (PyPI normalizes it to `signaljourney`), but the import package is still `signaljourney_validator` and the command is still `signaljourney-validate`.
Renaming the import package would break every existing `import`, so it is a separate decision.

```python
from signaljourney_validator import Validator
```

To include optional suggestion features (using fuzzy matching):

```bash
pip install "signalJourney[suggestions]"
```

## Packaged Schema, Errors and Logging

The signalJourney schema (`schema/`, with its definitions, extensions, versioned copies and examples) is package data of `signaljourney_validator`.
`Validator()` loads it through `importlib.resources`, so an installed wheel needs no repository checkout and no `schema_dir` argument.
The library expects a regular filesystem install (a wheel installed into `site-packages`); running it from inside a zip archive is not supported.

`schema_dir=` (and `--schema` on the command line) override the packaged schema, and a wrong `schema_dir` is an error, not a silent switch to the packaged schema:

- a `schema_dir` that does not exist, or is not a directory, raises `SchemaResolutionError`;
- a schema file in it that cannot be read or parsed raises `SchemaResolutionError`;
- the one fallback is a `schema_dir` that exists but holds no schema version (no `versions/` entry): the packaged schema is used and a warning is logged on the logger `signaljourney_validator`.

An unresolved `$ref` (a missing or unreadable referenced file, or a `#/...` pointer that points nowhere) raises `SchemaResolutionError` when the `Validator` is constructed.
`SchemaResolutionError` is a subclass of `SignalJourneyValidationError`.

The library writes nothing to standard output.
It logs on the logger `signaljourney_validator` (for example `logging.basicConfig(level=logging.DEBUG)` shows the reference inlining), and the command line prints its results as before.

## Basic Usage

```python
from signaljourney_validator import Validator, SignalJourneyValidationError

# Initialize with the default schema bundled with the package
validator = Validator()

# Validate a file
try:
    validator.validate("path/to/your_signalJourney.json")
    print("Validation successful!")
except SignalJourneyValidationError as e:
    print(f"Validation failed: {e}")
    for error_detail in e.errors:
        print(f"- {error_detail}")  # Includes suggestion if available
except FileNotFoundError:
    print("File not found.")

# Validate a dictionary
my_data = {
    "sj_version": "0.1.0",
    "schema_version": "0.1.0",
    "description": "Example data",
    # ... other fields ...
}
try:
    validator.validate(my_data)
    print("Dictionary validation successful!")
except SignalJourneyValidationError as e:
    print(f"Dictionary validation failed: {e}")
    for error_detail in e.errors:
        print(f"- {error_detail}")

# Get errors without raising an exception
validation_errors = validator.validate(
    "path/to/invalid_signalJourney.json", raise_exceptions=False
)
if validation_errors:  # Returns a list of ValidationErrorDetail objects
    print(f"Found {len(validation_errors)} validation errors:")
    for error_detail in validation_errors:
        print(f"- {error_detail}")
else:
    print("Validation successful (no errors found).")
```

## Features

*   Validates against the official [signalJourney JSON Schema](https://github.com/signal-journey/specification/blob/main/schema/signalJourney.schema.json).
*   Supports validation of JSON files, strings, or Python dictionaries.
*   Provides detailed error reporting, including the validation message, path to the error, and schema validation rule.
*   Offers basic suggestions for fixing common errors (e.g., type mismatches, missing required fields, enum value typos).
*   Customizable: Load your own schema version or a modified schema.

## Contributing

Please refer to the main project's [CONTRIBUTING.md](https://github.com/signal-journey/specification/blob/main/CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/signal-journey/specification/blob/main/LICENSE) file for details. <!-- TODO: Create LICENSE file -->

*(Details to be added)* 