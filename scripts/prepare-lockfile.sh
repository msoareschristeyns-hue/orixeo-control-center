#!/bin/sh
set -eu
npm install --package-lock-only --ignore-scripts
node scripts/pin-dependencies.cjs
npm install --package-lock-only --ignore-scripts
echo LOCKFILE_READY
