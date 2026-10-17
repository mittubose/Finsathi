# AI Assistant & SaaS Hub (24/7 Setup)

A turnkey, self-hosted personal AI assistant hub designed to operate within 5 GB of RAM on an Intel Core i5 or Apple Silicon / ARM machine.

---

## Architecture Overview
* **Ollama (Native Host):** Runs CPU-optimized 3B parameter models (`llama3.2:3b`, `qwen2.5:3b-instruct`) and `nomic-embed-text`.
* **Open WebUI (Docker):** Web interface for multi-device chat and local PDF document RAG.
* **n8n (Docker):** Automated scheduled morning briefs and webhook integrations.
* **Memos (Docker):** PWA-compatible micro-journaling and daily quick capture.
* **Tailscale:** Zero-config WireGuard mesh network for encrypted remote access without port forwarding.
* **2-File Agent Memory:** Markdown-based working memory (`brain.md`, `roadmap.md`, `project_log.md`) with context-bloat guard rules.

---

## Quick Start

### 1. Audit Current Machine (Dry Run)
Check hardware, memory, disk, and dependencies without modifying the system:
```bash
./hub-installer.sh --check-only
```

### 2. Run Automated Installation
Detects your OS, configures 24/7 laptop power settings (disables sleep on lid close), configures ZRAM, installs Docker & Ollama, pulls the 3B models, and launches the container stack:
```bash
./hub-installer.sh
```
*(Add `-y` or `--yes` for non-interactive auto-confirmation).*

### 3. Verify Health & Connectivity
Run the built-in diagnostic test:
```bash
./verify.sh
```

---

## Files Included
| File | Purpose |
| :--- | :--- |
| [`hub-installer.sh`](./hub-installer.sh) | Universal auditor and automated installer (Linux, macOS, Windows WSL). |
| [`docker-compose.yml`](./docker-compose.yml) | Production Compose file with RAM limits and Docker-to-host bridge. |
| [`verify.sh`](./verify.sh) | Connectivity tester for ports (`8080`, `5678`, `5230`, `11434`) and CPU inference. |
| [`memory/brain.md`](./memory/brain.md) | Central entry point for agent session navigation. |
| [`memory/roadmap.md`](./memory/roadmap.md) | Active tasks and backlog. |
| [`memory/project_log.md`](./memory/project_log.md) | Append-only decision log preventing context bloat. |

---

## Port Map
* **Open WebUI:** `http://localhost:8080` (or `http://<tailscale-ip>:8080`)
* **n8n Canvas:** `http://localhost:5678` (or `http://<tailscale-ip>:5678`)
* **Memos Notes:** `http://localhost:5230` (or `http://<tailscale-ip>:5230`)
* **Ollama API:** `http://localhost:11434`
