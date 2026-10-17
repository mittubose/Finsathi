#!/usr/bin/env bash
# FinSathi — Personal Laptop Host Launcher
# Runs the local MCP / Sync Daemon (port 3001) and Vite Frontend (port 5173, host 0.0.0.0)

set -e

PORT_SERVER=3001
PORT_CLIENT=5173

echo "========================================================"
echo "  ⚡ FINSATHI FINANCIAL OS — PERSONAL HOSTING LAUNCHER"
echo "========================================================"
echo "[1/2] Starting local MCP Sync Server on port $PORT_SERVER..."
node server/mcp-server.mjs &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Shutting down FinSathi background processes..."
  kill $SERVER_PID 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

echo "[2/2] Launching Vite Frontend on 0.0.0.0:$PORT_CLIENT..."
echo "Access from this laptop: http://localhost:5173"
echo "Access from mobile phone: http://<laptop-lan-ip>:5173"
echo "Press Ctrl+C to terminate all services."
echo "--------------------------------------------------------"

npm run host
