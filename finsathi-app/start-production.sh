#!/usr/bin/env bash
# FinSathi — One-Command Production Launcher
# Builds production SPA assets and starts the unified Node server on port 3001

set -e

echo "========================================================"
echo "  ⚡ FINSATHI FINANCIAL OS — PRODUCTION HOST LAUNCHER"
echo "========================================================"

echo "[1/2] Compiling production assets with Vite..."
npm run build

echo ""
echo "[2/2] Launching unified production server on port 3001..."
echo "Access from laptop: http://localhost:3001"
echo "Access from mobile: http://$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<laptop-ip>'):3001"
echo "Features: Full Web App + MCP Tools + Error Logging + Cron Diagnostics"
echo "Press Ctrl+C to terminate."
echo "--------------------------------------------------------"

PORT=3001 node server/mcp-server.mjs
