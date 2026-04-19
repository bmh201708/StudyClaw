#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"

SSH_HOST="${VIRGINIA_SSH_HOST:-Virginia}"
SSH_PASSWORD="${VIRGINIA_PASSWORD:-}"

LOCAL_DB_PORT="${LOCAL_DB_PORT:-55433}"
REMOTE_DB_HOST="${REMOTE_DB_HOST:-127.0.0.1}"
REMOTE_DB_PORT="${REMOTE_DB_PORT:-55432}"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

DB_URL="postgresql://studyclaw:change-me@127.0.0.1:${LOCAL_DB_PORT}/studyclaw"

TUNNEL_LOG="${TMPDIR:-/tmp}/studyclaw-virginia-tunnel.log"
BACKEND_LOG="${TMPDIR:-/tmp}/studyclaw-local-backend.log"

tunnel_pid=""
backend_pid=""
frontend_pid=""

cleanup() {
  local exit_code=$?
  if [[ -n "${frontend_pid}" ]] && kill -0 "${frontend_pid}" 2>/dev/null; then
    kill "${frontend_pid}" 2>/dev/null || true
  fi
  if [[ -n "${backend_pid}" ]] && kill -0 "${backend_pid}" 2>/dev/null; then
    kill "${backend_pid}" 2>/dev/null || true
  fi
  if [[ -n "${tunnel_pid}" ]] && kill -0 "${tunnel_pid}" 2>/dev/null; then
    kill "${tunnel_pid}" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

wait_for_port() {
  local port="$1"
  local attempts="${2:-30}"
  local delay="${3:-1}"
  local i
  for ((i = 0; i < attempts; i += 1)); do
    if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-30}"
  local delay="${3:-1}"
  local i
  for ((i = 0; i < attempts; i += 1)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

prompt_password() {
  if [[ -n "${SSH_PASSWORD}" ]]; then
    return 0
  fi

  printf 'Virginia SSH password: ' >&2
  stty -echo
  read -r SSH_PASSWORD
  stty echo
  printf '\n' >&2

  if [[ -z "${SSH_PASSWORD}" ]]; then
    echo "Password is required." >&2
    exit 1
  fi
}

require_cmd expect
require_cmd npm
require_cmd node
require_cmd curl
require_cmd lsof

if lsof -nP -iTCP:"${LOCAL_DB_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Local DB port ${LOCAL_DB_PORT} is already in use." >&2
  exit 1
fi

prompt_password

echo "Starting Virginia PostgreSQL tunnel on 127.0.0.1:${LOCAL_DB_PORT}..."
expect <<EOF >"${TUNNEL_LOG}" 2>&1 &
set timeout -1
spawn ssh -o ExitOnForwardFailure=yes -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -N -L ${LOCAL_DB_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT} ${SSH_HOST}
expect {
  -re ".*assword:" {send "${SSH_PASSWORD}\r"; exp_continue}
  eof
}
EOF
tunnel_pid=$!

if ! wait_for_port "${LOCAL_DB_PORT}" 20 1; then
  echo "Tunnel failed to start. See ${TUNNEL_LOG}" >&2
  exit 1
fi

echo "Building backend..."
(cd "${SERVER_DIR}" && npm run build >/dev/null)

echo "Starting backend on ${BACKEND_HOST}:${BACKEND_PORT}..."
(
  cd "${SERVER_DIR}"
  DATABASE_URL="${DB_URL}" \
  HOST="${BACKEND_HOST}" \
  PORT="${BACKEND_PORT}" \
  node --env-file=.env dist/index.js
) >"${BACKEND_LOG}" 2>&1 &
backend_pid=$!

if ! wait_for_http "http://${BACKEND_HOST}:${BACKEND_PORT}/health" 30 1; then
  echo "Backend failed to start. See ${BACKEND_LOG}" >&2
  exit 1
fi

echo "Starting frontend on ${FRONTEND_HOST}:${FRONTEND_PORT}..."
(
  cd "${ROOT_DIR}"
  VITE_DEV_API_PROXY="http://${BACKEND_HOST}:${BACKEND_PORT}" \
  npm run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}"
) &
frontend_pid=$!

echo "StudyClaw local dev is ready:"
echo "  Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}/"
echo "  Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}/health"
echo "  Database: Virginia PostgreSQL via ssh tunnel on 127.0.0.1:${LOCAL_DB_PORT}"
echo
echo "Press Ctrl+C to stop tunnel, backend, and frontend."

wait "${frontend_pid}"
