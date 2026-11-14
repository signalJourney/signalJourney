# Initial package marker
import logging

__version__ = "0.0.1"

from .errors import SchemaResolutionError, ValidationErrorDetail
from .validator import SignalJourneyValidationError, Validator

# A library installs no output handler; the application decides what to show.
logging.getLogger(__name__).addHandler(logging.NullHandler())

__all__ = [
    "Validator",
    "SchemaResolutionError",
    "SignalJourneyValidationError",
    "ValidationErrorDetail",
    "__version__",
]
