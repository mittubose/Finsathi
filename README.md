<div align="center">
  <img src="finsathi-app/public/finsathi.svg" width="96" height="96" alt="FinSathi Logo" />
  <h1>FinSathi</h1>
  <p><strong>The Private Financial Operating System &amp; Local AI Vault</strong></p>
  <p>
    <em>Built for Indian salaried professionals, active equity traders, and meticulous self-trackers who demand total privacy, zero cloud telemetry, and year-round tax clarity.</em>
  </p>

  <p>
    <a href="#quick-start">Quick Start</a> •
    <a href="#why-finsathi">Why FinSathi?</a> •
    <a href="#supported-devices--installation">Device Installation</a> •
    <a href="#companion-apps">Companion Apps</a> •
    <a href="#security--privacy-architecture">Security Architecture</a> •
    <a href="#ai--mcp-tools">AI &amp; MCP Integration</a>
  </p>
</div>

---

## 🌟 Why FinSathi?

Most personal finance apps sell your data, lock tax tools behind subscriptions, or force your financial records onto third-party cloud servers. 

**FinSathi is built differently:** It runs completely locally on your own hardware. Your data lives in your browser's encrypted IndexedDB and your private local filesystem.

| Feature | FinSathi | Standard SaaS Finance Apps |
| :--- | :--- | :--- |
| **Privacy & Storage** | **100% Local (IndexedDB + Private Disk)** | Hosted on remote cloud databases |
| **Indian Tax Engine** | **Dual Regime (Old vs New) + Budget 2024 Capital Gains** | None or basic manual calculations |
| **AI Privacy** | **Local In-Browser Parser + Native Ollama (0% Cloud)** | Cloud LLMs that read your raw receipts |
| **Mobile Access** | **Zero-config PWA + Local Wi-Fi QR Pairing** | Requires centralized user accounts |
| **Integrations** | **Model Context Protocol (MCP) for Claude & Cursor** | Proprietary closed APIs |
| **Cost** | **100% Free & Open Source Forever** | Monthly/Yearly subscriptions |

---

## 🚀 Key Features

### 1. 🛡️ Bank-Grade Vault Security
* **Hardware-Isolated Profiles:** Seamlessly switch between **Master Admin**, **Individual**, **Family**, and **Business** profiles without state bleeding.
* **Cryptographic Vault Lock:** Guard your financial ledger with a 4-digit PIN, master password, or biometric TouchID/FaceID via WebAuthn.
* **Emergency Recovery System:** Self-custody cryptographic Master Recovery Key and offline rate-limited OTP verification.

### 2. 🇮🇳 Indian Tax & Capital Gains Intelligence
* **Dual Regime Simulator:** Real-time side-by-side tax comparison between the **Old Tax Regime** (80C, 80D, HRA exemptions) and the **New Tax Regime** (standard deduction and updated slabs).
* **Budget 2024 Capital Gains Engine:** Computes **STCG (20%)** and **LTCG (12.5%)** with the new **₹1.25 Lakh LTCG exemption** and FIFO cost-lot matching.
* **Tax Loss Harvesting Assistant:** Analyzes unrealized equity losses to offset eligible capital gains before March 31st.
* **Advance Tax Planner:** Tracks quarterly advance tax liability (15%, 45%, 75%, 100%) and alerts you to avoid Section 234B/234C interest penalties.

### 3. 🧠 Local AI Financial Copilot & Statement OCR
* **Zero-Latency In-Browser Parser:** Instant query engine (0ms) parses natural requests like *"Update salary to 22LPA"*, *"How much tax did I pay last year?"*, or *"Remind me to pay HDFC card 45000 on 22nd"*.
* **Deep Document & Receipt OCR:** Drag-and-drop PDFs, Excel workbooks (`.xlsx`), CSVs, and photos of paper receipts. Auto-extracts merchants, taxes, dates, and amounts without sending images to the cloud.
* **Offline Ollama Integration:** Optional one-click bridge to local LLMs (`llama3.2:3b`, `qwen2.5:3b-instruct`) for natural language financial analysis.

