from dataclasses import dataclass, field
from typing import Any, List, Optional, Sequence, Union

# Optional fuzzywuzzy import
try:
    from fuzzywuzzy import process as fuzzy_process

    HAS_FUZZY = True
except ImportError:
    HAS_FUZZY = False

# Moved import to top

JsonPath = Union[str, int]


@dataclass
class ValidationErrorDetail:
    """Represents a detailed validation error."""

    message: str
    path: Sequence[JsonPath] = field(default_factory=list)
    schema_path: Sequence[JsonPath] = field(default_factory=list)
    validator: str = ""
    validator_value: Any = None
    instance_value: Any = None
    # For nested errors
    context: List["ValidationErrorDetail"] = field(default_factory=list)
    suggestion: Optional[str] = None  # Added field for suggestions

    def __post_init__(self):
        """Generate suggestions based on error type after initialization."""
        self._generate_suggestion()

    def __str__(self) -> str:
        path_str = "/".join(map(str, self.path)) if self.path else "root"
        msg = f"Error at '{path_str}': {self.message}"
        if self.suggestion:
            msg += f" -- Suggestion: {self.suggestion}"
        return msg

    def _generate_suggestion(self):
        """Internal method to populate the suggestion field based on validator type."""
        if self.validator == "required":
            # 'validator_value' usually holds the list of required properties
            missing_props = self.validator_value
            if isinstance(missing_props, list):
                props_str = "', '".join(missing_props)
                self.suggestion = (
                    f"Ensure required property or properties ('{props_str}') "
                    f"are present."
                )
            else:
                self.suggestion = (
                    "Ensure required property is present (check schema for details)."
                )

        elif self.validator == "type":
            expected_types = self.validator_value
            actual_type = type(self.instance_value).__name__
            if isinstance(expected_types, list):
                types_str = "', '".join(expected_types)
                self.suggestion = (
                    f"Change value type from '{actual_type}' to one of: '{types_str}'."
                )
            elif isinstance(expected_types, str):
                self.suggestion = (
                    f"Change value type from '{actual_type}' to '{expected_types}'."
                )
            else:
                self.suggestion = (
                    f"Check schema for expected type(s) instead of '{actual_type}'."
                )

        elif self.validator == "pattern":
            pattern = self.validator_value
            self.suggestion = (
                f"Ensure value matches the required regex pattern: '{pattern}'."
            )

        elif self.validator == "enum":
            allowed_values = self.validator_value
            if isinstance(allowed_values, list):
                suggestion_text = (
                    f"Value must be one of: {', '.join(map(repr, allowed_values))}."
                )
                # Optional: Add fuzzy matching
                if (
                    HAS_FUZZY
                    and isinstance(self.instance_value, str)
                    and self.instance_value
                ):
                    try:
                        # Filter for string choices
                        string_allowed_values = [
                            str(v) for v in allowed_values if isinstance(v, str)
                        ]
                        if string_allowed_values:
                            best_match, score = fuzzy_process.extractOne(
                                self.instance_value, string_allowed_values
                            )
                            if score > 80:  # Threshold
                                suggestion_text += f" Did you mean '{best_match}'?"
                    except Exception:
                        pass  # Ignore fuzzy matching errors
                self.suggestion = suggestion_text
            else:
                self.suggestion = (
                    "Ensure value is one of the allowed options (check schema)."
                )

        # Add suggestions for length/item constraints
        elif self.validator == "minLength":
            min_len = self.validator_value
            actual_len = (
                len(self.instance_value)
                if isinstance(self.instance_value, (str, list))
                else "N/A"
            )
            self.suggestion = (
                f"Ensure value has at least {min_len} characters/items "
                f"(currently {actual_len})."
            )

        elif self.validator == "maxLength":
            max_len = self.validator_value
            actual_len = (
                len(self.instance_value)
                if isinstance(self.instance_value, (str, list))
                else "N/A"
            )
            self.suggestion = (
                f"Ensure value has at most {max_len} characters/items "
                f"(currently {actual_len})."
            )

        elif self.validator == "minItems":
            min_num = self.validator_value
            actual_num = (
                len(self.instance_value)
                if isinstance(self.instance_value, list)
                else "N/A"
            )
            self.suggestion = (
                f"Ensure array has at least {min_num} items (currently {actual_num})."
            )

        elif self.validator == "maxItems":
            max_num = self.validator_value
            actual_num = (
                len(self.instance_value)
                if isinstance(self.instance_value, list)
                else "N/A"
            )
            self.suggestion = (
                f"Ensure array has at most {max_num} items (currently {actual_num})."
            )

        elif self.validator == "minimum":
            min_val = self.validator_value
            self.suggestion = f"Ensure value is at least {min_val}."

        elif self.validator == "maximum":
            max_val = self.validator_value
            self.suggestion = f"Ensure value is at most {max_val}."

        elif self.validator == "exclusiveMinimum":
            ex_min_val = self.validator_value
            self.suggestion = f"Ensure value is strictly greater than {ex_min_val}."

        elif self.validator == "exclusiveMaximum":
            ex_max_val = self.validator_value
            self.suggestion = f"Ensure value is strictly less than {ex_max_val}."

        # TODO: Add more specific suggestions based on common
        #       signalJourney patterns later
        # e.g., based on error.schema_path or specific known field constraints


# --- Custom Exception ---

# Make sure List and Optional are imported if not already
# from typing import List, Optional # Moved to top


class SignalJourneyValidationError(Exception):
    """Custom exception for validation errors."""

    def __init__(
        self, message: str, errors: Optional[List[ValidationErrorDetail]] = None
    ):
        super().__init__(message)
        self.errors = errors or []
