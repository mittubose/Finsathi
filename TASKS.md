# TASKS.md — FinSathi Web Implementation

> **Design ref:** [DESIGN.md](./DESIGN.md) (Vault_OS / Retro-Terminal Dark)
> **Tax ref:** [tax_skill.md](./tax_skill.md)
> **Priority:** Complex (Tier A) → Medium (Tier B) → Simple (Tier C) within each wave

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | Not started |
| 🔄 | In progress |
| ✅ | Done |
| 🔴 | Blocked |
| **A** | Tier A — strongest model / high scrutiny |
| **B** | Tier B — mid-tier implementation |
| **C** | Tier C — low-cost / repetitive |

---

## WAVE 1 — Stability Foundation

### 1.1 ✅ Project Scaffold `C`
- `npx create-vite@latest ./ --template react-ts`
- Install: TanStack Query, Zustand, React Hook Form, Zod, Recharts, React Router
- Tailwind CSS v4 setup with DESIGN.md tokens
- Folder structure per PRD appendix (`src/domains/`, `src/shared/`, `src/workers/`)
- **Done when:** `npm run dev` renders empty shell

### 1.2 ✅ Design System — Tokens & Globals `B`
- Map DESIGN.md YAML → Tailwind config (`tailwind.config.ts`)
- Colors, typography (Space Grotesk + Inter), spacing, border-radius
- Dot-grid background, glassmorphism utilities (`.glass-surface`, `.glass-card-header`, `.glass-row`)
- Custom scrollbar styles
- **Done when:** Token file matches code.html config exactly

### 1.3 ✅ Design System — Core Components `C`
- `GlassCard` — header + body, border, backdrop-blur
- `Button` — primary (solid white/black), secondary (transparent border), hover inversion
- `Input` — underline / 4-sided box, neon-green focus ring
- `Badge` / `StatusPip` — green (positive), amber (warning), red (error)
- `SegmentedProgressBar` — dot-matrix style
- `Skeleton` loader
- `EmptyState` component
- **Done when:** All components render in isolation, match code.html aesthetic

### 1.4 ✅ App Shell & Layout `B`
- Desktop: Sticky side nav (48px width collapsed → 192px expanded) with Vault_OS branding
- Mobile: Top app bar with hamburger
- Nav items: DASHBOARD, LEDGER, TAX_ENGINE, TRADES, REMINDERS, IMPORTS, REPORTS, SETTINGS
- Active tab: green left-border + green text (per code.html)
- Material Symbols Outlined icons (thin stroke, unfilled)
- **Done when:** Responsive shell renders, nav highlights active route

### 1.5 ⬜ Supabase Project + Auth Schema `A`
- Create Supabase project
- Auth: email OTP / phone OTP via Supabase Auth
- `profiles` table: user_id, display_name, financial_year, preferred_regime, onboarding_complete
- RLS policies on `profiles`
- React auth context + protected routes
- **Done when:** User can sign in via OTP, session persists, RLS blocks cross-user access

### 1.6 ⬜ Database Schema — Core Tables `A`
- `income_items`: id, user_id, head, amount_paise, source, financial_year, is_taxable, notes, tags, created_at, updated_at, deleted_at
- `expense_items`: id, user_id, category, amount_paise, date, merchant, notes, tags, receipt_url, is_recurring, created_at, updated_at, deleted_at
- `trades`: id, user_id, instrument, isin, entry_date, exit_date, qty, buy_price_paise, sell_price_paise, charges_paise, asset_type, classification (STCG/LTCG), realized_pnl_paise, lot_id, notes, source, created_at, updated_at, deleted_at
- `deductions`: id, user_id, section, amount_paise, proof_status, regime_eligibility, fy, limit_paise, notes
- `tax_rules`: id, fy, regime, slab_json, cess_pct, surcharge_json, standard_deduction_paise, version
- `reminders`: id, user_id, title, amount_paise, cadence, next_due, lead_days, status, linked_expense_id
- `import_logs`: id, user_id, file_name, file_type, status, row_count, error_count, created_at
- `documents`: id, user_id, file_url, linked_entity_type, linked_entity_id, ocr_status
- `audit_log`: id, user_id, entity_type, entity_id, action, diff_json, created_at
- RLS on every table
- Soft-delete via `deleted_at` column
- **Done when:** All tables created, RLS tested, audit trigger in place

