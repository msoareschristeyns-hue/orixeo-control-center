#!/bin/sh
set -eu
test -f package-lock.json || { echo "RELEASE_GATE_FAIL: package-lock.json absent"; exit 1; }
grep -Eq '"[^"]+": "[\^~]|"[^"]+": "latest"' package.json && { echo "RELEASE_GATE_FAIL: dépendance non figée"; exit 1; }
node -e "const p=require('./package.json');const l=require('./package-lock.json');const v=l.packages?.['']?.version;if(v!==p.version){console.error('RELEASE_GATE_FAIL: package/lock version mismatch '+p.version+' != '+v);process.exit(1)}"
npm ci
npm run build
echo CONTROL_CENTER_RELEASE_OK
