#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  APP_NAME: "driver-app",
  API_BASE_URL: "${API_BASE_URL:-http://localhost:3000}",
  WS_BASE_URL: "${WS_BASE_URL:-ws://localhost:3000}"
};
EOF
