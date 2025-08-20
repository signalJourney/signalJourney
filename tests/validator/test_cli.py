"""Unit tests for the signaljourney_validator.cli module."""

import json
from pathlib import Path

import pytest
from click.testing import CliRunner

from signaljourney_validator.cli import cli

# Calculate path relative to this test file
TEST_DIR = Path(__file__).parent
PROJECT_ROOT = TEST_DIR.parent.parent  # Go up two levels (tests/ -> .)
EXAMPLES_DIR = PROJECT_ROOT / "tests/schemas/examples"


@pytest.fixture
def runner():
    return CliRunner()


def test_cli_help(runner):
    """Test the CLI --help option."""
    result = runner.invoke(cli, ["--help"])
    assert result.exit_code == 0
    assert "Usage: cli [OPTIONS] COMMAND [ARGS]..." in result.output
    assert "Validate one or more signalJourney JSON files." in result.output


def test_cli_version(runner):
    """Test the CLI --version option."""
    # This requires the package to be installed or properly configured in pyproject.toml
    # We'll check for the presence of the version string format
    result = runner.invoke(cli, ["--version"])
    assert result.exit_code == 0
    assert "signaljourney-validate, version" in result.output  # Based on setup


def test_cli_validate_valid_file(runner):
    """Test validating a valid file via the CLI."""
    valid_file = EXAMPLES_DIR / "valid/minimal_valid.json"
    assert valid_file.exists(), f"Test file not found: {valid_file}"
    result = runner.invoke(cli, ["validate", str(valid_file)])
    assert result.exit_code == 0
    assert "Validating:" in result.output
    assert "PASSED" in result.output


def test_cli_validate_invalid_file(runner):
    """Test validating an invalid file via the CLI."""
    invalid_file = EXAMPLES_DIR / "invalid/missing_required_top_level.json"
    assert invalid_file.exists(), f"Test file not found: {invalid_file}"
    result = runner.invoke(cli, ["validate", str(invalid_file)])
    assert result.exit_code == 1  # Should exit with error code
    assert "Validating:" in result.output
    assert "FAILED" in result.output
    assert "'sj_version' is a required property" in result.output


def test_cli_validate_nonexistent_file(runner):
    """Test validating a non-existent file via the CLI."""
    result = runner.invoke(cli, ["validate", "nonexistent_file.json"])
    assert result.exit_code != 0  # Should fail
    assert "Path 'nonexistent_file.json' does not exist" in result.output


def test_cli_validate_directory(runner):
    """Test validating a directory (non-recursive)."""
    valid_dir = EXAMPLES_DIR / "valid"
    assert valid_dir.exists()
    result = runner.invoke(cli, ["validate", str(valid_dir)])
    assert result.exit_code == 0
    assert "Scanning directory:" in result.output
    assert str(valid_dir / "minimal_valid.json") in result.output
    assert "PASSED" in result.output


# TODO: Add tests for recursive validation
# TODO: Add tests for JSON output format
# TODO: Add tests for BIDS options


class TestSchemaVersionCLI:
    """Test CLI functionality for schema version support."""

    def test_schema_version_help(self, runner):
        """Test that schema version option appears in help."""
        result = runner.invoke(cli, ["validate", "--help"])
        assert result.exit_code == 0
        assert "--schema-version" in result.output
        assert "Specific schema version to use" in result.output

    def test_conflicting_schema_options(self, runner, tmp_path):
        """Test error when both --schema and --schema-version are specified."""
        # Create a dummy schema file
        schema_file = tmp_path / "dummy.json"
        schema_file.write_text('{"title": "dummy"}')

        # Create a dummy data file
        data_file = tmp_path / "data.json"
        data_file.write_text('{"schema_version": "0.1.0"}')

        result = runner.invoke(
            cli,
            [
                "validate",
                "--schema",
                str(schema_file),
                "--schema-version",
                "0.1.0",
                str(data_file),
            ],
        )

        assert result.exit_code == 1
        assert "Cannot specify both --schema and --schema-version" in result.output

    def test_schema_version_validation(self, runner, tmp_path):
        """Test validation with specific schema version."""
        # Create a minimal test file that follows signalJourney structure
        # but will fail validation due to missing required fields
        test_data = {"schema_version": "0.1.0", "description": "Test file"}
        data_file = tmp_path / "test.json"
        data_file.write_text(json.dumps(test_data))

        # Test with schema version that should trigger version-based validation
        # This will fail because the test data doesn't have all required fields
        # but demonstrates that the CLI properly handles --schema-version flag
        result = runner.invoke(
            cli, ["validate", "--schema-version", "0.1.0", str(data_file)]
        )

        # Should fail validation due to missing required fields,
        # but this proves --schema-version flag works correctly
        assert result.exit_code == 1
        assert "FAILED" in result.output
        # Should show that it's using the correct schema version
        assert "0.1.0" in result.output or "schema_version" in result.output
