classdef test_readSignalJourney < matlab.unittest.TestCase
    % Tests for the readSignalJourney.m function

    properties
        FixturesPath = fullfile(fileparts(mfilename('fullpath')), 'fixtures');
        ValidFile = 'minimal_valid_sj.json';
        MalformedFile = 'malformed.json';
        NonExistentFile = 'non_existent_file.json';
    end

    methods (Test)
        function testReadValidFile(testCase)
            % Test reading a well-formed and valid signalJourney JSON file
            filePath = fullfile(testCase.FixturesPath, testCase.ValidFile);
            
            % Add the scripts/matlab directory to the path
            scriptPath = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'scripts', 'matlab');
            addpath(scriptPath);
            
            try
                sjStruct = readSignalJourney(filePath);
            catch ME
                testCase.verifyFail(sprintf('readSignalJourney failed unexpectedly for valid file: %s\n%s', ...
                                          filePath, ME.message));
            end
            
            % Basic structure checks
            testCase.verifyTrue(isstruct(sjStruct), 'Output should be a struct.');
            testCase.verifyTrue(isfield(sjStruct, 'sj_version'), 'Struct missing sj_version field.');
            testCase.verifyTrue(isfield(sjStruct, 'schema_version'), 'Struct missing schema_version field.');
            testCase.verifyTrue(isfield(sjStruct, 'pipelineInfo'), 'Struct missing pipelineInfo field.');
            testCase.verifyTrue(isfield(sjStruct, 'processingSteps'), 'Struct missing processingSteps field.');
            
            % Check some values
            testCase.verifyEqual(sjStruct.sj_version, '0.1.0', 'Incorrect sj_version value.');
            testCase.verifyEqual(sjStruct.pipelineInfo.projectName, 'MATLAB_TestProject', 'Incorrect project name.');
            testCase.verifyTrue(iscell(sjStruct.processingSteps), 'processingSteps should be a cell array.');
            testCase.verifyEqual(numel(sjStruct.processingSteps), 1, 'Expected one processing step.');

            % Clean up path
            rmpath(scriptPath);
        end

        function testReadMalformedFile(testCase)
            % Test reading a JSON file that is syntactically incorrect
            filePath = fullfile(testCase.FixturesPath, testCase.MalformedFile);
            scriptPath = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'scripts', 'matlab');
            addpath(scriptPath);
            
            % Expect an error during parsing
            testCase.verifyError(@() readSignalJourney(filePath), ...
                                 'MATLAB:UndefinedFunction', ... % Or a more specific JSON parse error ID if available
                                 'Expected readSignalJourney to error on malformed JSON.');
                                 
            rmpath(scriptPath);
        end

        function testReadNonExistentFile(testCase)
            % Test reading a file that does not exist
            filePath = fullfile(testCase.FixturesPath, testCase.NonExistentFile);
            scriptPath = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'scripts', 'matlab');
            addpath(scriptPath);

            % Expect an error when the file cannot be opened
            testCase.verifyError(@() readSignalJourney(filePath), ...
                                 'MATLAB:UndefinedFunction', ... % Or potentially 'MATLAB:FileIO:InvalidFid' or similar
                                 'Expected readSignalJourney to error on non-existent file.');

            rmpath(scriptPath);
        end
    end

end 