### 1.7 ✅ Onboarding Flow `B`
- Step 1: Welcome → select profile type (Salary, Trading, Both)
- Step 2: Financial year selection (current FY auto-detected)
- Step 3: Preferred tax regime (Old / New / Compare Both)
- Step 4: Quick start — Manual entry or Import first
- Save to `profiles`, mark `onboarding_complete`
- **Done when:** New user reaches dashboard in ≤ 3 steps after OTP
- **Location:** `src/domains/auth/Onboarding.tsx`

### 1.8 ✅ Local Draft Persistence `B`
- Zustand middleware for `localStorage` persistence
- Draft queue for income, expense, trade forms
- Sync queue with retry + conflict markers
- **Done when:** Partially filled form survives page refresh

---

## WAVE 2 — Financial Core (Complex First)

### 2.1 ✅ Indian Salary Tax Engine — Core `A`
- **New Regime FY 2025-26 slabs:**
  - 0–4L → 0%, 4–8L → 5%, 8–12L → 10%, 12–16L → 15%, 16–20L → 20%, 20–24L → 25%, >24L → 30%
  - Standard deduction: ₹75,000
  - No 80C, 80D, HRA exemptions
- **Old Regime slabs:**
  - 0–2.5L → 0%, 2.5–5L → 5%, 5–10L → 20%, >10L → 30%
  - Standard deduction: ₹50,000
  - 80C up to ₹1.5L, 80D up to ₹25K (₹50K for senior), HRA calc
- Cess: 4% on tax
- Surcharge: tiered (50L–1Cr → 10%, 1–2Cr → 15%, etc.)
- Inputs: gross salary, basic, HRA, rent paid, city type, employer PF, deductions array
- Output: taxable income, tax, cess, surcharge, effective rate, regime comparison
- **All amounts in paise (integer math only)**
- Show assumptions + confidence
- Versioned by FY in `tax_rules` table
- **Done when:** Golden test cases pass for both regimes, side-by-side comparison works

### 2.2 ✅ Capital Gains Engine — STCG/LTCG `A`
- Equity: <12 months = STCG, ≥12 months = LTCG
- STCG tax: 20% (FY 2025-26)
- LTCG tax: 12.5% above ₹1.25L exemption (FY 2025-26)
- FIFO lot matching with audit trail
- Partial sells across lots
- Realized P&L per trade
- Loss tracking: STCL can offset STCG + LTCG; LTCL offsets only LTCG
- Carry-forward flag for unadjusted losses
- Brokerage + STT + charges deduction from gains
- **Done when:** FIFO matching produces auditable breakdown, loss set-off rules validated

### 2.3 ✅ Tax Engine UI — Regime Comparison `B`
- Salary breakup input form (React Hook Form + Zod)
- Fields: Basic, HRA, Special Allowance, Conveyance, LTA, Bonus, Employer PF, Profession Tax
- Deduction checklist with progress bar (80C, 80D, 80E, etc.)
- Side-by-side Old vs New regime output
- Highlighted winner regime
- Monthly & yearly breakdown view
- Suggested actions cards (e.g., "Invest ₹X more in 80C to save ₹Y")
- Glassmorphism cards matching code.html TAX_ESTIMATOR widget
- **Done when:** User can input salary, see both regime taxes, get savings suggestions

### 2.4 ✅ Manual Income Entry `B`
- Form: head (salary/freelance/interest/dividend/rental/other), amount, source, FY, taxable flag, notes, tags
- Validation: Zod schema, amount > 0, valid FY
- CRUD operations via Supabase
- Audit log on create/update/delete
- Draft save to local storage
- **Done when:** Income record created in < 20 seconds, validation blocks bad data

### 2.5 ✅ Manual Expense Entry `B`
- Form: category, amount, date, merchant, notes, tags, receipt upload, recurring flag
- Category presets: Food, Transport, Housing, Healthcare, Education, Utilities, Entertainment, Shopping, Other
- Validation: Zod, date not future (optional toggle), amount > 0
- CRUD + audit log
- **Done when:** Expense added in < 20 seconds, receipt attached successfully

### 2.6 ✅ Manual Trade Entry `B`
- Form: instrument/ticker, ISIN (optional), buy date, sell date, qty, buy price, sell price, charges, asset type, notes
- Auto-classify STCG/LTCG from holding period
- Compute realized P&L = (sell - buy) × qty - charges
- Validation: sell date ≥ buy date, qty > 0, prices > 0
- CRUD + audit log
- **Done when:** Trade entry auto-classifies and shows P&L

