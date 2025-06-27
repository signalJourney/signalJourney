# Example: Source Localization

This page explains the [`source_localization_pipeline.signalJourney.json`](https://github.com/neuromechanist/signalJourney/blob/main/schema/examples/source_localization_pipeline.signalJourney.json) example file, documenting a source localization workflow. This pipeline documents the process of estimating the brain sources of EEG activity using the dSPM (dynamic Statistical Parametric Mapping) inverse solution in MNE-Python.

```json
{
  "sj_version": "0.1.0",
  "schema_version": "0.1.0",
  "description": "Example signalJourney file for a source localization pipeline using MNE-Python (dSPM).",
  "pipelineInfo": {
    "name": "Source Localization (dSPM)",
    "description": "Performs source localization on evoked data using dSPM inverse solution with a BEM head model.",
    "pipelineType": "source-localization",
    "version": "1.0.0",
    "executionDate": "2024-05-02T13:00:00Z"
  },
  "processingSteps": [
    // ... steps detailed below ...
  ],
  "summaryMetrics": {
    "analysisType": "Source Localization",
    "inverseMethod": "dSPM",
    "headModel": "BEM",
    "sourceSpace": "fsaverage (oct6)"
  }
}
```

## Overview

The pipeline performs the following steps:

1.  Loads evoked EEG data (averaged epochs).
2.  Sets up a source space based on the `fsaverage` template brain.
3.  Computes a Boundary Element Model (BEM) head model solution.
4.  Computes the forward solution (leadfield matrix).
5.  Computes a noise covariance matrix from baseline epochs.
6.  Creates the inverse operator.
7.  Applies the dSPM inverse solution to the evoked data.
8.  Saves the resulting source time courses (STC).

## Key Sections Explained

*   **`pipelineInfo`:** Defines the pipeline name, description, type ("source-localization"), etc.
*   **`processingSteps`:**
    *   **Step 1: Load Evoked Data**
        *   `inputSources`: Loads an evoked data file (`*_ave.fif`), potentially from a previous averaging pipeline.
        *   `outputTargets`: Outputs a list containing the loaded Evoked object(s).
    *   **Step 2: Setup Source Space**
        *   `software`: MNE-Python, `mne.setup_source_space`.
        *   `parameters`: Specifies the template subject (`fsaverage`), spacing (`oct6`), and path to the FreeSurfer subjects directory (using an environment variable placeholder `subjects_dir_env_var`).
        *   `inputSources`: References an external `resource` (the fsaverage MRI data).
        *   `outputTargets`: Outputs the computed `mne.SourceSpaces` object.
    *   **Step 3: Compute BEM Solution**
        *   `dependsOn`: `[]` (Can be computed independently if MRI data is available).
        *   `software`: MNE-Python, `mne.make_bem_model` and `mne.make_bem_solution`.
        *   `parameters`: Specifies BEM parameters like conductivity.
        *   `inputSources`: References an external `resource` (BEM surfaces).
        *   `outputTargets`: Outputs the BEM solution dictionary.
    *   **Step 4: Make Forward Solution**
        *   `dependsOn`: `["1", "2", "3"]` (Needs evoked data info, source space, and BEM).
        *   `software`: MNE-Python, `mne.make_forward_solution`.
        *   `parameters`: Specifies transform (`fsaverage`), sensor types (`eeg: true`), minimum distance, etc.
        *   `inputSources`: References outputs from steps 1, 2, and 3.
        *   `outputTargets`: Outputs the `mne.Forward` object.
    *   **Step 5: Compute Covariance Matrix**
        *   `dependsOn`: `[]` (Typically computed from baseline periods of *epochs*, not the evoked data itself, so often done separately or uses a pre-computed matrix).
        *   `software`: MNE-Python, `mne.compute_covariance`.
        *   `parameters`: Specifies the time window (`tmax=0.`) and estimation `method`.
        *   `inputSources`: References the *epochs* file (`*_epo.fif`) used for covariance estimation.
        *   `outputTargets`: Outputs the `mne.Covariance` object.
    *   **Step 6: Make Inverse Operator**
        *   `dependsOn`: `["1", "4", "5"]` (Needs evoked info, forward solution, and covariance).
        *   `software`: MNE-Python, `make_inverse_operator`.
        *   `parameters`: Specifies inverse solution parameters (`loose`, `depth`).
        *   `inputSources`: References outputs from steps 1, 4, and 5.
        *   `outputTargets`: Outputs the `mne.minimum_norm.InverseOperator` object.
    *   **Step 7: Apply Inverse Solution (dSPM)**
        *   `dependsOn`: `["1", "6"]` (Needs evoked data and inverse operator).
        *   `software`: MNE-Python, `apply_inverse`.
        *   `parameters`: Specifies the inverse `method` ("dSPM") and regularization (`lambda2_snr`, derived from SNR).
        *   `inputSources`: References outputs from steps 1 and 6.
        *   `outputTargets`: Saves the final source estimate (`STC`) to a `file` (`format: "HDF5"`).
        *   `qualityMetrics`: Records the inverse method and SNR estimate used.
*   **`summaryMetrics`:** Provides overall information about the source localization approach used.

This example demonstrates documenting a multi-step analysis with dependencies on external resources (MRI data) and intermediate computed objects (BEM, forward solution, covariance), highlighting the provenance tracking capabilities. 