# syntax=docker/dockerfile:1

# ─── Этап 1: Frontend (embed + mobile + desktop) ─────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /src

# Сначала ставим зависимости — package.json единственный вход для максимального кеширования слоёв.
COPY frontend/embed/package*.json   ./frontend/embed/
COPY frontend/desktop/package*.json ./frontend/desktop/
COPY frontend/mobile/package*.json  ./frontend/mobile/

RUN cd frontend/embed   && npm ci \
 && cd /src/frontend/desktop && npm ci \
 && cd /src/frontend/mobile  && npm ci

# Shared-код и исходники копируем ПОСЛЕ npm ci — правки кода не инвалидируют слой зависимостей.
COPY frontend/shared/  ./frontend/shared/
COPY frontend/embed/   ./frontend/embed/
COPY frontend/desktop/ ./frontend/desktop/
COPY frontend/mobile/  ./frontend/mobile/

# Vite пишет результат в ../../server/wwwroot/{embed,desktop,mobile} (см. vite.config.ts).
# Embed сначала — desktop/index.html ссылается на /embed/qr-remote.js во время билда.
RUN mkdir -p server/wwwroot \
 && cd frontend/embed   && npm run build \
 && cd /src/frontend/desktop && npm run build \
 && cd /src/frontend/mobile  && npm run build

# ─── Этап 2: Server (AOT) ────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim AS server-build

# .NET AOT на Linux требует clang и dev-заголовки zlib для линковки.
RUN apt-get update \
 && apt-get install -y --no-install-recommends clang zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Сначала restore — отдельный слой, инвалидируется только при изменении csproj.
COPY server/RemoteWebControlServer.csproj ./server/
RUN dotnet restore server/RemoteWebControlServer.csproj -r linux-x64

COPY server/ ./server/
COPY --from=frontend-build /src/server/wwwroot/ ./server/wwwroot/

RUN dotnet publish server/RemoteWebControlServer.csproj \
    -c Release \
    -r linux-x64 \
    --no-restore \
    --self-contained true \
    -p:PublishAot=true \
    -p:StripSymbols=true \
    -o /app

# ─── Этап 3: Runtime ─────────────────────────────────────────────────────────
# AOT-бинарь линкуется только с glibc (libc + libm) — bookworm-slim содержит и то и другое.
# curl ставится исключительно ради HEALTHCHECK (~2.5 МБ).
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid 1001 --no-create-home app

WORKDIR /app
COPY --from=server-build --chown=app:app /app/ .

USER app

ENV PORT=8080 \
    SESSION_TTL_MINUTES=30 \
    MAX_SESSIONS=500

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["./remote-web-control-server"]