### 2.7 ✅ Dashboard — Main View `B`
- Hero section: NET_INCOME display (gross income − expenses − tax estimate)
- YTD trend badge (↑ green / ↓ amber)
- Segmented progress bar (liquidity ratio)
- Bento grid (4-col desktop, 1-col mobile):
  - **CASH_FLOW** — monthly income vs expense bar chart (Recharts)
  - **ALLOCATION** — trading portfolio breakdown
  - **SAVINGS_RATE** — circular gauge (% saved)
  - **TAX_ESTIMATOR** — estimated liability, effective rate, next advance tax date
- Quick action buttons: Add Income, Add Expense, Add Trade, Import, Scan, Reminder
- **Done when:** Dashboard loads with skeleton → data, matches code.html layout

### 2.8 ✅ Recent Activity Feed `C`
- Last 10 transactions across income/expense/trade
- Glass row styling per code.html
- Icon per type (Material Symbols, thin stroke)
- Amount formatting: green (+), white (−)
- Timestamp: relative ("TODAY 14:22", "YESTERDAY 09:15")
- "VIEW_ALL" link → Ledger page
- **Done when:** Feed renders mixed transaction types, hover states work

### 2.9 ✅ Recurring Reminders Engine `B`
- CRUD for reminders: title, amount (optional/variable), cadence (monthly/quarterly/annual/custom), next_due, lead_days[]
- Cadence logic: auto-advance next_due after marking paid
- Status: upcoming, due_soon, overdue, paid, dismissed
- One-click "Mark Paid" → creates expense record + updates reminder
- Handle edge cases: Feb 29, weekend due dates
- **Done when:** Monthly reminder auto-advances, paid creates expense entry

### 2.10 ✅ Reminders UI `B`
- Notification inbox panel (slide-in or dedicated page)
- Grouped by: Overdue, Due Soon, Upcoming
- Each reminder card: title, amount, due date, cadence badge, actions (Pay, Snooze, Edit)
- Dashboard widget showing count of overdue/due-soon
- **Done when:** Overdue reminders surfaced clearly, pay flow works end-to-end

### 2.11 ✅ Ledger Page — Unified Transaction List `B`
- Filterable table: type (income/expense/trade), date range, category, tags, amount range
- Sort by date (default), amount, type
- Glass row styling, paginated (50 per page)
- Inline actions: Edit, Archive, Delete (soft)
- Mobile: card-based layout
- **Done when:** All transaction types visible, filters functional

### 2.12 ✅ Trading Dashboard — P&L View `B`
- Summary cards: Total Realized Gain, Total Realized Loss, Net P&L, STCG Tax, LTCG Tax
- Trades table: instrument, dates, qty, buy/sell prices, charges, P&L, classification
- Loss harvesting alerts: "Selling X now would offset ₹Y of gains"
- Holding period indicator (days held, STCG/LTCG badge)
- **Done when:** P&L summary matches individual trade calculations

---

## WAVE 3 — Ingestion

### 3.1 ✅ CSV Import Pipeline `A`
- File upload (drag & drop + click)
- Auto-detect: Zerodha, Groww, Angel One, Kite CSV templates
- Column mapping UI for unknown formats
- Row validation + preview (show errors per row)
- Partial import (skip bad rows, import good ones)
- Deduplication via source fingerprint (hash of date+instrument+qty+price)
- Import log entry
- **Done when:** Zerodha CSV imports with < 2 min effort, dupes blocked
- **Location:** `src/domains/imports/Imports.tsx`

### 3.2 ✅ Excel Import Support `B`
- Parse .xlsx via SheetJS
- Multi-sheet detection → sheet selector
- Same validation + preview pipeline as CSV
- Handle: headers not in row 1, mixed delimiters
- **Done when:** Excel with multiple sheets importable
- **Location:** `src/domains/imports/ExcelImport.tsx`

### 3.3 ✅ Import Review & History UI `B`
- Step-based wizard: Upload → Map → Preview → Confirm → Done
- Error rows highlighted with inline fix suggestions
- Import history page: file name, date, status, row/error counts, re-import action
- **Done when:** User can review before commit, re-visit past imports
- **Location:** `src/domains/imports/SmartImport.tsx`

