# FinSathi Web v2.0 — Product Requirements Document (PRD) & Architectural Revamp

**Document Status:** Revamp Blueprint & System Architecture  
**Target Environment:** Self-Hosted Local Vault (HP ProBook i5 / 8GB RAM compatible) + Web Client + MCP Server  
**Default Accounting Period:** Indian Financial Year (April 1 – March 31)

## 1. Executive Summary & Audit of v1.0 Spec

FinSathi Web v1.0 establishes a strong identity: a cold, disciplined, high-density financial vault for Indian salaried professionals (ages 25–45) who actively trade equities and want year-round tax clarity rather than March panic. Furthermore, having a working [Model Context Protocol (MCP)](https://www.google.com/search?q=https%3A%2F%2Fmodelcontextprotocol.io%2Fspecification%2F2026-07-28) server and chat interface for basic salary updates and report queries gives you a high-leverage operational foundation.

However, a critical product audit reveals three structural tensions in the v1.0 concept that must be resolved to make FinSathi sustainable for daily life:

1. **The Daily Friction Trap:** Combining granular expense tracking, receipt image ingestion, equity FIFO lot matching, and tax simulation on Day 1 creates severe onboarding fatigue. Users abandon manual micro-expense trackers within weeks.
2. **Missing Indian Trader-Salaried Edge Cases:** Salaried equity traders face specific statutory landmines—most notably **Advance Tax penalties (Sections 234B/234C)** on non-TDS capital gains, the post-Budget [Section 87A ₹12 Lakh rebate cliff](https://www.google.com/search?q=https%3A%2F%2Fcleartax.in%2Fpaytax%2Ftaxcalculator) (₹12.75 Lakh gross with Standard Deduction), and **STCG/LTCG set-off rules**—that must be first-class citizens in the product.
3. **LLM Arithmetic Hallucination Risk:** As you expand the MCP + Chat workflow, the LLM must never compute tax slabs or FIFO lot matches directly in tokens. Every calculation must run inside a deterministic code engine, with MCP acting strictly as the intent router and query layer.

## 2. Strategic 80/20 Scope Triage: Simplify, Cut, & Add

To maximize daily utility while keeping maintenance near zero, FinSathi v2.0 shifts from an "all-in-one manual tracker" to a **Cashflow Pulse & Tax Instrumentation Vault**.

| Category | Action | Rationale & 80/20 Redesign |
| :--- | :--- | :--- |
| **Micro-Expense Tracking** | **Simplify** | Stop logging ₹50 UPI coffee/grocery transactions. Replace daily expense logging with **Monthly Bucket Snapshots** (Credit Card Statement Total + UPI Outflow Total + Fixed Obligations) and **Tax-Relevant Receipts Only** (HRA Rent, 80D Medical, High-Value Warranties). |
| **Live Market Feeds** | **Cut** | FinSathi is a vault, not a live trading terminal. Avoid flaky real-time WebSocket tickers. Use **On-Demand CSV/XLSX Batch Ingestion** from [Zerodha Console](https://www.google.com/search?q=https%3A%2F%2Ftaxharvestlab.com%2Ffor%2Fzerodha) or [CAMS Consolidated Account Statements (CAS)](https://www.google.com/search?q=https%3A%2F%2Fwww.camsonline.com%2FInvestors%2FStatements%2FConsolidated-Account-Statement). |
| **Advance Tax Radar** | **Add (Must-Have)** | Salaried employers deduct TDS on salary, not on stock/MF gains. If realized trading gains push non-TDS tax liability over ₹10,000, FinSathi calculates cumulative quarterly instalments ([15% Jun 15, 45% Sep 15, 75% Dec 15, 100% Mar 15](https://www.google.com/search?q=https%3A%2F%2Fcleartax.in%2Fpaytax%2Fadvancetaxcalculator)) to prevent 1%/month interest penalties. |
| **Regime Breakeven Engine** | **Add (Must-Have)** | Compare New Regime (₹75,000 Standard Deduction + [Section 87A zero-tax up to ₹12L net taxable income](https://www.google.com/search?q=https%3A%2F%2Ftax2win.in%2Fguide%2Fsection-87a)) vs. Old Regime (HRA, 80C, 80D, 80CCD(1B) NPS), displaying the exact **Deduction Breakeven Delta** in rupees. |
| **Tax-Loss Harvesting Meter** | **Add (Essential)** | Track realized Long-Term Capital Gains against the **₹1.25 Lakh annual tax-free LTCG buffer** (12.5% above ₹1.25L) and Short-Term Capital Gains (20%), highlighting unrealized loss lots eligible for offset before March 31. |
| **Proactive Life Reminders** | **Add (Essential)** | Replace passive calendar lists with an automated state-driven reminder pipeline (Advance Tax windows, Credit Card bill due dates, SIP execution buffer checks, Annual Insurance/FASTag/PPF renewals). |

## 3. Progressive Disclosure & Onboarding Architecture

Instead of exposing every module at once, FinSathi v2.0 introduces complexity across three progressive maturity tiers. A user can live comfortably in Tier 1 all year and only unlock Tier 2 on weekends or quarter-ends.

| Tier | Mode Name | User Input Required | Modules Unlocked | Time to Value |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Core Pulse (Day-to-Day)** | Basic CTC/Payslip via Chat (`"My salary is ₹22L, PF ₹3.6k/mo"`) + 5–10 recurring bills/SIPs | Regime Comparator, Monthly Cashflow Runway, Obligation Reminder Strip | < 5 minutes |
| **Tier 2** | **Trader & Tax Vault (Quarterly)** | Drop broker CSV/XLSX tradebook + upload HRA/80D/Invoice PDFs | FIFO Lot Engine, STCG/LTCG Offset Matrix, Advance Tax Radar, Document Vault | 15 mins / quarter |
| **Tier 3** | **Autonomous OS (Power User)** | Connect local [n8n](https://www.google.com/search?q=https%3A%2F%2Fn8n.io%2F) + [Ollama](https://www.google.com/search?q=https%3A%2F%2Follama.com%2F) worker & watched folder | Zero-UI Telegram/WebUI Chat Logging, Automated PDF OCR Ingestion, Multi-App Life Bus | Set once, runs 24/7 |

## 4. Core Functional Specifications (v2.0 Modules)

### Module A: Salary & Tax Regime Instrumentation (`TAX_ENGINE`)
* **Dual-Regime Live Computation:** Calculates tax liability side-by-side under both the New Tax Regime (default under Section 115BAC with ₹75,000 Standard Deduction and employer NPS deduction under Section 80CCD(2)) and the Old Tax Regime.
* **Breakeven Instrumentation Bar:** Displays a segmented terminal gauge showing:
  * Current projected taxable income and effective tax rate (%).
  * Proximity to the ₹12,00,000 New Regime [Section 87A rebate cliff](https://www.google.com/search?q=https%3A%2F%2Ftax2win.in%2Fguide%2Fsection-87a) (including marginal relief calculations just above ₹12L).
  * Exact additional deductions required (in ₹) for the Old Regime to outperform the New Regime.
* **Mid-Year Appraisal / Bonus Simulator:** Via MCP chat or slider, users can test scenarios (`"What is my post-tax take-home if I get a ₹3L performance bonus in November?"`) without mutating committed ledger state until confirmed.

### Module B: FIFO Capital Gains & Tax-Loss Harvesting (`CAPITAL_LEDGER`)
* **Deterministic FIFO Lot Matching:** Processes equity and mutual fund transactions strictly in chronological order per ISIN/symbol, separating intraday (speculative business income), Short-Term Capital Gains (STCG held ≤ 12 months for listed equities, taxed at 20%), and Long-Term Capital Gains (LTCG held > 12 months, taxed at 12.5% above ₹1.25 Lakh).
* **LTCG ₹1.25L Exemption Harvester:** Displays a segmented progress bar (`[██████░░░░] ₹78,400 / ₹1,25,000 EXEMPTION USED`). Before March 31, it calculates exactly how much additional long-term profit can be booked tax-free (and immediately repurchased the next trading day) to step up cost basis.
* **Set-Off Rules Enforcement:** Automatically enforces Indian Income Tax set-off hierarchy:
  * Short-Term Capital Losses (STCL) can offset both STCG (20%) and LTCG (12.5%).
  * Long-Term Capital Losses (LTCL) can *only* offset LTCG (12.5%).
  * Unabsorbed losses are flagged for 8-year carry-forward (requiring ITR filing before the July 31 statutory deadline).

### Module C: Recurring Obligations & Cashflow Pulse (`OBLIGATION_BUS`)
* **Fixed Obligation Registry:** Tracks high-consequence recurring payments across four frequencies (Monthly, Quarterly, Annual, Custom):
  * *Monthly:* Credit Card due dates, Rent/HRA transfer, SIP dates, Maid/Cook/Utility payouts.
  * *Quarterly:* Advance Tax instalments ([Income Tax Portal ITNS 280](https://www.google.com/search?q=https%3A%2F%2Fwww.incometax.gov.in%2Fiec%2Ffoportal%2Fhelp%2Fall-topics%2Fe-filing-services%2Ftax-payments)), society maintenance.
  * *Annual:* Term & Health Insurance premiums (80D linked), PPF minimum deposit (before April 5 for maximum interest), vehicle insurance.
* **1st-to-10th Liquidity Check:** Calculates the "Free Cash After Commitments" metric (`Net Monthly SalaryCredited - Total SIPs - Fixed Bills - Credit Card Statement Due`) so the user knows on the 1st of every month how much capital can be deployed into equity trading without causing a bank balance shortfall on SIP dates.

### Module D: High-Signal Document & Receipt Vault (`DOC_VAULT`)
* **Strict High-Value Filter:** Only stores documents that have tax, audit, warranty, or legal longevity:
  * Salary slips & Form 16 / Form 26AS / AIS snapshots.
  * Rent receipts & landlord PAN records (for HRA claims).
  * 80D Health Insurance certificates & preventive health checkup bills (up to ₹5,000 cash/digital limit).
  * Hardware/appliance invoices with active warranty expiration dates.
* **Confidence & Manual Fallback:** Every ingested PDF or image carries a status tag: `VERIFIED_HUMAN`, `PARSED_HIGH_CONFIDENCE`, or `NEEDS_REVIEW`. If local OCR fails, a 3-field inline keyboard form (`Date`, `Amount`, `Category/Tag`) lets the user commit the record in 4 seconds.

## 5. Upgrading the MCP & Chat Architecture

You have already built an [MCP](https://www.google.com/search?q=https%3A%2F%2Fmodelcontextprotocol.io%2Fspecification%2F2026-07-28) server and chat functionality for updating salary and requesting reports. To evolve this into a daily financial operating system without relying on paid cloud AI subscriptions, FinSathi v2.0 separates **Conversational Intent** from **Deterministic Computation**.

### Architectural Rule: Zero LLM Math
The local LLM (e.g., `llama3.2:3b` running on [Ollama](https://www.google.com/search?q=https%3A%2F%2Follama.com%2F)) is strictly forbidden from performing arithmetic in its prompt response. Instead:
1. User sends natural language: `"I sold 50 shares of INFY at ₹1,920 today and updated my monthly NPS contribution to ₹10,000. How does my tax look?"`
2. LLM invokes MCP tools (`record_equity_trade`, `update_deduction_item`, `compute_fy_tax_summary`).
3. The backend executes deterministic TypeScript/Python logic over SQLite/PostgreSQL and returns exact numbers.
4. LLM formats the structured output in FinSathi's concise, cold instrumentation tone.

### Expanded MCP Tool Surface (v2.0 Roadmap)

| MCP Tool Name | Status | Input Parameters | Deterministic Action & Return Payload |
| :--- | :--- | :--- | :--- |
| `update_salary_structure` | **Implemented** | `fy`, `gross_ctc`, `basic`, `hra_received`, `pf_deduction`, `employer_nps` | Updates salary ledger and recalculates monthly TDS projection. |
| `get_financial_report` | **Implemented** | `fy`, `report_type` (`tax_summary`, `net_worth`, `pnl`) | Returns structured JSON report of current FY standing. |
| `simulate_tax_scenario` | **Phase 1 New** | `bonus_amount`, `extra_stcg`, `extra_ltcg`, `deduction_80c`, `deduction_80d` | Runs ephemeral Old vs. New Regime comparison without mutating database state. |
| `log_obligation_payment` | **Phase 1 New** | `obligation_id_or_name`, `amount_paid`, `paid_date`, `payment_ref` | Marks a recurring bill/CC statement as `PAID` for the current cycle and advances next due date. |
| `get_upcoming_dues` | **Phase 1 New** | `window_days` (default `14`) | Lists all unpaid obligations, SIP liquidity requirements, and tax deadlines within window. |
| `record_trade_or_lot` | **Phase 2 New** | `symbol`, `action` (`BUY`/`SELL`), `qty`, `price`, `trade_date` | Appends trade lot, runs FIFO matching if `SELL`, and returns realized STCG/LTCG delta. |
| `get_advance_tax_status` | **Phase 2 New** | `fy`, `as_of_date` | Computes cumulative non-TDS tax liability against the 15%/45%/75%/100% quarterly thresholds. |
| `register_vault_document` | **Phase 2 New** | `file_path`, `doc_type`, `fy`, `amount`, `expiry_date` | Indexes a receipt, Form 16, or warranty invoice with metadata and verification status. |

## 6. Proactive Day-to-Day Reminder & Notification Engine

A financial vault only improves day-to-day living if it taps you on the shoulder *before* a deadline or liquidity crunch occurs—without spamming you with noisy promotional push notifications.

### The 3-Tier Urgency Protocol
* **`[INFO / DIGEST]` (Weekly — Sunday 09:00 IST):** 5-line terminal summary of upcoming week's SIPs, credit card bills due in the next 7 days, and remaining monthly cash buffer.
* **`[WARN / ACTION]` (T-3 Days Before Due Date):** Triggered for unpaid credit card bills, insurance renewals, or when bank liquidity buffer drops near scheduled SIP totals.
* **`[CRITICAL / STATUTORY]` (T-5 & T-1 Days Before Statutory Cutoff):**
  * **June 12 / Sept 12 / Dec 12 / March 12:** Advance Tax instalment alert if non-TDS capital gains tax exceeds ₹10,000.
  * **March 20:** Annual Tax-Loss Harvesting & ₹1.25L LTCG exemption utilization alert before the Indian equity settlement cutoff for FY-end.
  * **April 2:** PPF lump-sum deposit window reminder (deposits before April 5 earn interest for the full month of April).

### Self-Hosted Execution on Your HP ProBook (Zero Cloud Cost)
Using the [n8n](https://www.google.com/search?q=https%3A%2F%2Fn8n.io%2F) + [Ollama](https://www.google.com/search?q=https%3A%2F%2Follama.com%2F) stack running on your spare HP ProBook:
1. An **n8n Cron Node** fires every morning at `08:30 IST`.
2. It calls `GET /api/mcp/upcoming-dues?window=7` and `GET /api/mcp/advance-tax-status` on the FinSathi backend.
3. If any items cross the `[WARN]` or `[CRITICAL]` threshold, n8n dispatches a clean, monospaced notification to your private Telegram bot, Discord webhook, or [Memos](https://www.google.com/search?q=https%3A%2F%2Fusememos.com%2F) timeline—with a one-tap reply action (`"Paid HDFC CC 42500"`) that routes back through the FinSathi MCP `log_obligation_payment` tool.

## 7. Terminal UI/UX Simplification & Design System Guardrails

To preserve the **Cold, Disciplined, Sophisticated Digital Vault** brand identity while reducing cognitive overload:

* **Single-Screen Command Deck (Default View):** Replace multi-page nested menus with a 4-quadrant instrumentation view:
  * **Quadrant 1 (Top-Left): FY Tax Telemetry** — Old vs. New Regime delta, effective tax rate, and Advance Tax status pill (`CLEAR` in green `#10B981` or `DUE ₹14,200 BY SEP 15` in amber `#F59E0B`).
  * **Quadrant 2 (Top-Right): Equity & Capital Gains Gauge** — Segmented bar for the ₹1.25L LTCG tax-free harvesting quota, net realized STCG/LTCG, and last tradebook sync timestamp.
  * **Quadrant 3 (Bottom-Left): 30-Day Obligation Radar** — Chronological monospaced table of upcoming credit card bills, rent, and SIPs with one-key (`[Space]` or `[P]`) mark-as-paid toggle.
  * **Quadrant 4 (Bottom-Right): Persistent MCP Command Bar (`⌘K` / `/`)** — Always-accessible terminal input at the bottom of the viewport where you can type natural commands (`"add rent receipt ₹28000 for Oct"`, `"simulate 2L LTCG booking"`) or drag-and-drop a CSV/PDF.
* **Audit Transparency Badges:** Every computed figure displays a subtle monospace source badge on hover (`[SRC: ZERODHA_CSV_2026_09]`, `[SRC: MANUAL_CHAT_OVERRIDE]`, `[ASSUMPTION: STD_DED_75K]`) so you never have to guess how a number was derived.

## 8. Multi-App "Way of Living" Ecosystem Architecture

Because FinSathi is the first in a planned series of personal life-improvement apps, v2.0 establishes a shared local infrastructure (**Personal OS Core**) so future apps do not duplicate authentication, storage, reminder scheduling, or MCP routing.

| Shared Layer | Component | How FinSathi Uses It Now | How Future "Way of Living" Apps Plug In |
| :--- | :--- | :--- | :--- |
| **Unified MCP Router** | Single local MCP Gateway (`localhost:3001/mcp`) | Exposes `finance.*` tools (`salary`, `tax`, `obligations`, `trades`) | Future apps register `health.*` (biomarkers, workouts), `home.*` (appliance maintenance, inventory), or `career.*` (learning & project logs) on the same chat interface. |
| **Central Obligation & Reminder Engine** | Shared SQLite/Postgres `events_and_dues` schema + [n8n](https://www.google.com/search?q=https%3A%2F%2Fn8n.io%2F) dispatcher | Fires credit card, SIP, and Advance Tax alerts | Fires blood-test checkup intervals, vehicle servicing reminders, or domain/passport renewal alerts through the exact same notification channel. |
| **Document & Asset Vault** | Content-addressed local storage + [Paperless-ngx](https://www.google.com/search?q=https%3A%2F%2Fdocs.paperless-ngx.com%2F) / OCR worker | Archives Form 16, rent receipts, and tax statements | Archives medical lab PDFs, home lease agreements, and vehicle RC/insurance papers with unified tag search. |
| **Design Token System** | Shared CSS Variables & Monospace Terminal UI Kit | Renders financial tables, segmented bars, and green/amber status badges | Gives every future personal app the same cohesive, zero-bloat instrumentation aesthetic out of the box. |

## 9. Phased Implementation Roadmap (80/20 Execution)

### Phase 1: High-Leverage Core & MCP Upgrade (Weeks 1–2)
* Refactor database schema around strict Indian Financial Year (`2026-27`) partitioning.
* Implement the deterministic **FY 2025-26 / 2026-27 Tax Engine** (New Regime ₹75k Standard Deduction + ₹12L Section 87A rebate + Marginal Relief vs. Old Regime).
* Add `simulate_tax_scenario`, `log_obligation_payment`, and `get_upcoming_dues` to your existing MCP server.
* Build the **30-Day Obligation Radar** and replace granular expense entry with monthly bucket snapshots.

### Phase 2: Trader Intelligence & Advance Tax Shield (Weeks 3–4)
* Build the **CSV/XLSX Tradebook Ingestor** for Zerodha/Groww/CAMS exports with deterministic FIFO lot matching.
* Add the **₹1.25L LTCG Exemption Segmented Bar** and STCG/LTCG set-off matrix.
* Implement the **Quarterly Advance Tax Calculator** (June 15, Sept 15, Dec 15, March 15) and expose `get_advance_tax_status` via MCP.

### Phase 3: ProBook Self-Hosting & Proactive Automation (Week 5)
* Deploy FinSathi Web + MCP Server alongside [Ollama](https://www.google.com/search?q=https%3A%2F%2Follama.com%2F) (`llama3.2:3b`) and [n8n](https://www.google.com/search?q=https%3A%2F%2Fn8n.io%2F) on the HP ProBook over [Tailscale](https://www.google.com/search?q=https%3A%2F%2Ftailscale.com%2F).
* Configure the morning `08:30 IST` n8n cron job to query `get_upcoming_dues` and push actionable terminal digests to your phone.
