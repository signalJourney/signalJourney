import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import click
import jsonschema

from signaljourney_validator.validator import (
    DEFAULT_SCHEMA_PATH,
    SignalJourneyValidationError,
    Validator,
)

JsonDict = Dict[str, Any]

# Determine project structure relative to this file
CLI_ROOT = Path(__file__).parent
PROJECT_ROOT = CLI_ROOT.parent.parent
SCHEMA_DIR = PROJECT_ROOT / "schema"
DEFINITIONS_DIR = SCHEMA_DIR / "definitions"
EXTENSIONS_DIR = SCHEMA_DIR / "extensions"


@click.group(context_settings=dict(help_option_names=["-h", "--help"]))
@click.version_option(
    package_name="signaljourney-validator", prog_name="signaljourney-validate"
)
def cli():
    """
    Signal Journey Validator CLI.

    Provides tools to validate signalJourney JSON files against the official
    specification schema.
    Supports validating single files or entire directories.
    """
    pass


@cli.command()
@click.argument(
    "path",
    type=click.Path(exists=True, readable=True, resolve_path=True, path_type=Path),
)
@click.option(
    "--schema",
    "-s",
    type=click.Path(
        exists=True, dir_okay=False, readable=True, resolve_path=True, path_type=Path
    ),
    help="Path to a custom JSON schema file to validate against.",
)
@click.option(
    "--recursive",
    "-r",
    is_flag=True,
    default=False,
    help="Recursively search for *_signalJourney.json files in subdirectories.",
)
@click.option(
    "--output-format",
    "-o",
    type=click.Choice(["text", "json"], case_sensitive=False),
    default="text",
    help='Output format: "text" (human-readable, default) or "json" '
    "(machine-readable).",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    default=False,
    help='Enable verbose output for the "text" format (shows more error details).',
)
@click.option(
    "--bids",
    is_flag=True,
    default=False,
    help="Enable BIDS context validation checks (experimental).",
)
@click.option(
    "--bids-root",
    type=click.Path(exists=True, file_okay=False, path_type=Path, resolve_path=True),
    help="Path to the BIDS dataset root directory (required if --bids is used).",
)
def validate(
    path: Path,
    schema: Path,
    recursive: bool,
    output_format: str,
    verbose: bool,
    bids: bool,
    bids_root: Path,
):
    """
    Validate one or more signalJourney JSON files.

    Checks conformance against the official signalJourney schema (or a custom schema
    if provided via --schema).

    Examples:

    Validate a single file:

        signaljourney-validate path/to/sub-01_task-rest_signalJourney.json

    Validate all files in a directory (non-recursively):

        signaljourney-validate path/to/derivatives/pipelineX/

    Validate all files recursively, outputting JSON:

        signaljourney-validate -r -o json path/to/bids_dataset/

    Validate with BIDS context checks:

        signaljourney-validate --bids --bids-root path/to/bids_dataset \\
            path/to/bids_dataset/derivatives/...
    """
    if bids and not bids_root:
        click.echo(
            "Error: --bids-root is required when using the --bids flag.", err=True
        )
        sys.exit(1)

    files_to_validate: List[Path] = []
    if path.is_file():
        # If a single file is provided, attempt to validate it if it's JSON,
        # regardless of the _signalJourney suffix.
        # Keep the suffix check for directory scanning.
        if path.name.lower().endswith(".json"):
            files_to_validate.append(path)
        elif output_format == "text":  # Only print skip message for non-JSON files
            click.echo(f"Skipping non-JSON file: {path}", err=True)
    elif path.is_dir():
        if output_format == "text":
            scan_mode = " recursively" if recursive else ""
            bids_mode = " (BIDS mode)" if bids else ""
            click.echo(f"Scanning directory: {path}{scan_mode}{bids_mode}")
        if recursive:
            # Keep the suffix check for recursive scanning
            for root, _, filenames in os.walk(path):
                for filename in filenames:
                    if filename.endswith("_signalJourney.json"):
                        files_to_validate.append(Path(root) / filename)
        else:
            # For non-recursive directory scan, find any .json file
            for item in path.iterdir():
                if item.is_file() and item.name.lower().endswith(".json"):
                    files_to_validate.append(item)
    else:
        # This error should occur regardless of format
        click.echo(
            f"Error: Input path is neither a file nor a directory: {path}", err=True
        )
        sys.exit(1)

    # Prepare results structure
    results: Dict[str, Any] = {"overall_success": True, "files": []}
    validator_instance: Optional[Validator] = None

    if not files_to_validate:
        if output_format == "text" and path.is_dir():
            # Only print if input was a directory and no files were found.
            scan_mode = " recursively" if recursive else ""
            click.echo(
                f"No *_signalJourney.json files found to validate in {path}{scan_mode}",
                err=True,
            )
        elif output_format == "json":
            # Output valid JSON even if no files processed
            print(json.dumps({"files": [], "overall_success": True}, indent=2))
        # Exit code 0 if input dir was empty, 1 otherwise (e.g., non-JSON file input)
        sys.exit(0 if path.is_dir() else 1)

    # --- Schema Loading and Resolver Setup (Load ONCE) ---
    # try:
    #     schema_to_use = schema if schema else DEFAULT_SCHEMA_PATH
    #     if not schema_to_use.exists():
    #         raise FileNotFoundError(f"Schema file not found: {schema_to_use}")
    #     with open(schema_to_use, "r", encoding="utf-8") as f:
    #         main_schema_dict = json.load(f)
    #
    #     # Setup resolver similar to conftest.py - REMOVED
    #     ...
    #
    #     resolver = jsonschema.RefResolver(...)
    # except Exception as e:
    #     click.echo(f"Error loading schema or building resolver: {e}", err=True)
    #     sys.exit(1)
    # --- End Schema Loading ---

    overall_success = True
    for filepath in files_to_validate:
        file_result: Dict[str, Any] = {
            "filepath": str(filepath),
            "status": "unknown",
            "errors": [],
        }
        if output_format == "text":
            click.echo(f"Validating: {filepath} ... ", nl=False)

        try:
            if validator_instance is None:
                # Create validator ONCE using the schema path (or None for default)
                # Validator internal __init__ now handles registry setup.
                try:
                    validator_instance = Validator(schema=schema) # Pass schema path/None
                except Exception as e:
                    # Handle potential errors during Validator initialization (e.g., schema loading)
                    click.echo(f"CRITICAL ERROR initializing validator: {e}", err=True)
                    # For JSON output, log the critical error at file level
                    if output_format == "json":
                         file_result["status"] = "critical_error"
                         file_result["errors"] = [{"message": f"Validator init failed: {e}"}]
                         results["files"].append(file_result)
                         results["overall_success"] = False
                         overall_success = False # Ensure overall failure
                    # Exit or continue? Maybe continue to report errors for other files?
                    # For now, let's make it a fatal error for the specific file.
                    if output_format == "text":
                         click.echo(" CRITICAL ERROR")
                         click.echo(f"  - Initialization Failed: {e}")
                    # Skip to the next file if validator init fails
                    continue

            # Pass bids_root to validator if bids flag is set
            current_bids_context = bids_root if bids else None
            validation_errors = validator_instance.validate(
                filepath, raise_exceptions=False, bids_context=current_bids_context
            )

            if validation_errors:
                overall_success = False
                file_result["status"] = "failed"
                if output_format == "text":
                    click.secho("FAILED", fg="red")
                for error in validation_errors:
                    # Store structured error
                    error_dict = {
                        "message": error.message,
                        "path": list(error.path) if error.path else [],
                        "schema_path": list(error.schema_path)
                        if error.schema_path
                        else [],
                        "validator": error.validator,
                        "validator_value": repr(error.validator_value),  # Use repr
                        "instance_value": repr(error.instance_value),  # Use repr
                        "suggestion": error.suggestion,
                    }
                    file_result["errors"].append(error_dict)

                    # Print detailed error in text mode
                    if output_format == "text":
                        error_path_list = list(error.path) if error.path else []
                        error_path_str = (
                            "/".join(map(str, error_path_list))
                            if error_path_list
                            else "root"
                        )
                        error_msg = f"  - Error at '{error_path_str}': {error.message}"
                        if verbose:
                            # Add more details in verbose mode
                            error_msg += f" (validator: '{error.validator}')"
                            # Add more details if needed
                        if error.suggestion:
                            error_msg += f" -- Suggestion: {error.suggestion}"
                        click.echo(error_msg)
            else:
                file_result["status"] = "passed"
                if output_format == "text":
                    click.secho("PASSED", fg="green")

        except SignalJourneyValidationError as e:
            overall_success = False
            file_result["status"] = "error"
            file_result["error_message"] = str(e)
            if output_format == "text":
                click.secho("ERROR", fg="yellow")
                click.echo(f"  - Validation Error: {e}", err=True)
            # Include details from SignalJourneyValidationError if available
            detailed_errors = []
            if (
                isinstance(e, SignalJourneyValidationError)
                and hasattr(e, "errors")
                and e.errors
            ):
                detailed_errors = [
                    {
                        "message": detail.get("message", "N/A"),
                        "path": detail.get("path", []),
                        # Add other relevant fields from ValidationErrorDetail if needed
                    }
                    for detail in e.errors
                ]
                file_result["errors"] = detailed_errors  # Overwrite with details
                if output_format == "text":
                    click.echo("    Detailed Errors:", err=True)
                    for detail in detailed_errors:
                        path_str = detail.get("path", "N/A")
                        msg_str = detail.get("message", "N/A")
                        click.echo(f"    - Path: {path_str}, Msg: {msg_str}", err=True)

        except Exception as e:
            overall_success = False
            file_result["status"] = "error"
            file_result["error_message"] = f"An unexpected error occurred: {e}"
            if output_format == "text":
                click.secho("CRITICAL ERROR", fg="red", bold=True)
                click.echo(f"  - Unexpected Error: {e}", err=True)

        results["files"].append(file_result)

    results["overall_success"] = overall_success

    if output_format == "json":
        print(json.dumps(results, indent=2))
    elif output_format == "text" and verbose:
        # Add a summary line in verbose text mode
        status_msg = (
            click.style("PASSED", fg="green")
            if overall_success
            else click.style("FAILED", fg="red")
        )
        click.echo(f"\nOverall validation result: {status_msg}")

    # Exit with appropriate code
    sys.exit(0 if overall_success else 1)


if __name__ == "__main__":
    cli()
