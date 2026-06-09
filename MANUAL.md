# Запуск на тестовом хосте

Linux x64 + bash.

## Зависимости

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nodejs npm dotnet-sdk-8.0 clang zlib1g-dev

# Опционально (для иконок PWA — не блокирует основной флоу):
sudo apt-get install -y imagemagick
```

Версии:
- Node.js 18+ (`engines: ">=18"` в package.json)
- .NET SDK 8.0 (для AOT нужен clang + zlib-dev в системе)
- npm 9+

## Сборка

```bash
git clone <repo-url>
cd remote-web-control

./scripts/build-all.sh
```

Что произойдёт:
1. `npm install` + `npm run build` для embed-библиотеки → `server/wwwroot/embed/qr-remote.{js,css}`
2. То же для desktop → `server/wwwroot/desktop/`
3. То же для mobile → `server/wwwroot/mobile/`
4. `dotnet publish -p:PublishAot=true -r linux-x64` → `dist/remote-web-control-server` (~12 МБ self-contained)

При первом запуске займёт 3–5 минут (NuGet restore + npm install + AOT генерация). При повторных — 30–40 секунд.

## Запуск

```bash
cd dist
PORT=8080 ./remote-web-control-server
```

Лог при старте:
```
info: Program[0]
      Конфиг: port=8080, ip=192.168.1.10, ttl=30мин, maxSessions=500
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://0.0.0.0:8080
```

`ip` — LAN-IP, который попадёт в QR-URL. Если телефон не из той же подсети — задайте `PUBLIC_HOST=<нужный-IP>`.

## Демо

1. Откройте `http://localhost:8080/desktop/` в браузере на хосте.
2. Дождитесь статуса «Готово · …» в верхнем правом углу — embed-библиотека создала сессию и начала опрос (poll).
3. Нажмите «QR-парный пульт» — появится оверлей с QR-кодом и URL под ним.
4. Отсканируйте QR-код устройством в той же Wi-Fi-сети.
5. На устройстве откроется мобильный пульт с группами виджетов («Призыв к действию», «Конфигуратор», «Аудио», «Внешний вид», «Форма обратной связи»).
6. Действия на пульте отражаются на desktop-странице: счётчик покупок, форма, слайдеры, тёмная тема и т. д.

## Тесты

```bash
./scripts/test-all.sh
```

Прогоняет xUnit, vitest × 3, AOT-сборку и Playwright e2e. Полный прогон — 1–2 минуты после первой инициализации.

Только без Playwright (быстрый цикл):
```bash
SKIP_E2E=1 ./scripts/test-all.sh
```

## Очистка

```bash
rm -rf dist server/bin server/obj server/wwwroot/{embed,desktop,mobile}/* \
       frontend/*/node_modules e2e/node_modules
```

## Troubleshooting

**`dotnet publish` падает с «zlib not found».**  
Поставьте `zlib1g-dev` (см. зависимости выше).

**Телефон не подключается к QR-URL.**  
`./scripts/build-all.sh` использует автоопределение LAN-IP. Если он неверный (например, host в подсети 192.168.1.x, а телефон в 192.168.0.x) — запустите сервер с `PUBLIC_HOST=<правильный-IP>`.

**Playwright требует webkit.**  
Конфиг запускает только chromium (`projects: [{ name: 'chromium' }]`). Если e2e ругается на webkit — обновите `e2e/playwright.config.ts` локально (возможны несоответствия версий после `npm update`).
