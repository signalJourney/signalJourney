# Signal Journey Tests

This directory contains automated tests for the signalJourney project.

## Structure

- `schemas/`: Tests for validating data against the JSON schemas.
- `validator/`: Unit tests for the Python validator library (`src/signaljourney_validator`).
- `matlab/`: Tests for the MATLAB tools (`scripts/matlab/`).
- `conftest.py`: Shared pytest fixtures.

## Running Tests

Install test dependencies:
```bash
pip install -e .[test]
```

Run Python tests (schemas and validator):
```bash
pytest
```

Run with coverage:
```bash
pytest --cov
```

(Add instructions for running MATLAB tests once implemented) 