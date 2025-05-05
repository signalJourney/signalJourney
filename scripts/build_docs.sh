#!/bin/bash
# Simple script to build the MkDocs documentation locally

set -e # Exit immediately if a command exits with a non-zero status.

echo "Installing documentation dependencies..."
# Assuming conda base is activated or project venv is active
# Use pip install instead of pip3 if in conda base or venv
pip install -e ".[docs]"

echo "Building documentation..."
mkdocs build

echo "Documentation successfully built in ./site directory." 