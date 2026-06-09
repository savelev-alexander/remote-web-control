#!/usr/bin/env bash
# Генерирует placeholder-иконки для PWA через ImageMagick.
# Запускать на TEST-машине: ./scripts/generate-icons.sh
set -e

if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed. Install: sudo apt install imagemagick"
    exit 1
fi

# Mobile
convert -size 512x512 -background "#0f3460" -fill "#e94560" \
  -gravity center -pointsize 220 label:"CB" \
  frontend/mobile/public/icon-512.png
convert frontend/mobile/public/icon-512.png -resize 192x192 \
  frontend/mobile/public/icon-192.png

# Desktop
mkdir -p frontend/desktop/public
convert -size 512x512 -background "#0a0e27" -fill "#e94560" \
  -gravity center -pointsize 200 label:"CB Desk" \
  frontend/desktop/public/icon-512.png
convert frontend/desktop/public/icon-512.png -resize 192x192 \
  frontend/desktop/public/icon-192.png

echo "Icons generated."
