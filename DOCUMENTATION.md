# QR-Embed Remote — техническая документация

JavaScript-библиотека для подключения мобильного пульта управления к произвольной веб-странице через QR-сопряжение. Статус: прототип.

## Оглавление

1. [Архитектурный обзор](#1-архитектурный-обзор)
2. [API эндпоинты](#2-api-эндпоинты)
3. [Command DSL](#3-command-dsl)
4. [Сессия и реестр элементов](#4-сессия-и-реестр-элементов)
5. [Embed-библиотека](#5-embed-библиотека)
6. [Desktop-демо](#6-desktop-демо)
7. [Mobile пульт](#7-mobile-пульт)
8. [Конфигурация](#8-конфигурация)
9. [Тесты](#9-тесты)
10. [Карта кода](#10-карта-кода)
11. [Безопасность](#11-безопасность)

---

## 1. Архитектурный обзор

Три фронтенд-пакета и один сервер:

- **`frontend/embed`** — vanilla IIFE-библиотека `qr-remote.js`. Раздаётся сервером как статика по `/embed/qr-remote.js`. Любая host-страница включает её одним `<script>` и получает API на `window.QRRemote`.
- **`frontend/desktop`** — React-приложение «Acme Demo», демонстрирующее работу embed-библиотеки. Является примером host-страницы, а не частью продукта.
- **`frontend/mobile`** — React-приложение мобильного пульта. Открывается по QR-URL. Не содержит сведений о конкретной host-странице — рендерит элементы из реестра сессии.
- **`server/`** — брокер на .NET 8 AOT. Хранит сессии и реестры в памяти, валидирует команды, раздаёт статику фронтендов.

Поток данных:

```
Host page (embed lib)                 Broker                  Mobile remote
─────────────────────                 ──────                  ─────────────
register('btn-buy', ...) ──────▶ PUT /api/registry/{sid} ◀──── (polling every 5s)
                                       │                       GET /api/registry/{sid}
                                       │
                  ◀── GET /api/poll ───┤                       (отрисовывает виджет)
onAction('click')   (every 1s)         │                                │
                                       │                       user taps button
                                       ├── POST /api/execute ◀──        │
                                       │       (CLICK:btn-buy)          │
                                       │                                
                            queued in SessionStore                      
                                       │                       
              command arrives at next /poll iteration                   
                            onAction() fires
```

## 2. API эндпоинты

Все эндпоинты возвращают JSON (или `text/plain` для health/ready). Тело запроса ≤ 64 КБ (Kestrel limit).

### POST /api/session

Создаёт новую сессию. Body: пустой (`{}`).
```json
{"session_id": "5f4dcc3b5aa765d61d8327deb882cf99"}
```

### POST /api/execute

Кладёт команды в очередь сессии. Каждый шаг проверяется `CommandValidator`.

Body:
```json
{"session_id": "5f4dcc...", "steps": ["CLICK:btn-buy", "SHOW_MSG:done"]}
```

Лимиты: ≤ 32 шага, ≤ 1536 символов каждый.

Коды ответа:
- `200 {"status":"ok"}` — все команды положены в очередь
- `400 {"error":"…"}` — невалидная команда (включая эхо проблемного шага)
- `404` — неизвестный `session_id`

### GET /api/poll?session_id=…

Извлекает и очищает очередь команд.
```json
{"commands": ["CLICK:btn-buy", "SHOW_MSG:done"]}
```

Коды: 200 (пустой массив при отсутствии команд), 400 (нет параметра), 404 (неизвестная сессия).

### PUT /api/registry/{session_id}

Записывает полный снимок реестра. Перезаписывает предыдущий.

Body:
```json
{
  "version": 7,
  "elements": [
    {"id":"btn-buy","kind":"button","label":"Buy","group":"Cart"},
    {"id":"qty","kind":"slider","label":"Qty","group":"Cart","min":1,"max":10,"step":1}
  ]
}
```

Лимиты: ≤ 256 элементов, label ≤ 200, group ≤ 100, options ≤ 32 шт по ≤ 100 символов, id матчится `^[a-zA-Z0-9_\-:.]{1,64}$`, kind ∈ `{button,input,select,toggle,slider}`, slider min < max и step > 0, все id уникальны.

Коды: 200 `{"status":"ok","version":7}`, 400 (валидация), 404 (нет сессии).

### GET /api/registry/{session_id}

Читает текущий снимок. Если ничего ещё не PUT'или — возвращает `{"version":0,"elements":[]}`, не 404.

### DELETE /api/registry/{session_id}

Опционально, удаляет реестр без удаления сессии.

### GET /api/server-ip

Возвращает LAN-IP, который embed-библиотека подставит в QR-URL.
```json
{"ip": "192.168.1.10"}
```

Если задана `PUBLIC_HOST`, возвращается она; иначе — результат [DetectLanIp()](server/Program.cs).

### GET /health, GET /ready

Plain-text `OK`/`READY`, статус 200.

## 3. Command DSL

Whitelist в [server/Validation/CommandValidator.cs](server/Validation/CommandValidator.cs):

| Префикс | Payload | Лимиты |
|---|---|---|
| `CLICK` | `<id>` | id ∈ `[a-zA-Z0-9_\-:.]{1,64}` |
| `INPUT` | `<id>:<value>` | value ≤ 1024 символов (UTF-8) |
| `SELECT` | `<id>:<value>` | value ≤ 100 |
| `TOGGLE` | `<id>:(true\|false)` | строго `true` или `false` |
| `SLIDE` | `<id>:<число>` | `^-?\d+(\.\d+)?$` |
| `SHOW_MSG` | `<text>` | text ≤ 500 (отклик демо) |
| `ALERT` | `<info\|warning\|critical>:<text>` | text ≤ 500 (отклик демо) |
| `PLAY_SOUND` | `alarm` или `ok` | (отклик демо) |

Сервер не интерпретирует команды — только проверяет формат и кладёт в очередь. Парсинг и роутинг в `onAction` происходят в [embed/src/dispatch.ts](frontend/embed/src/dispatch.ts).

Безадресные команды (SHOW_MSG/ALERT/PLAY_SOUND) не привязаны к зарегистрированному элементу. Embed-библиотека доставляет их host-странице через колбэк `onMessage`, переданный в `init(opts)` (значение типа `HostMessage`). Если `onMessage` не задан — такие команды игнорируются.

## 4. Сессия и реестр элементов

### Сессия (SessionStore)

- ID = `Guid.NewGuid().ToString("N")` (32 hex chars).
- Состояние: `ConcurrentQueue<string>` + `LastActivityMs` (монотонные часы через `IClock`).
- TTL: `SESSION_TTL_MINUTES` (default 30) — окно неактивности.
- LRU: `MAX_SESSIONS` (default 500) — жёсткий лимит, при превышении удаляется самая старая.
- Cleanup-таймер каждые TTL/4 минут (но не реже 5 мин и не чаще 1 мин).
- Событие `SessionEvicted` — на него подписан `RegistryStore`, чтобы убрать связанный снимок.

### Реестр (RegistryStore)

- Один снимок (`RegistrySnapshot`) на сессию.
- Перезаписывается целиком при каждом `PUT` (last-write-wins).
- Версия — монотонный счётчик от host-страницы; мобильный пульт использует его, чтобы пропустить перерисовку, если `version` не изменилась.
- Автоматически удаляется при выселении сессии (через `SessionEvicted`).

## 5. Embed-библиотека

Модули в [frontend/embed/src/](frontend/embed/src/):

| Файл | Назначение |
|---|---|
| `index.ts` | Public API на `window.QRRemote`. Связывает все остальные модули. |
| `types.ts` | `RegistryDescriptor`, `QRRemoteHandle`, `QRRemoteInitOpts`, `HostMessage`. |
| `session.ts` | `obtainSession()` через `POST /api/session`. По умолчанию кэш в `sessionStorage` (режим `'tab'`, изоляция по вкладке); ключ содержит origin. Режимом `persistSession` можно выбрать `'origin'` (`localStorage`) или `'none'`. |
| `registry.ts` | In-memory `Map<id, descriptor>`, debounced flush 200 мс с инкрементом version. `onAction` режется при сериализации. |
| `poller.ts` | Polling `/api/poll` с экспоненциальным backoff (1 → 10 сек). 404 → callback `onSessionLost`. |
| `dispatch.ts` | Разбирает команды и направляет их в `descriptor.onAction(arg)` с корректным типом аргумента. |
| `qr.ts` | Генерация SVG-QR (qrcode-generator). `buildMobileUrl()` использует `/api/server-ip` + текущий port. |
| `overlay.ts` | Минимальный диалог поверх host-страницы. Все классы префиксованы `qr-remote-` для изоляции. |
| `styles.css` | Стили оверлея. |

Бандл: IIFE, не-хешированное имя `qr-remote.js` для стабильного URL. Размер ~12 КБ gzip.

## 6. Desktop-демо

[frontend/desktop/src/App.tsx](frontend/desktop/src/App.tsx) — показательная host-страница «Acme Demo». Регистрирует 12 элементов через [useRegister](frontend/desktop/src/useQRRemote.ts):

- Внешний вид: dark-toggle, Show-QR button.
- Призыв к действию: «Купить», «Подписаться» + счётчик покупок.
- Конфигуратор: размер (select), цвет (select), количество (slider).
- Форма обратной связи: имя (input), email (input), сообщение (input).
- Аудио: громкость (slider), тест-уведомление (button).

Каждый `onAction` изменяет локальный React state — desktop-страница визуально отражает действия, поступающие с мобильного пульта.

Хук [useRegister](frontend/desktop/src/useQRRemote.ts) проксирует `onAction` через ref на свежую функцию, чтобы `onAction` видел актуальный state без ре-регистрации при каждом изменении.

## 7. Mobile пульт

[frontend/mobile/src/App.tsx](frontend/mobile/src/App.tsx) — пульт, авто-генерируемый из реестра. Никаких знаний о конкретной host-странице:

1. Достаёт `session_id` из `?sid=` (QR) или localStorage.
2. Polling `/api/registry/{sid}` каждые 5 секунд. Skip re-render если `version` не изменилась.
3. Группирует элементы по `group` (алфавитный порядок групп).
4. Рендерит каждый kind через свой виджет:
   - [ButtonWidget](frontend/mobile/src/widgets/ButtonWidget.tsx) — большая кнопка (≥ 48px touch).
   - [InputWidget](frontend/mobile/src/widgets/InputWidget.tsx) — input + send-button.
   - [SelectWidget](frontend/mobile/src/widgets/SelectWidget.tsx) — native select.
   - [ToggleWidget](frontend/mobile/src/widgets/ToggleWidget.tsx) — animated switch с aria-checked.
   - [SliderWidget](frontend/mobile/src/widgets/SliderWidget.tsx) — range, шлёт `SLIDE` только на `pointerup`/`keyup`.
5. Любая ошибка 404 → очистка localStorage и статус «Сессия истекла».

## 8. Конфигурация

| Env | Default | Что делает |
|---|---|---|
| `PORT` | 8080 | TCP-порт сервера |
| `SESSION_TTL_MINUTES` | 30 | окно неактивности |
| `MAX_SESSIONS` | 500 | LRU-лимит |
| `PUBLIC_HOST` | (auto-detect) | хост, отдаваемый в `/api/server-ip` |

Auto-detect: `DetectLanIp()` в [Program.cs:69-96](server/Program.cs#L69-L96). Алгоритм:
1. Кандидаты: только Ethernet/Wireless80211, IPv4, RFC1918 (отсекает tun*, virbr*, docker0).
2. Один кандидат → возвращаем.
3. Несколько → UDP-connect к `8.8.8.8:53` для определения default route.
4. Иначе → приоритет 192.168.* > 10.* > 172.16-31.*.

## 9. Тесты

`./scripts/test-all.sh` запускает всё. `SKIP_E2E=1` пропускает Playwright.

| Набор | Где | Кол-во |
|---|---|---|
| xUnit | [server/RemoteWebControlServer.Tests/](server/RemoteWebControlServer.Tests/) | 65 |
| vitest embed | [frontend/embed/tests/](frontend/embed/tests/) | 52 |
| vitest desktop | [frontend/desktop/tests/](frontend/desktop/tests/) | 4 |
| vitest mobile | [frontend/mobile/tests/](frontend/mobile/tests/) | 24 |
| Playwright e2e | [e2e/tests/](e2e/tests/) | 3 |

xUnit покрывает: SessionStore TTL+LRU+concurrent, RegistryStore round-trip + auto-eviction, CommandValidator whitelist (parametrized), ApiEndpoints полный HTTP с `WebApplicationFactory<Program>`.

vitest покрывает: parseCommand, dispatch routing по kind, registry debounce+version+`onAction`-strip, session cache, виджеты-к-команде, ApiClient mock-fetch.

Playwright покрывает: парный QR-flow на реальном AOT-бинаре, slider→display sync, /health+/ready smoke.

## 10. Карта кода

```
server/
├── Program.cs                       — entry, DI, LAN-IP detect, cache headers
├── ProgramPartial.cs                — public partial class Program для WebApplicationFactory
├── Endpoints/ApiEndpoints.cs        — minimal-API endpoints + validation
├── Services/
│   ├── IClock.cs / SystemClock.cs   — injectable monotonic clock
│   ├── SessionStore.cs              — queue + TTL + LRU + SessionEvicted event
│   └── RegistryStore.cs             — per-session snapshot + auto-cleanup on eviction
├── Validation/CommandValidator.cs    — whitelist + regex validation
├── Models/
│   ├── ApiModels.cs                 — DTO records с JsonPropertyName
│   └── AppJsonContext.cs            — AOT source-gen для всех DTO
└── RemoteWebControlServer.Tests/        — xUnit suite

frontend/
├── shared/                           — types, ApiClient, parseCommand, command builders
├── embed/                            — vanilla IIFE library
│   └── src/{index,session,registry,poller,dispatch,qr,overlay}.ts
├── desktop/                          — Acme Demo host page (React)
│   └── src/{App,useQRRemote}.tsx
└── mobile/                           — auto-generated remote (React)
    └── src/{App.tsx,widgets/*.tsx}

e2e/                                  — Playwright tests
scripts/
├── build-all.sh                     — собирает все три FE + AOT
└── test-all.sh                      — прогоняет полный test suite
```

## 11. Безопасность

- **CORS открыт** (`AllowAnyOrigin`) — приемлемо для LAN-демо, недопустимо для интернета.
- **Команды whitelist'ятся** — невалидные шаги → 400 ещё до попадания в очередь.
- **Embed-библиотека не доверяет серверу** в смысле произвольного исполнения — `onAction` вызывается только если `id` есть в локальном registry (отказ от unknown id).
- **Кэш сессии изолирован по origin** — ключ `qrremote.session.<origin>` (по умолчанию `sessionStorage`) не делится между разными host-страницами.
- **AOT source-gen JSON** — каждый DTO зарегистрирован в [AppJsonContext](server/Models/AppJsonContext.cs). Пропуск → `NotSupportedException` в проде (отлавливается AOT-smoke в e2e).
