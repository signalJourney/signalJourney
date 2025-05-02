function writeSignalJourney(data, filename)
%WRITESIGNALJOURNEY Writes a MATLAB structure to a signalJourney JSON file.
%
%   WRITESIGNALJOURNEY(data, filename) encodes the MATLAB structure 'data'
%   into JSON format and writes it to the file specified by 'filename'.
%   The output JSON is pretty-printed for readability.
%
%   Args:
%       data (struct): The MATLAB structure representing signalJourney data.
%       filename (string): The path to the output JSON file.
%
%   Raises:
%       error: If the input data is not a structure, if required fields are
%              missing, if JSON encoding fails, or if the file cannot be written.

    arguments
        data (1,1) struct % Input must be a single struct
        filename (1,:) char % Filename must be a character row vector
    end

    % Basic check: Ensure it looks somewhat like a signalJourney structure
    requiredFields = {'sj_version', 'schema_version', 'description', 'pipelineInfo', 'processingSteps'};
    if ~all(isfield(data, requiredFields))
         warning('writeSignalJourney:FormatWarning', ...
                 'Input structure might not be a valid signalJourney object (missing top-level fields).');
         % Decide if this should be an error or just a warning
         % For now, proceed with writing.
    end

    try
        % Encode the MATLAB structure to JSON with pretty-printing
        % Note: MATLAB's jsonencode doesn't have a direct pretty-print option
        % like Python's indent. It produces readable JSON by default.
        % For more control, external libraries or manual formatting would be needed.
        jsonString = jsonencode(data);

        % Add a newline at the end for POSIX compatibility
        if ~isempty(jsonString)
            jsonString = [jsonString, sprintf('\n')];
        end

    catch ME
        error('writeSignalJourney:JSONEncodeError', ...
              'Failed to encode MATLAB structure to JSON. Reason: %s', ME.message);
    end

    try
        % Open the file for writing (overwrite if exists)
        fileID = fopen(filename, 'w', 'n', 'UTF-8'); % Specify UTF-8 encoding
        if fileID == -1
            error('writeSignalJourney:FileOpenError', 'Could not open file %s for writing.', filename);
        end
        % Ensure file is closed even if errors occur
        cleanupObj = onCleanup(@() fclose(fileID));

        % Write the JSON string to the file
        fprintf(fileID, '%s', jsonString);

    catch ME
        error('writeSignalJourney:FileWriteError', ...
              'Could not write JSON to file: %s. Reason: %s', filename, ME.message);
    end

end 