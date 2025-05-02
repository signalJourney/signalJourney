# Tutorial: Creating a signalJourney File Manually

This tutorial guides you through creating a basic signalJourney JSON file by hand using a text editor. This is useful for understanding the core structure or for simple pipelines where automated generation isn't necessary.

**Prerequisites:**

*   A text editor (like VS Code, Sublime Text, Notepad++).
*   Basic understanding of JSON syntax (key-value pairs, objects {}, arrays []).
*   Familiarity with the pipeline you want to document.

## 1. Basic File Structure

Start with the essential top-level fields:

```json
{
  "sj_version": "0.1.0", 
  "schema_version": "0.1.0", 
  "description": "", 
  "pipelineInfo": {},
  "processingSteps": [] 
}
```

*   Set `sj_version` and `schema_version` to the current version you are targeting (e.g., "0.1.0").
*   Add a brief `description` of the pipeline.

## 2. Describe the Pipeline (`pipelineInfo`)

Fill in the `pipelineInfo` object with details about the overall workflow:

```json
{
  // ... sj_version, schema_version, description ...
  "pipelineInfo": {
    "name": "My Simple EEG Filter Pipeline",
    "description": "Applies high-pass and low-pass filters to raw EEG data using EEGLAB.",
    "version": "1.0", 
    "pipelineType": "preprocessing",
    "executionDate": "2024-05-02T15:30:00Z" // Optional: Use ISO 8601 format
  },
  "processingSteps": []
}
```

*   Provide a clear `name` and more detailed `description`.
*   Assign a `version` to your specific pipeline script/implementation.
*   Optionally add `pipelineType` and `executionDate`.

## 3. Add Processing Steps (`processingSteps`)

This is an array where each element is an object describing one step. Let's add a filtering step:

```json
{
  // ... sj_version, schema_version, description, pipelineInfo ...
  "processingSteps": [
    {
      "stepId": "step1_filter", 
      "name": "Apply Band-pass Filter",
      "description": "Applied a high-pass filter at 1 Hz and low-pass at 40 Hz.",
      "software": {
        "name": "EEGLAB",
        "version": "2023.1"
      },
      "parameters": {
        "locutoff": 1.0,
        "hicutoff": 40.0,
        "filter_type": "fir"
      },
      "inputSources": [
        {
          "sourceType": "file",
          "location": "./sub-01_task-rest_eeg.set"
        }
      ],
      "outputTargets": [
        {
          "targetType": "file",
          "description": "Filtered EEG data file",
          "location": "./derivatives/pipeline/sub-01_task-rest_desc-filtered_eeg.set"
        }
      ]
    }
    // Add more steps here...
  ]
}
```

**Key fields for each step:**

*   `stepId`: A unique identifier for this step (e.g., "step1", "filter_hp").
*   `name`: Human-readable name.
*   `description`: What the step did.
*   `software`: Name and version of the tool used.
*   `parameters`: Key-value pairs of the parameters used.
*   `inputSources`: An array describing where the step got its data.
    *   `sourceType`: Typically `"file"` for the first step, or `"previousStepOutput"` for subsequent steps.
    *   `location` (for `file` type): Path to the input file.
*   `outputTargets`: An array describing the step's output.
    *   `targetType`: Can be `"file"`, `"in-memory"`, etc.
    *   `description`: **Important:** A unique description used to link inputs of later steps.
    *   `location` (for `file` type): Path where the output was saved.

## 4. Linking Steps (`dependsOn` and `previousStepOutput`)

To show the flow, use `dependsOn` in the step definition and `previousStepOutput` in `inputSources`.

```json
{
  // ... sj_version, schema_version, description, pipelineInfo ...
  "processingSteps": [
    {
      "stepId": "step1_filter", 
      "name": "Apply Band-pass Filter",
      // ... other fields ...
      "outputTargets": [
        {
          "targetType": "in-memory", // Output is kept in memory for next step
          "description": "Filtered EEG data in memory" // Unique description
        }
      ]
    },
    {
      "stepId": "step2_reref",
      "name": "Apply Average Reference",
      "description": "Re-referenced the data to the average.",
      "dependsOn": ["step1_filter"], // Depends on the previous step
      "software": {
        "name": "EEGLAB",
        "version": "2023.1"
      },
      "parameters": {
        "reference_type": "average"
      },
      "inputSources": [
        {
          "sourceType": "previousStepOutput",
          "stepId": "step1_filter", // ID of the step that produced the input
          "outputId": "Filtered EEG data in memory" // Matches description in step1 outputTarget
        }
      ],
      "outputTargets": [
        {
          "targetType": "file",
          "description": "Final preprocessed file",
          "location": "./derivatives/pipeline/sub-01_task-rest_desc-preproc_eeg.set"
        }
      ]
    }
  ]
}
```

## 5. Adding Optional Information

You can add more detail:

*   **Quality Metrics:** Add a `qualityMetrics` object to steps or a top-level `summaryMetrics` object.
    ```json
    // In a processing step:
    "qualityMetrics": { "numBadChannelsInterpolated": 2 }
    
    // At the top level:
    "summaryMetrics": { "percentGoodICAComponents": 90 }
    ```
*   **Software Details:** Add `functionCall`, `repository`, etc., to the `software` object.
*   **Extensions:** Add domain-specific info under the `extensions` object (see [Namespaces](../specification/namespaces.md)).

## 6. Validation

Once you have created your file, it's highly recommended to validate it against the schema using a tool like the [`signaljourney-validator`](../guides/validator_python.md) to catch errors in structure or types.

This covers the basics of creating a signalJourney file manually. Remember to consult the [Specification Fields](../specification/fields.md) documentation for details on all available fields. 