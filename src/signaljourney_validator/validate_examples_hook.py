#!/usr/bin/env python3
"""
Pre-commit hook to validate signalJourney example files.

This script validates all example files that are being committed
to ensure they conform to the signalJourney schema.
"""

import sys
from pathlib import Path
from typing import List

from signaljourney_validator import Validator


def validate_examples(file_paths: List[str]) -> bool:
    """
    Validate example files using signaljourney_validator.
    
    Args:
        file_paths: List of file paths to validate
        
    Returns:
        True if all files are valid, False otherwise
    """
    all_valid = True
    validator = Validator()
    
    for file_path in file_paths:
        file_path = Path(file_path)
        
        # Only validate JSON files in examples directory
        if not file_path.name.endswith('.json'):
            continue
            
        if 'examples' not in str(file_path):
            continue
            
        print(f"Validating {file_path}...")
        
        try:
            errors = validator.validate(file_path, raise_exceptions=False)
            
            if errors:
                print(f"✗ {file_path} failed validation:")
                for error in errors[:5]:  # Show first 5 errors
                    path_str = " → ".join(str(p) for p in error.path) if error.path else "root"
                    print(f"  • {path_str}: {error.message}")
                    if error.suggestion:
                        print(f"    Suggestion: {error.suggestion}")
                
                if len(errors) > 5:
                    print(f"    ... and {len(errors) - 5} more errors")
                    
                all_valid = False
            else:
                print(f"✓ {file_path} is valid")
                
        except Exception as e:
            print(f"✗ {file_path} validation failed with error: {e}")
            all_valid = False
    
    return all_valid


def main():
    """Main entry point for pre-commit hook."""
    if len(sys.argv) < 2:
        print("No files to validate")
        return 0
        
    file_paths = sys.argv[1:]
    
    if validate_examples(file_paths):
        return 0
    else:
        print("\n❌ Some example files failed validation. Please fix the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())