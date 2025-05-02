classdef test_validateSignalJourney < matlab.unittest.TestCase
    % Tests for the validateSignalJourney.m function

    properties
        FixturesPath = fullfile(fileparts(mfilename('fullpath')), 'fixtures');
        ScriptsPath = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'scripts', 'matlab');
        ValidFile = 'minimal_valid_sj.json'; 
        % Add paths to invalid fixture files as needed
        % InvalidFileMissingField = 'invalid_missing_field.json';
        % InvalidFileWrongType = 'invalid_wrong_type.json';
    end

    methods (TestClassSetup)
        function addPaths(testCase)
             addpath(testCase.ScriptsPath);
        end
    end
    methods (TestClassTeardown)
         function removePaths(testCase)
             rmpath(testCase.ScriptsPath);
         end
    end

    methods (Test)
        function testValidateValidStruct(testCase)
            % Test validation with a known valid struct (read from file)
            validStruct = readSignalJourney(fullfile(testCase.FixturesPath, testCase.ValidFile));
            
            isValid = validateSignalJourney(validStruct); % Assume it returns logical
            
            testCase.verifyTrue(isValid, 'Validation unexpectedly failed for a valid struct.');
        end

        function testValidateInvalidStructMissingField(testCase)
            % Test validation with a struct missing a required field
            % TODO: Create or load an invalid struct fixture
            validStruct = readSignalJourney(fullfile(testCase.FixturesPath, testCase.ValidFile));
            invalidStruct = rmfield(validStruct, 'pipelineInfo'); % Example: remove a required field
            
            isValid = validateSignalJourney(invalidStruct);
            
            testCase.verifyFalse(isValid, 'Validation unexpectedly passed for struct missing pipelineInfo.');
        end
        
        function testValidateInvalidStructWrongType(testCase)
            % Test validation with a struct field having the wrong data type
            % TODO: Create or load an invalid struct fixture
            validStruct = readSignalJourney(fullfile(testCase.FixturesPath, testCase.ValidFile));
            invalidStruct = validStruct;
            invalidStruct.sj_version = 1.0; % Set version to numeric instead of string
            
            isValid = validateSignalJourney(invalidStruct);
            
            testCase.verifyFalse(isValid, 'Validation unexpectedly passed for struct with wrong sj_version type.');
        end

        % TODO: Add more tests for various invalid conditions based on schema
        % TODO: Test if it uses the Python validator correctly (if applicable)

    end

end 