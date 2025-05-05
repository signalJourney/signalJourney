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

Describes a single step within the `processingSteps` array.

*   `stepId` (string, required)
    *   **Description:** A unique identifier for this step within the pipeline (e.g., "1", "2a", "filter_step"). Used in `dependsOn`.
    *   **Example:** `"stepId": "filter_highpass"`
*   `name` (string, required)
    *   **Description:** A human-readable name for the processing step.
    *   **Example:** `"name": "Apply High-pass Filter"`
*   `description` (string, required)
    *   **Description:** Detailed description of what this specific step does.
*   `software` (object, required)
    *   **Description:** Information about the software used for this step.
    *   **See:** [Software Object](#software-object)
*   `parameters` (object, optional)
    *   **Description:** Key-value pairs detailing the parameters used for this step. Values can be strings, numbers, booleans, arrays, or nested objects.
    *   **Example:** `"parameters": { "cutoff_freq_hz": 1.0, "filter_type": "FIR", "order": 512 }`
*   `inputSources` (array, optional)
    *   **Description:** List of data sources used as input for this step.
    *   **See:** [Input Source Object](#input-source-object)
*   `outputTargets` (array, optional)
    *   **Description:** List of data targets produced by this step.
    *   **See:** [Output Target Object](#output-target-object)
*   `dependsOn` (array, optional)
    *   **Description:** An array of `stepId` strings from previous steps that must be completed before this step can run. Defines the pipeline's execution graph.
    *   **Example:** `"dependsOn": ["load_data", "filter_highpass"]`
*   `executionDateTime` (string, optional, format: date-time)
    *   **Description:** The specific date and time this step was executed.
*   `qualityMetrics` (object, optional)
    *   **Description:** Quality metrics specific to the output of this particular step.
    *   **See:** [Quality Metrics Object](#quality-metrics-object)

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

## Input Source Object

Describes an input to a processing step, as defined in [`InputSource.schema.json`](../../schema/definitions/InputSource.schema.json).

*   `sourceType` (string, required)
    *   **Description:** Type of the input source.
    *   **Enum:** `"file"`, `"previousStepOutput"`, `"variable"`, `"resource"`, `"userDefined"`
*   **Conditional Fields:** Depending on the `sourceType`:
    *   **If `sourceType` is `"file"`:**
        *   `location` (string, required): Path, URL, or identifier for the input file.
        *   `format` (string, optional): File format (e.g., "FIF", "SET", "EDF", "NIFTI", "JSON", "TSV").
        *   `entityLabels` (object, optional): Key-value pairs representing BIDS-like entities (e.g., `{"sub": "01", "task": "rest"}`).
        *   `pipelineSource` (object, optional): If the file was generated by another documented pipeline. See [Pipeline Source Object](#pipeline-source-object).
    *   **If `sourceType` is `"previousStepOutput"`:**
        *   `stepId` (string, required): The `stepId` of the previous step that produced this input.
        *   `outputId` (string, required): A descriptive identifier matching the `description` field in the corresponding `outputTarget` of the source step.
    *   **If `sourceType` is `"variable"`:**
        *   `name` (string, required): Name of the in-memory variable.
        *   `description` (string, optional): Description of the variable.
    *   **If `sourceType` is `"resource"`:**
        *   `location` (string, required): Description or identifier of the external resource (e.g., "fsaverage MRI data", URL).
    *   **If `sourceType` is `"userDefined"`:**
        *   `description` (string, required): Description of the user-provided input.

---

## Output Target Object

Describes an output from a processing step, as defined in [`OutputTarget.schema.json`](../../schema/definitions/OutputTarget.schema.json).

*   `targetType` (string, required)
    *   **Description:** Type of the output target.
    *   **Enum:** `"file"`, `"in-memory"`, `"variable"`, `"report"`, `"userDefined"`, `"inlineData"`
*   `description` (string, required)
    *   **Description:** A descriptive identifier for this output, used by subsequent steps referencing it via `previousStepOutput` inputs.
    *   **Example:** `"description": "Band-pass filtered data."`
*   **Conditional Fields:** Depending on the `targetType`:
    *   **If `targetType` is `"file"`:**
        *   `location` (string, required): Path where the output file was saved (relative or absolute).
        *   `format` (string, optional): File format (e.g., "FIF", "NetCDF", "HDF5").
        *   `entityLabels` (object, optional): Key-value pairs representing BIDS-like entities.
    *   **If `targetType` is `"in-memory"`:**
        *   `format` (string, optional): Description of the data format/object type in memory (e.g., "mne.io.Raw", "mne.Epochs").
    *   **If `targetType` is `"variable"`:**
        *   `name` (string, required): Name of the variable stored.
    *   **If `targetType` is `"report"`:**
        *   `location` (string, optional): Path to a generated report file (e.g., HTML, PDF).
        *   `format` (string, optional): Format of the report.
    *   **If `targetType` is `"userDefined"`:**
        *   `details` (string, required): Description of the output.
    *   **If `targetType` is `"inlineData"`:**
        *   `data` (any, required): The actual data stored inline. Can be any valid JSON type (object, array, string, number, boolean).
        *   `encoding` (string, optional, default: "utf-8"): Encoding of the `data` (e.g., "utf-8", "base64"). Use "base64" for binary data.
        *   `formatDescription` (string, optional): Describes the format or structure of the `data`. Useful for complex data like matrices or specific object schemas.
            *   **Recommendation:** Use a structured format like `application/json; format=<custom-name>[; version=<version>]` for clarity.
        *   **Purpose:** Useful for storing small results, parameters, or derived values directly within the JSON, avoiding the need for extra files. Examples include rejected channel lists, ICA component properties, or summary statistics.
        *   **Caution:** Avoid storing large amounts of data inline, as it increases the file size significantly. Consider `targetType: "file"` for larger datasets.
        *   **Examples:**
            ```json
            // Example 1: Storing rejected channels list
            {
              "targetType": "inlineData",
              "description": "List of channels rejected by cleanRawData",
              "data": ["Fp1", "F7", "O2"],
              "formatDescription": "application/json; format=channel-names"
            }

            // Example 2: Storing ICA weight matrix (simplified)
            {
              "targetType": "inlineData",
              "description": "ICA weight matrix (W)",
              "data": [[0.1, 0.5, -0.2], [-0.3, 0.1, 0.8], [0.7, 0.3, 0.1]],
              "formatDescription": "application/json; format=matrix; rows=components; cols=channels"
            }

            // Example 3: Storing ICLabel results
            {
              "targetType": "inlineData",
              "description": "ICLabel classifications for component 3",
              "data": {
                "Brain": 0.85,
                "Muscle": 0.05,
                "Eye": 0.03,
                "Heart": 0.01,
                "Line Noise": 0.02,
                "Channel Noise": 0.02,
                "Other": 0.02
              },
              "formatDescription": "application/json; format=iclabel-probabilities"
            }
            ```

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