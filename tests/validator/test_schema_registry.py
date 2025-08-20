"""
Tests for the schema registry and version-based validation system.
"""

import json

import pytest

from signaljourney_validator.schema_registry import SchemaVersionRegistry
from signaljourney_validator.validator import Validator


class TestSchemaVersionRegistry:
    """Test the SchemaVersionRegistry class."""

    def test_discover_versions(self, tmp_path):
        """Test that versions are correctly discovered."""
        # Create test versions directory structure
        versions_dir = tmp_path / "schema" / "versions"
        versions_dir.mkdir(parents=True)

        # Create version 0.1.0
        v010_dir = versions_dir / "0.1.0"
        v010_dir.mkdir()
        (v010_dir / "signalJourney.schema.json").write_text('{"title": "v0.1.0"}')

        # Create version 0.2.0
        v020_dir = versions_dir / "0.2.0"
        v020_dir.mkdir()
        (v020_dir / "signalJourney.schema.json").write_text('{"title": "v0.2.0"}')

        # Create directory without schema (should be ignored)
        invalid_dir = versions_dir / "invalid"
        invalid_dir.mkdir()

        registry = SchemaVersionRegistry(tmp_path / "schema")
        versions = registry.get_supported_versions()

        assert versions == ["0.1.0", "0.2.0"]
        assert registry.is_version_supported("0.1.0")
        assert registry.is_version_supported("0.2.0")
        assert not registry.is_version_supported("0.3.0")

    def test_get_latest_version(self, tmp_path):
        """Test getting the latest version."""
        # Create test versions
        versions_dir = tmp_path / "schema" / "versions"
        versions_dir.mkdir(parents=True)

        for version in ["0.1.0", "0.2.0", "1.0.0"]:
            version_dir = versions_dir / version
            version_dir.mkdir()
            schema_content = f'{{"title": "v{version}"}}'
            (version_dir / "signalJourney.schema.json").write_text(schema_content)

        registry = SchemaVersionRegistry(tmp_path / "schema")
        assert registry.get_latest_version() == "1.0.0"

    def test_get_schema_path(self, tmp_path):
        """Test getting schema path for a version."""
        versions_dir = tmp_path / "schema" / "versions"
        versions_dir.mkdir(parents=True)

        v010_dir = versions_dir / "0.1.0"
        v010_dir.mkdir()
        (v010_dir / "signalJourney.schema.json").write_text('{"title": "v0.1.0"}')

        registry = SchemaVersionRegistry(tmp_path / "schema")
        expected_path = v010_dir / "signalJourney.schema.json"
        assert registry.get_schema_path("0.1.0") == expected_path

    def test_get_schema_path_unsupported(self, tmp_path):
        """Test error when getting path for unsupported version."""
        registry = SchemaVersionRegistry(tmp_path / "schema")

        with pytest.raises(ValueError, match="Schema version '0.1.0' is not supported"):
            registry.get_schema_path("0.1.0")

    def test_load_schema(self, tmp_path):
        """Test loading a schema for a specific version."""
        versions_dir = tmp_path / "schema" / "versions"
        versions_dir.mkdir(parents=True)

        v010_dir = versions_dir / "0.1.0"
        v010_dir.mkdir()
        schema_content = {"title": "Test Schema", "version": "0.1.0"}
        (v010_dir / "signalJourney.schema.json").write_text(json.dumps(schema_content))

        registry = SchemaVersionRegistry(tmp_path / "schema")
        loaded_schema = registry.load_schema("0.1.0")

        assert loaded_schema == schema_content

    def test_detect_schema_version_from_dict(self):
        """Test detecting schema version from a dictionary."""
        registry = SchemaVersionRegistry()

        data = {"schema_version": "0.1.0", "other_field": "value"}
        version = registry.detect_schema_version(data)
        assert version == "0.1.0"

        # Test data without schema_version
        data_no_version = {"other_field": "value"}
        version = registry.detect_schema_version(data_no_version)
        assert version is None

    def test_detect_schema_version_from_file(self, tmp_path):
        """Test detecting schema version from a file."""
        registry = SchemaVersionRegistry()

        # Create test file
        test_file = tmp_path / "test.json"
        test_data = {"schema_version": "0.2.0", "description": "Test file"}
        test_file.write_text(json.dumps(test_data))

        version = registry.detect_schema_version(test_file)
        assert version == "0.2.0"

    def test_detect_schema_version_invalid_file(self, tmp_path):
        """Test error handling for invalid files."""
        registry = SchemaVersionRegistry()

        # Test non-existent file
        with pytest.raises(FileNotFoundError):
            registry.detect_schema_version(tmp_path / "nonexistent.json")

        # Test invalid JSON
        invalid_file = tmp_path / "invalid.json"
        invalid_file.write_text("invalid json content")

        with pytest.raises(IOError, match="Invalid JSON"):
            registry.detect_schema_version(invalid_file)


