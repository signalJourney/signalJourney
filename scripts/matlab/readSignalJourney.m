function journeyData = readSignalJourney(filename)
%READSIGNALJOURNEY Reads and parses a signalJourney JSON file
%   journeyData = READSIGNALJOURNEY(filename) reads the specified JSON file
%   and returns a structured MATLAB object containing the parsed data.
%   Handles basic file reading and JSON decoding errors.

    arguments
        filename (1,:) char {mustBeFile}
    end

    try
        % Read the file content
        fileContent = fileread(filename);
    catch ME
        error('readSignalJourney:fileReadError', ...
              'Failed to read file "%s": %s', filename, ME.message);
    end

    try
        % Parse JSON content using MATLAB's built-in decoder
        journeyData = jsondecode(fileContent);
    catch ME
        % Catch potential JSON decoding errors
        error('readSignalJourney:jsonDecodeError', ...
              'Failed to parse JSON in file "%s": %s', filename, ME.message);
    end

    % Basic validation (optional - can be expanded in later tasks)
    % Example: Check for a required top-level field
    % if ~isfield(journeyData, 'sj_version')
    %     warning('readSignalJourney:missingField', ...
    %             'Required field "sj_version" is missing in file "%s"', filename);
    % end

end

function mustBeFile(filename)
    % Custom validation function to check if file exists
    if ~isfile(filename) && ~exist(filename, 'file') % Check both isfile and exist for robustness
        eid = 'readSignalJourney:FileDoesNotExist';
        msg = sprintf('Input file does not exist: %s', filename);
        throwAsCaller(MException(eid, msg));
    end
end 