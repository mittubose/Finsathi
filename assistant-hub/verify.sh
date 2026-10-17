#!/usr/bin/env bash
# ==============================================================================
# AI Assistant & SaaS Hub: Verification & Health Check Script
# Works on Linux (any distro), macOS, and Windows (WSL)
# ==============================================================================

set -u

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}       AI Assistant Hub: Service Verification        ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Helper function to check TCP port
check_port() {
  local port=$1
  local name=$2
  
  if command -v nc &>/dev/null; then
    if nc -z 127.0.0.1 "$port" 2>/dev/null; then
      echo -e "  [${GREEN}ONLINE${NC}] $name (Port $port)"
      return 0
    fi
  elif (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
    echo -e "  [${GREEN}ONLINE${NC}] $name (Port $port)"
    return 0
  fi
  echo -e "  [${RED}OFFLINE${NC}] $name (Port $port)"
  return 1
}

echo -e "\n${YELLOW}1. Checking Port Bindings:${NC}"
check_port 11434 "Ollama Local Engine"
check_port 8080  "Open WebUI (ChatGPT UI & RAG)"
check_port 5678  "n8n Automation Engine"
check_port 5230  "Memos Note Capture"

echo -e "\n${YELLOW}2. Checking Docker to Host Bridge:${NC}"
if command -v docker &>/dev/null && docker info &>/dev/null; then
  BRIDGE_TEST=$(docker run --rm --add-host=host.docker.internal:host-gateway curlimages/curl:latest -s --connect-timeout 5 http://host.docker.internal:11434/api/tags 2>/dev/null || echo "FAILED")
  if [[ "$BRIDGE_TEST" == *"models"* ]]; then
    echo -e "  [${GREEN}PASSED${NC}] Docker containers can communicate with Ollama on host."
  else
    echo -e "  [${RED}FAILED${NC}] Containers cannot reach Ollama at http://host.docker.internal:11434"
    echo -e "           Ensure Ollama is listening on 0.0.0.0:11434 (not 127.0.0.1)."
  fi
else
  echo -e "  [${YELLOW}SKIPPED${NC}] Docker daemon not running or not accessible."
fi

echo -e "\n${YELLOW}3. Testing Inference Speed (llama3.2:3b):${NC}"
if curl -s --connect-timeout 3 http://127.0.0.1:11434/api/tags &>/dev/null; then
  START_TIME=$(date +%s%N 2>/dev/null || date +%s)
  RES=$(curl -s --connect-timeout 10 http://127.0.0.1:11434/api/generate -d '{
    "model": "llama3.2:3b",
    "prompt": "Respond with single word: OK",
    "stream": false
  }' 2>/dev/null || true)
  END_TIME=$(date +%s%N 2>/dev/null || date +%s)
  
  if [[ -n "$RES" ]] && [[ "$RES" == *"response"* ]]; then
    CLEAN_RES=$(echo "$RES" | grep -o '"response":[^,]*' | cut -d':' -f2 | tr -d '"')
    echo -e "  [${GREEN}SUCCESS${NC}] Model responded: ${CLEAN_RES}"
  else
    echo -e "  [${YELLOW}WARNING${NC}] llama3.2:3b did not respond or is not pulled yet."
  fi
else
  echo -e "  [${RED}OFFLINE${NC}] Ollama is not responding on http://127.0.0.1:11434"
fi

echo -e "\n${YELLOW}4. Resource Utilization & Swap:${NC}"
if command -v free &>/dev/null; then
  free -h
elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Memory Pressure on macOS:"
  memory_pressure -Q || true
fi

echo -e "\n${YELLOW}5. Remote Mesh Access (Tailscale):${NC}"
if command -v tailscale &>/dev/null; then
  TS_STATUS=$(tailscale status 2>/dev/null || echo "Not logged in")
  echo "  Tailscale Status: $TS_STATUS"
else
  echo -e "  [${YELLOW}NOT INSTALLED${NC}] Tailscale is not installed yet."
fi

echo -e "\n${BLUE}=====================================================${NC}"
echo -e "${BLUE}                 Check Complete                      ${NC}"
echo -e "${BLUE}=====================================================${NC}"
