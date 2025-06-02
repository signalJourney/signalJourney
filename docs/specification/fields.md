# Specification Fields

This section details the primary fields defined in the `signalJourney.schema.json`.

## Top-Level Fields

These fields are required at the root level of every signalJourney JSON file.

*   `sj_version` (string, required)
    *   **Description:** The version of the signalJourney specification that this file conforms to. Must follow semantic versioning (e.g., "0.1.0").
    *   **Example:** `"sj_version": "0.1.0"`
*   `schema_version` (string, required)
    *   **Description:** The version of the specific `signalJourney.schema.json` file used for validation. Must follow semantic versioning.
    *   **Example:** `"schema_version": "0.1.0"`
*   `description` (string, required)
    *   **Description:** A brief, human-readable summary of the processing pipeline described in this file.
    *   **Example:** `"description": "EEG preprocessing pipeline including filtering and ICA."`
*   `pipelineInfo` (object, required)
    *   **Description:** Contains metadata about the overall processing pipeline.
    *   **See:** [Pipeline Info Object](#pipeline-info-object)
*   `processingSteps` (array, required)
    *   **Description:** An ordered array detailing each individual step performed in the pipeline.
    *   **See:** [Processing Step Object](#processing-step-object)

### Optional Top-Level Fields

*   `summaryMetrics` (object, optional)
    *   **Description:** Contains summary quality metrics that summarizes multiple `qualtiyMetrics` fileds across pipline or dataset. For example, sumamrizing quality metrics such as average powerline noise across subjects in a dataset.
    *   **Structure:** Key-value pairs where keys are metric names and values are the metric results. Can be nested objects.
    *   **See:** [Quality Metrics Object](#quality-metrics-object)
    *   **Example:** `"summaryMetrics": { "finalSNR": 35.2, "percentDataRejected": 5.1 }`
*   `extensions` (object, optional)
    *   **Description:** Container for domain-specific or custom extensions to the core specification, organized by namespace.
    *   **See:** [Namespaces](./namespaces.md) for details on structure and governance.
    *   **Example:** `"extensions": { "eeg": { "channelCount": 64, "referenceType": "average" } }`
*   `versionHistory` (array, optional)
    *   **Description:** Records changes made to this specific signalJourney file over time. Each item is an object.
    *   **See:** [Version History Object](#version-history-object)

---

## Pipeline Info Object

Describes the overall pipeline.

*   `name` (string, required)
    *   **Description:** A descriptive name for the pipeline.
    *   **Example:** `"name": "Standard EEG Preprocessing"`
*   `description` (string, required)
    *   **Description:** A more detailed description of the pipeline's purpose and methods.
*   `version` (string, required)
    *   **Description:** The version of this specific pipeline script/implementation (distinct from `sj_version`).
    *   **Example:** `"version": "1.2.0"`
*   `pipelineType` (string, optional)
    *   **Description:** A category describing the pipeline's main function (e.g., "preprocessing", "ica", "source-localization", "connectivity", "statistics").
    *   **Example:** `"pipelineType": "preprocessing"`
*   `executionDate` (string, optional, format: date-time)
    *   **Description:** The date and time when the pipeline was executed (ISO 8601 format).
    *   **Example:** `"executionDate": "2024-05-02T10:00:00Z"`
*   `institution` (string, optional)
    *   **Description:** The institution where the pipeline was run.
*   `references` (array, optional)
    *   **Description:** List of relevant publications or resources related to the pipeline methods.
    *   **Items:** Object with `doi` (string, required) and `citation` (string, optional) fields.
    *   **Example:** `"references": [ { "doi": "10.1016/j.neuroimage.2019.116046" } ]`

---

## Processing Step Object

A single step within the processing pipeline.

Required Fields:
*   `stepId` (string): A unique identifier for this step within the pipeline (e.g., "01_filter", "ica_run").
*   `name` (string): A human-readable name for the step (e.g., "High-pass Filter", "ICA Decomposition").
*   `description` (string): A brief description of what the step does.
*   `software` (array): An array of [softwareDetails](#software-details-object) objects detailing the software used.
*   `inputSources` (array): An array of [inputSource](#inputsource-object) objects defining the inputs. Must contain at least one item.

Optional Fields:
*   `parameters` (object): Key-value pairs representing parameters specific to this step.
*   `outputTargets` (array): An array of [outputTarget](#outputtarget-object) objects defining the outputs.
*   `qualityMetrics` (object): A [qualityMetricsObject](#quality-metrics-object) containing metrics relevant to this step's output.
*   `extensions` (object): Container for [extensions](#extensions-object).

### inputSource Object

Defines a source of input data for a processing step.

*   `description` (string, required): Describes the input data (e.g., "Raw EEG data", "ICA component activations").
*   `location` (string, required): Path to the input file, relative to the dataset root or the `signalJourney.json` file itself (convention TBD, likely relative to dataset root for BIDS).
*   `format` (string, optional): The file format (e.g., "SET", "FIF", "EDF").

### outputTarget Object

Defines the target location or method for storing the output of a processing step.

*   `description` (string, required): Describes the output data (e.g., "Filtered EEG data", "Cleaned IC weights", "Rejected channels list").
*   `targetType` (string, required): Specifies the storage method. Must be one of:
    *   `file`: The output is stored in an external file (maps to `location`).
    *   `in-memory`: Output exists in memory (e.g., a specific data structure in a script) but isn't explicitly saved to a file or variable name in this record. Use `format` for data type description.
    *   `variable`: Output is stored as a named variable within the execution environment (maps to `name`). Use `format` for data type description.
    *   `report`: Output is a report (e.g., HTML, PDF). May optionally use `location`. Use `format` for report type.
    *   `userDefined`: A custom output type not covered by others (maps to `details`).
    *   `inlineData`: The output data is embedded directly within the JSON (maps to `data`, `encoding`, `formatDescription`).
*   `location` (string, required if `targetType` is `file`, optional for `report`): Path to the output file, relative path convention same as `inputSource.location`.
*   `format` (string, optional, recommended for `file`, `in-memory`, `variable`, `report`): The file format, data type, or report type (e.g., "SET", "FIF", "TSV", "NumPy array", "HTML").
*   `entityLabels` (object, optional, applicable if `targetType` is `file`): Key-value pairs representing BIDS-like entities for the output file. Example: `{"desc": "filtered"}`.
*   `name` (string, required if `targetType` is `variable`): Name of the variable stored.
*   `details` (string, required if `targetType` is `userDefined`): Description of the user-defined output.
*   `data` (any, required if `targetType` is `inlineData`): The embedded data itself (e.g., a list of bad channel names, an ICA weight matrix as a nested array, QC metrics as an object).
*   `encoding` (string, optional if `targetType` is `inlineData`, default: "utf-8"): Specifies how the `data` is encoded if it's binary or needs special handling (e.g., "base64", "gzip+base64"). Defaults to standard JSON types if omitted.
*   `formatDescription` (string, required if `targetType` is `inlineData`): A human-readable description of the `data` field's format (e.g., "List of bad channel labels", "NumPy array serialized to list", "JSON object with QC scores").

#### Example `inlineData` Usage:

```json
{
  "description": "List of channels rejected during artifact removal",
  "targetType": "inlineData",
  "formatDescription": "List of bad channel labels",
  "data": ["Fp1", "Oz", "T7"]
}
```

```json
{
  "description": "ICA weight matrix",
  "targetType": "inlineData",
  "formatDescription": "ICA weights matrix (channels x components) as nested list",
  "encoding": null, // Or omit if standard JSON types
  "data": [
    [0.1, 0.5, -0.2],
    [-0.3, 0.8, 0.1],
    // ... more rows ...
  ]
}
```

---

## Software Details Object

Describes the software used in a processing step. Corresponds to items in the `processingSteps[].software` array.

Required Fields:
*   `name` (string): The name of the software package or library (e.g., "MNE-Python", "EEGLAB", "FieldTrip").
*   `version` (string): The specific version of the software used.

Optional Fields:
*   `functionCall` (string): The specific function or command executed (potentially abbreviated or representative). Example: `"functionCall": "raw.filter(l_freq=1.0, h_freq=40.0)"`
*   `operatingSystem` (string): The operating system the software was run on.
*   `repository` (string, format: uri): URL to the software's source code repository (e.g., GitHub link).
*   `commitHash` (string): Specific Git commit hash of the software version used, if applicable.

---

## Quality Metrics Object

Container for quality metrics, used in `summaryMetrics` and `processingSteps[].qualityMetrics`.

*   **Structure:** Free-form key-value pairs. Keys should be descriptive metric names. Values can be numbers, strings, booleans, arrays, or nested objects.
*   **Recommendation:** Use consistent naming conventions (e.g., camelCase, snake_case) and include units where applicable (e.g., `snrDb`, `latencyMs`). Use namespaces for custom or tool-specific metrics within the `extensions` object if necessary.
*   **Examples:**
    ```json
    "qualityMetrics": {
      "channelsInterpolated": ["EEG 053"],
      "numComponentsRemoved": 3,
      "percentVarianceExplainedICA": 85.2,
      "eogCorrelationThreshold": 0.8
    }
    ```

---

## Extensions Object

Container for domain-specific or tool-specific information not covered by the core schema.

*   **Structure:** Key-value pairs where keys are namespace prefixes (e.g., "eeg", "mne", "iclabel") and values are objects containing the extension data.
*   **See:** [Namespaces](./namespaces.md) for details.
*   **Location:** Can appear at the top level (`extensions`) or within a `processingStep` (`extensions`).
*   **Example (within a step):**
    ```json
    "extensions": {
      "iclabel": {
        "componentClassifications": [
          {"icIndex": 0, "label": "Brain", "probability": 0.95},
          {"icIndex": 1, "label": "Eye", "probability": 0.88}
        ]
      }
    }
    ```

---

## Version History Object

Describes a single entry in the top-level `versionHistory` array.

Required Fields:
*   `version` (string): The version identifier for this entry (e.g., "1.1.0"). Should correspond to `schema_version` at the time of change.
*   `date` (string, format: date): The date this version was created (ISO 8601 format YYYY-MM-DD).
*   `changes` (string): A description of the changes made in this version of the signalJourney file.

Optional Fields:
*   `author` (string): The person or entity who made the changes. 
