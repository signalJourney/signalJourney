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
                self.suggestion = f"Ensure required property '{missing_props[0]}' is present." # Simple suggestion for now

        elif self.validator == 'type':
            expected_type = self.validator_value
            actual_type = type(self.instance_value).__name__
            self.suggestion = f"Change value type from '{actual_type}' to '{expected_type}'."

        elif self.validator == 'pattern':
            pattern = self.validator_value
            self.suggestion = f"Ensure value matches the regex pattern: '{pattern}'."

        elif self.validator == 'enum':
            allowed_values = self.validator_value
            if isinstance(allowed_values, list):
                suggestion_text = f"Value must be one of: {', '.join(map(str, allowed_values))}."
                # Optional: Add fuzzy matching if library is available
                if HAS_FUZZY and isinstance(self.instance_value, str):
                    best_match, score = fuzzy_process.extractOne(self.instance_value, allowed_values)
                    if score > 80: # Threshold for suggesting a match
                        suggestion_text += f" Did you mean '{best_match}'?"
                self.suggestion = suggestion_text

        # Add more specific suggestions based on common signalJourney patterns later 