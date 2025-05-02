from dataclasses import dataclass, field
from typing import Any, List, Union, Optional, Deque

# Placeholder for a fuzzy matching library (optional dependency)
try:
    from fuzzywuzzy import process as fuzzy_process
    HAS_FUZZY = True
except ImportError:
    HAS_FUZZY = False

@dataclass
class ValidationErrorDetail:
    \"\"\"Stores detailed information about a single validation error.\"\"\"
    message: str
    path: List[Union[str, int]] = field(default_factory=list)
    schema_path: List[Union[str, int]] = field(default_factory=list)
    validator: str = ""
    validator_value: Any = None
    instance_value: Any = None
    context: List['ValidationErrorDetail'] = field(default_factory=list) # For nested errors like anyOf
    suggestion: Optional[str] = None # Added field for suggestions

    def __str__(self) -> str:
        path_str = "/".join(map(str, self.path)) if self.path else "root"
        base = f"Error at '{path_str}': {self.message}"
        if self.suggestion:
            base += f" -- Suggestion: {self.suggestion}"
        return base

    def generate_suggestion(self) -> None:
        """Generates a potential suggestion based on the error type."""
        # Simple suggestions based on validator type
        if self.validator == 'required':
            missing_props = self.validator_value
            if isinstance(missing_props, list):
                props_str = "', '".join(missing_props)
                self.suggestion = f"Ensure required property or properties ('{props_str}') are present."
            else:
                self.suggestion = "Ensure required property is present (check schema for details)."

        elif self.validator == 'type':
            expected_types = self.validator_value
            actual_type = type(self.instance_value).__name__
            if isinstance(expected_types, list):
                types_str = "', '".join(expected_types)
                self.suggestion = f"Change value type from '{actual_type}' to one of: '{types_str}'."
            elif isinstance(expected_types, str):
                self.suggestion = f"Change value type from '{actual_type}' to '{expected_types}'."
            else:
                 self.suggestion = f"Check schema for expected type(s) instead of '{actual_type}'."


        elif self.validator == 'pattern':
            pattern = self.validator_value
            self.suggestion = f"Ensure value matches the regex pattern: '{pattern}'."

        elif self.validator == 'enum':
            allowed_values = self.validator_value
            if isinstance(allowed_values, list):
                suggestion_text = f"Value must be one of: {', '.join(map(repr, allowed_values))}."
                # Optional: Add fuzzy matching if library is available and value is string
                if HAS_FUZZY and isinstance(self.instance_value, str) and self.instance_value:
                    try:
                        # Filter allowed_values to only include strings for fuzzy matching
                        string_allowed_values = [str(v) for v in allowed_values if isinstance(v, str)]
                        if string_allowed_values:
                            best_match, score = fuzzy_process.extractOne(self.instance_value, string_allowed_values)
                            if score > 80: # Threshold for suggesting a match
                                suggestion_text += f" Did you mean '{best_match}'?"
                    except Exception: # Catch potential errors in fuzzy matching
                         pass # Don't let suggestion generation fail validation
                self.suggestion = suggestion_text

        elif self.validator == 'format':
            format_type = self.validator_value
            self.suggestion = f"Ensure value conforms to the '{format_type}' format."
            # Add more specific suggestions for common formats
            if format_type == 'date-time':
                self.suggestion += " (e.g., 'YYYY-MM-DDTHH:MM:SSZ' or with offset)."
            elif format_type == 'uri':
                self.suggestion += " (e.g., 'https://example.com/resource')."

        elif self.validator == 'minLength':
            min_len = self.validator_value
            actual_len = len(self.instance_value) if isinstance(self.instance_value, (str, list)) else 'N/A'
            self.suggestion = f"Ensure value has at least {min_len} characters/items (currently {actual_len})."

        elif self.validator == 'maxLength':
            max_len = self.validator_value
            actual_len = len(self.instance_value) if isinstance(self.instance_value, (str, list)) else 'N/A'
            self.suggestion = f"Ensure value has at most {max_len} characters/items (currently {actual_len})."

        elif self.validator == 'minItems':
            min_num = self.validator_value
            actual_num = len(self.instance_value) if isinstance(self.instance_value, list) else 'N/A'
            self.suggestion = f"Ensure array has at least {min_num} items (currently {actual_num})."

        elif self.validator == 'maxItems':
            max_num = self.validator_value
            actual_num = len(self.instance_value) if isinstance(self.instance_value, list) else 'N/A'
            self.suggestion = f"Ensure array has at most {max_num} items (currently {actual_num})."

        elif self.validator == 'minimum':
            min_val = self.validator_value
            self.suggestion = f"Ensure value is greater than or equal to {min_val}."

        elif self.validator == 'maximum':
            max_val = self.validator_value
            self.suggestion = f"Ensure value is less than or equal to {max_val}."

        elif self.validator == 'exclusiveMinimum':
            ex_min_val = self.validator_value
            self.suggestion = f"Ensure value is strictly greater than {ex_min_val}."

        elif self.validator == 'exclusiveMaximum':
            ex_max_val = self.validator_value
            self.suggestion = f"Ensure value is strictly less than {ex_max_val}."


        # TODO: Add more specific suggestions based on common signalJourney patterns later
        # e.g., based on error.schema_path or specific known field constraints

        # Add more specific suggestions based on common signalJourney patterns later 