from dataclasses import dataclass, field
from typing import Any, List, Optional, Deque

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

    def __str__(self) -> str:
        path_str = \"/\".join(map(str, self.path)) if self.path else \"root\"
        return f\"Error at '{path_str}': {self.message}\" 