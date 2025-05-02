import click
from pathlib import Path
import sys

from .validator import Validator, SignalJourneyValidationError

@click.group()
@click.version_option(package_name='signaljourney-validator')
def cli():
    """Command-line tool for validating signalJourney JSON files."""
    pass

@cli.command()
@click.argument('filepath', type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option('--schema', type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help='Path to a custom JSON schema file.')
def validate(filepath: Path, schema: Path):
    """Validate a single signalJourney JSON file against the schema."""
    try:
        validator = Validator(schema=schema) # Pass custom schema if provided
        validation_errors = validator.validate(filepath, raise_exceptions=False)

        if validation_errors:
            click.echo(f"Validation FAILED for: {filepath}", err=True)
            for error in validation_errors:
                click.echo(f"- {error}", err=True) # Print error with suggestion
            sys.exit(1) # Exit with non-zero code for failure
        else:
            click.echo(f"Validation successful for: {filepath}")
            sys.exit(0)

    except SignalJourneyValidationError as e:
        click.echo(f"Validation Error: {e}", err=True)
        # Print detailed errors if available in the exception
        if hasattr(e, 'errors') and e.errors:
             for error in e.errors:
                click.echo(f"- {error}", err=True)
        sys.exit(1)
    except FileNotFoundError as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"An unexpected error occurred: {e}", err=True)
        sys.exit(1)

if __name__ == '__main__':
    cli() 