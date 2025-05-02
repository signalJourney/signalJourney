# User Guide: MATLAB Tools

This guide provides comprehensive details on using the signalJourney MATLAB tools for reading, writing, and performing basic validation on signalJourney JSON files.

## Setup

1.  Ensure you have MATLAB R2019b or newer installed.
2.  Add the directory containing the MATLAB tools (`scripts/matlab` in the repository) to your MATLAB path:
    ```matlab
    addpath('path/to/signalJourney/scripts/matlab'); 
    savepath; % Optional: Save the path for future sessions
    ```

## Core Functions

### `readSignalJourney(filename)`

Reads a signalJourney JSON file and converts it into a MATLAB structure.

**Syntax:**
```matlab
journeyData = readSignalJourney(filename)
```

**Arguments:**

*   `filename` (char vector or string): Path to the `*.signalJourney.json` file.

**Returns:**

*   `journeyData` (struct): A MATLAB structure representing the content of the JSON file. Field names in the structure correspond to the keys in the JSON object.

**Error Handling:**

*   Throws an error if the file does not exist (`readSignalJourney:FileDoesNotExist`).
*   Throws an error if the file cannot be read (`readSignalJourney:fileReadError`).
*   Throws an error if the file contains invalid JSON (`readSignalJourney:jsonDecodeError`).

**Example:**
```matlab
fname = '../../schema/examples/basic_preprocessing_pipeline.signalJourney.json';
try
    data = readSignalJourney(fname);
    disp(data.pipelineInfo);
catch ME
    disp(ME.getReport());
end
```

### `writeSignalJourney(data, filename)`

Writes a MATLAB structure (representing signalJourney data) to a JSON file.

**Syntax:**
```matlab
writeSignalJourney(data, filename)
```

**Arguments:**

*   `data` (struct): A MATLAB structure containing the signalJourney data.
*   `filename` (char vector or string): Path to the output JSON file. The file will be overwritten if it exists.

**Behavior:**

*   Performs a basic check for essential top-level fields (`sj_version`, `schema_version`, etc.) and issues a warning (`writeSignalJourney:FormatWarning`) if they are missing.
*   Encodes the MATLAB structure into a JSON string using `jsonencode` with the `PrettyPrint` option enabled for human readability.
*   Writes the JSON string to the specified file using UTF-8 encoding.

**Error Handling:**

*   Throws an error if the input `data` is not a struct.
*   Throws an error if the structure cannot be encoded to JSON (`writeSignalJourney:jsonEncodeError`).
*   Throws an error if the output file cannot be opened (`writeSignalJourney:fileOpenError`) or written to (`writeSignalJourney:fileWriteError`).

**Example:**
```matlab
% Assume 'modifiedData' is a struct loaded and modified
output_fname = 'my_output.signalJourney.json';
try
    writeSignalJourney(modifiedData, output_fname);
    disp(['File written to: ', output_fname]);
catch ME
    disp(ME.getReport());
end
```

### `validateSignalJourney(data)`

Performs *basic* validation checks on a MATLAB structure to see if it loosely conforms to the signalJourney format. **Note:** This is *not* a full JSON schema validation.

**Syntax:**
```matlab
[isValid, messages] = validateSignalJourney(data)
```

**Arguments:**

*   `data` (struct): The MATLAB structure to validate.

**Returns:**

*   `isValid` (logical): `true` if basic checks pass, `false` otherwise.
*   `messages` (cell array of strings): Contains error or warning messages if validation issues are found. Empty if `isValid` is `true`.

**Checks Performed:**

*   Verifies the input is a single struct.
*   Checks for the presence of required top-level fields (`sj_version`, `schema_version`, `description`, `pipelineInfo`, `processingSteps`).
*   Checks the basic data types of required fields (e.g., `sj_version` is char, `pipelineInfo` is struct, `processingSteps` is cell or struct array).
*   Checks semantic version format for version fields.
*   Checks types of optional top-level fields if they exist (`summaryMetrics`, `extensions`, `versionHistory`) and issues warnings if incorrect.
*   Performs basic structural checks on `processingSteps` array elements (e.g., checks for required fields like `stepId`, `name`).

**Example:**
```matlab
% Assume 'journeyData' is loaded
[isValid, validationMsgs] = validateSignalJourney(journeyData);
if ~isValid
    disp('Basic validation found issues:');
    disp(strjoin(validationMsgs, '\n'));
else
    disp('Basic structure appears valid.');
end
```

### `convertSignalJourneyVersion(data, targetVersion)`

**(Placeholder)** This function is intended for future implementation to convert a signalJourney MATLAB structure from its current `sj_version` to a specified `targetVersion`.

**Syntax (Intended):**
```matlab
convertedData = convertSignalJourneyVersion(data, targetVersion)
```

**Current Behavior:**

*   Checks if `data.sj_version` exists.
*   If `currentVersion` matches `targetVersion`, issues a warning and returns the original data.
*   Otherwise, throws a `convertSignalJourneyVersion:NotImplemented` error.

## Limitations

*   **Validation:** `validateSignalJourney` performs only basic structural and type checks. It does **not** fully validate against the official JSON schema. For rigorous validation, use the Python `signaljourney-validator` library or CLI tool.
*   **Version Conversion:** Not yet implemented.

*(Content to be added)* 