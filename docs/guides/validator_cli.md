# User Guide: CLI Validator Tool (`signaljourney-validate`)

This guide provides comprehensive details on using the `signaljourney-validate` command-line interface (CLI) to validate signalJourney JSON files.

## Installation

The CLI tool is installed as part of the `signaljourney-validator` Python package:

```bash
pip install signaljourney-validator
```

This makes the `signaljourney-validate` command available in your terminal.

## Basic Usage

The primary command is `validate`. It takes the path to a signalJourney JSON file or a directory containing such files as its main argument.

```bash
signaljourney-validate [OPTIONS] PATH
```

*   `PATH`: Path to a single `*_signalJourney.json` file or a directory.

**Examples:**

*   **Validate a single file:**
    ```bash
    signaljourney-validate path/to/my_pipeline.signalJourney.json
    ```
    Output on success:
    ```
    Validating: path/to/my_pipeline.signalJourney.json ... OK
    ```
    Output on failure:
    ```
    Validating: path/to/my_pipeline.signalJourney.json ... FAILED
      - Error at 'pipelineInfo/version': '1.0' is not a 'string' -- Suggestion: Change value type from 'float' to 'string'.
      - Error at 'processingSteps/0/stepId': Required property 'stepId' is missing. -- Suggestion: Ensure required property or properties ('stepId') are present.
    ```

*   **Validate all `*_signalJourney.json` files in a directory (non-recursive):**
    ```bash
    signaljourney-validate path/to/my_pipelines/
    ```
    Output:
    ```
    Scanning directory: path/to/my_pipelines/
    Validating: path/to/my_pipelines/pipeline_a.signalJourney.json ... OK
    Validating: path/to/my_pipelines/pipeline_b.signalJourney.json ... FAILED
      - Error at ...
    ```

*   **Validate recursively through subdirectories:**
    ```bash
    signaljourney-validate -r path/to/project/
    # OR
    signaljourney-validate --recursive path/to/project/
    ```
    Output:
    ```
    Scanning directory: path/to/project/ recursively
    Validating: path/to/project/pipeline1.signalJourney.json ... OK
    Validating: path/to/project/derivatives/pipeline2.signalJourney.json ... OK
    ```

## Options

*   `-s, --schema PATH`: Validate against a custom JSON schema file instead of the default one bundled with the package.
    ```bash
    signaljourney-validate -s path/to/custom_schema.json my_file.signalJourney.json
    ```
*   `-r, --recursive`: Recursively search for `*_signalJourney.json` files in subdirectories when `PATH` is a directory.
*   `-o, --output-format [text|json]`: Specify the output format. Defaults to `text` (human-readable). Use `json` for machine-readable output.
    ```bash
    signaljourney-validate -o json path/to/directory/
    ```
*   `-v, --verbose`: Enable verbose output in `text` format. Shows more error details, including the specific validator and schema path involved, in addition to the basic message and suggestion.
    ```bash
    signaljourney-validate -v path/to/invalid_file.signalJourney.json
    ```
*   `--bids`: Enable experimental BIDS context validation checks (see below).
*   `--bids-root PATH`: Specify the path to the BIDS dataset root directory. **Required** if `--bids` is used.
    ```bash
    signaljourney-validate --bids --bids-root /path/to/bids_dataset path/to/bids_dataset/derivatives/...
    ```
*   `-h, --help`: Show the help message and exit.
*   `--version`: Show the version of the `signaljourney-validator` package and exit.

## Output Formats

*   **`text` (Default):**
    *   Prints the validation status (`OK` or `FAILED`) for each file.
    *   On failure, lists errors with the path within the JSON, the error message, and any suggestions.
    *   If `--verbose` is used, adds more detail to error messages.
*   **`json`:**
    *   Outputs a single JSON object.
    *   Contains an `overall_status` ("passed" or "failed").
    *   Contains a `files` array, where each element is an object representing a validated file.
    *   Each file object includes `filepath`, `status` ("passed", "failed", or "error" if processing failed), and an `errors` array if applicable.
    *   The `errors` array contains objects with detailed error information: `message`, `path`, `schema_path`, `validator`, `validator_value`, `instance_value`, `suggestion`.
    *   Example JSON Output Fragment:
        ```json
        {
          "files": [
            {
              "filepath": "path/to/valid_file.signalJourney.json",
              "status": "passed",
              "errors": []
            },
            {
              "filepath": "path/to/invalid_file.signalJourney.json",
              "status": "failed",
              "errors": [
                {
                  "message": "'1.0' is not of type 'string'",
                  "path": ["pipelineInfo", "version"],
                  "schema_path": ["properties", "pipelineInfo", "properties", "version", "type"],
                  "validator": "type",
                  "validator_value": "string",
                  "instance_value": "1.0",
                  "suggestion": "Change value type from 'float' to 'string'."
                }
              ]
            }
          ],
          "bids_mode_enabled": false,
          "overall_status": "failed"
        }
        ```

## BIDS Context Validation (`--bids`)

This is an **experimental** feature.

When the `--bids` flag is used (along with `--bids-root`), the validator attempts to perform checks relevant to the BIDS standard:

*   *(Planned)* Verify the signalJourney file is located appropriately within the BIDS `derivatives/` structure.
*   *(Planned)* Check if file paths referenced within the signalJourney file (e.g., in `inputSources`) exist relative to the BIDS root.

Currently, enabling this flag primarily prints an informational message in the underlying library. Full BIDS validation logic will be added in future versions.

## Exit Codes

The CLI uses the following exit codes, useful for scripting:

*   `0`: Validation successful (all files passed, or no `*_signalJourney.json` files found when using `json` output).
*   `1`: Validation failed (one or more files failed validation or encountered a processing error like file not found/invalid JSON). Also used if no `*_signalJourney.json` files are found when using `text` output.
*   `>1`: Typically indicates an error with the CLI arguments themselves (handled by `click`). 