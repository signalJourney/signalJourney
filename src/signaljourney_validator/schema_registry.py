"""
Schema Registry for version-based schema validation.

This module manages multiple schema versions and provides utilities to 
load appropriate schema based on the schema_version field in signalJourney files.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

JsonDict = Dict[str, Any]

# Default paths
DEFAULT_SCHEMA_DIR = Path(__file__).parent.parent.parent / "schema"
DEFAULT_VERSIONS_DIR = DEFAULT_SCHEMA_DIR / "versions"


class SchemaVersionRegistry:
    """Registry for managing multiple schema versions."""
    
    def __init__(self, schema_dir: Optional[Path] = None):
        """
        Initialize the schema registry.
        
        Args:
            schema_dir: Path to the schema directory. If None, uses default.
        """
        self.schema_dir = schema_dir or DEFAULT_SCHEMA_DIR
        self.versions_dir = self.schema_dir / "versions"
        self._supported_versions = self._discover_versions()
        
    def _discover_versions(self) -> List[str]:
        """
        Discover available schema versions by scanning the versions directory.
        
        Returns:
            List of available version strings, sorted in semantic version order.
        """
        if not self.versions_dir.exists():
            return []
            
        versions = []
        for item in self.versions_dir.iterdir():
            if item.is_dir() and (item / "signalJourney.schema.json").exists():
                versions.append(item.name)
                
        # Sort versions using semantic versioning
        try:
            versions.sort(key=lambda v: tuple(map(int, v.split('.'))))
        except ValueError:
            # Fall back to string sort if versions don't follow semantic versioning
            versions.sort()
            
        return versions
    
    def get_supported_versions(self) -> List[str]:
        """Get list of supported schema versions."""
        return self._supported_versions.copy()
    
    def is_version_supported(self, version: str) -> bool:
        """Check if a schema version is supported."""
        return version in self._supported_versions
    
    def get_latest_version(self) -> Optional[str]:
        """Get the latest supported schema version."""
        if not self._supported_versions:
            return None
        return self._supported_versions[-1]
    
    def get_schema_path(self, version: str) -> Path:
        """
        Get the path to the schema file for a specific version.
        
        Args:
            version: Schema version string (e.g., "0.1.0")
            
        Returns:
            Path to the schema file
            
        Raises:
            ValueError: If version is not supported
        """
        if not self.is_version_supported(version):
            raise ValueError(
                f"Schema version '{version}' is not supported. "
                f"Available versions: {self._supported_versions}"
            )
        
        return self.versions_dir / version / "signalJourney.schema.json"
    
    def load_schema(self, version: str) -> JsonDict:
        """
        Load the schema for a specific version.
        
        Args:
            version: Schema version string
            
        Returns:
            Schema dictionary
            
        Raises:
            ValueError: If version is not supported
            FileNotFoundError: If schema file doesn't exist
            IOError: If schema file cannot be read
        """
        schema_path = self.get_schema_path(version)
        
        try:
            with open(schema_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Schema file not found: {schema_path}")
        except json.JSONDecodeError as e:
            raise IOError(f"Invalid JSON in schema file {schema_path}: {e}")
        except Exception as e:
            raise IOError(f"Error reading schema file {schema_path}: {e}")
    
    def detect_schema_version(self, data: Union[Path, str, JsonDict]) -> Optional[str]:
        """
        Detect the schema version from a signalJourney file or data.
        
        Args:
            data: Path to JSON file, JSON string, or dictionary
            
        Returns:
            Schema version if found, None otherwise
            
        Raises:
            FileNotFoundError: If file path doesn't exist
            IOError: If file cannot be read
        """
        instance: JsonDict
        
        if isinstance(data, (Path, str)):
            file_path = Path(data)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")
            
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    instance = json.load(f)
            except json.JSONDecodeError as e:
                raise IOError(f"Invalid JSON in file {file_path}: {e}")
            except Exception as e:
                raise IOError(f"Error reading file {file_path}: {e}")
        elif isinstance(data, dict):
            instance = data
        else:
            raise TypeError("Data must be a Path, string, or dictionary.")
        
        return instance.get("schema_version")
    
    def get_default_schema_version(self) -> str:
        """
        Get the default schema version to use when none is specified.
        
        Returns:
            Default version string
            
        Raises:
            RuntimeError: If no schemas are available
        """
        if not self._supported_versions:
            raise RuntimeError("No schema versions available")
        
        # For backward compatibility, use the latest version as default
        return self.get_latest_version()


# Global registry instance
_registry = None


def get_registry(schema_dir: Optional[Path] = None) -> SchemaVersionRegistry:
    """
    Get the global schema registry instance.
    
    Args:
        schema_dir: Optional custom schema directory
        
    Returns:
        Schema registry instance
    """
    global _registry
    if _registry is None or (schema_dir and schema_dir != _registry.schema_dir):
        _registry = SchemaVersionRegistry(schema_dir)
    return _registry


def get_supported_versions() -> List[str]:
    """Get list of supported schema versions using the global registry."""
    return get_registry().get_supported_versions()


def detect_schema_version(data: Union[Path, str, JsonDict]) -> Optional[str]:
    """Detect schema version using the global registry."""
    return get_registry().detect_schema_version(data)


def is_version_supported(version: str) -> bool:
    """Check if version is supported using the global registry."""
    return get_registry().is_version_supported(version)


def load_schema_for_version(version: str) -> JsonDict:
    """Load schema for specific version using the global registry."""
    return get_registry().load_schema(version)