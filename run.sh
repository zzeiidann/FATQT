#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$ROOT_DIR/venv"

if [ -d "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/python3" ]; then
  echo "Using Python virtual environment..."
  PYTHON_BIN="$VENV_DIR/bin/python3"
else
  PYTHON_BIN="${PYTHON:-python3}"
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  printf '\nShutting down services...\n'
  if [ -n "$FRONTEND_PID" ] && ps -p "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$BACKEND_PID" ] && ps -p "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Error: python3 not found. Set the PYTHON env var to a valid interpreter." >&2
  exit 1
fi

if [ ! -f "$BACKEND_DIR/main.py" ]; then
  echo "Error: backend/main.py not found." >&2
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/package.json" ]; then
  echo "Error: frontend/package.json not found." >&2
  exit 1
fi

( cd "$BACKEND_DIR" && "$PYTHON_BIN" main.py ) &
BACKEND_PID=$!
echo "Backend running (PID $BACKEND_PID)"

cd "$FRONTEND_DIR"
if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

echo "Starting frontend dev server..."
npm run dev &
FRONTEND_PID=$!

wait "$FRONTEND_PID"
