#!/usr/bin/env bash
# ==============================================================================
# Universal AI Assistant & SaaS Hub: Cross-Platform Auditor & Installer
# Compatible with: Linux (Ubuntu/Debian, Fedora, Arch, SUSE), macOS, Windows (WSL)
# ==============================================================================

set -uo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_ONLY=false
AUTO_YES=false

# Parse command line flags
for arg in "$@"; do
  case $arg in
    --check-only|-c)
      CHECK_ONLY=true
      ;;
    -y|--yes)
      AUTO_YES=true
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --check-only, -c    Run all audits and hardware checks without installing anything."
      echo "  --yes, -y           Non-interactive installation (accept all prompts)."
      echo "  --help, -h          Show this help message."
      exit 0
      ;;
  esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Universal AI Assistant & SaaS Hub Orchestrator            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"

# ------------------------------------------------------------------------------
# 1. OS & Platform Detection
# ------------------------------------------------------------------------------
PLATFORM="unknown"
DISTRO="unknown"
PKG_MGR="unknown"
IS_LAPTOP=false

detect_system() {
  UNAME_S="$(uname -s)"
  case "$UNAME_S" in
    Linux*)
      PLATFORM="linux"
      if grep -qi microsoft /proc/version 2>/dev/null; then
        DISTRO="wsl"
      elif [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO="${ID:-linux}"
      fi

      if command -v apt-get &>/dev/null; then
        PKG_MGR="apt"
      elif command -v dnf &>/dev/null; then
        PKG_MGR="dnf"
      elif command -v pacman &>/dev/null; then
        PKG_MGR="pacman"
      elif command -v zypper &>/dev/null; then
        PKG_MGR="zypper"
      fi

      # Check if device is a laptop (battery detected)
      if [ -d "/sys/class/power_supply" ] && ls /sys/class/power_supply/BAT* &>/dev/null; then
        IS_LAPTOP=true
      fi
      ;;
    Darwin*)
      PLATFORM="macos"
      DISTRO="macos"
      if command -v brew &>/dev/null; then
        PKG_MGR="brew"
      fi
      # macOS laptop detection
      if system_profiler SPPowerDataType 2>/dev/null | grep -qi "battery"; then
        IS_LAPTOP=true
      fi
      ;;
    CYGWIN*|MINGW*|MSYS*)
      PLATFORM="windows"
      DISTRO="windows_native"
      ;;
  esac
}

detect_system

echo -e "\n${BOLD}${CYAN}▶ System Environment Detected:${NC}"
echo -e "  • Platform:   ${BOLD}${PLATFORM}${NC} (${DISTRO})"
echo -e "  • Package Mgr:${BOLD}${PKG_MGR}${NC}"
echo -e "  • Form Factor:${BOLD}$([ "$IS_LAPTOP" = true ] && echo "Laptop (Battery Detected)" || echo "Desktop / Server")${NC}"

# ------------------------------------------------------------------------------
# 2. Hardware Auditing & Resource Budget Checks
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}▶ Auditing Hardware & System Resources:${NC}"

# CPU check
CPU_CORES=1
CPU_ARCH="$(uname -m)"
AVX2_SUPPORT=false

if [ "$PLATFORM" = "macos" ]; then
  CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 1)
  if [[ "$CPU_ARCH" == "arm64" ]]; then
    AVX2_SUPPORT=true # Apple Silicon uses ARM NEON which Ollama fully accelerates
  else
    AVX2_SUPPORT=$(sysctl -n hw.optional.avx2_0 2>/dev/null || echo 0)
    [ "$AVX2_SUPPORT" -eq 1 ] && AVX2_SUPPORT=true || AVX2_SUPPORT=false
  fi
elif [ "$PLATFORM" = "linux" ]; then
  CPU_CORES=$(nproc 2>/dev/null || echo 1)
  if grep -qi avx2 /proc/cpuinfo 2>/dev/null; then
    AVX2_SUPPORT=true
  elif [[ "$CPU_ARCH" == "aarch64" ]]; then
    AVX2_SUPPORT=true
  fi
fi

if [ "$AVX2_SUPPORT" = true ]; then
  echo -e "  • CPU Cores:  ${GREEN}${CPU_CORES} cores (${CPU_ARCH}) - Vector acceleration (AVX2/NEON) supported${NC}"
