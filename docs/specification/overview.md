# Specification Overview

The signalJourney specification provides a standardized JSON format for describing biosignal processing pipelines and their outputs. Its primary goal is to enhance reproducibility and data sharing by capturing detailed provenance information.

## Core Concepts

*   **Pipeline Description:** Defines the overall goal, software environment, and execution context of the processing workflow.
*   **Processing Steps:** Details each individual operation performed on the data, including the specific software, function calls, parameters used, inputs, and outputs.
*   **Data Provenance:** Explicitly links processing steps, defining dependencies and tracking data flow.
*   **Quality Metrics:** Allows for embedding quantitative or qualitative metrics about the data quality or processing outcomes at various stages.
*   **Extensibility:** Uses a namespace system to allow for domain-specific extensions (e.g., for EEG, MEG) while maintaining a core standard.

## File Structure

A signalJourney file is a JSON object with several key top-level fields:

*   `sj_version`: The version of the signalJourney specification the file adheres to.
*   `schema_version`: The version of the JSON schema file itself.
*   `description`: A brief, human-readable description of the pipeline documented in the file.
*   `pipelineInfo`: An object containing metadata about the overall pipeline (name, version, type, execution date, etc.).
*   `processingSteps`: An array of objects, each detailing a single step in the pipeline.
*   `summaryMetrics` (optional): An object containing summary quality metrics for the entire pipeline output.
*   `extensions` (optional): An object containing namespaced, domain-specific extensions.
*   `versionHistory` (optional): An array documenting changes to the signalJourney file itself.

## Purpose

By standardizing how processing pipelines are documented, signalJourney aims to:

*   Improve **reproducibility** by capturing exact parameters and software versions.
*   Facilitate **data sharing** and **meta-analysis** by providing rich, machine-readable provenance.
*   Enable **automated analysis** of processing pipelines across different studies and labs.
*   Provide a clear **audit trail** for complex data transformations.

See the [Fields](./fields.md) section for a detailed description of each component. 