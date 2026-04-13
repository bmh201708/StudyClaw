#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_step() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_commands() {
  local missing=0
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      printf 'Missing required command: %s\n' "$cmd" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

load_deploy_env() {
  local env_file="${DEPLOY_ENV_FILE:-$ROOT_DIR/.deploy.env}"
  if [[ ! -f "$env_file" ]]; then
    printf 'Missing deploy config: %s\n' "$env_file" >&2
    printf 'Create it from %s\n' "$ROOT_DIR/.deploy.env.example" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  : "${DEPLOY_HOST:?DEPLOY_HOST is required}"
  : "${DEPLOY_USER:?DEPLOY_USER is required}"
  : "${DEPLOY_PORT:?DEPLOY_PORT is required}"
  : "${DEPLOY_PASSWORD:?DEPLOY_PASSWORD is required}"

  export DEPLOY_HOST DEPLOY_USER DEPLOY_PORT DEPLOY_PASSWORD
  export BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
  export BACKEND_REMOTE_DIR="${BACKEND_REMOTE_DIR:-/opt/studyclaw-backend}"
  export BACKEND_COMPOSE_PROJECT="${BACKEND_COMPOSE_PROJECT:-studyclaw}"
  export BACKEND_API_PORT="${BACKEND_API_PORT:-38101}"
  export FRONTEND_REMOTE_DIR="${FRONTEND_REMOTE_DIR:-/opt/studyclaw-frontend}"
  export FRONTEND_PORT="${FRONTEND_PORT:-38180}"
  export NGINX_INCLUDE_FILE="${NGINX_INCLUDE_FILE:-/www/server/panel/vhost/nginx/111.229.204.242.studyclaw.inc}"
  export FRONTEND_LOCATION_PREFIX="${FRONTEND_LOCATION_PREFIX:-/studyclaw}"
  export API_LOCATION_PREFIX="${API_LOCATION_PREFIX:-/studyclaw-api}"
}

upload_file() {
  local local_path="$1"
  local remote_path="$2"

  env \
    DEPLOY_HOST="$DEPLOY_HOST" \
    DEPLOY_USER="$DEPLOY_USER" \
    DEPLOY_PORT="$DEPLOY_PORT" \
    DEPLOY_PASSWORD="$DEPLOY_PASSWORD" \
    LOCAL_PATH="$local_path" \
    REMOTE_PATH="$remote_path" \
    expect <<'EOF'
set timeout -1
spawn scp -O -o StrictHostKeyChecking=no -P $env(DEPLOY_PORT) $env(LOCAL_PATH) "$env(DEPLOY_USER)@$env(DEPLOY_HOST):$env(REMOTE_PATH)"
expect {
  "*password:*" { send -- "$env(DEPLOY_PASSWORD)\r" }
}
expect eof
EOF
}

run_remote_script() {
  local script="$1"
  local encoded
  encoded="$(printf '%s' "$script" | base64 | tr -d '\n')"

  env \
    DEPLOY_HOST="$DEPLOY_HOST" \
    DEPLOY_USER="$DEPLOY_USER" \
    DEPLOY_PORT="$DEPLOY_PORT" \
    DEPLOY_PASSWORD="$DEPLOY_PASSWORD" \
    REMOTE_SCRIPT_B64="$encoded" \
    expect <<'EOF'
set timeout -1
spawn ssh -o StrictHostKeyChecking=no -p $env(DEPLOY_PORT) "$env(DEPLOY_USER)@$env(DEPLOY_HOST)" "echo '$env(REMOTE_SCRIPT_B64)' | base64 -d | bash"
expect {
  "*password:*" { send -- "$env(DEPLOY_PASSWORD)\r" }
}
expect eof
EOF
}
