# Signal Journey MATLAB Tools

MATLAB functions for reading, writing, and validating signalJourney JSON files.

## Functions

*   `readSignalJourney(filename)`: Reads a signalJourney JSON file into a MATLAB structure.
*   `writeSignalJourney(data, filename)`: Writes a MATLAB structure to a signalJourney JSON file.
*   `validateSignalJourney(data)`: Performs basic validation checks on a signalJourney MATLAB structure.
*   `convertSignalJourneyVersion(data, targetVersion)`: (Placeholder) Converts a structure between specification versions.

## Usage

1.  Add the `scripts/matlab` directory to your MATLAB path.
2.  Call the functions directly:

```matlab
% Read a file
journeyData = readSignalJourney('path/to/your_signalJourney.json');

% Validate the structure
[isValid, messages] = validateSignalJourney(journeyData);
if ~isValid
    disp('Validation Errors:');
    disp(messages);
end

% Modify the data (example)
journeyData.description = 'Updated description';

% Write the modified data back to a new file
writeSignalJourney(journeyData, 'path/to/updated_signalJourney.json');
```

## Requirements

*   MATLAB R2019b or newer (due to `arguments` block usage and potentially `jsonencode`/`jsondecode` behavior).

## Limitations

*   `validateSignalJourney` only performs basic structural checks, not full schema validation.
*   Version conversion is not yet implemented.

## Contributing

Please refer to the main project's [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

MIT License - see the main project [LICENSE](../../LICENSE) file. 