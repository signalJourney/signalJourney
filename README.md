# Signal Journey Specification

**Track the journey of your biosignals with detailed, reproducible provenance.**

## Overview

Signal Journey is a specification for documenting the processing steps applied to biosignal data, particularly EEG and MEG. It aims to capture the complete history of transformations, software versions, parameters, and quality metrics associated with a processed dataset.

**Purpose & Goals:**

*   **Reproducibility:** Provide a clear, machine-readable record of the entire processing pipeline.
*   **Transparency:** Understand exactly how derived data was generated from raw data.
*   **Quality Assessment:** Track quality metrics at each stage of processing.
*   **Collaboration:** Share processing details effectively between researchers and labs.
*   **Standardization:** Offer a common format for provenance tracking in neuroimaging.

## Key Features

*   **JSON Schema:** Defined by a formal [JSON Schema (`schema/signalJourney.schema.json`)](schema/signalJourney.schema.json) for validation.
*   **Step-by-Step Tracking:** Records each processing step, including software, parameters, inputs, and outputs.
*   **Quality Metrics:** Allows embedding quality metrics at both the step and pipeline level.
*   **Extensibility:** Uses a namespace system within the `extensions` field to accommodate domain-specific information (e.g., EEG-specific channel metrics, NEMAR project details) without cluttering the core specification. *Note: Namespaces are reserved; see [CONTRIBUTING.md](CONTRIBUTING.md) and documentation for details on proposing new namespaces.*
*   **BIDS Compatibility:** Designed to integrate with the Brain Imaging Data Structure (BIDS) standard, typically residing in the `derivatives/` directory.

## Schema Structure Overview

A `signalJourney.json` file contains the following main sections:

*   `sj_version`: The version of the Signal Journey specification used.
*   `schema_version`: The version of the schema file itself.
*   `description`: A human-readable description of the documented pipeline.
*   `pipelineInfo`: General metadata about the pipeline (e.g., name, project).
*   `processingSteps`: An ordered array detailing each processing step:
    *   `stepId`: Unique identifier for the step.
    *   `name`, `description`: Human-readable details.
    *   `software`: Software used (name, version, URL).
    *   `parameters`: List of parameters applied.
    *   `inputSources`, `outputTargets`: Links to input/output data or previous steps.
    *   `dependsOn`: Prerequisite step IDs.
    *   `qualityMetrics`: Metrics specific to this step's output.
*   `summaryMetrics`: (Optional) Metrics summarizing the overall pipeline outcome.
*   `extensions`: (Optional) Container for namespaced, domain-specific information.

See the [JSON Schema (`schema/signalJourney.schema.json`)](schema/signalJourney.schema.json) for the complete structure and field descriptions.

## Basic Usage

Signal Journey files are typically generated programmatically by processing pipelines or analysis tools.

**Example Snippet (`complex_pipeline.json`):**

```json
{
  "sj_version": "0.1.0",
  "schema_version": "0.1.0",
  "description": "Complex pipeline: Preprocessing, ICA, and Epoching.",
  "pipelineInfo": {
    "pipeline_name": "EEG Preprocessing + ICA",
    "project": "Study X"
  },
  "processingSteps": [
    {
      "stepId": "filter",
      "name": "Band-pass Filter",
      "description": "Apply 1-45 Hz filter.",
      "software": {"name": "EEGLAB", "version": "2023.1"},
      "parameters": [
        {"name": "locutoff", "value": 1.0, "unit": "Hz"},
        {"name": "hicutoff", "value": 45.0, "unit": "Hz"}
      ],
      "dependsOn": ["load"]
    },
    // ... other steps ...
    {
      "stepId": "ic_reject",
      "name": "Reject ICs",
      // ... details ...
      "dependsOn": ["ica"],
      "qualityMetrics": {
        "numICsRejected": 5,
        "eeg:percentVarianceRemoved": 12.1
      }
    }
  ],
  "extensions": {
    "eeg": {
      "channelLocationsFile": "/path/to/standard_1020.elc"
    }
  }
}
```

See the [`schema/examples/`](schema/examples/) directory for more complete examples:
*   [`simple_pipeline.json`](schema/examples/simple_pipeline.json)
*   [`complex_pipeline.json`](schema/examples/complex_pipeline.json)
*   [`metrics_heavy.json`](schema/examples/metrics_heavy.json)

## Documentation

*Full documentation coming soon (See Task #10).*

## Contributing

We welcome contributions! Please see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines on bug reports, feature requests, pull requests, and proposing new namespaces.

## License

*License information TBD.* 