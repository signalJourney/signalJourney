function writeSignalJourney(data, filename)
%WRITESIGNALJOURNEY Writes a MATLAB structure to a signalJourney JSON file.
%   WRITESIGNALJOURNEY(data, filename) converts the MATLAB structure 'data'
%   into a JSON format and saves it to the specified 'filename'.
%   Includes basic validation and pretty-printing.

    arguments
        data (1,1) struct % Input must be a single struct
        filename (1,:) char % Output filename
    end

    % Basic Validation: Check for some essential top-level fields
    requiredFields = {'sj_version', 'schema_version', 'description', 'pipelineInfo', 'processingSteps'};
    if ~all(isfield(data, requiredFields))
         warning('writeSignalJourney:FormatWarning', ...
                 'Input data might not be a valid signalJourney structure (missing required top-level fields). Saving anyway.');
    end

    try
        % Encode the MATLAB structure to JSON
        % Use 'PrettyPrint', true for human-readable output
        jsonString = jsonencode(data, 'PrettyPrint', true);
    catch ME
        error('writeSignalJourney:jsonEncodeError', ...
              'Failed to encode MATLAB structure to JSON: %s', ME.message);
    end

    try
        % Open the file for writing
        fid = fopen(filename, 'w');
        if fid == -1
            error('writeSignalJourney:fileOpenError', 'Cannot open file "%s" for writing.', filename);
        end
        
        % Write the JSON string to the file
        fprintf(fid, '%s\n', jsonString);
        
        % Close the file
        fclose(fid);
    catch ME
        % Ensure file is closed even if fprintf fails
        if exist('fid', 'var') && fid ~= -1
            fclose(fid);
        end
        % Rethrow the error caught during file operations
        error('writeSignalJourney:fileWriteError', ...
              'Failed to write JSON to file "%s": %s', filename, ME.message);
    end

end 