### 4. ⚡ Retro-Terminal Vault_OS Design
* Designed with high-contrast, information-dense dark glassmorphism inspired by professional financial command terminals.
* Keyboard-first navigation (`⌘K` / `/` omni-search command palette).
* 10-year multi-year trends, cash flow velocity meters, and inflation depreciation calculators.

---

## 💻 Supported Devices & Installation

FinSathi is built with standard web technologies and runs smoothly on almost any device.

### Device Compatibility
* **Laptops & Desktops:** macOS (Apple Silicon & Intel), Windows 10/11, Linux (Ubuntu, Debian, Fedora, Arch).
* **Mobile Phones & Tablets:** iOS (iPhone/iPad via Safari PWA), Android (Chrome PWA).
* **24/7 Home Servers:** HP ProBook, Raspberry Pi 4/5, Intel NUC, or any spare PC.

---

### Method A: Quick Local Desktop Run (Development / Personal Use)

**Prerequisites:** [Node.js (v18+)](https://nodejs.org/) installed.

```bash
# 1. Clone the repository
git clone https://github.com/mittubose/finsathi.git
cd "finsathi/finsathi-app"

# 2. Install dependencies
npm install

# 3. Start the application in development mode
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

### Method B: Running the Unified Private Host (Desktop + Mobile Wi-Fi Sync)

To serve the app to your phone over your home Wi-Fi and enable the MCP Agent server:

```bash
# Inside finsathi-app directory
node server/mcp-server.mjs
```

1. The server starts on port `3001` and prints your local Wi-Fi IP (e.g., `http://192.168.1.25:3001`).
2. Open **Settings &rarr; Server Wizard** on your laptop.
3. Open your smartphone camera, scan the **Pairing QR Code**, and your phone pairs instantly over your home network with end-to-end token authentication.

---

### Method C: Installing as an App on Mobile (iOS & Android PWA)

FinSathi functions as a native application on your phone without downloading anything from the App Store:

#### On iPhone / iPad (iOS Safari):
1. Open Safari and navigate to your laptop's FinSathi address (or Tailscale URL).
2. Tap the **Share** button (box with an arrow pointing up) at the bottom.
3. Scroll down and tap **"Add to Home Screen"**.
4. FinSathi will now appear on your home screen with its official icon and launch fullscreen like a native iOS app.

#### On Android (Google Chrome):
1. Open Chrome and navigate to your FinSathi address.
2. Tap the **three-dot menu (⋮)** in the top right corner.
3. Tap **"Install app"** or **"Add to Home screen"**.
4. The app installs into your Android app drawer.

---

### Method D: 24/7 Always-On Hub (HP ProBook / Ubuntu / Linux Server)

If you have a spare laptop or mini PC that you want to turn into a 24/7 private assistant hub:

```bash
cd assistant-hub
# 1. Run pre-flight hardware and port audit
./hub-installer.sh --check-only

# 2. Run automated installation (configures laptop sleep, ZRAM, Docker & Ollama)
./hub-installer.sh -y
```

What the automated hub installer configures:
* **Prevents Laptop Sleep:** Disables systemd suspend when the laptop lid is closed (`HandleLidSwitch=ignore`).
* **Disables Wi-Fi Sleep:** Prevents power-saving dropouts on 24/7 idle servers.
* **ZRAM Memory Compression:** Optimizes memory usage to easily run within 5 GB on 8 GB RAM machines.
* **Docker Compose Stack:** Deploys Open WebUI, n8n automation, and Memos with memory caps.

---

## 📦 Companion Apps & Ecosystem

FinSathi works standalone, but pairs with these free, open-source companion tools for maximum leverage:

| App | Role in Ecosystem | Why It's Useful |
| :--- | :--- | :--- |
| **[Ollama](https://ollama.com/)** | Local AI Engine | Enables completely offline AI chat and document reasoning using `llama3.2:3b` or `qwen2.5:3b-instruct` on raw CPU. |
| **[Tailscale](https://tailscale.com/)** | Encrypted Mesh VPN | Allows you to access your home laptop's FinSathi vault and server securely from anywhere in the world without opening router ports. |
| **[Docker](https://docker.com/)** | Container Hub | Runs the optional 24/7 automation hub (n8n for morning briefings, Memos for quick note capture). |
| **[Claude Desktop](https://claude.ai/download)** / **[Cursor](https://cursor.com/)** | Agentic IDEs | Connects to FinSathi's built-in Model Context Protocol (MCP) server so you can query your ledger from your editor. |

---

## 🔒 Security Architecture & Exploit Mitigations

FinSathi has been rigorously audited to adhere to zero-trust principles:

1. **Path Traversal Protection:** Static asset streaming in `mcp-server.mjs` enforces canonical path validation (`path.resolve`) against directory traversal attempts (`/../../etc/passwd`).
2. **Timing-Attack Immune Authentication:** Tokens and passwords are verified using constant-time buffer comparison (`crypto.timingSafeEqual`) to prevent side-channel timing analysis.
3. **Payload Size Capping & DoS Shield:** All incoming JSON API streams are strictly capped at 5 MB to prevent memory exhaustion attacks.
4. **IP Rate Limiter:** Built-in sliding window rate limiter protects local endpoints against brute-force attempts and ping floods.
5. **Zero Cloud Telemetry:** Zero external analytics, zero tracking pixels, and zero third-party cookies.

---

## 🤖 AI & Model Context Protocol (MCP) Integration

FinSathi includes a native MCP server (`server/mcp-server.mjs`) compatible with the [Model Context Protocol](https://modelcontextprotocol.io/).

### Supported MCP Tools
* `query_ledger`: Filter and inspect income, expenses, and trades with date ranges.
* `add_expense`: Add structured transactions with categories and merchant tags.
* `get_financial_summary`: Fetch real-time savings rate, liquid cash flow, and tax obligations.
* `simulate_tax_scenario`: Test bonus payouts, capital gains, or 80C deductions without mutating your ledger.
* `get_upcoming_dues`: Inspect scheduled credit card bills and SIP commitments within any day window.

### Connecting Claude Desktop to FinSathi
Add this snippet to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "finsathi": {
      "command": "node",
      "args": ["/absolute/path/to/finsathi-app/server/mcp-server.mjs"],
      "env": {
        "FINSATHI_AUTH_TOKEN": "your-token-from-settings"
      }
    }
  }
}
```

---

## 🛠️ Project Structure

```text
├── assistant-hub/             # Turnkey 24/7 self-hosted hub (Docker, Ollama, n8n, Memos)
│   ├── hub-installer.sh      # Universal OS auditor and one-click installer
│   ├── docker-compose.yml    # Production container stack with RAM limits
│   ├── verify.sh             # Health and connectivity diagnostic test
│   └── memory/               # Context-bloat-resistant agent working memory
├── finsathi-app/              # Core React + Vite + TypeScript application
│   ├── server/               # Unified local MCP server & sync daemon
│   ├── src/
│   │   ├── domains/
│   │   │   ├── assistant/    # Local AI chat & statement verification
│   │   │   ├── auth/         # Vault lock, onboarding & settings
│   │   │   ├── ledger/       # Transaction tables, filters, analytics
│   │   │   ├── salary/       # Form 16, payslip parser & salary heads
│   │   │   ├── tax/          # Old vs New regime, STCG/LTCG, Loss Harvesting
│   │   │   └── trades/       # Stock, mutual fund & derivative tracking
│   │   └── shared/           # Reusable forms, hooks, UI tokens, and icons
├── DESIGN.md                  # Vault_OS Retro-Terminal Dark Design System
├── PRODUCT.md                 # Product specifications and core principles
└── README.md                  # Project documentation and setup guide
```

---

## 📄 License

Distributed under the MIT License. Built with pride for financial sovereignty and self-custody.
