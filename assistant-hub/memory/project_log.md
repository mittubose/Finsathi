# Project Log
<!-- RULE: Agents must append entries at the bottom before ending a session. Never delete or overwrite previous entries. Keep context clean by reading only the last 3-5 entries during routine tasks. -->

## [Initial Setup] - Assistant Hub Blueprint Finalized
- **Prompt / Request:** Audit architecture for 24/7 HP ProBook assistant hub (Ubuntu Server, Ollama, Open WebUI, n8n, Memos, Tailscale) and create an automated universal installation & audit script.
- **Decisions & Rationale:**
  - Configured Ollama with `OLLAMA_HOST=0.0.0.0:11434` to eliminate Docker-to-host connectivity failures.
  - Added resource limits to `docker-compose.yml` to prevent OOM panics on 8GB RAM.
  - Offloaded RAG embedding in Open WebUI to `nomic-embed-text` in Ollama to save 1.5GB RAM.
  - Added systemd power rules (`HandleLidSwitch=ignore`) and Wi-Fi powersave disables for 24/7 laptop stability.
- **Shipped:**
  - `assistant-hub/hub-installer.sh` (Universal cross-platform auditor & installer)
  - `assistant-hub/docker-compose.yml` (Hardened container stack)
  - `assistant-hub/verify.sh` (Port and inference health checks)
  - `assistant-hub/memory/` (`brain.md`, `roadmap.md`, `project_log.md`)
