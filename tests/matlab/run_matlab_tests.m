function results = run_matlab_tests(testFilePath)
    % Runs MATLAB unit tests specified by a file or all tests in the current folder.
    % Example Usage:
    %   results = run_matlab_tests(); % Runs all tests in the current folder
    %   results = run_matlab_tests('test_myFunction.m'); % Runs specific test file
    %   results = run_matlab_tests('path/to/tests'); % Runs all tests in specific folder

    import matlab.unittest.TestRunner;
    import matlab.unittest.TestSuite;
    % Optional: Add plugins for output formats like TAP or JUnit XML if needed for CI
    % import matlab.unittest.plugins.TAPPlugin;
    % import matlab.unittest.plugins.ToFile;

    try
        % Add scripts directory to path to make functions available
        scriptsPath = fullfile(fileparts(mfilename('fullpath')), '..', '..', 'scripts', 'matlab');
        addpath(scriptsPath);
        
        if nargin == 0 || isempty(testFilePath)
            % Discover tests in the current directory (where this script is located)
            suite = TestSuite.fromFolder(fileparts(mfilename('fullpath')));
            disp('Running all tests found in current folder...');
        elseif isfolder(testFilePath)
            % Discover tests in the specified folder
            suite = TestSuite.fromFolder(testFilePath);
            disp(['Running all tests found in folder: ' testFilePath]);
        elseif isfile(testFilePath)
            % Discover tests in the specified file
            suite = TestSuite.fromFile(testFilePath);
            disp(['Running tests from file: ' testFilePath]);
        else
            error('Invalid input: Must be a valid test file path, folder path, or empty to run tests in current folder.');
        end

        runner = TestRunner.withTextOutput();
        
        % Example for TAP output to file (uncomment if needed):
        % tapFile = 'testresults.tap';
        % runner.addPlugin(TAPPlugin.producingVersion13(ToFile(tapFile)));
        % disp(['TAP output will be written to: ' tapFile]);

        results = runner.run(suite);

        % Display summary
        disp(newline + 'Test Run Summary:');
        disp(results);

        % Optional: Exit with non-zero status code if tests failed
        if any([results.Failed])
             fprintf('\n%d tests failed.\n', sum([results.Failed]));
             % Uncomment below to exit with error code 1 in batch mode
             % exit(1);
        else
             fprintf('\nAll tests passed.\n');
             % Uncomment below to exit with code 0 in batch mode
             % exit(0);
        end

    catch ME
        disp(getReport(ME, 'extended', 'hyperlinks', 'on'));
        results = [];
        % Uncomment below to exit with error code 1 in batch mode on script error
        % exit(1);
    end

    % Clean up path
    rmpath(scriptsPath);

end 