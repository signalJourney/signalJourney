function [isValid, messages] = validateSignalJourney(data)
%VALIDATESIGNALJOURNEY Performs basic validation on a signalJourney MATLAB structure.
%
%   [isValid, messages] = VALIDATESIGNALJOURNEY(data) checks the MATLAB
%   structure 'data' for basic conformance to the signalJourney specification.
%   It checks for the presence of required top-level fields and basic types.
%   Note: This is NOT a full schema validation like jsonschema.
%
%   Args:
%       data (struct): The MATLAB structure representing signalJourney data.
%
%   Returns:
%       isValid (logical): True if basic checks pass, False otherwise.
%       messages (cellstr): A cell array of strings containing warning or error
%                           messages. Empty if no issues found.
%
    arguments
        data (1,1) struct % Input must be a single struct
    end

    isValid = true;
    messages = {};

    % 1. Check for required top-level fields
    requiredFields = {'sj_version', 'schema_version', 'description', 'pipelineInfo', 'processingSteps'};
    for i = 1:length(requiredFields)
        field = requiredFields{i};
        if ~isfield(data, field)
            isValid = false;
            messages{end+1} = sprintf('Missing required top-level field: %s', field);
        end
    end

    % If essential fields are missing, stop further checks
    if ~isValid
        return;
    end

    % 2. Check basic types of required fields
    if ~ischar(data.sj_version) || isempty(regexp(data.sj_version, '^[0-9]+\.[0-9]+\.[0-9]+$', 'once'))
        isValid = false;
        messages{end+1} = 'Field \'sj_version\' must be a string in semantic version format (e.g., \'0.1.0\').';
    end
    if ~ischar(data.schema_version) || isempty(regexp(data.schema_version, '^[0-9]+\.[0-9]+\.[0-9]+$', 'once'))
        isValid = false;
        messages{end+1} = 'Field \'schema_version\' must be a string in semantic version format (e.g., \'0.1.0\').';
    end
     if ~ischar(data.description)
        isValid = false;
        messages{end+1} = 'Field \'description\' must be a string.';
    end
    if ~isstruct(data.pipelineInfo)
        isValid = false;
        messages{end+1} = 'Field \'pipelineInfo\' must be a struct.';
    end
    if ~iscell(data.processingSteps) && ~isstruct(data.processingSteps) % Allow empty struct or cell
        isValid = false;
        messages{end+1} = 'Field \'processingSteps\' must be a cell array or struct array.';
    elseif ~isempty(data.processingSteps) && ~isstruct(data.processingSteps(1)) % Check first element if not empty
         isValid = false;
         messages{end+1} = 'Elements in \'processingSteps\' must be structs.';
         % TODO: Add deeper validation for processingSteps structure if needed
    end

    % 3. Check optional fields if they exist
    if isfield(data, 'summaryMetrics') && ~isstruct(data.summaryMetrics)
        % isValid = false; % Optional field, maybe just a warning?
        messages{end+1} = '[Warning] Field \'summaryMetrics\' exists but is not a struct.';
    end
     if isfield(data, 'extensions') && ~isstruct(data.extensions)
        % isValid = false;
        messages{end+1} = '[Warning] Field \'extensions\' exists but is not a struct.';
    end
     if isfield(data, 'versionHistory') && ~iscell(data.versionHistory) && ~isstruct(data.versionHistory)
        % isValid = false;
        messages{end+1} = '[Warning] Field \'versionHistory\' exists but is not a cell or struct array.';
    end

    % Add more specific checks for nested structures as needed
    % Example: Check required fields within processingSteps
    if isstruct(data.processingSteps)
        stepFields = {'stepId', 'name', 'description', 'software'};
        for k = 1:length(data.processingSteps)
            step = data.processingSteps(k);
            if ~all(isfield(step, stepFields))
                isValid = false;
                messages{end+1} = sprintf('Processing step %d is missing required fields.', k);
            end
             % Add type checks for step fields...
        end
    end

end 