### 3.4 ⬜ OCR Receipt Upload `A`
- Image upload (camera + file picker)
- Extract via Tesseract.js or cloud OCR: merchant, amount, date, category guess
- Confidence scoring per field
- Review-and-confirm screen (never auto-post)
- Store original image in Supabase Storage
- **Done when:** Receipt scanned → fields pre-filled → user confirms → expense created

### 3.5 ⬜ OCR Review UI `B`
- Side-by-side: image preview | extracted fields form
- Low-confidence fields highlighted in amber
- User can correct any field before save
- Link to stored document after save
- **Done when:** User can correct OCR mistakes before committing

---

## WAVE 4 — Intelligence & Hardening

### 4.1 ⬜ Notion Sync — One-Way Import `A`
- Notion API OAuth connection
- Database selector + property mapper (date, amount, merchant, category, type)
- "Review before sync" workflow
- Sync log: created, updated, skipped, conflicted counts
- Handle: schema changes, token revocation, cross-source dupes
- **Done when:** Notion table imports without code, sync logged

### 4.2 ✅ Tax-Saving Suggestions Engine `A`
- Based on regime comparison gap
- Suggestions: "Invest ₹X in 80C", "Get health insurance for 80D", "Claim HRA"
- Show condition, limit, current usage, potential saving
- Never recommend without showing assumptions
- **Done when:** 3+ actionable suggestions generated from real salary data

### 4.3 ✅ Advance Tax Calculator `B`
- Quarterly due dates: Jun 15, Sep 15, Dec 15, Mar 15
- Based on estimated annual tax − TDS already deducted
- Show per-quarter installment amounts
- Interest penalty estimator (234B/234C awareness)
- **Done when:** Quarterly schedule generated from salary + trading tax

### 4.4 ✅ Reports — Monthly Summary `B`
- Income vs Expense breakdown
- Category-wise expense pie chart
- Trading P&L summary
- Tax estimate snapshot
- Export to CSV
- **Done when:** Monthly report downloadable

### 4.5 ✅ Reports — FY Tax Summary `B`
- Full year salary breakup
- All deductions claimed
- Capital gains ledger (lot-level)
- Tax computation (both regimes)
- TDS vs estimated tax
- Export to PDF-ready format
- **Done when:** Accountant-ready summary exportable

### 4.6 ✅ Inflation Calculator `B`
- Category CPI data (food, housing, transport, healthcare, education)
- Map user expense categories → inflation categories
- Personal effective inflation rate
- Budget adjustment suggestions
- Source date + freshness badge
- **Done when:** Personal inflation rate computed from actual spending
- **Location:** `src/domains/reports/InflationCalc.tsx`

### 4.7 ✅ Audit Trail Viewer `B`
- Searchable log of all mutations
- Filter by entity type, action, date
- Diff viewer for updates
- **Done when:** Any record change traceable with before/after

### 4.8 ✅ Settings Page `C`
- Profile: name, avatar
- Tax preferences: regime, FY
- Data: export all, delete account
- Notification preferences
- Connected accounts (Notion)
- **Done when:** All settings editable, saved to Supabase

### 4.9 ✅ Data Export Pack `B`
- Full data export: JSON + CSV
- Scoped by FY
- Include: income, expenses, trades, deductions, reminders, documents
- **Done when:** One-click export produces complete archive

---

## WAVE 5 — Recurring Rules, Smart Imports & Intelligence (PRD v4)

> **Sources:** `prd_react_finance_app_v4.md`, `agent_react_finance_app_v2.md`
> **Priority order:** Tier A → Tier B → Tier C

### 5.1 ✅ Recurring Rules Engine `A`
- New Zustand slice: `RecurringRule` with fields: id, title, type (income/expense/savings/tax/transfer), frequency (weekly/monthly/quarterly/yearly/custom), amountRule (fixed/variable/estimate), startDate, endDate?, nextDueDate, source, status (active/paused/completed/overdue)
- Auto-advance `nextDueDate` after a rule is triggered
- Generate projected cash-flow from active rules (next 12 months)
- Rules are separate from manual one-off entries — do NOT merge with existing `Reminder` model
- Audit log every rule create/update/pause/resume/delete
- **Done when:** Recurring salary + recurring rent both project into dashboard cash-flow widget

