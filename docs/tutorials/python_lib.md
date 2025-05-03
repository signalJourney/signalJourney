# Tutorial: Using the Python Library (`signaljourney-validator`)

The `signaljourney-validator` Python library provides programmatic ways to validate your signalJourney JSON files.

**Prerequisites:**

*   Python 3.8+ installed.
*   The `signaljourney-validator` library installed (`pip install signaljourney-validator`).
*   A signalJourney JSON file to validate (e.g., one created manually or an example file).

## 1. Basic Validation

The core functionality involves creating a `Validator` instance and calling its `validate` method.

```python
from pathlib import Path
from signaljourney_validator import Validator, SignalJourneyValidationError

# Path to your signalJourney file
journey_file = Path('path/to/your_pipeline.signalJourney.json') 
# Or use one of the examples:
# journey_file = Path('../../schema/examples/basic_preprocessing_pipeline.signalJourney.json')

try:
    # Initialize validator (uses the default schema bundled with the package)
    validator = Validator()

    # Validate the file
    # By default, validate() returns True on success 
    # and raises SignalJourneyValidationError on failure.
    is_valid = validator.validate(journey_file)
    
    if is_valid:
        print(f"Validation successful for: {journey_file.name}")

except SignalJourneyValidationError as e:
    print(f"Validation FAILED for {journey_file.name}: {e}")
    # Access detailed errors
    if e.errors:
        print("Details:")
        for error_detail in e.errors:
            path_str = '/'.join(map(str, error_detail.path)) if error_detail.path else 'root'
            print(f"  - Error at '{path_str}': {error_detail.message}")
            if error_detail.suggestion:
                 print(f"    Suggestion: {error_detail.suggestion}")

except FileNotFoundError:
    print(f"Error: File not found at {journey_file}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
```

## 2. Getting Errors Without Exceptions

If you prefer to handle errors without try-except blocks, set `raise_exceptions=False`. The `validate` method will then return an empty list `[]` on success or a list of `ValidationErrorDetail` objects on failure.

```python
# ... (import Validator, SignalJourneyValidationError, Path) ...

journey_file = Path('path/to/invalid_pipeline.signalJourney.json')
validator = Validator()

validation_result = validator.validate(journey_file, raise_exceptions=False)

if not validation_result: # Empty list means success
    print(f"Validation successful for: {journey_file.name}")
else:
    print(f"Validation FAILED for {journey_file.name}. Found {len(validation_result)} errors:")
    for error_detail in validation_result:
        path_str = '/'.join(map(str, error_detail.path)) if error_detail.path else 'root'
        print(f"  - Error at '{path_str}': {error_detail.message}")
        if error_detail.suggestion:
            print(f"    Suggestion: {error_detail.suggestion}")
```

## 3. Using a Custom Schema

You can initialize the `Validator` with a path to your own schema file or a schema dictionary.

```python
# ... (import Validator, Path) ...

custom_schema_path = Path('path/to/my_custom_schema.json')
journey_file = Path('path/to/your_pipeline.signalJourney.json')

try:
    # Initialize with a custom schema file
    validator = Validator(schema=custom_schema_path)
    
    # Or initialize with a schema dictionary
    # my_schema_dict = { ... } 
    # validator = Validator(schema=my_schema_dict)
    
    validator.validate(journey_file) # Raises exception on failure by default
    print("Validation successful with custom schema!")

except Exception as e:
    print(f"Error: {e}")
```

## 4. Validating Data In-Memory

You can also validate Python dictionaries directly.

```python
# ... (import Validator) ...

my_journey_data = {
  "sj_version": "0.1.0",
  "schema_version": "0.1.0",
  "description": "In-memory example",
  "pipelineInfo": { "name": "Test", "version": "1.0", "description": "..." },
  "processingSteps": [
      # ... steps ... 
      # Missing required fields might cause validation failure
  ]
}

validator = Validator()

validation_errors = validator.validate(my_journey_data, raise_exceptions=False)

if not validation_errors:
    print("In-memory data is valid.")
else:
    print(f"In-memory data validation FAILED. Found {len(validation_errors)} errors:")
    # ... (print errors as before) ...
```

## 5. BIDS Context Validation (Experimental)

The library includes experimental support for validating within a BIDS context. This requires providing the path to the BIDS dataset root.

```python
# ... (import Validator, Path, SignalJourneyValidationError) ...

bids_root_path = Path('/path/to/your/bids_dataset')
# Make sure the journey file path is within the BIDS root for context checks
journey_file_in_bids = bids_root_path / 'derivatives' / 'my_pipeline' / 'sub-01' / 'eeg' / 'sub-01_task-rest_signalJourney.json'

validator = Validator()

try:
    # Pass the bids_context argument
    validator.validate(journey_file_in_bids, bids_context=bids_root_path)
    print(f"Validation successful within BIDS context: {journey_file_in_bids.name}")

except SignalJourneyValidationError as e:
    print(f"Validation FAILED for {journey_file_in_bids.name}: {e}")
    if e.errors:
        print("Details (including potential BIDS context errors):")
        # ... (print errors as before) ...

except Exception as e:
     print(f"An unexpected error occurred: {e}")
```

This covers the main ways to use the `signaljourney-validator` library for validating your files programmatically. For detailed information on the available functions and classes, refer to the [Python API documentation](../api/index.md). 