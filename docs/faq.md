# Frequently Asked Questions (FAQ)

Common questions about the signalJourney specification and tools.

## General

**Q: What is the main purpose of signalJourney?**

> A: To provide a standardized, machine-readable format for documenting the *provenance* of biosignal processing pipelines. This improves reproducibility, facilitates data sharing, and enables automated analysis of processing steps across studies.

**Q: How is this different from BIDS?**

> A: BIDS primarily standardizes the *organization* and *metadata* of raw and derived neuroimaging data. signalJourney focuses specifically on documenting the *processing steps* (the pipeline itself) used to generate derived data. They are complementary: signalJourney files can be placed within BIDS derivatives to document how specific BIDS-compliant derivatives were created. See the [BIDS Integration](./bids.md) guide.

**Q: Do I need to create signalJourney files manually?**

> A: Not necessarily. While you can create them manually (see [Tutorial](./tutorials/creating_manual.md)), the goal is for analysis software (like EEGLAB plugins, MNE-Python scripts) to generate these files automatically as part of the processing workflow. Tools for reading/writing/validating are provided ([Python](./guides/validator_python.md), [MATLAB](./guides/tools_matlab.md)).

## Schema & Validation

**Q: Where can I find the official JSON schema?**

> A: The schema is located in the main repository at [`schema/signalJourney.schema.json`](https://github.com/signal-journey/specification/blob/main/schema/signalJourney.schema.json).

**Q: What's the difference between `sj_version` and `schema_version`?**

> A: `sj_version` refers to the version of the overall specification standard the file adheres to. `schema_version` refers to the specific version of the `signalJourney.schema.json` file itself. They might differ slightly if schema fixes are made that don't change the core specification. See [Versioning](./specification/versioning.md).

**Q: My file looks correct, but fails validation. Why?**

> A: Common reasons include:
> *   Typos in field names (JSON is case-sensitive).
> *   Incorrect data types (e.g., using a number where a string is expected).
> *   Missing required fields.
> *   Incorrectly formatted values (e.g., dates not in ISO 8601 format, version strings not matching SemVer).
> *   Invalid structure (e.g., `processingSteps` not being an array of objects).
> Use the `signaljourney-validate` tool ([CLI](./guides/validator_cli.md) or [Python](./guides/validator_python.md)) for detailed error messages and suggestions.

## Content & Best Practices

**Q: How much detail should I include in parameters?**

> A: Include all parameters that were actually used in the function call, even defaults, if possible. The goal is reproducibility. If a parameter value was determined algorithmically, describe the algorithm or reference the relevant input.

**Q: How should I represent a step that involves manual intervention?**

> A: You can describe the manual step in the `description` field. For software, you might list the tool used for visualization/interaction. For parameters, describe the criteria used for the manual decision (e.g., `"parameters": {"manual_rejection_criteria": "Visual inspection for amplitudes > 100 uV"}`). Consider adding a quality metric indicating manual review occurred.

**Q: Where should I put custom metadata specific to my lab or tool?**

> A: Use the top-level `extensions` object, organized by namespace. See the [Namespaces](./specification/namespaces.md) documentation. Avoid adding custom fields outside of `extensions`.

## Tools

**Q: Do the MATLAB tools perform full schema validation?**

> A: No. `validateSignalJourney.m` performs only basic structural and type checks on the MATLAB struct. For full schema validation, use the Python library or CLI.

*(This FAQ will be expanded based on user feedback and common issues.)* 