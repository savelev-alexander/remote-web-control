#!/usr/bin/env bash
# Прогон всех наборов тестов: xUnit (сервер), vitest (embed/desktop/mobile),
# затем сборка артефактов и Playwright e2e. Если последний шаг не нужен —
# вызывайте: SKIP_E2E=1 ./scripts/test-all.sh
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

echo "==> [1/6] xUnit server tests..."
dotnet test server/RemoteWebControlServer.Tests/RemoteWebControlServer.Tests.csproj --nologo

echo "==> [2/6] vitest embed..."
(cd frontend/embed && [ -d node_modules ] || npm install) && (cd frontend/embed && npm test -- --run)

echo "==> [3/6] vitest desktop..."
(cd frontend/desktop && [ -d node_modules ] || npm install) && (cd frontend/desktop && npm test -- --run)

echo "==> [4/6] vitest mobile..."
(cd frontend/mobile && [ -d node_modules ] || npm install) && (cd frontend/mobile && npm test -- --run)

if [ "${SKIP_E2E:-0}" = "1" ]; then
  echo "==> [5/6] e2e build SKIPPED"
  echo "==> [6/6] e2e run   SKIPPED"
  echo "All non-e2e tests passed."
  exit 0
fi

echo "==> [5/6] Building AOT bundle for e2e..."
./scripts/build-all.sh

echo "==> [6/6] Playwright e2e..."
(cd e2e && [ -d node_modules ] || npm install)
# --with-deps требует sudo на Linux; CI пусть сам прогревает контейнер. Локально
# полагаемся на то, что разработчик прогнал `npx playwright install chromium` один раз.
(cd e2e && npx playwright install chromium >/dev/null)
(cd e2e && npm test)

echo ""
echo "All tests passed."
