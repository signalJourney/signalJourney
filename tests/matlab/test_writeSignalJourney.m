classdef test_writeSignalJourney < matlab.unittest.TestCase
    % Tests for the writeSignalJourney.m function

    properties
        TestOutputPath;
        ScriptsPath = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'scripts', 'matlab');
    end

    methods (TestMethodSetup)
        function createTempDir(testCase)
            % Create a temporary directory for output files
            testCase.TestOutputPath = fullfile(tempdir, ['sj_write_test_', datestr(now,'yyyymmddTHHMMSSFFF')]);
            mkdir(testCase.TestOutputPath);
            % Add scripts path for setup and teardown too
            addpath(testCase.ScriptsPath);
        end
    end

    methods (TestMethodTeardown)
        function removeTempDir(testCase)
            % Remove the temporary directory after tests
            if ~isempty(testCase.TestOutputPath) && isfolder(testCase.TestOutputPath)
                rmdir(testCase.TestOutputPath, 's');
            end
            % Remove scripts path
             rmpath(testCase.ScriptsPath);
        end
    end

    methods (Test)
        function testWriteValidStruct(testCase)
            % Test writing a valid struct to a JSON file
            sjStruct.sj_version = '0.1.0';
            sjStruct.schema_version = '0.1.0';
            sjStruct.description = 'Test struct write';
            sjStruct.pipelineInfo.projectName = 'WriteTest';
            sjStruct.pipelineInfo.datasetId = 'dsWrite01';
            sjStruct.processingSteps{1}.stepId = 'write-step-1';
            sjStruct.processingSteps{1}.name = 'Write Proc';
            sjStruct.processingSteps{1}.description = 'Desc';
            sjStruct.processingSteps{1}.software.name = 'MATLAB';
            sjStruct.processingSteps{1}.software.version = 'R2024a';
            sjStruct.processingSteps{1}.parameters{1}.name = 'param1';
            sjStruct.processingSteps{1}.parameters{1}.value = 123;
            sjStruct.processingSteps{1}.inputSources = {'in.dat'};
            sjStruct.processingSteps{1}.outputTargets = {'out.dat'};
            
            outputFilePath = fullfile(testCase.TestOutputPath, 'valid_output.json');

            try
                writeSignalJourney(sjStruct, outputFilePath);
            catch ME
                testCase.verifyFail(sprintf('writeSignalJourney failed unexpectedly for valid struct: %s\n%s', ...
                                          outputFilePath, ME.message));
            end

            % Verify file exists
            testCase.verifyTrue(isfile(outputFilePath), 'Output file was not created.');

            % Read back and verify content
            try
                readStruct = readSignalJourney(outputFilePath); % Use our reader
            catch ME_read
                 testCase.verifyFail(sprintf('Failed to read back the written file: %s\n%s', ...
                                          outputFilePath, ME_read.message));
            end

            % Compare - Use isequaln to handle potential NaN, etc., robustly
            testCase.verifyTrue(isequaln(sjStruct, readStruct), 'Written file content does not match original struct.');
        end

        function testWriteInvalidInputType(testCase)
            % Test writing an invalid input type (not a struct)
            invalidInput = [1, 2, 3]; % Use a numeric array
            outputFilePath = fullfile(testCase.TestOutputPath, 'invalid_input_type.json');

            % Expect an error (likely related to input type)
            % The exact error ID might depend on how writeSignalJourney checks input.
            % 'MATLAB:invalidType' or a custom error ID could be possibilities.
            testCase.verifyError(@() writeSignalJourney(invalidInput, outputFilePath), ...
                                 'MATLAB:InputParser:ArgumentFailedValidation', ... % Placeholder ID
                                 'Expected writeSignalJourney to error on non-struct input.');
        end

        function testWriteInvalidOutputPath(testCase)
            % Test writing to an invalid path (e.g., non-existent nested dir)
            sjStruct.sj_version = '0.1.0'; % Minimal valid struct
            sjStruct.schema_version = '0.1.0';
            sjStruct.description = 'Test invalid path';
            sjStruct.pipelineInfo.projectName = 'InvalidPathTest';
            sjStruct.pipelineInfo.datasetId = 'dsInvalidPath';
            sjStruct.processingSteps = {}; % Empty cell for minimal struct
            
            invalidPath = fullfile(testCase.TestOutputPath, 'nonexistent_subdir', 'output.json');

            % Expect a file I/O error because the subdirectory doesn't exist
            % Error ID might vary based on MATLAB version and OS.
            % 'MATLAB:FileIO:UnableToOpenFile' or similar.
             testCase.verifyError(@() writeSignalJourney(sjStruct, invalidPath), ...
                                 'MATLAB:FileIO:UnableToOpenFile', ... % Placeholder ID
                                 'Expected writeSignalJourney to error on invalid output path.');
        end

    end

end 