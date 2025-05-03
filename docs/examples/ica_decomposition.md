# Example: ICA Decomposition

This page explains the [`ica_decomposition_pipeline.signalJourney.json`](https://github.com/neuromechanist/signalJourney/blob/main/schema/examples/ica_decomposition_pipeline.signalJourney.json) example file, which documents an ICA decomposition workflow. This pipeline demonstrates applying Independent Component Analysis (ICA) to remove eye-blink artifacts using MNE-Python, assuming the data has already undergone basic preprocessing (as shown in the [Basic Preprocessing Example](./basic_preprocessing.md)).

```json
{
  "sj_version": "0.1.0",
  "schema_version": "0.1.0",
  "description": "Example signalJourney file for an ICA decomposition pipeline using MNE-Python.",
  "pipelineInfo": {
    "name": "ICA Decomposition",
    "description": "Applies ICA using FastICA, identifies EOG components, and removes them from the preprocessed data.",
    "pipelineType": "ica",
    "version": "1.0.0",
    "executionDate": "2024-05-02T11:00:00Z"
  },
  "processingSteps": [
    // ... steps detailed below ...
  ],
  "summaryMetrics": {
    "numIcaComponents": 15,
    "numArtifactComponentsRemoved": 2
  }
}
```

## Overview

The pipeline performs the following steps:

1.  Loads preprocessed EEG data (output from a previous pipeline).
2.  Fits an ICA model (FastICA) to the data.
3.  Identifies components highly correlated with an Electrooculogram (EOG) channel.
4.  Removes the identified EOG components from the data.
5.  Saves the ICA-cleaned data and the ICA object itself.

## Key Sections Explained

*   **`pipelineInfo`:** Defines the pipeline name, description, type ("ica"), etc.
*   **`processingSteps`:**
    *   **Step 1: Load Preprocessed Data**
        *   `inputSources`: Specifies the preprocessed FIF file as input.
            *   Note the `pipelineSource` field, linking this input file back to the "Basic EEG Preprocessing" pipeline that generated it.
        *   `outputTargets`: Outputs the loaded data to memory.
    *   **Step 2: Fit ICA**
        *   `dependsOn`: `["1"]`.
        *   `software`: MNE-Python, using `mne.preprocessing.ICA` and `ica.fit`.
        *   `parameters`: Details the ICA configuration (`n_components`, `method`, `random_state`, etc.).
        *   `inputSources`: Takes the loaded preprocessed data from Step 1.
        *   `outputTargets`: Produces two outputs:
            1.  An `in-memory` ICA object (`description: "Fitted ICA object."`).
            2.  A saved `file` copy of the ICA object (`format: "FIF"`, `description: "Saved ICA object file."`).
    *   **Step 3: Find EOG Components**
        *   `dependsOn`: `["1", "2"]` (needs both the raw data and the fitted ICA object).
        *   `software`: MNE-Python, using `ica.find_bads_eog`.
        *   `parameters`: Specifies the EOG channel name (`ch_name`).
        *   `inputSources`: References outputs from Step 1 ("Loaded preprocessed data object.") and Step 2 ("Fitted ICA object.").
        *   `outputTargets`: Produces two `variable` outputs: `eog_indices` and `eog_scores`.
        *   `qualityMetrics`: Records the indices and count of identified EOG components.
    *   **Step 4: Apply ICA (Remove Components)**
        *   `dependsOn`: `["1", "2", "3"]` (needs raw data, ICA object, and identified indices).
        *   `software`: MNE-Python, representing `ica.exclude = ...` and `ica.apply`.
        *   `parameters`: Shows the `exclude` list (indices identified in Step 3).
        *   `inputSources`: References outputs from Step 1, Step 2, and Step 3 ("Indices of identified EOG components.").
        *   `outputTargets`: Saves the final cleaned data to a `file` (`description: "ICA cleaned EEG data file."`).
        *   `qualityMetrics`: Records the indices and count of components actually removed.
*   **`summaryMetrics`:** Provides overall metrics like the total number of ICA components fitted and the number removed as artifacts.

This example highlights how to document pipelines that consume outputs from previous pipelines (using `pipelineSource`), produce multiple outputs (in-memory objects, saved files, variables), and reference variables between steps. 