else
  echo -e "  • CPU Cores:  ${YELLOW}${CPU_CORES} cores (${CPU_ARCH}) - AVX2 not detected. Inference will be slower.${NC}"
fi

# RAM check
TOTAL_RAM_MB=0
if [ "$PLATFORM" = "macos" ]; then
  TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
  TOTAL_RAM_MB=$(( TOTAL_RAM_BYTES / 1024 / 1024 ))
elif [ "$PLATFORM" = "linux" ]; then
  TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
  TOTAL_RAM_MB=$(( TOTAL_RAM_KB / 1024 ))
fi

TOTAL_RAM_GB=$(awk "BEGIN {printf \"%.1f\", $TOTAL_RAM_MB/1024}")

if [ "$TOTAL_RAM_MB" -ge 7500 ]; then
  echo -e "  • Memory:     ${GREEN}${TOTAL_RAM_GB} GB RAM - Optimal for 3B models & Docker stack${NC}"
elif [ "$TOTAL_RAM_MB" -ge 4000 ]; then
  echo -e "  • Memory:     ${YELLOW}${TOTAL_RAM_GB} GB RAM - Tight buffer. ZRAM or Swap is mandatory.${NC}"
else
  echo -e "  • Memory:     ${RED}${TOTAL_RAM_GB} GB RAM - Insufficient memory. Minimum 4GB+ recommended.${NC}"
fi

# Disk space check (need at least 15 GB free)
FREE_DISK_GB=0
if command -v df &>/dev/null; then
  FREE_DISK_KB=$(df -k "$SCRIPT_DIR" | tail -1 | awk '{print $4}')
  FREE_DISK_GB=$(( FREE_DISK_KB / 1024 / 1024 ))
fi

if [ "$FREE_DISK_GB" -ge 15 ]; then
  echo -e "  • Disk Space: ${GREEN}${FREE_DISK_GB} GB Available (>= 15GB required)${NC}"
else
  echo -e "  • Disk Space: ${RED}${FREE_DISK_GB} GB Available (Warning: Docker images + LLMs need ~15GB)${NC}"
fi

# ------------------------------------------------------------------------------
# 3. Server Power & Sleep Audit (Linux Laptops)
# ------------------------------------------------------------------------------
LID_CHECK="N/A"
WIFI_POWERSAVE_CHECK="N/A"

