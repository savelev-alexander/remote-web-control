#!/usr/bin/env bash
# Запускает сервер и оба dev-фронта параллельно.
# Полезно во время разработки на TEST-машине.
set -e
trap 'kill 0' EXIT

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

echo "Starting server, mobile dev, desktop dev..."
(cd server && dotnet run) &
(cd frontend/mobile && npm run dev) &
(cd frontend/desktop && npm run dev) &

wait
