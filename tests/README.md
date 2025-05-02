# Signal Journey Tests

This directory contains automated tests for the `signalJourney` project, ensuring the schema, validator, and tools function correctly.

## Structure

- `schemas/`: Contains tests for validating data against the official JSON schemas defined in `schema/`.
    - `examples/`: Sample JSON files (valid and invalid) used as test fixtures.
    - `test_schema_validation.py`: Pytest tests using `jsonschema` to validate examples.
- `validator/`: Contains unit tests for the Python validator library located in `src/signaljourney_validator`.
    - `test_validator.py`: Tests the core `Validator` class logic.
    - `test_cli.py`: Tests the command-line interface (`signaljourney-validate`).
- `matlab/`: Contains unit tests for the MATLAB tools located in `scripts/matlab/`.
    - `fixtures/`: Sample JSON files used as fixtures for MATLAB tests.
    - `test_*.m`: Individual test files for MATLAB functions (e.g., `test_readSignalJourney.m`) using `matlab.unittest.TestCase`.
    - `run_matlab_tests.m`: A runner script to execute MATLAB tests.
- `conftest.py`: Shared pytest fixtures for Python tests (e.g., schema loading, validator instantiation).

## Running Tests

### 1. Install Dependencies

Ensure you have Python (3.9+) installed. Install the package in editable mode along with test dependencies:

```bash
pip install --upgrade pip
pip install -e '.[test]'
```

This command installs the `signaljourney_validator` package itself, plus `pytest`, `pytest-cov`, `jsonschema`, and `ruff`.

### 2. Python Tests (Schema Validation & Validator Library)

Run all Python tests using pytest:

```bash
pytest tests/schemas/ tests/validator/
```

To run with code coverage reporting:

```bash
pytest tests/schemas/ tests/validator/ --cov=src/signaljourney_validator --cov-report term-missing
```

A coverage report (`coverage.xml`) is also generated, which is used by the CI workflow.

### 3. MATLAB Tests (MATLAB Tools)

**Prerequisites:**
- MATLAB (R2019b or later recommended) must be installed.

**Execution:**
1.  Open MATLAB.
2.  Navigate the MATLAB Current Folder browser to the root directory of this `signalJourney` repository.
3.  Run the test runner script from the MATLAB Command Window:

    ```matlab
    cd tests/matlab % Change to the MATLAB test directory
    results = run_matlab_tests;
    ```
    This will discover and run all tests within the `tests/matlab` directory and display the results.

    Alternatively, to run a specific test file:
    ```matlab
    cd tests/matlab
    results = run_matlab_tests('test_readSignalJourney.m');
    ```

    *(Note: Running MATLAB tests via the command line (`matlab -batch`) requires configuring your system's PATH to include the MATLAB executable.)*

## Continuous Integration (CI)

A CI workflow is configured in `.github/workflows/ci.yml`. It automatically runs linting (Ruff) and Python tests (pytest) on pushes and pull requests to the `main` branch across multiple Python versions. Coverage reports are uploaded to Codecov.

MATLAB tests are currently not executed automatically in CI due to environment dependencies but are included as a placeholder. 