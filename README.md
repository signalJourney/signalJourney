# Signal Journey: Mapping the path from raw to processed biosignals

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)
<!-- [![PyPI version](https://badge.fury.io/py/signaljourney-validator.svg)](https://badge.fury.io/py/signaljourney-validator) TODO: Activate once published -->
[![Docs](https://img.shields.io/badge/docs-mkdocs-green)](https://neuromechanist.github.io/signalJourney/)
[![Tests](https://github.com/neuromechanist/signalJourney/actions/workflows/ci.yml/badge.svg)](https://github.com/neuromechanist/signalJourney/actions/workflows/ci.yml)
[![Code style: ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)

**Track the journey of your biosignals with detailed, reproducible, machine-readable provenance.**

## Overview

Signal Journey defines a specification and provides tools for documenting the processing steps applied to biosignal data (EEG, MEG, etc.). It aims to capture the complete history of transformations, software versions, parameters, and quality metrics associated with derived datasets.

This repository contains:

1.  **The Signal Journey Specification:** Formal definition of the `signalJourney.json` format ([`schema/signalJourney.schema.json`](schema/signalJourney.schema.json)).
2.  **Python Validator (`signaljourney_validator`):** A library and CLI tool to validate `.json` files against the schema ([`src/signaljourney_validator`](src/signaljourney_validator)).
3.  **Documentation:** Comprehensive guides, tutorials, and examples ([`docs/`](docs/), published at [neuromechanist.github.io/signalJourney](https://neuromechanist.github.io/signalJourney/)).
4.  **Examples:** Illustrative `signalJourney.json` files ([`schema/examples/`](schema/examples/)).
5.  **MATLAB Tools:** Basic utilities for working with Signal Journey structs in MATLAB ([`scripts/matlab/`](scripts/matlab/)).

## Why Signal Journey?

Modern biosignal analysis involves numerous steps and diverse software, making reproducibility challenging. Traditional methods like lab notes or script comments are often insufficient. Signal Journey addresses this by providing a standardized **JSON format** that captures:

*   **Pipeline Metadata:** Name, version, description.
*   **Input Data:** Origin and characteristics.
*   **Processing Steps:** Detailed sequence including software, functions, parameters, inputs, outputs, and dependencies.
*   **Output Data:** Description of final results.
*   **Quality Metrics:** Quantitative or qualitative assessments at step or pipeline level.
*   **Extensibility:** A namespaced `extensions` field for domain-specific additions.

**Key Benefits:**

*   **Reproducibility:** Clear, machine-readable record enables replication.
*   **Transparency:** Explicitly details how derived data was generated.
*   **Standardization:** Common format for provenance across tools and labs.
*   **Interoperability:** Facilitates sharing and comparison of methods.
*   **Automation:** Machine-readable format enables automated validation, analysis, and potentially re-execution.

## Getting Started

### Using the Validator (Python)

The `signaljourney_validator` package provides a CLI tool for easy validation.

1.  **Installation:**
    ```bash
    pip install signaljourney_validator
    ```
    *(Note: Package not yet published to PyPI yet)*

2.  **Validation:**
    ```bash
    signaljourney-validate /path/to/your_pipeline_signalJourney.json
    ```
    The validator will report success or list detailed errors if the file does not conform to the schema.

### Exploring the Specification

*   **Introduction:** [docs/introduction.md](docs/introduction.md)
*   **Full Specification:** [docs/specification/](docs/specification/)
*   **Schema File:** [schema/signalJourney.schema.json](schema/signalJourney.schema.json)
*   **Examples:** [schema/examples/](schema/examples/)

### BIDS Integration

Signal Journey is designed to complement the Brain Imaging Data Structure (BIDS). Learn how to integrate `signalJourney.json` files into BIDS datasets: [docs/bids.md](docs/bids.md).

## Documentation

The full documentation, built with MkDocs, is available online:

**[neuromechanist.github.io/signalJourney](https://neuromechanist.github.io/signalJourney/)**

To build the documentation locally:
```bash
pip install -r docs/requirements.txt
mkdocs build
# Or serve locally: mkdocs serve
```

## Contributing

We welcome contributions! Please see the **[CONTRIBUTING.md](CONTRIBUTING.md)** file for detailed guidelines on:

*   Reporting bugs and suggesting features
*   Setting up a development environment
*   Running tests (`pytest`) and linters (`ruff`)
*   Making changes and submitting pull requests
*   Proposing schema modifications

Please also adhere to our **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**.

## License

This project is licensed under the **[BSD 3-Clause License](LICENSE)**. 