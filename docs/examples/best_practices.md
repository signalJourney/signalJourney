# Best Practices

This section outlines recommended best practices when creating and using signalJourney files.

## File Naming

- Follow the BIDS (Brain Imaging Data Structure) naming convention where applicable, typically `sub-<label>_task-<label>_signalJourney.json`.
- Use descriptive names for files not strictly part of a BIDS dataset.

## Metadata Completeness

- Provide comprehensive information in `pipelineInfo`, including the pipeline's purpose, version, and execution context.
- Clearly document the software used in each `processingStep`, including version numbers.

## Parameter Documentation

- Be specific about parameter values.
- Use the `description` field for parameters to clarify their meaning or units if not standard.
- Document the *source* of parameters if they are derived (e.g., calculated from data, user input).

## Input/Output Linking

- Clearly define `inputSources` and `outputTargets` for each step.
- Use `sourceType: "previousStepOutput"` and consistent `outputId` values to explicitly link consecutive steps.
- For inputs originating from other pipelines, use `pipelineSource` to document the provenance.

## Quality Metrics

- Include relevant `qualityMetrics` at both the step level and in `summaryMetrics`.
- Define metrics clearly (e.g., what does a specific score represent?).
- Be consistent in the metrics reported for similar processing steps.

## Versioning

- Keep `sj_version` updated to reflect the specification version being followed.
- Increment `pipelineInfo.version` appropriately when the pipeline logic changes.

## Extensibility

- Use the `extensions` field for non-standard information, potentially organizing by domain (e.g., `extensions.eeg`).
- Document custom extension fields clearly.

## Validation

- Regularly validate your signalJourney files against the official schema using the provided validator tools.

*(More best practices will be added here)* 