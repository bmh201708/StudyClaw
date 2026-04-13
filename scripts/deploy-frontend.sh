#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-common.sh"

load_deploy_env
require_commands tar expect base64

TMP_DIR="$(mktemp -d -t studyclaw-frontend)"
ARCHIVE_PATH="$TMP_DIR/studyclaw-frontend.tgz"
REMOTE_ARCHIVE="/opt/studyclaw-frontend-deploy.tgz"
trap 'rm -rf "$TMP_DIR"' EXIT

print_step "Packing frontend"
tar -C "$ROOT_DIR" -czf "$ARCHIVE_PATH" \
  .dockerignore \
  .env.production \
  Dockerfile.frontend \
  docker-compose.frontend.yml \
  nginx.frontend.conf \
  index.html \
  package.json \
  package-lock.json \
  vite.config.ts \
  src

print_step "Uploading frontend archive"
upload_file "$ARCHIVE_PATH" "$REMOTE_ARCHIVE"

print_step "Deploying frontend on server"
remote_script="$(cat <<EOF
set -euo pipefail
TS=\$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR" "$FRONTEND_REMOTE_DIR"
if [ "\$(ls -A "$FRONTEND_REMOTE_DIR" 2>/dev/null || true)" ]; then
  tar -C "$(dirname "$FRONTEND_REMOTE_DIR")" -czf "$BACKUP_DIR/studyclaw-frontend-\$TS.tgz" "$(basename "$FRONTEND_REMOTE_DIR")"
fi
cd "$FRONTEND_REMOTE_DIR"
find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf "$REMOTE_ARCHIVE" -C "$FRONTEND_REMOTE_DIR"
docker compose -f docker-compose.frontend.yml up -d --build
cat > "$NGINX_INCLUDE_FILE" <<'NGINX'
location = $FRONTEND_LOCATION_PREFIX {
    return 301 $FRONTEND_LOCATION_PREFIX/;
}

location ^~ $FRONTEND_LOCATION_PREFIX/ {
    proxy_pass http://127.0.0.1:$FRONTEND_PORT/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}

location = $API_LOCATION_PREFIX {
    return 301 $API_LOCATION_PREFIX/;
}

location ^~ $API_LOCATION_PREFIX/ {
    proxy_pass http://127.0.0.1:$BACKEND_API_PORT/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
NGINX
nginx -t
nginx -s reload
curl -fsS "http://127.0.0.1:$FRONTEND_PORT/health"
rm -f "$REMOTE_ARCHIVE"
EOF
)"
run_remote_script "$remote_script"

print_step "Frontend deploy complete"
