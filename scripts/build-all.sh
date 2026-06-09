#!/usr/bin/env bash
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

echo "==> [1/5] Building embed library..."
cd frontend/embed
[ -d node_modules ] || npm install
npm run build
cd "$ROOT"

echo "==> [2/5] Building desktop frontend..."
cd frontend/desktop
[ -d node_modules ] || npm install
npm run build
cd "$ROOT"

echo "==> [3/5] Building mobile frontend..."
cd frontend/mobile
[ -d node_modules ] || npm install
npm run build
cd "$ROOT"

echo "==> [4/5] Publishing server (AOT)..."
dotnet publish server/RemoteWebControlServer.csproj \
  -c Release -r linux-x64 \
  -o "$ROOT/dist" \
  --self-contained true \
  -p:PublishAot=true \
  -p:StripSymbols=true

echo "==> [5/5] Verifying artifacts..."
test -f "$ROOT/dist/wwwroot/embed/qr-remote.js" \
  || { echo "ERROR: dist/wwwroot/embed/qr-remote.js not found"; exit 1; }
test -f "$ROOT/dist/wwwroot/desktop/index.html" \
  || { echo "ERROR: dist/wwwroot/desktop/index.html not found"; exit 1; }
test -f "$ROOT/dist/wwwroot/mobile/index.html" \
  || { echo "ERROR: dist/wwwroot/mobile/index.html not found"; exit 1; }

echo ""
echo "Build complete!"
echo "Run: cd dist && ./remote-web-control-server"
echo ""
ls -lh "$ROOT/dist/remote-web-control-server"
