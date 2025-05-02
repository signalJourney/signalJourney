# Validation

The signalJourney specification is formally defined by a JSON Schema ([`signalJourney.schema.json`](../../schema/signalJourney.schema.json)). This schema allows for automated validation of signalJourney files.

## Schema Validation

Any valid signalJourney file **MUST** conform to the structure and constraints defined in the official JSON Schema corresponding to the `schema_version` specified within the file.

Tools like the [`signaljourney-validator`](../guides/validator_python.md) library leverage this schema to check for:

*   **Presence of required fields:** Ensures all mandatory fields (e.g., `sj_version`, `pipelineInfo`, `processingSteps`) are included.
*   **Correct data types:** Verifies that field values match their expected types (string, number, boolean, object, array).
*   **Format constraints:** Checks adherence to specific formats (e.g., `date-time` for timestamps, `uri` for URLs, semantic versioning patterns for `sj_version` and `schema_version`).
*   **Enum constraints:** Ensures values for fields with restricted options are within the allowed set (e.g., `sourceType`, `targetType`).
*   **Structural integrity:** Validates the correct nesting and structure of objects and arrays (e.g., `processingSteps` must be an array of objects conforming to the processing step definition).

## Additional Validation (Tool-Specific)

While the JSON Schema enforces structural validity, dedicated validation tools may perform additional checks beyond the schema's scope:

*   **Dependency Checking:** Verifying that `stepId` values referenced in `dependsOn` fields actually exist within the `processingSteps` array and that there are no circular dependencies.
*   **Input/Output Linking:** Ensuring that `outputId` references in `previousStepOutput` inputs correctly match `description` fields in the `outputTargets` of the specified preceding step.
*   **BIDS Context Validation:** (Experimental/Optional) If run within a BIDS dataset context, validators might check:
    *   Correct placement of the signalJourney file within the BIDS structure (e.g., in `derivatives/<pipeline_name>/`).
    *   Existence of data files referenced in `inputSources` relative to the BIDS root.
    *   Consistency with BIDS naming conventions where applicable.
*   **Semantic Checks:** Potentially checking for logical consistency, such as ensuring parameter values are reasonable for the specified software function (though this is often complex).

Refer to the documentation for specific validation tools (like [`signaljourney-validator`](../guides/validator_python.md)) for details on the checks they perform. 