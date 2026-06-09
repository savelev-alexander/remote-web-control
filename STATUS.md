# STATUS

State of QR-Embed Remote subsystems.

## Components

- **Broker server** ([server/](server/)): .NET 8 AOT, ~12 MB binary.
  `SessionStore` (TTL + LRU + injectable `IClock`), `RegistryStore`
  (per-session snapshots), `CommandValidator` (whitelist DSL).
- **API**: `/session`, `/execute`, `/poll`, `/registry/{sid}`
  (PUT/GET/DELETE), `/server-ip`, `/health`, `/ready`.
- **Embed library** ([frontend/embed/](frontend/embed/)): vanilla TS,
  ~12 KB gzip IIFE / ~14 KB gzip ESM. No framework lock-in.
- **Desktop showcase** ([frontend/desktop/](frontend/desktop/)):
  reference host page demonstrating the library with 12 registered
  elements via a `useRegister` React hook.
- **Mobile remote** ([frontend/mobile/](frontend/mobile/)):
  auto-generated from the registry. Five widgets
  (Button/Input/Select/Toggle/Slider), versioned polling, grouped UI.
- **Tests**: xUnit 65, vitest embed 52 + desktop 4 + mobile 24,
  Playwright e2e 3. 148 specs total, all green.
- **Build**: [scripts/build-all.sh](scripts/build-all.sh) builds all
  three frontends and AOT-publishes the server.
  [scripts/test-all.sh](scripts/test-all.sh) runs every test suite.
- **Docker**: multi-stage Dockerfile, no external sidecars.
- **CI**: [.github/workflows/ci.yml](.github/workflows/ci.yml) runs
  server / embed / frontend / e2e jobs.

## Known limitations

- **In-memory state**: a server restart wipes every session and
  registry. Production deployments need an external store (Redis, DB).
- **Permissive CORS**: `AllowAnyOrigin()` is fine for LAN demos, not
  for the public internet.
- **Polling, not push**: 1 Hz polling trades latency for battery life
  and connection robustness. A WebSocket transport would be tighter.
- **Stale-QR rescan**: if the server forgets a session (TTL), the
  phone shows "Session expired. Rescan QR" until the desktop publishes
  a fresh code.

