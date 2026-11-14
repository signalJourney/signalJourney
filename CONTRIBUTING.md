# Contributing to Signal Journey

Thank you for your interest in contributing to the Signal Journey specification and its associated tools!

We welcome contributions in various forms, from reporting bugs and suggesting enhancements to improving documentation and adding examples.

## Getting Started

*   **Code of Conduct:** Before contributing, please read our [Code of Conduct (`CODE_OF_CONDUCT.md`)](CODE_OF_CONDUCT.md). We expect all contributors to adhere to its principles.
*   **License:** By contributing, you agree that your contributions will be licensed under the [BSD 3-Clause License (`LICENSE`)](LICENSE).
*   **Issues:** Check the [GitHub Issues](https://github.com/signalJourney/signalJourney/issues) for existing bug reports or feature requests.

## Development Setup

To contribute code changes, you'll need a local development environment:

1.  **Fork & Clone:** Fork the repository on GitHub and clone your fork locally.
2.  **Environment:** It's recommended to use a virtual environment (e.g., `venv` or `conda`).
    ```bash
    # Using venv
    python -m venv .venv
    source .venv/bin/activate # On Windows use `.venv\Scripts\activate`
    
    # Using conda
    # conda create -n signaljourney python=3.10
    # conda activate signaljourney
    ```
3.  **Install Dependencies:** Install the core library and development dependencies.
    ```bash
    pip install -e .[dev,test,docs]
    ```
    This installs the `signaljourney_validator` package in editable mode (`-e`) along with all optional dependencies required for testing, linting, and building documentation.
    
4.  **Set up Pre-commit Hooks:** Install pre-commit hooks to automatically check code quality:
    ```bash
    pre-commit install
    ```
    This will automatically run linting, formatting, and validation checks before each commit.

## Making Changes

1.  **Create a Branch:** Create a new branch for your changes (e.g., `git checkout -b feature/my-new-feature` or `bugfix/fix-validation-error`).
2.  **Code:** Make your code changes.
3.  **Linting:** Ensure your code adheres to the style guide by running `ruff`:
    ```bash
    ruff check . && ruff format .
    ```
4.  **Testing:** Add tests for any new functionality or bug fixes in the `tests/` directory. Run the full test suite with `pytest`:
    ```bash
    pytest tests/ -v --cov=src --cov-report=term-missing
    ```
    Ensure all tests pass and aim for good test coverage.
    
5.  **Validation:** If you modify schema or examples, validate all example files:
    ```bash
    signaljourney-validate validate src/signaljourney_validator/schema/examples/
    ```
6.  **Documentation:** If your changes affect the specification, validator behavior, or user-facing features, update the documentation in the `docs/` directory. You can preview the documentation locally:
    ```bash
    mkdocs serve
    ```
7.  **Commit:** Commit your changes with a clear and descriptive commit message. Pre-commit hooks will automatically run and check your code.
8.  **Push:** Push your branch to your fork on GitHub.
9.  **Pull Request:** Open a pull request against the `main` branch of the `signalJourney/signalJourney` repository.
    *   Clearly describe the purpose and details of your changes in the PR description.
    *   Link to any relevant GitHub issues (e.g., `Fixes #123`).
    *   Wait for CI checks to pass - your PR must pass all automated tests including:
        - Python tests (3.9-3.12)
        - Code linting and formatting
        - Example validation
        - Security scanning
        - Documentation building

## Releasing

Every pull request that changes `src/`, `pyproject.toml` or `MANIFEST.in` adds a line to `CHANGELOG.md` under `## [Unreleased]`, or carries the label `no-changelog`; the `Changelog` check enforces it.
The version has one source, `__version__` in `src/signaljourney_validator/__init__.py`, and never changes in an ordinary pull request.
The [version policy](docs/RELEASING.md#version-policy): minor versions are reserved for huge breaking changes, and every other release is a patch bump.

A release is a pull request that moves the `## [Unreleased]` entries under `## [X.Y.Z] - YYYY-MM-DD` and sets `__version__ = "X.Y.Z"`, followed by pushing the tag `vX.Y.Z` on the merge commit.
Tags are exactly `vX.Y.Z` and are never moved or reused.
The tag push runs `.github/workflows/publish.yml`: it publishes to TestPyPI, installs from there in a fresh environment, publishes to PyPI, and creates a GitHub release titled exactly with the tag.
`scripts/release_check.py` holds every rule, and [docs/RELEASING.md](docs/RELEASING.md) has the steps and what to do when a run stops half way.
The PyPI project is named `signalJourney` (normalized `signaljourney`); the import package `signaljourney_validator` and the command `signaljourney-validate` keep their names.

## Reporting Bugs

*   Use the [GitHub Issues](https://github.com/signalJourney/signalJourney/issues) page.
*   Provide a clear title and description.
*   Include steps to reproduce the bug.
*   Mention the version of `signaljourney_validator` you are using.
*   If possible, include a minimal example `signalJourney.json` file that triggers the bug.

## Suggesting Enhancements

*   Use the [GitHub Issues](https://github.com/signalJourney/signalJourney/issues) page.
*   Provide a clear title and detailed description of the proposed enhancement and its motivation.
*   Explain the use case and potential benefits.

## Proposing Schema Changes / New Namespaces

The Signal Journey specification uses namespaces under the `extensions` property to allow for domain-specific information. Major changes to the core schema or proposals for new top-level namespaces require careful consideration.

1.  **Discussion First:** Please open a GitHub issue with the label `schema-proposal` or `namespace-proposal` to initiate a discussion *before* creating a pull request for schema changes.
2.  **Justification:** Clearly outline the need, scope, and potential structure.
3.  **Review Process:** Follow the discussion and review process guided by the maintainers.

Thank you for contributing! 