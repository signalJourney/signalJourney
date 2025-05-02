function data = readSignalJourney(filename)
%READSIGNALJOURNEY Reads a signalJourney JSON file into a MATLAB structure.
%
%   data = READSIGNALJOURNEY(filename) reads the JSON file specified by
%   filename and returns its contents as a MATLAB structure.
%
%   Args:
%       filename (string): The path to the signalJourney JSON file.
%
%   Returns:
%       struct: A MATLAB structure representing the JSON data.
%
%   Raises:
%       error: If the file does not exist, cannot be read, or contains
%              invalid JSON.

    arguments
        filename (1,:) char {mustBeFile} % Use function argument validation
    end

    try
        % Read the entire file content as a string
        jsonString = fileread(filename);
    catch ME
        error('readSignalJourney:FileReadError', ...
              'Could not read file: %s. Reason: %s', filename, ME.message);
    end

    try
        % Decode the JSON string into a MATLAB structure
        data = jsondecode(jsonString);
    catch ME
        % Check for specific JSON parsing errors if possible, otherwise generic
        if strcmp(ME.identifier, 'MATLAB:json:ExpectedEOS') || contains(ME.identifier, 'JSON')
            error('readSignalJourney:JSONDecodeError', ...
                  'Invalid JSON format in file: %s. Reason: %s', filename, ME.message);
        else
            % Rethrow unexpected errors during decoding
            rethrow(ME);
        end
    end

    % Basic check: Ensure it looks somewhat like a signalJourney file
    requiredFields = {'sj_version', 'schema_version', 'description', 'pipelineInfo', 'processingSteps'};
    if ~isstruct(data) || ~all(isfield(data, requiredFields))
         warning('readSignalJourney:FormatWarning', ...
                 'File %s was parsed but might not be a valid signalJourney file (missing top-level fields).', filename);
    end

end

function mustBeFile(filename)
    % Custom validation function to check if file exists
    if ~isfile(filename) && ~exist(filename, 'file') % Check both isfile and exist for robustness
        eid = 'readSignalJourney:FileDoesNotExist';
        msg = sprintf('Input file does not exist: %s', filename);
        throwAsCaller(MException(eid, msg));
    end
end 