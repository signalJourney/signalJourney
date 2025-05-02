# BIDS Integration

This document outlines strategies and best practices for integrating signalJourney provenance files within datasets structured according to the Brain Imaging Data Structure (BIDS) standard.

## Goal

The primary goal is to store detailed pipeline provenance alongside the BIDS data it describes or generates, without violating BIDS validation rules.

## Placement of `*_signalJourney.json` Files

BIDS currently does not formally specify `*_signalJourney.json` files. Therefore, they should **always** be placed within the `/derivatives` subdirectory of a BIDS dataset.

**Recommended Location:**

Place signalJourney files within the specific pipeline derivative directory they document:

```
<bids_root>/
  derivatives/
    <pipeline_name>/
      sub-<label>/
        [ses-<label>/]
          <datatype>/
            <source_entities>_desc-<description>_<suffix>.json <-- Associated data file
            <source_entities>_desc-<description>_signalJourney.json <-- Provenance for the data file
      ...
      dataset_description.json
      *_signalJourney.json <-- Optional: For pipeline-level info not tied to a specific output file
```

*   `<pipeline_name>`: A descriptive name for your processing pipeline (e.g., `eeg_preprocessing`, `fmri_stats`).
*   The signalJourney filename should mirror the BIDS filename of the data file it primarily documents, replacing the data suffix (e.g., `_eeg.fif`) with `_signalJourney.json`.
*   Pipeline-level signalJourney files (not documenting a *specific* output file but perhaps the overall pipeline execution) can be placed at the root of the `<pipeline_name>` directory.

**Why `/derivatives`?**

*   Raw data directories in BIDS have strict validation rules. signalJourney files are not part of the raw data standard.
*   `/derivatives` is the designated location for outputs of processing pipelines.
*   This keeps provenance clearly associated with the derived data.

## Referencing Files within signalJourney

When specifying file paths within `inputSources` or `outputTargets` in a signalJourney file placed within a BIDS `/derivatives` directory:

*   **Use relative paths:** Paths should ideally be relative *to the BIDS root directory*.
    *   **Input Raw Data:** `../rawdata/sub-01/ses-test/eeg/sub-01_ses-test_task-rest_eeg.vhdr`
    *   **Input Derivative Data:** `./derivatives/preprocessing_pipeline/sub-01/eeg/sub-01_desc-preproc_eeg.fif` (Note the leading `./`)
    *   **Output Derivative Data:** `./derivatives/ica_pipeline/sub-01/eeg/sub-01_desc-cleaned_eeg.fif`
*   This ensures paths remain valid regardless of where the BIDS dataset is moved.
*   Avoid absolute paths unless necessary for external resources.

## Using `.bidsignore`

To prevent standard BIDS validators (which don't recognize `*_signalJourney.json`) from generating errors or warnings about these files, add an entry to the `.bidsignore` file located at the root of your BIDS dataset:

```
# Ignore signalJourney provenance files
*_signalJourney.json
```

This tells BIDS-compliant tools to ignore these files during validation scans.

## Root-Level vs. Derivative-Level Pipelines

signalJourney can document pipelines that operate on entire datasets or individual subject/session files.

*   **Subject/Session Level:** If a pipeline is run independently for each subject/session, the corresponding `*_signalJourney.json` file should typically reside alongside the output data within the subject's derivative directory (as shown in the recommended location example).
*   **Dataset Level:** If a single pipeline instance processes multiple subjects (e.g., group analysis, template creation), a single `*_signalJourney.json` file might be placed at the root of the specific derivative pipeline directory (e.g., `/derivatives/<group_analysis_pipeline>/group_analysis_signalJourney.json`). This file would then reference multiple subject input files using relative paths from the BIDS root.

## Linking signalJourney Files

If one pipeline's output (documented in `pipelineA_signalJourney.json`) is the input to another pipeline (documented in `pipelineB_signalJourney.json`), use the `pipelineSource` field within the `inputSources` of `pipelineB_signalJourney.json`:

```json
// Inside pipelineB_signalJourney.json
"inputSources": [
  {
    "sourceType": "file",
    "location": "./derivatives/pipelineA/sub-01/eeg/sub-01_desc-outputA_eeg.fif",
    "pipelineSource": {
      "pipelineName": "Pipeline A Name", // Matches pipelineInfo.name in pipelineA_signalJourney.json
      "pipelineVersion": "1.2.0",       // Matches pipelineInfo.version in pipelineA_signalJourney.json
      "signalJourneyFile": "./derivatives/pipelineA/sub-01_desc-outputA_signalJourney.json" // Optional path to the source file
    }
  }
]
```

## Summary of Recommendations

1.  Place `*_signalJourney.json` files **only** within `/derivatives/<pipeline_name>/`.
2.  Use filenames that mirror the associated data file, replacing the data suffix with `_signalJourney.json`.
3.  Use **relative paths from the BIDS root** within `inputSources` and `outputTargets`.
4.  Add `*_signalJourney.json` to your top-level `.bidsignore` file.
5.  Store provenance alongside the data it describes (subject/session level where appropriate).
6.  Use `pipelineSource` to link dependent pipelines.

*(Content to be added in Subtask 10.7)* 