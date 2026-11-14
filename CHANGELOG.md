# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-13

### Added
- The schema (definitions, extensions, versions and examples) is packaged inside the wheel and loaded with `importlib.resources`, so an installed copy validates without a repository checkout.
- `SchemaResolutionError`, raised when a `$ref` cannot be resolved.
- A release process: tags are exactly `vX.Y.Z`, `scripts/release_check.py` enforces the version, tag and changelog rules in CI, and a tag push publishes to TestPyPI, smoke-tests the install, publishes to PyPI and creates the GitHub release (see `docs/RELEASING.md`).

### Changed
- The distribution is renamed `signalJourney`; the import package `signaljourney_validator` and the `signaljourney-validate` command keep their names.
- `schema_dir` is refused when it is wrong instead of silently falling back; the default is the packaged schema.
- Local `$ref` values resolve within their `$id` scope.
- `requires-python` is `>=3.9`.
- The validator logs through `logging` instead of printing.
- The version has one source, `__version__`; `pyproject.toml` reads it.

### Fixed
- The continuous integration jobs run on `ubuntu-24.04` with Python from `uv`, and the dependency audit uses `pip-audit`.

## [0.1.0] - 2025-08-20

### Added
- Initial release of signalJourney specification and tools
- Complete JSON Schema definition with modular structure
- Version-based validation system supporting multiple schema versions
- Python validator library with comprehensive validation and error reporting
- MATLAB validation tools for basic structural validation
- CLI validator for batch validation workflows
- Comprehensive documentation with examples and tutorials
- Support for EEG and NEMAR namespace extensions (placeholders)
- Example signalJourney files covering common biosignal processing workflows
- MkDocs-based documentation website with Material theme

### Features
- **Schema Structure**: Modular schema design with external references for reusability
- **Validation**: Robust validation with automatic version detection and backward compatibility
- **Documentation**: Complete specification documentation with field details and validation rules
- **Examples**: Comprehensive examples covering MNE-Python, EEGLAB, and other common tools
- **Tools**: Python and MATLAB validation libraries with CLI support
- **Extensibility**: Namespace system for domain-specific extensions

### Technical Details
- JSON Schema Draft 2020-12 compliance
- Semantic versioning for both specification and schema versions
- BIDS-compatible file naming conventions
- UTF-8 encoding requirement
- Comprehensive field validation including timestamps, URIs, and semantic versioning patterns