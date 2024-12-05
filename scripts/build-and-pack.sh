#!/bin/bash

# Stop on error.
set -e

# Get the directory of the script.
SCRIPT_DIR=$(dirname $(readlink -f $0))

# Get the directory of the project.
PROJECT_BASE_DIR=$(dirname $SCRIPT_DIR)

echo $PROJECT_BASE_DIR
# Change to the project directory.
cd $PROJECT_BASE_DIR

#Install dependencies, build, and test.

echo "rush install"
node common/scripts/install-run-rush.js install

echo "check format"
node common/scripts/install-run-rush.js check-format --verbose

echo "rush build"
node common/scripts/install-run-rush.js build

echo "test"
node common/scripts/install-run-rush.js test --verbose

IMPORTER_BASE_DIR=$PROJECT_BASE_DIR/libraries/azure-app-configuration-importer
FILE_IMPORTER_SRC_BASE_DIR=$PROJECT_BASE_DIR/libraries/azure-app-configuration-importer-file-source

# Create a tarball

cd $IMPORTER_BASE_DIR

echo "pack azure-app-configuration-importer"
npm pack

cd $FILE_IMPORTER_SRC_BASE_DIR

echo "pack azure-app-configuration-importer-file-source"
npm pack