if [ "$PLATFORM" = "linux" ] && [ "$IS_LAPTOP" = true ]; then
  echo -e "\n${BOLD}${CYAN}▶ Laptop 24/7 Server Readiness Check:${NC}"
  
  if [ -f /etc/systemd/logind.conf ]; then
    if grep -E "^HandleLidSwitch=(ignore|lock)" /etc/systemd/logind.conf* /etc/systemd/logind.conf.d/* 2>/dev/null | grep -q "ignore"; then
      LID_CHECK="Configured (will not sleep on lid close)"
      echo -e "  • Lid Switch:   ${GREEN}${LID_CHECK}${NC}"
    else
      LID_CHECK="Unconfigured (Laptop will sleep when closed!)"
      echo -e "  • Lid Switch:   ${RED}${LID_CHECK}${NC}"
    fi
  fi

  if [ -d /etc/NetworkManager/conf.d ]; then
    if grep -rq "wifi.powersave = 2" /etc/NetworkManager/conf.d/ 2>/dev/null; then
      WIFI_POWERSAVE_CHECK="Disabled (Stable 24/7 connectivity)"
      echo -e "  • Wi-Fi Sleep:  ${GREEN}${WIFI_POWERSAVE_CHECK}${NC}"
    else
      WIFI_POWERSAVE_CHECK="Enabled (Wi-Fi may drop out when idle)"
      echo -e "  • Wi-Fi Sleep:  ${YELLOW}${WIFI_POWERSAVE_CHECK}${NC}"
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 4. Software Dependencies Audit
# ------------------------------------------------------------------------------
echo -e "\n${BOLD}${CYAN}▶ Software Dependency Audit:${NC}"

check_tool() {
  local tool=$1
  local friendly_name=$2
  if command -v "$tool" &>/dev/null; then
    echo -e "  • $friendly_name: ${GREEN}Installed ($(command -v "$tool"))${NC}"
    return 0
  else
    echo -e "  • $friendly_name: ${RED}Missing${NC}"
    return 1
  fi
}

check_tool curl "cURL" || true
check_tool jq "jq (JSON parser)" || true
check_tool docker "Docker Engine" || true
check_tool ollama "Ollama AI Engine" || true
check_tool tailscale "Tailscale Mesh VPN" || true

# Docker Daemon check
DOCKER_RUNNING=false
if command -v docker &>/dev/null; then
  if docker info &>/dev/null; then
    DOCKER_RUNNING=true
    echo -e "  • Docker Status:${GREEN} Running${NC}"
  else
    echo -e "  • Docker Status:${RED} Daemon not running${NC}"
  fi
fi

# If check-only flag is set, stop here and display report
if [ "$CHECK_ONLY" = true ]; then
  echo -e "\n${BLUE}=====================================================${NC}"
  echo -e "${GREEN} Audit Complete (--check-only mode). No changes made.${NC}"
  echo -e "${BLUE}=====================================================${NC}"
  exit 0
fi

# ------------------------------------------------------------------------------
# 5. User Confirmation Before Installation
# ------------------------------------------------------------------------------
if [ "$AUTO_YES" = false ]; then
  echo -e "\n${BOLD}${YELLOW}Would you like to install missing dependencies and launch the stack? [y/N]:${NC} "
  read -r response
  if [[ ! "$response" =~ ^[yY](es)?$ ]]; then
    echo -e "\n${YELLOW}Installation cancelled by user.${NC}"
    exit 0
  fi
fi

echo -e "\n${BLUE}=====================================================${NC}"
echo -e "${BLUE}          Beginning Automated Installation           ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Elevate privileges if Linux
SUDO=""
if [ "$PLATFORM" = "linux" ] && [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
fi

# ------------------------------------------------------------------------------
# 6. Apply Linux Server Hardening (Lid Switch, Wi-Fi, ZRAM)
# ------------------------------------------------------------------------------
if [ "$PLATFORM" = "linux" ]; then
  echo -e "\n${CYAN}[Step 1/6] Hardening Linux Server Settings...${NC}"

  # Fix Lid Switch on Laptops
  if [ "$IS_LAPTOP" = true ]; then
    echo "  -> Configuring systemd to ignore lid close..."
    $SUDO mkdir -p /etc/systemd/logind.conf.d/
    cat <<EOF | $SUDO tee /etc/systemd/logind.conf.d/disable-suspend.conf >/dev/null
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
    $SUDO systemctl restart systemd-logind 2>/dev/null || true

    # Fix Wi-Fi power saving
    if [ -d "/etc/NetworkManager/conf.d" ]; then
      echo "  -> Disabling Wi-Fi power saving..."
      cat <<EOF | $SUDO tee /etc/NetworkManager/conf.d/default-wifi-powersave-on.conf >/dev/null
[connection]
wifi.powersave = 2
EOF
      $SUDO systemctl restart NetworkManager 2>/dev/null || true
    fi
  fi

  # Enable ZRAM on Debian/Ubuntu
  if [ "$PKG_MGR" = "apt" ]; then
    echo "  -> Installing zram-tools to prevent Out-Of-Memory crashes..."
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq zram-tools jq net-tools curl ufw >/dev/null
    cat <<EOF | $SUDO tee /etc/default/zramswap >/dev/null
ALGO=zstd
PERCENT=50
PRIORITY=100
EOF
    $SUDO systemctl restart zramswap 2>/dev/null || true
  fi
fi

# ------------------------------------------------------------------------------
# 7. Install Docker & Compose
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[Step 2/6] Verifying / Installing Docker...${NC}"
if ! command -v docker &>/dev/null; then
  if [ "$PLATFORM" = "linux" ]; then
    echo "  -> Installing Docker Engine via official get.docker.com script..."
    curl -fsSL https://get.docker.com | $SUDO sh
    if [ -n "$SUDO" ]; then
      $SUDO usermod -aG docker "$USER" || true
    fi
  elif [ "$PLATFORM" = "macos" ]; then
    if [ "$PKG_MGR" = "brew" ]; then
      echo "  -> Installing Docker via Homebrew..."
      brew install --cask docker
      echo "  ${YELLOW}Notice: Please open Docker from Applications to complete its setup.${NC}"
    else
      echo -e "${RED}Homebrew not detected. Please install Docker Desktop manually from https://docker.com${NC}"
    fi
  fi
else
  echo "  -> Docker is already installed."
fi

# ------------------------------------------------------------------------------
# 8. Install & Configure Native Ollama
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[Step 3/6] Installing & Configuring Ollama on Host...${NC}"
if ! command -v ollama &>/dev/null; then
  if [ "$PLATFORM" = "linux" ]; then
    curl -fsSL https://ollama.com/install.sh | sh
  elif [ "$PLATFORM" = "macos" ]; then
    if [ "$PKG_MGR" = "brew" ]; then
      brew install --cask ollama
    else
      echo "Please download Ollama from https://ollama.com/download"
    fi
  fi
fi

# Critical Network Fix: Allow Docker containers to reach host Ollama
if [ "$PLATFORM" = "linux" ] && command -v systemctl &>/dev/null; then
  echo "  -> Setting OLLAMA_HOST=0.0.0.0:11434 for container communication..."
  $SUDO mkdir -p /etc/systemd/system/ollama.service.d/
  cat <<EOF | $SUDO tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF
  $SUDO systemctl daemon-reload
  $SUDO systemctl restart ollama 2>/dev/null || true
fi

# ------------------------------------------------------------------------------
# 9. Pull Recommended Lightweight Models
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[Step 4/6] Pre-caching Optimized 3B Models in Ollama...${NC}"
if command -v ollama &>/dev/null; then
  echo "  -> Pulling llama3.2:3b (Primary reasoning & summarization)..."
  ollama pull llama3.2:3b || echo "Could not pull llama3.2:3b automatically (Ollama service may need manual start)."

  echo "  -> Pulling qwen2.5:3b-instruct (Best for JSON & strict markdown formatting)..."
  ollama pull qwen2.5:3b-instruct || true

  echo "  -> Pulling nomic-embed-text (Offloads RAG embeddings to host Ollama)..."
  ollama pull nomic-embed-text || true
fi

# ------------------------------------------------------------------------------
# 10. Install Tailscale Mesh VPN (Optional)
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[Step 5/6] Verifying Tailscale Mesh VPN...${NC}"
if ! command -v tailscale &>/dev/null; then
  if [ "$PLATFORM" = "linux" ]; then
    echo "  -> Installing Tailscale via official installer..."
    curl -fsSL https://tailscale.com/install.sh | $SUDO sh
  elif [ "$PLATFORM" = "macos" ] && [ "$PKG_MGR" = "brew" ]; then
    brew install --cask tailscale
  fi
fi

# ------------------------------------------------------------------------------
# 11. Launch Docker Compose Stack
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[Step 6/6] Launching SaaS Stack (Open WebUI, n8n, Memos)...${NC}"
cd "$SCRIPT_DIR"

if command -v docker &>/dev/null && docker info &>/dev/null; then
  docker compose up -d
  echo -e "  [${GREEN}OK${NC}] Containers launched in background."
else
  echo -e "  [${YELLOW}NOTE${NC}] Docker daemon is not active. Start Docker and run 'docker compose up -d' in $SCRIPT_DIR"
fi

# Run Verification Script
if [ -f "$SCRIPT_DIR/verify.sh" ]; then
  chmod +x "$SCRIPT_DIR/verify.sh"
  bash "$SCRIPT_DIR/verify.sh"
fi

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               Assistant Hub Deployment Complete!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo -e "Access your private services locally or over Tailscale:"
echo -e "  • Assistant UI (Open WebUI): ${CYAN}http://localhost:8080${NC}"
echo -e "  • Workflow Canvas (n8n):    ${CYAN}http://localhost:5678${NC}"
echo -e "  • Fast Notes (Memos):       ${CYAN}http://localhost:5230${NC}"
echo -e "  • Local AI Engine (Ollama): ${CYAN}http://localhost:11434${NC}"
echo -e "\nTo check service health anytime, run: ${BOLD}./verify.sh${NC}\n"