### 5.2 ✅ Recurring Income UI `B`
- CRUD screen for recurring income rules (salary retainer, rent received, dividends)
- Fields: title, frequency, amount, start date, end date, notes
- Status badges: ACTIVE, PAUSED, OVERDUE
- "Trigger now" action to instantly post a ledger entry from a rule
- **Done when:** User can set up monthly salary and see it in the schedule

### 5.3 ✅ Recurring Expense UI `B`
- CRUD screen for recurring expense rules (rent paid, electricity, subscriptions, EMIs)
- Variable-amount support: user can override amount at trigger time
- Template presets: Rent, Electricity, Internet, Groceries, OTT, Insurance, EMI
- **Done when:** User can set up monthly rent and mark it paid each month

### 5.4 ✅ Recurring Savings & Investment Tracker `B`
- Separate from expenses — type: SAVINGS with distinct color
- Track: equity SIP, mutual fund SIP, chit fund, RD contributions
- Show cumulative savings target vs actual
- **Done when:** SIP contribution shows in savings dashboard, not expense bucket
- **Location:** `src/domains/recurring/Recurring.tsx`

### 5.5 ✅ Intelligent Document Import — Type Detection `A`
- Accept: CSV, Excel, PDF, Image (JPEG/PNG), Word (.docx)
- Detect document intent: payslip, Form 16, bank statement, broker statement, utility bill, tax notice
- Explain document purpose in plain language before extracting data
- Extract fields with confidence scores (0–100)
- Review screen — amber for low confidence fields; user confirms or corrects
- Save raw file reference + parsed JSON + audit log entry
- Never auto-post without user confirmation
- **Done when:** Uploading a payslip PDF explains document type before extracting fields

### 5.6 ✅ Payslip & Form 16 Parser `A`
- Parse PDF/image payslips: Basic, HRA, Special Allowance, Conveyance, LTA, Bonus, Employer PF, Professional Tax, Net Pay, TDS deducted
- Parse Form 16 Part A (TDS summary) and Part B (salary breakup + deductions)
- Detect old-regime fields: HRA exemption, 80C/80D claimed
- Confidence scoring per field; prefill Tax Engine — mark each field as "imported" vs "manual"
- Store source mapping — never treat as final without user confirmation
- **Done when:** Form 16 upload populates tax engine with review-required badges

### 5.7 ✅ Multi-Account Trading P&L `A`
- Support multiple named broker accounts (Zerodha, Groww, Angel, etc.)
- Each account: trade ledger, import history, capital gains summary, dividend income view
- Aggregate view: combined P&L across all accounts for tax filing
- Tax P&L views: Equity STCG, LTCG, Dividend Income, MF gains, ELSS tracking
- **Done when:** User can add two accounts and see separate + combined tax P&L

### 5.8 ✅ Multi-Year Reporting `B`
- FY selector on all reports: current year + past 3 years
- Side-by-side FY comparison: income, expenses, savings rate, tax, net worth delta
- Trading P&L by account AND by financial year
- Export-ready audit view (PDF-ready layout)
- **Done when:** User can compare FY 2024-25 vs FY 2025-26 side by side

### 5.9 ✅ Ledger Detail View & Inline Edit `B`
- Every ledger record gets a detail drawer/panel
- Shows: source, creation time, last updated, linked documents, notes, tags
- Inline edit for: amount, date, category, notes, tags
- Change history: edits with timestamp + before → after diff
- Soft delete with 30-day recovery
- **Done when:** Clicking a ledger row opens detail; user can edit and see history

### 5.10 ✅ Tax Education Help Panel `B`
- Help icon (?) on all tax fields in Tax Engine, Advance Tax, and Import screens
- Opens bottom-sheet with: plain-language definition + "Why it matters" ₹ example
- Required topics: Advance Tax, Form 16, HRA, PF, Capital Gain, Dividend, Loss Harvesting, Deduction vs Exemption
- **Done when:** Each tax field has a working help icon with contextual panel

### 5.11 ✅ Projected Cash Flow Widget `B`
- New dashboard widget: CASH_FLOW_PROJECTION
- 12-month bar chart (Recharts): green = recurring income, amber = recurring expenses, white line = net
- Highlight months where net is negative
- **Done when:** Dashboard shows 12-month projection from active recurring rules

