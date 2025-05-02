import click
from pathlib import Path
import sys
import os # Import os for path operations
from typing import List, Dict, Any
import json # Import json for JSON output

from .validator import Validator, SignalJourneyValidationError
from .errors import ValidationErrorDetail # Import needed for type hints

@click.group(context_settings=dict(help_option_names=['-h', '--help']))
@click.version_option(package_name='signaljourney-validator', prog_name='signaljourney-validate')
def cli():
    """
    Signal Journey Validator CLI.

    Provides tools to validate signalJourney JSON files against the official specification schema.
    Supports validating single files or entire directories.
    """
    pass

@cli.command()
@click.argument('path',
              type=click.Path(exists=True, readable=True, resolve_path=True, path_type=Path),
              help='Path to a single signalJourney JSON file or a directory containing them.')
@click.option('--schema', '-s',
              type=click.Path(exists=True, dir_okay=False, readable=True, resolve_path=True, path_type=Path),
              help='Path to a custom JSON schema file to validate against.')
@click.option('--recursive', '-r', is_flag=True, default=False,
              help='Recursively search for *_signalJourney.json files in subdirectories.')
@click.option('--output-format', '-o',
              type=click.Choice(['text', 'json'], case_sensitive=False), default='text',
              help='Output format: "text" (human-readable, default) or "json" (machine-readable).')
@click.option('--verbose', '-v', is_flag=True, default=False,
              help='Enable verbose output for the "text" format (shows more error details).')
def validate(path: Path, schema: Path, recursive: bool, output_format: str, verbose: bool):
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
    """
    files_to_validate: List[Path] = []
    if path.is_file():
        if path.name.endswith('_signalJourney.json'):
            files_to_validate.append(path)
        elif output_format == 'text': # Only print skip message for text output
            click.echo(f"Skipping non-signalJourney file: {path}", err=True)
    elif path.is_dir():
        if output_format == 'text':
             click.echo(f"Scanning directory: {path}{ ' recursively' if recursive else ''}")
        if recursive:
            for root, _, filenames in os.walk(path):
                for filename in filenames:
                    if filename.endswith('_signalJourney.json'):
                        files_to_validate.append(Path(root) / filename)
        else:
            for item in path.iterdir():
                if item.is_file() and item.name.endswith('_signalJourney.json'):
                    files_to_validate.append(item)
    else:
        # This error should occur regardless of format
        click.echo(f"Error: Input path is neither a file nor a directory: {path}", err=True)
        sys.exit(1)

    if not files_to_validate:
        if output_format == 'text':
             click.echo(f"No signalJourney JSON files found to validate in {path}", err=True)
        # For JSON output, just exit cleanly if no files found
        sys.exit(1 if output_format == 'text' else 0)

    overall_success = True
    validator = None
    results: Dict[str, Any] = {"files": []} # Structure for JSON output

    for filepath in files_to_validate:
        file_result: Dict[str, Any] = {"filepath": str(filepath), "status": "unknown", "errors": []}
        if output_format == 'text':
            click.echo(f"Validating: {filepath} ... ", nl=False)

        try:
            if validator is None:
                 validator = Validator(schema=schema)

            validation_errors = validator.validate(filepath, raise_exceptions=False)

            if validation_errors:
                file_result["status"] = "failed"
                file_result["errors"] = [
                    {
                        "message": err.message,
                        "path": err.path,
                        "schema_path": err.schema_path,
                        "validator": err.validator,
                        "validator_value": repr(err.validator_value), # Use repr for broad compatibility
                        "instance_value": repr(err.instance_value),
                        "suggestion": err.suggestion
                    }
                    for err in validation_errors
                ]
                overall_success = False
                if output_format == 'text':
                    click.echo(click.style("FAILED", fg="red"))
                    for error in validation_errors:
                        # Basic error message for standard text output
                        error_msg = f"  - Error at '{'/'.join(map(str, error.path)) if error.path else 'root'}': {error.message}"
                        if verbose:
                             # Add more details in verbose mode
                             error_msg += f" (validator: '{error.validator}')"
                             # Potentially add schema_path, validator_value etc. if useful
                        if error.suggestion:
                            error_msg += f" -- Suggestion: {error.suggestion}"
                        click.echo(error_msg, err=True)
            else:
                file_result["status"] = "passed"
                if output_format == 'text':
                    click.echo(click.style("OK", fg="green"))

        except (SignalJourneyValidationError, FileNotFoundError, Exception) as e:
            file_result["status"] = "error"
            error_message = str(e)
            # Include details from SignalJourneyValidationError if available
            detailed_errors = []
            if isinstance(e, SignalJourneyValidationError) and hasattr(e, 'errors') and e.errors:
                 detailed_errors = [
                    {
                        "message": err.message,
                        "path": err.path,
                        # ... (potentially add other fields from ValidationErrorDetail)
                        "suggestion": err.suggestion
                    }
                     for err in e.errors
                 ]
                 # Append detailed errors to the main message for context
                 error_message += f" (Details: {json.dumps(detailed_errors)})"

            file_result["error_message"] = error_message
            overall_success = False
            if output_format == 'text':
                click.echo(click.style("ERROR", fg="red"))
                click.echo(f"  {type(e).__name__}: {e}", err=True)
                # Optionally print detailed errors from exception if verbose
                if verbose and detailed_errors:
                     click.echo("    Detailed Errors:", err=True)
                     for detail in detailed_errors:
                         click.echo(f"    - Path: {detail.get('path', 'N/A')}, Msg: {detail.get('message', 'N/A')}", err=True)

        results["files"].append(file_result)

    # Output results based on format
    if output_format == 'json':
        results["overall_status"] = "passed" if overall_success else "failed"
        click.echo(json.dumps(results, indent=2))
    elif output_format == 'text' and verbose:
         # Add a summary line in verbose text mode
         status_msg = click.style("PASSED", fg="green") if overall_success else click.style("FAILED", fg="red")
         click.echo(f"\nOverall validation result: {status_msg}")

    sys.exit(0 if overall_success else 1)

if __name__ == '__main__':
    cli() 