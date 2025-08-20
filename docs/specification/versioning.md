# Versioning

signalJourney uses semantic versioning (SemVer - MAJOR.MINOR.PATCH) for both the specification itself and the schema file.

## Specification Version (`sj_version`)

This field, located at the root of the signalJourney JSON file, indicates the version of the *overall specification standard* that the file adheres to.

*   **MAJOR:** Incremented for incompatible changes to the conceptual model or fundamental structure.
*   **MINOR:** Incremented for additions or changes that are backward-compatible with previous minor versions within the same major version.
*   **PATCH:** Incremented for backward-compatible bug fixes or clarifications to the specification text.

Files declaring a specific `sj_version` (e.g., "0.1.0") should be valid according to the rules and structures defined in that version of the specification document.

## Schema Version (`schema_version`)

This field, also at the root level, indicates the version of the *JSON Schema file* (`signalJourney.schema.json`) used to define and validate the file's structure.

While often aligned with the `sj_version`, the `schema_version` might increment more frequently for schema-specific fixes or improvements that don't necessarily change the conceptual specification.

*   **MAJOR:** Incremented for backward-incompatible changes to the schema structure that would break validation for files valid under previous versions.
*   **MINOR:** Incremented for backward-compatible additions to the schema (e.g., adding new optional fields, adding new enum values).
*   **PATCH:** Incremented for backward-compatible fixes or refinements to the schema definitions (e.g., improving descriptions, tightening patterns) that do not change validation outcomes for previously valid files.

The signalJourney validator automatically uses the `schema_version` declared in the file to select the appropriate schema definition for validation. This enables backward compatibility with older versions while supporting new features in newer versions.

## Pipeline Version (`pipelineInfo.version`)

This field within the `pipelineInfo` object represents the version of the *specific pipeline script or implementation* described in the file. It is independent of the signalJourney specification and schema versions and should be managed by the pipeline developers.

## Version History (`versionHistory`)

The optional top-level `versionHistory` array allows tracking changes made to the *content* of a specific signalJourney file over time. Each entry should include:

*   `version` (string): A user-defined version string for this state of the file.
*   `date` (string, format: date): The date the change was made.
*   `changes` (string): A description of the changes.
*   `author` (string, optional): Who made the changes.

This provides an audit trail for modifications to the provenance record itself. 

### Version History

| Version | Date       | Changes Summary                                                                                  |
| :------ | :--------- | :----------------------------------------------------------------------------------------------- |
| 0.2.0   | 2024-05-06 | Refactored `InputSource`/`OutputTarget` into definitions. Added `inlineData` targetType.        |
| 0.1.0   | 2024-05-03 | Initial schema structure definition. Basic fields for pipeline, steps, software, parameters. | 