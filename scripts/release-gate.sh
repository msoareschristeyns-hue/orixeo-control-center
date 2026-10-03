#!/bin/sh
set -eu
test -f package-lock.json || { echo "RELEASE_GATE_FAIL: package-lock.json absent"; exit 1; }
grep -Eq '"[^"]+": "[\^~]|"[^"]+": "latest"' package.json && { echo "RELEASE_GATE_FAIL: dépendance non figée"; exit 1; }
grep -q '"version": "5.5.0"' package.json || { echo "RELEASE_GATE_FAIL: version Control Center != 5.5.0"; exit 1; }
npm ci
npm run build
echo CONTROL_CENTER_RELEASE_OK
