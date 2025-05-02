import click
from pathlib import Path
import sys
import os # Import os for path operations
from typing import List

from .validator import Validator, SignalJourneyValidationError

@click.group()
@click.version_option(package_name='signaljourney-validator')
def cli():
    """Command-line tool for validating signalJourney JSON files."""
    pass

@cli.command()
# Allow path to be a directory or file, check existence
@click.argument('path', type=click.Path(exists=True, path_type=Path))
@click.option('--schema', type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help='Path to a custom JSON schema file.')
@click.option('--recursive', '-r', is_flag=True, default=False,
              help='Recursively validate files in directories.')
def validate(path: Path, schema: Path, recursive: bool):
    """Validate a single file or directory of signalJourney JSON files."""
    files_to_validate: List[Path] = []
    if path.is_file():
        if path.name.endswith('_signalJourney.json'):
            files_to_validate.append(path)
        else:
            click.echo(f"Skipping non-signalJourney file: {path}", err=True)
    elif path.is_dir():
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
        click.echo(f"Error: Input path is neither a file nor a directory: {path}", err=True)
        sys.exit(1)

    if not files_to_validate:
        click.echo(f"No signalJourney JSON files found to validate in {path}", err=True)
        sys.exit(1)

    overall_success = True
    validator = None # Initialize validator once

    for filepath in files_to_validate:
        click.echo(f"Validating: {filepath} ... ", nl=False) # Indicate processing
        try:
            if validator is None: # Lazy load validator
                 validator = Validator(schema=schema)

            validation_errors = validator.validate(filepath, raise_exceptions=False)

            if validation_errors:
                click.echo(click.style("FAILED", fg="red"))
                overall_success = False
                for error in validation_errors:
                    click.echo(f"  - {error}", err=True)
            else:
                click.echo(click.style("OK", fg="green"))

        except SignalJourneyValidationError as e:
            click.echo(click.style("ERROR", fg="red"))
            click.echo(f"  Validation Error: {e}", err=True)
            if hasattr(e, 'errors') and e.errors:
                 for error in e.errors:
                     click.echo(f"    - {error}", err=True)
            overall_success = False
        except FileNotFoundError as e: # Should not happen due to click check, but good practice
            click.echo(click.style("ERROR", fg="red"))
            click.echo(f"  File Error: {e}", err=True)
            overall_success = False
        except Exception as e:
            click.echo(click.style("ERROR", fg="red"))
            click.echo(f"  An unexpected error occurred: {e}", err=True)
            overall_success = False

    # Final exit code based on overall success
    sys.exit(0 if overall_success else 1)

if __name__ == '__main__':
    cli() 