class TestVersionBasedValidator:
    """Test the Validator class with version-based functionality."""

    def create_test_schema(self, tmp_path, version="0.1.0"):
        """Helper to create a minimal test schema."""
        schema_dir = tmp_path / "schema" / "versions" / version
        schema_dir.mkdir(parents=True)

        schema_content = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Test Schema",
            "type": "object",
            "required": ["schema_version", "description"],
            "properties": {
                "schema_version": {"type": "string", "const": version},
                "description": {"type": "string"},
            },
        }

        schema_file = schema_dir / "signalJourney.schema.json"
        schema_file.write_text(json.dumps(schema_content))

        return tmp_path / "schema"

    def test_validator_with_specific_version(self, tmp_path):
        """Test creating validator with specific schema version."""
        schema_dir = self.create_test_schema(tmp_path, "0.1.0")

        validator = Validator(schema_version="0.1.0", schema_dir=schema_dir)
        assert validator.get_current_version() == "0.1.0"
        assert "0.1.0" in validator.get_supported_versions()

    def test_validator_unsupported_version(self, tmp_path):
        """Test error when creating validator with unsupported version."""
        schema_dir = self.create_test_schema(tmp_path, "0.1.0")

        with pytest.raises(ValueError, match="Schema version '0.2.0' is not supported"):
            Validator(schema_version="0.2.0", schema_dir=schema_dir)

    def test_auto_detect_validation(self, tmp_path):
        """Test validation with automatic version detection."""
        schema_dir = self.create_test_schema(tmp_path, "0.1.0")

        # Create validator without specific version
        validator = Validator(schema_dir=schema_dir)

        # Test data with matching schema version
        test_data = {"schema_version": "0.1.0", "description": "Test description"}

        # Should validate successfully
        errors = validator.validate(test_data, raise_exceptions=False)
        assert len(errors) == 0

    def test_auto_detect_validation_unsupported_version(self, tmp_path):
        """Test validation error for unsupported detected version."""
        schema_dir = self.create_test_schema(tmp_path, "0.1.0")

        validator = Validator(schema_dir=schema_dir)

        # Test data with unsupported version
        test_data = {"schema_version": "0.2.0", "description": "Test description"}

        errors = validator.validate(test_data, raise_exceptions=False)
        assert len(errors) == 1
        assert "not supported" in errors[0].message
        assert "0.2.0" in errors[0].message

    def test_validation_missing_version_field(self, tmp_path):
        """Test validation when schema_version field is missing."""
        schema_dir = self.create_test_schema(tmp_path, "0.1.0")

        # Create validator without default version
        validator = Validator(schema_dir=schema_dir)
        validator._schema_version = None  # Force no default

        # Test data without schema_version
        test_data = {"description": "Test description"}

        errors = validator.validate(test_data, raise_exceptions=False)
        assert len(errors) == 1
        assert "No schema_version field found" in errors[0].message

    def test_multiple_versions(self, tmp_path):
        """Test validation with multiple schema versions."""
        # Create multiple schema versions
        schema_base = tmp_path / "schema"

        # Version 0.1.0
        v010_dir = schema_base / "versions" / "0.1.0"
        v010_dir.mkdir(parents=True)
        v010_schema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Schema v0.1.0",
            "type": "object",
            "required": ["schema_version", "description"],
            "properties": {
                "schema_version": {"type": "string", "const": "0.1.0"},
                "description": {"type": "string"},
            },
        }
        (v010_dir / "signalJourney.schema.json").write_text(json.dumps(v010_schema))

        # Version 0.2.0 with additional required field
        v020_dir = schema_base / "versions" / "0.2.0"
        v020_dir.mkdir(parents=True)
        v020_schema = {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": "Schema v0.2.0",
            "type": "object",
            "required": ["schema_version", "description", "new_field"],
            "properties": {
                "schema_version": {"type": "string", "const": "0.2.0"},
                "description": {"type": "string"},
                "new_field": {"type": "string"},
            },
        }
        (v020_dir / "signalJourney.schema.json").write_text(json.dumps(v020_schema))

        # Create validator
        validator = Validator(schema_dir=schema_base)

        # Test data for v0.1.0 (should pass)
        data_v010 = {"schema_version": "0.1.0", "description": "Test v0.1.0"}
        errors = validator.validate(data_v010, raise_exceptions=False)
        assert len(errors) == 0

        # Test data for v0.2.0 without new_field (should fail)
        data_v020_incomplete = {"schema_version": "0.2.0", "description": "Test v0.2.0"}
        errors = validator.validate(data_v020_incomplete, raise_exceptions=False)
        assert len(errors) == 1
        assert "required" in errors[0].message.lower()

        # Test data for v0.2.0 with new_field (should pass)
        data_v020_complete = {
            "schema_version": "0.2.0",
            "description": "Test v0.2.0",
            "new_field": "Required field",
        }
        errors = validator.validate(data_v020_complete, raise_exceptions=False)
        assert len(errors) == 0

    def test_disable_auto_detect(self, tmp_path):
        """Test validation with auto-detection disabled."""
        schema_dir = self.create_test_schema(tmp_path, "0.1.0")

        validator = Validator(schema_version="0.1.0", schema_dir=schema_dir)

        # Data with different version should still validate against configured version
        # (but will fail because const doesn't match)
        test_data = {
            "schema_version": "0.2.0",  # Different version
            "description": "Test description",
        }

        errors = validator.validate(
            test_data, raise_exceptions=False, auto_detect_version=False
        )
        # Should get validation error because const doesn't match
        assert len(errors) >= 1
