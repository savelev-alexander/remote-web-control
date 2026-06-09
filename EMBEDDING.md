# EMBEDDING.md — интеграция в host-проекты

Библиотека `qr-remote.js` живёт по фиксированному URL `/embed/qr-remote.js` на любом сервере, где запущен наш broker. Host-страница может находиться на отдельном сервере — embed-библиотека использует абсолютный `baseUrl`, переданный в `init()`.

## Vanilla HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="https://broker.example.com/embed/qr-remote.css">
    <script src="https://broker.example.com/embed/qr-remote.js"></script>
  </head>
  <body>
    <button id="real-buy">Купить</button>
    <button id="open-qr">Показать QR-пульт</button>

    <script>
      QRRemote.init({ baseUrl: 'https://broker.example.com' }).then(remote => {
        remote.register('btn-buy', {
          kind: 'button', label: 'Купить', group: 'Корзина',
          onAction: () => document.getElementById('real-buy').click(),
        });

        document.getElementById('open-qr')
          .addEventListener('click', () => remote.showQR());
      });
    </script>
  </body>
</html>
```

## React (без хука)

```tsx
import { useEffect, useRef } from 'react';

export function ProductPage() {
  const remoteRef = useRef(null);

  useEffect(() => {
    let handle;
    window.QRRemote.init().then(h => {
      handle = h;
      remoteRef.current = h;
      h.register('btn-buy', {
        kind: 'button', label: 'Купить',
        onAction: () => buy(),
      });
    });
    return () => handle?.destroy();
  }, []);

  return <button onClick={() => remoteRef.current?.showQR()}>QR-пульт</button>;
}
```

## React (с готовым хуком из этой репы)

См. [frontend/desktop/src/useQRRemote.ts](frontend/desktop/src/useQRRemote.ts) — `useRegister(remote, id, descriptor)` декларативно регистрирует элемент на mount и снимает на unmount. Используется в [frontend/desktop/src/App.tsx](frontend/desktop/src/App.tsx) как референсная реализация.

```tsx
const remote = useQRRemote();
useRegister(remote, 'vol', {
  kind: 'slider', label: 'Громкость', min: 0, max: 100, step: 5,
  onAction: v => setVolume(Number(v ?? 0)),
});
```

## Vue (concept)

```vue
<template>
  <button @click="showQr">QR-пульт</button>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

let handle = null;
onMounted(async () => {
  handle = await window.QRRemote.init();
  handle.register('btn-buy', {
    kind: 'button', label: 'Купить',
    onAction: () => realBuy(),
  });
});
onUnmounted(() => handle?.destroy());

function showQr() { handle?.showQR(); }
</script>
```

## Полный API

### `window.QRRemote.init(opts?): Promise<QRRemoteHandle>`

| Поле `opts` | Тип | По умолчанию | Что делает |
|---|---|---|---|
| `baseUrl` | string | `window.location.origin` | URL брокера (если host-страница на другом домене) |
| `pollMinMs` | number | `1000` | минимальный интервал poll (мс), clamp 250..300000 |
| `pollMaxMs` | number | `max(10000, pollMinMs)` | верх backoff при ошибках сети (должен быть ≥ `pollMinMs`) |
| `registryFlushMs` | number | `200` | debounce flush реестра после register/unregister (0..60000) |
| `persistSession` | `'tab' \| 'origin' \| 'none'` | `'tab'` | где кэшировать `session_id`: `'tab'` — `sessionStorage` (изоляция по вкладке), `'origin'` — `localStorage`, `'none'` — всегда новая сессия |
| `onMessage` | `(msg: HostMessage) => void \| Promise<void>` | — | колбэк для безадресных команд (SHOW_MSG/ALERT/PLAY_SOUND), не привязанных к элементу; может быть async — ожидается перед обработкой следующей команды |

### `QRRemoteHandle`

```ts
{
  register(id: string, descriptor: RegistryDescriptor): void;
  unregister(id: string): void;
  showQR(target?: HTMLElement): void;   // fixed-position, либо внутрь target
  hideQR(): void;
  destroy(): void;                       // stop poller, drop overlay
  readonly sessionId: string;
}
```

### `RegistryDescriptor`

```ts
{
  kind: 'button' | 'input' | 'select' | 'toggle' | 'slider';
  label: string;          // показывается на мобильном пульте
  group?: string;         // группа для группировки виджетов
  options?: string[];     // обязательно для kind: 'select'
  min?: number;           // обязательно для kind: 'slider'
  max?: number;           // обязательно для kind: 'slider'
  step?: number;          // опционально для kind: 'slider'
  onAction(value?: string | number | boolean): void | Promise<void>;
}
```

`onAction` получает:
- `undefined` для kind: `button`
- `string` для kind: `input` или `select`
- `boolean` для kind: `toggle`
- `number` для kind: `slider`

### `HostMessage` (колбэк `onMessage`)

Безадресные команды доставляются в `onMessage(msg)`:

```ts
type HostMessage =
  | { type: 'SHOW_MSG';   text: string }
  | { type: 'ALERT';      level: string; text: string }
  | { type: 'PLAY_SOUND'; sound: string };
