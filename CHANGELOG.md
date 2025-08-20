# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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