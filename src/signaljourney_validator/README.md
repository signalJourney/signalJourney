# signaljourney-validator

[![PyPI version](https://badge.fury.io/py/signaljourney-validator.svg)](https://badge.fury.io/py/signaljourney-validator) <!-- TODO: Update badge URL if name changes -->
<!-- [![Build Status](https://travis-ci.org/signal-journey/specification.svg?branch=main)](https://travis-ci.org/signal-journey/specification) --> <!-- TODO: Add CI badge -->
<!-- [![Coverage Status](https://coveralls.io/repos/github/signal-journey/specification/badge.svg?branch=main)](https://coveralls.io/github/signal-journey/specification?branch=main) --> <!-- TODO: Add coverage badge -->

Python library for validating signalJourney JSON files against the [official schema](https://github.com/signal-journey/specification/blob/main/schema/signalJourney.schema.json).

This validator helps ensure that your signalJourney files conform to the specification, promoting reproducibility and interoperability.

## Installation

```bash
pip install signaljourney-validator
```

To include optional suggestion features (using fuzzy matching):

```bash
pip install signaljourney-validator[suggestions]
```

## Basic Usage

```python
from signaljourney_validator import Validator, SignalJourneyValidationError

# Initialize with the default schema bundled with the package
validator = Validator()

# Validate a file
try:
    validator.validate('path/to/your_signalJourney.json')
    print("Validation successful!")
except SignalJourneyValidationError as e:
    print(f"Validation failed: {e}")
    for error_detail in e.errors:
        print(f"- {error_detail}") # Includes suggestion if available
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
validation_errors = validator.validate('path/to/invalid_signalJourney.json', raise_exceptions=False)
if validation_errors: # Returns a list of ValidationErrorDetail objects
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