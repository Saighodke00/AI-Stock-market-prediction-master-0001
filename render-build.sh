#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Building React Frontend..."
cd frontend
# Install Node.js if not present (Render Python envs might not have it)
if ! command -v npm &> /dev/null
then
    echo "npm could not be found. Please use the Docker environment on Render or add a Node buildpack."
    exit 1
fi

npm ci
npm run build
cd ..

echo "Installing Python Dependencies..."
pip install -r requirements.txt
