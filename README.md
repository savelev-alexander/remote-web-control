# QR-Embed Remote

[![npm version](https://img.shields.io/npm/v/qr-embed-remote.svg)](https://www.npmjs.com/package/qr-embed-remote)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Превратите телефон в пульт управления для веб-страницы — без установки приложений и без переписывания самой страницы. Пользователь сканирует QR-код, и на телефоне открывается пульт с кнопками, полями ввода и слайдерами, которые управляют исходной страницей в реальном времени.

> **Статус:** прототип, не предназначен для production. См. [Ограничения](#ограничения).

NPM-пакет: [`qr-embed-remote`](frontend/embed/) · `npm install qr-embed-remote` · [документация пакета](frontend/embed/README.md)

## Как это устроено

1. Host-страница подключает `qr-remote.js` и регистрирует свои интерактивные элементы вызовом `register()`.
2. Библиотека показывает QR-код со ссылкой на мобильный пульт.
3. Телефон в той же локальной сети сканирует код — открывается пульт, элементы которого сгенерированы из реестра сессии.
4. Действие на телефоне отправляет команду брокеру; host-страница получает её при следующем опросе (`poll`) и вызывает обработчик `onAction`.

Библиотека не зависит от фреймворка (React, Vue, vanilla) и добавляется к существующей странице, не требуя её переработки.

## Быстрый старт

```bash
./scripts/build-all.sh
cd dist && PORT=8080 ./remote-web-control-server
```

Откройте `http://localhost:8080/desktop/`, нажмите «QR-парный пульт» и отсканируйте код телефоном в той же сети.

## Интеграция

Подключите два файла и зарегистрируйте элементы:

```html
<link rel="stylesheet" href="/embed/qr-remote.css">
<script src="/embed/qr-remote.js"></script>
<script>
  QRRemote.init().then(remote => {
    remote.register('btn-buy', {
      kind: 'button', label: 'Купить', group: 'Cart',
      onAction: () => document.getElementById('buy').click(),
    });
    document.getElementById('open-qr')
      .addEventListener('click', () => remote.showQR());
  });
</script>
```

Аргумент `onAction` зависит от `kind`: `undefined` — button, `string` — input/select, `boolean` — toggle, `number` — slider.

Полный API и примеры для React/Vue — в [EMBEDDING.md](EMBEDDING.md).

## Архитектура

```
┌──── Host-страница ────────────────┐
│  QRRemote.register(id, descriptor)│ ─── PUT /api/registry/{sid}
│  QRRemote.showQR()                │ ─── GET /api/poll?sid → onAction
└──────────────┬────────────────────┘
               │ HTTP, LAN
       ┌───────┴───────────────────────┐
       │  Брокер (.NET 8 AOT)          │
       │  SessionStore (TTL + LRU)     │
       │  RegistryStore (per-session)  │
       │  CommandValidator (whitelist) │
       └───────┬───────────────────────┘
               │ GET /api/registry/{sid}
               ▼
   ┌─── Мобильный пульт (PWA) ─────────┐
   │  Button / Input / Select /        │
   │  Toggle / Slider                  │
   └───────────────────────────────────┘
```

| Компонент | Расположение | Размер |
|---|---|---|
| Embed-библиотека | [frontend/embed](frontend/embed/) | ~12 КБ gzip |
| Desktop-демо | [frontend/desktop](frontend/desktop/) | ~48 КБ gzip |
| Мобильный пульт | [frontend/mobile](frontend/mobile/) | ~48 КБ gzip |
| Брокер | [server/](server/) | 12 МБ AOT-бинарь |

## API

| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/session` | Создать сессию |
| POST | `/api/execute` | Поставить команды в очередь |
| GET | `/api/poll?session_id=…` | Забрать команды из очереди |
| PUT | `/api/registry/{session_id}` | Опубликовать реестр элементов |
| GET | `/api/registry/{session_id}` | Прочитать реестр |
| DELETE | `/api/registry/{session_id}` | Очистить реестр |
| GET | `/api/server-ip` | LAN-IP для QR-URL |
| GET | `/health`, `/ready` | Healthcheck |

Подробности — в [DOCUMENTATION.md](DOCUMENTATION.md).

## Команды (whitelist)

| Команда | Ограничения |
|---|---|
| `CLICK:<id>` | id ∈ `[a-zA-Z0-9_\-:.]{1,64}` |
| `INPUT:<id>:<value>` | value ≤ 1024 символов |
| `SELECT:<id>:<value>` | value ≤ 100 символов |
| `TOGGLE:<id>:(true\|false)` | булево |
| `SLIDE:<id>:<число>` | `^-?\d+(\.\d+)?$` |
| `SHOW_MSG:<text>` | text ≤ 500 |
| `ALERT:(info\|warning\|critical):<text>` | text ≤ 500 |
| `PLAY_SOUND:(alarm\|ok)` | — |

## Конфигурация

| Переменная | По умолчанию | Описание |
|---|---|---|
| `PORT` | `8080` | TCP-порт |
| `SESSION_TTL_MINUTES` | `30` | TTL неактивной сессии |
| `MAX_SESSIONS` | `500` | LRU-лимит сессий |
| `PUBLIC_HOST` | (auto) | IP для QR-URL (нужен в docker-bridge) |

## Сборка и тесты

```bash
./scripts/build-all.sh             # сборка фронтендов и AOT-публикация брокера
./scripts/test-all.sh              # все тесты
SKIP_E2E=1 ./scripts/test-all.sh   # без Playwright
```

148 тестов: xUnit (65) + vitest embed/desktop/mobile (80) + Playwright e2e (3).

## Ограничения

- **Прототип, не для production.**
- Состояние сессий хранится в памяти процесса и теряется при перезапуске.
- CORS настроен на `AllowAnyOrigin` — приемлемо для локальной сети, но не для публикации в интернет.
- Транспорт — опрос (`poll`), а не push; задержка отклика до ~1 секунды.
