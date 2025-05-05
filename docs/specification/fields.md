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
    *   **Description:** Contains summary quality metrics that apply to the final output of the entire pipeline.
    *   **Structure:** Key-value pairs where keys are metric names and values are the metric results. Can be nested objects.
    *   **See:** [Quality Metrics Object](#quality-metrics-object)
    *   **Example:** `"summaryMetrics": { "finalSNR": 35.2, "percentDataRejected": 5.1 }`
*   `extensions` (object, optional)
    *   **Description:** Container for domain-specific or custom extensions to the core specification, organized by namespace.
    *   **See:** [Namespaces](./namespaces.md) for details on structure and governance.
    *   **Example:** `"extensions": { "eeg": { "channelCount": 64, "referenceType": "average" } }`
*   `versionHistory` (array, optional)
    *   **Description:** Records changes made to this specific signalJourney file over time.
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

*   `stepId` (string, required): A unique identifier for this step within the pipeline (e.g., "01_filter", "ica_run").
*   `name` (string, required): A human-readable name for the step (e.g., "High-pass Filter", "ICA Decomposition").
*   `description` (string, required): A brief description of what the step does.
*   `software` (array, required): An array of [softwareDetails](#software-details-object) objects detailing the software used.
*   `parameters` (object, optional): Key-value pairs representing parameters specific to this step.
*   `inputSources` (array, required): An array of [inputSource](#inputsource-object) objects defining the inputs.
*   `outputTargets` (array, optional): An array of [outputTarget](#outputtarget-object) objects defining the outputs.
*   `qualityMetrics` (object, optional): A [qualityMetricsObject](#qualitymetricsobject) containing metrics relevant to this step's output.
*   `extensions` (object, optional): Container for [extensions](#extensions-object).

### inputSource Object

Defines a source of input data for a processing step.

*   `description` (string, required): Describes the input data (e.g., "Raw EEG data", "ICA component activations").
*   `location` (string, required): Path to the input file, relative to the dataset root or the `signalJourney.json` file itself (convention TBD, likely relative to dataset root for BIDS).
*   `format` (string, optional): The file format (e.g., "SET", "FIF", "EDF").

### outputTarget Object

Defines the target location or method for storing the output of a processing step.

*   `description` (string, required): Describes the output data (e.g., "Filtered EEG data", "Cleaned IC weights", "Rejected channels list").
*   `targetType` (string, required): Specifies the storage method. Must be one of:
    *   `file`: The output is stored in an external file.
    *   `inlineData`: The output data is embedded directly within the JSON.
*   `location` (string, required if `targetType` is `file`): Path to the output file, relative path convention same as `inputSource.location`.
*   `format` (string, optional if `targetType` is `file`): The file format (e.g., "SET", "FIF", "TSV").
*   `data` (any, required if `targetType` is `inlineData`): The embedded data itself (e.g., a list of bad channel names, an ICA weight matrix as a nested array, QC metrics as an object).
*   `encoding` (string, optional if `targetType` is `inlineData`): Specifies how the `data` is encoded if it's binary or needs special handling (e.g., "base64", "gzip+base64"). Defaults to standard JSON types if omitted.
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

## Software Object

Describes the software used in a processing step.

*   `name` (string, required)
    *   **Description:** The name of the software package or library (e.g., "MNE-Python", "EEGLAB", "FieldTrip").
*   `version` (string, required)
    *   **Description:** The specific version of the software used.
*   `functionCall` (string, optional)
    *   **Description:** The specific function or command executed (potentially abbreviated or representative).
    *   **Example:** `"functionCall": "raw.filter(l_freq=1.0, h_freq=40.0)"`
*   `operatingSystem` (string, optional)
    *   **Description:** The operating system the software was run on.
*   `repository` (string, optional, format: uri)
    *   **Description:** URL to the software's source code repository (e.g., GitHub link).
*   `commitHash` (string, optional)
    *   **Description:** Specific Git commit hash of the software version used, if applicable.

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

## Pipeline Source Object

Used within `inputSources` of type `"file"` to link to the pipeline that generated the file.

*   `pipelineName` (string, required)
    *   **Description:** The name of the pipeline (should match `pipelineInfo.name` of the source signalJourney file).
*   `pipelineVersion` (string, required)
    *   **Description:** The version of the pipeline (should match `pipelineInfo.version` of the source signalJourney file).
*   `signalJourneyFile` (string, optional)
    *   **Description:** Relative path to the signalJourney file documenting the source pipeline.

---

## Version History Object

Describes a single entry in the top-level `versionHistory` array.

*   `version` (string, required)
    *   **Description:** The version identifier for this entry (e.g., "1.1.0").
*   `date` (string, required, format: date)
    *   **Description:** The date this version was created (ISO 8601 format YYYY-MM-DD).
*   `changes` (string, required)
    *   **Description:** A description of the changes made in this version of the signalJourney file.
*   `author` (string, optional)
    *   **Description:** The person or entity who made the changes. 