### 5.12 ✅ Savings Dashboard Bucket `C`
- Savings section separate from expense bucket in dashboard
- Shows: total SIP contributions this FY, target vs actual, per-stream breakdown
- **Done when:** SIP and RD contributions appear in savings section, not expenses

---

## Parallel Work (Any Wave) — Simple Tasks `C`

| # | Task | Status |
|---|------|--------|
| P.1 | **Form Component Library** | ✅ |
| P.1.1 | — TextInput (standard & password with "Vault" style) | ✅ |
| P.1.2 | — NumberInput (currency aware, auto-handles paise conversion) | ✅ |
| P.1.3 | — Select / Dropdown (styled for terminal aesthetic) | ✅ |
| P.1.4 | — Checkbox & Radio (custom styled toggles) | ✅ |
| P.1.5 | — DatePicker (minimalist terminal-style wrapper) | ✅ |
| P.2 | Table component with sort, filter, pagination | ✅ |
| P.3 | Modal / Drawer component | ✅ |
| P.4 | Tab component | ✅ |
| P.5 | Toast / Notification system | ✅ |
| P.6 | Currency formatter (paise → ₹ display, always integer math) | ✅ |
| P.7 | Date utilities (FY boundaries, relative time, FY from date) | ✅ |
| P.8 | Empty state illustrations + copy for each page | ✅ |
| P.9 | Loading skeleton variants (card, table row, form) | ✅ |
| P.10 | Error boundary + fallback UI | ✅ |
| P.11 | Keyboard shortcuts (Ctrl+N new entry, Ctrl+S save) | ✅ |
| P.12 | Mobile bottom nav bar | ✅ |
| P.13 | Dark mode is default (already via DESIGN.md) — ensure no light-mode leaks | ✅ |
| P.14 | Notification system (toast, inline alerts, empty states) | ✅ |
| P.15 | Tax regime comparison engine (side-by-side) | ✅ |
| P.18 | Command Palette (Cmd+K) global search/actions | ✅ |

---

## Dependency Graph

```
1.1 Scaffold
 ├── 1.2 Design Tokens
 │    └── 1.3 Core Components
 │         └── 1.4 App Shell
 ├── 1.5 Auth + Supabase
 │    └── 1.6 Schema
 │         ├── 1.7 Onboarding
 │         ├── 2.1 Tax Engine ──→ 2.3 Tax UI
 │         ├── 2.2 Capital Gains ──→ 2.12 Trading Dashboard
 │         ├── 2.4 Income Entry ─┐
 │         ├── 2.5 Expense Entry ├──→ 2.7 Dashboard
 │         ├── 2.6 Trade Entry ──┘    2.8 Activity Feed
 │         ├── 2.9 Reminders Engine ──→ 2.10 Reminders UI
 │         └── 2.11 Ledger Page
 │
 ├── 3.1 CSV Import ──→ 3.3 Import UI
 ├── 3.2 Excel Import ─┘
 ├── 3.4 OCR ──→ 3.5 OCR Review UI
 │
 └── 4.1 Notion Sync
     4.2 Tax Suggestions
     4.3 Advance Tax
     4.4–4.9 Reports, Settings, Export
```

---

## Tax Rule Quick Reference (FY 2025-26)

### New Regime Slabs
| Income Range | Rate |
|---|---|
| 0 – ₹4,00,000 | 0% |
| ₹4L – ₹8L | 5% |
| ₹8L – ₹12L | 10% |
| ₹12L – ₹16L | 15% |
| ₹16L – ₹20L | 20% |
| ₹20L – ₹24L | 25% |
| > ₹24L | 30% |

Standard Deduction: ₹75,000 | Rebate u/s 87A up to ₹25,000 (income ≤ ₹12L)

### Old Regime Slabs
| Income Range | Rate |
|---|---|
| 0 – ₹2,50,000 | 0% |
| ₹2.5L – ₹5L | 5% |
| ₹5L – ₹10L | 20% |
| > ₹10L | 30% |

Standard Deduction: ₹50,000 | 80C: ₹1.5L | 80D: ₹25K/₹50K | HRA: formula-based

### Capital Gains (Equity Delivery)
| Type | Holding | Tax Rate | Exemption |
|---|---|---|---|
| STCG | < 12 months | 20% | None |
| LTCG | ≥ 12 months | 12.5% | ₹1.25L/year |

Health & Education Cess: 4% on total tax