```

```ts
QRRemote.init({
  onMessage: (m) => {
    if (m.type === 'SHOW_MSG') showToast(m.text);
  },
});
```

Исключение, брошенное внутри `onMessage`, перехватывается и логируется через `console.warn` — poll-цикл не падает.

## Жизненный цикл сессии

1. `init()` → `POST /api/session` → `sessionId` кэшируется (по умолчанию `sessionStorage`, ключ `qrremote.session.<origin>`; режим задаётся опцией `persistSession`).
2. Каждый `register/unregister` → debounced (200 мс) `PUT /api/registry/{sid}` со снимком всех текущих элементов и инкрементной `version`.
3. Каждую секунду → `GET /api/poll?session_id=…` забирает очередную партию команд.
4. На каждой команде → внутренний parser → `descriptor.onAction(arg)`.
5. Сервер удаляет сессию по TTL (по умолчанию 30 мин неактивности) → 404 на poll → embed-библиотека очищает кэш и переинициализируется.

## Сетевые требования

Мобильный пульт открывается по URL вида `http://<LAN-IP>:<port>/mobile/?sid=...`. Это значит:

- Брокер должен быть доступен из той же LAN, где находится телефон.
- Если брокер за NAT'ом (docker bridge, k8s), укажите `PUBLIC_HOST=<видимый-извне-IP>` в env переменных сервера.
- HTTPS не обязателен для прототипа, но для production-сценариев на iOS Safari потребует валидный сертификат (иначе fetch будет блокироваться mixed-content политикой, если host-страница на https).

## Troubleshooting

**`onAction` не срабатывает.**
1. Проверьте Network в DevTools: успешно ли `PUT /api/registry/{sid}` идёт после `register(...)`?
2. Проверьте, что `id` в `register` совпадает с тем, который рендерится на мобильном пульте (`data-testid="widget-<id>"`).
3. Проверьте, не упал ли poll loop (Console: `[qr-remote] poll failed`). 404 = сессия истекла, нужен новый QR.

**Мобильный пульт показывает «Сессия истекла».**
- TTL по умолчанию 30 мин неактивности. Перезагрузите host-страницу — она создаст новую сессию и сгенерирует новый QR-код.

**QR-код есть, но на телефоне `ERR_CONNECTION_REFUSED`.**
- `/api/server-ip` отдаёт LAN-IP, который недостижим с телефона (Wi-Fi другой подсети, фаервол хоста). Переопределите через `PUBLIC_HOST=<IP, видимый с телефона>` в env сервера.

**`onAction` вызывается со старым React state.**
- Используйте [useRegister](frontend/desktop/src/useQRRemote.ts) — он проксирует `onAction` через ref на свежую функцию.

**Команды не валидируются на сервере (получаем 400).**
- Сверьтесь с whitelist'ом из [server/Validation/CommandValidator.cs](server/Validation/CommandValidator.cs): `id` должен матчиться `^[a-zA-Z0-9_\-:.]{1,64}$`, лимиты по value см. в README.
