"""Unit tests for the signaljourney_validator.cli module."""

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
