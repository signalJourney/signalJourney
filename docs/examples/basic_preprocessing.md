# Example: Basic Preprocessing

This page explains the [`basic_preprocessing_pipeline.signalJourney.json`](../../schema/examples/basic_preprocessing_pipeline.signalJourney.json) example file, which documents a standard EEG preprocessing workflow using MNE-Python.

```json
{
  "sj_version": "0.1.0",
  "schema_version": "0.1.0",
  "description": "Example signalJourney file for a basic EEG preprocessing pipeline.",
  "pipelineInfo": {
    "name": "Basic EEG Preprocessing",
    "description": "Standard preprocessing steps including filtering, referencing, and bad channel interpolation using MNE-Python.",
    "pipelineType": "preprocessing",
    "version": "1.0.0",
    "executionDate": "2024-05-02T10:00:00Z"
  },
  "processingSteps": [
    // ... steps detailed below ...
  ],
  "summaryMetrics": {
    "finalSamplingRateHz": 1000,
    "totalChannels": 64,
    "numBadChannelsDetected": 2
  }
}
```

## Overview

The pipeline performs the following steps:

1.  Loads raw EEG data from a FIF file.
2.  Applies a 1-40 Hz band-pass filter.
3.  Applies a 60 Hz notch filter.
4.  Sets an average reference.
5.  Interpolates pre-defined bad channels.
6.  Saves the preprocessed data to a new FIF file.

## Key Sections Explained

*   **`pipelineInfo`:** Defines the pipeline's name, description, type ("preprocessing"), version, and execution date.
*   **`processingSteps`:** An array containing objects for each step.
    *   **Step 1: Load Raw Data**
        *   `stepId`: "1"
        *   `software`: MNE-Python v1.6.1, using `mne.io.read_raw_fif`.
        *   `inputSources`: Specifies the raw FIF file using `sourceType: "file"` and its `location`.
        *   `outputTargets`: Describes the output as an `in-memory` MNE Raw object with `description: "Loaded raw data object."`.
    *   **Step 2: Apply Band-pass Filter**
        *   `dependsOn`: `["1"]`, indicating it runs after Step 1.
        *   `parameters`: Lists the filter parameters (`l_freq`, `h_freq`, `method`, etc.).
        *   `inputSources`: Uses `sourceType: "previousStepOutput"` referencing `stepId: "1"` and `outputId: "Loaded raw data object."`.
        *   `outputTargets`: Describes the output as `in-memory` with `description: "Band-pass filtered data."`.
    *   **Step 3: Apply Notch Filter**
        *   Similar structure, depends on Step 2, takes "Band-pass filtered data." as input, outputs "Notch filtered data.".
    *   **Step 4: Set Average Reference**
        *   Depends on Step 3.
        *   Includes `qualityMetrics`: `{"projectionAdded": true}`.
        *   Outputs "Average referenced data.".
    *   **Step 5: Interpolate Bad Channels**
        *   Depends on Step 4.
        *   `parameters` includes the `bad_channels_list` used for interpolation.
        *   `qualityMetrics`: Records which channels were interpolated and the count.
        *   `outputTargets`: Describes the final output using `targetType: "file"`, specifying the `location` and `format` ("FIF") of the saved preprocessed file.
*   **`summaryMetrics`:** Provides overall metrics about the final output, like sampling rate and number of bad channels detected (even if interpolated later).

This example demonstrates how to link steps using `dependsOn` and `previousStepOutput`/`outputId`, document parameters and software, specify input/output types, and include quality metrics. 