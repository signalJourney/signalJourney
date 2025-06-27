# Tutorial: Using the MATLAB Tools

This tutorial demonstrates how to use the provided MATLAB functions to interact with signalJourney JSON files.

**Prerequisites:**

*   MATLAB R2019b or newer.
*   The `scripts/matlab` directory added to your MATLAB path.
*   signalJourney JSON files to work with.

## 1. Reading a signalJourney File

Use the `readSignalJourney` function to load a JSON file into a MATLAB structure.

```matlab
% Define the path to your file
filename = '../../schema/examples/basic_preprocessing_pipeline_mne.signalJourney.json';

try
    journeyData = readSignalJourney(filename);
    disp('File read successfully!');
    
    % Access data within the structure
    disp(['Pipeline Name: ', journeyData.pipelineInfo.name]);
    fprintf('Number of processing steps: %d\n', length(journeyData.processingSteps));
    
    % Display parameters of the first step (if it exists)
    if ~isempty(journeyData.processingSteps) && isfield(journeyData.processingSteps(1), 'parameters')
        disp('Parameters of first step:');
        disp(journeyData.processingSteps(1).parameters);
    end
    
catch ME
    fprintf('Error reading file: %s\n', ME.message);
end
```

## 2. Basic Validation of MATLAB Structure

Use `validateSignalJourney` to perform basic checks on a loaded structure (this is *not* full schema validation).

```matlab
% Assuming journeyData is loaded from the previous step

[isValid, messages] = validateSignalJourney(journeyData);

if isValid
    disp('MATLAB structure passed basic validation checks.');
else
    disp('Basic validation failed:');
    for i = 1:length(messages)
        disp(['- ', messages{i}]);
    end
end

% Example of an invalid structure
invalidData = struct('sj_version', '0.1.0'); % Missing required fields
[isValid, messages] = validateSignalJourney(invalidData);
if ~isValid
    disp('Invalid structure failed validation as expected:');
    disp(messages);
end
```

## 3. Modifying Data

You can modify the MATLAB structure directly.

```matlab
% Assuming journeyData is loaded

% Change the pipeline description
journeyData.pipelineInfo.description = 'Updated pipeline description for tutorial.';

% Add a quality metric to the first step
if ~isempty(journeyData.processingSteps)
   journeyData.processingSteps(1).qualityMetrics = struct('filterRippleDb', -60);
   disp('Added quality metric to step 1.');
end

% Add a new top-level summary metric
journeyData.summaryMetrics = struct('totalExecutionTimeSec', 125.5);
disp('Added summary metric.');
```

## 4. Writing to a signalJourney File

Use `writeSignalJourney` to save a MATLAB structure back to a JSON file. The output will be pretty-printed.

```matlab
% Assuming journeyData has been loaded and possibly modified
outputFilename = './my_modified_pipeline.signalJourney.json';

try
    writeSignalJourney(journeyData, outputFilename);
    disp(['Successfully wrote modified data to: ', outputFilename]);
catch ME
    fprintf('Error writing file: %s\n', ME.message);
end
```

## 5. Version Conversion (Placeholder)

The `convertSignalJourneyVersion` function is a placeholder for future development. It is intended to convert structures between different versions of the specification.

```matlab
% Placeholder usage - this will currently error
% targetVersion = '0.2.0'; 
% try
%    convertedData = convertSignalJourneyVersion(journeyData, targetVersion);
% catch ME
%    disp(ME.message); % Expect 'Not Implemented' error
% end
```

These examples cover the basic usage of the MATLAB tools for interacting with signalJourney files. 