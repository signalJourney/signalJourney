# Example: Connectivity Analysis

This page explains the [`connectivity_analysis_pipeline.signalJourney.json`](../../schema/examples/connectivity_analysis_pipeline.signalJourney.json) example file. This pipeline calculates spectral coherence between EEG sensors using the `mne-connectivity` Python package.

```json
{
  "sj_version": "0.1.0",
  "schema_version": "0.1.0",
  "description": "Example signalJourney file for a connectivity analysis pipeline using MNE-Connectivity (Coherence).",
  "pipelineInfo": {
    "name": "Connectivity Analysis (Coherence)",
    "description": "Calculates spectral coherence between EEG sensor pairs using multitaper method on epoched data.",
    "pipelineType": "connectivity",
    "version": "1.0.0",
    "executionDate": "2024-05-02T14:00:00Z"
  },
  "processingSteps": [
    // ... steps detailed below ...
  ],
  "summaryMetrics": {
    "analysisType": "Connectivity",
    "method": "Coherence (multitaper)",
    "domain": "sensor"
  }
}
```

## Overview

The pipeline performs the following steps:

1.  Loads epoched EEG data (presumably cleaned).
2.  Calculates spectral connectivity using the coherence (`coh`) method with multitaper estimation for the alpha band (8-13 Hz).
3.  Saves the resulting connectivity object to a NetCDF file.

## Key Sections Explained

*   **`pipelineInfo`:** Defines the pipeline name, description, type ("connectivity"), etc.
*   **`processingSteps`:**
    *   **Step 1: Load Epoched Data**
        *   Similar to previous examples, loads an `*_epo.fif` file, potentially linked via `pipelineSource`.
        *   Outputs an `in-memory` MNE Epochs object.
    *   **Step 2: Calculate Spectral Connectivity (Coherence)**
        *   `dependsOn`: `["1"]`.
        *   `software`: Specifies `MNE-Connectivity` (version 0.6) and the function `spectral_connectivity_epochs`.
        *   `parameters`: Details the connectivity parameters:
            *   `method`: "coh" (coherence).
            *   `mode`: "multitaper".
            *   `fmin`, `fmax`: Defines the frequency band (8-13 Hz).
            *   Other relevant function arguments (`faverage`, `mt_adaptive`, `n_jobs`).
        *   `inputSources`: Takes the loaded Epochs object from Step 1.
        *   `outputTargets`: Saves the resulting connectivity data directly to a `file` (`format: "NetCDF"`).
        *   `qualityMetrics`: Records key parameters like the frequency band and method used.
*   **`summaryMetrics`:** Provides overall information about the connectivity analysis performed (type, method, domain).

This example shows how to document the use of specific connectivity measures and parameters within the signalJourney framework. 