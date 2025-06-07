#!/bin/bash

# IDCN Setup Script
set -e

echo "Setting up IDCN..."

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 not found. Please install Python 3.8+ and try again."
    exit 1
fi

echo "Found: $(python3 --version)"

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo "Error: pip3 not found. Please install pip and try again."
    exit 1
fi

echo "Installing dependencies..."
pip3 install mesa==2.3.2 flask

# Check directory
if [ ! -f "app.py" ]; then
    echo "Error: app.py not found. Run this script from the MASMAS directory."
    exit 1
fi

echo "Starting Flask application..."

python3 app.py
