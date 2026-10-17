# FinSathi Web v2.0 — Architectural Audit, DDD Ubiquitous Language & Issue Registry

**Status:** Approved for Implementation  
**Architecture Paradigm:** Domain-Driven Design (DDD) with Deep Modules & Clean Interfaces  
**Testing Philosophy:** Test-Driven Development (TDD) via Vitest  
**Execution Standard:** `/ponytail` (Senior dev mode: highest leverage, zero bloat, integer-paise arithmetic)

---

## 1. Domain-Driven Design (DDD) Ubiquitous Language Glossary

To eliminate cognitive friction and prevent mismatched assumptions between statutory Indian tax laws, capital markets, and software implementation, FinSathi adopts this strict ubiquitous language:

| Domain Term | Canonical Definition | Mathematical Invariant |
|---|---|---|
| **`PaiseInteger`** | Integer representing 1/100th of an Indian Rupee. | All money stored and manipulated exclusively as `integer`. No floats. |
| **`AssessmentYear` / `FinancialYear`** | FY runs April 1 to March 31. AY is FY + 1 year. | E.g. FY 2025-26 $\to$ AY 2026-27. |
| **`Section87ARebate`** | Full tax rebate under Section 115BAC New Regime for taxable income $\le ₹12,00,000$. | Net tax = ₹0 if taxable income $\le ₹12,00,000$. |
| **`MarginalRelief`** | Relief under Section 87A proviso preventing tax from exceeding income earned above ₹12,00,000. | $\text{Tax} \le (\text{TaxableIncome} - ₹12,00,000)$. |
| **`DeductionBreakevenDelta`** | The exact additional deductions required for Old Regime tax to beat New Regime. | $\text{Tax}_{\text{Old}} < \text{Tax}_{\text{New}}$. |
| **`AdvanceTaxQuarter`** | Statutory quarterly tax liability schedule under Section 208/211. | Q1: 15% (Jun 15), Q2: 45% (Sep 15), Q3: 75% (Dec 15), Q4: 100% (Mar 15). |
| **`SafeHarbor234C`** | Threshold below which Section 234C interest penalties accrue. | Q1: 12%, Q2: 36%, Q3: 75%, Q4: 100%. |
| **`TradeLot`** | An atomic purchase lot of equity or mutual fund with date, quantity, and cost basis. | FIFO order per ISIN/Symbol. |
| **`HarvestableLtcgQuota`** | Remaining buffer within the annual ₹1,25,000 tax-free LTCG exemption under Section 112A. | $\max(0, ₹1,25,000 - \text{RealizedLTCG})$. |
| **`FreeCashAfterCommitments`** | Net monthly liquidity remaining after clearing all scheduled bills and SIPs. | $\text{NetSalary} - \sum(\text{SIPs}) - \sum(\text{FixedBills}) - \text{CCStatementDue}$. |
| **`MonthlyBucketSnapshot`** | Macro aggregation replacing ₹50 UPI micro-logging. | CC Total + UPI Outflow + Fixed Obligations. |

---

## 2. Deep Module Architecture

Following John Ousterhout's *Philosophy of Software Design*, FinSathi v2.0 establishes **Deep Modules**: modules that provide powerful, extensive functionality while exposing a minimal, intuitive surface area.

```
src/domains/
├── tax/
│   └── domain/
│       ├── TaxEngineService.ts       <-- Deep Module: Dual regime, 87A rebate, marginal relief, 234B/C
│       └── __tests__/
│           └── TaxEngineService.test.ts
├── trades/
│   └── domain/
│       ├── CapitalLedgerService.ts   <-- Deep Module: FIFO lot matcher, ₹1.25L LTCG harvester, set-off matrix
│       └── __tests__/
│           └── CapitalLedgerService.test.ts
├── obligations/
│   └── domain/
│       ├── ObligationRadarService.ts <-- Deep Module: 30-day radar, Free cash liquidity, bucket snapshots
│       └── __tests__/
│           └── ObligationRadarService.test.ts
└── command-deck/
    ├── CommandDeck.tsx               <-- 4-Quadrant Single Screen Command Deck UI
    └── CommandDeck.css
```

---

## 3. GitHub Issue Registry (Actionable Roadmap)

### Issue #1: [CORE-DDD] Implement `TaxEngineService` Deep Module with FY 25-26 87A Marginal Relief
- **Severity:** High (Core Statutory Correctness)
- **Problem:** The ₹12L Section 87A rebate cliff creates an anomalous spike in tax liability for salaried earners making just over ₹12 Lakhs without marginal relief calculations.
- **Specification:**
  - Standard deduction: ₹75,000 in New Regime, ₹50,000 in Old Regime.
  - Slabs: 0-4L (0%), 4-8L (5%), 8-12L (10%), 12-16L (15%), 16-20L (20%), 20-24L (25%), >24L (30%).
  - Zero tax up to ₹12.75L Gross (₹12L net).
  - Marginal relief for incomes between ₹12,00,000 and ₹12,70,000.
  - Calculate `deductionBreakevenDeltaPaise` (exact rupee amount needed to make Old Regime viable).
  - Calculate Section 234B and 234C quarterly safe-harbors.
- **Verification:** Unit tests asserting 0 tax at ₹12L net, correct marginal relief at ₹12.1L net, and accurate 234C shortfall penalties.

### Issue #2: [CORE-DDD] Implement `CapitalLedgerService` with FIFO Lot Matching & ₹1.25L Harvester
- **Severity:** High (Financial Accuracy)
- **Problem:** Equity trades require strict FIFO order per symbol/ISIN to differentiate STCG (20%) from LTCG (12.5% above ₹1.25L). Intraday must be segregated as speculative business income.
- **Specification:**
  - Chronological queue matching (FIFO) per instrument.
  - Set-off hierarchy: STCL offsets STCG and LTCG; LTCL offsets only LTCG.
  - Compute `remainingLtcgExemptionPaise` out of ₹1,25,000.
  - Compute `taxLossHarvestableLots` to identify loss-booking opportunities before March 31.
- **Verification:** Unit tests for partial lot sales, multi-year holding periods, and ₹1.25L exemption exhaustion.

### Issue #3: [CORE-DDD] Implement `ObligationRadarService` & Monthly Bucket Snapshots
- **Severity:** Medium (Daily Utility)
- **Problem:** Logging micro-expenses creates onboarding friction. Users need cashflow clarity and automated reminder states.
- **Specification:**
  - 30-day window aggregation of upcoming credit cards, SIPs, rent, and quarterly advance tax.
  - `computeFreeCashAfterCommitments` for monthly salary liquidity verification.
  - Macro monthly bucket snapshot: CC statement + UPI debit total + fixed obligations.
- **Verification:** Unit tests for due dates calculation, overdue status, and free cash after commitments.

### Issue #4: [UI/UX] Implement PRD v2.0 4-Quadrant Command Deck
- **Severity:** High (User Experience)
- **Problem:** The v1 dashboard has scattered widgets without cohesive operational hierarchy.
- **Specification:**
  - **Quadrant 1:** FY Tax Telemetry (Regime Delta, Effective Rate, Advance Tax pill: `CLEAR` / `DUE`).
  - **Quadrant 2:** Equity & Capital Gains Gauge (Segmented ₹1.25L LTCG bar, Realized STCG/LTCG).
  - **Quadrant 3:** 30-Day Obligation Radar (Upcoming bills, 1-key mark-as-paid, Free Cash metric).
  - **Quadrant 4:** Persistent Command Bar (`⌘K` / `/` launcher, instant file drop).
- **Verification:** Clean responsive rendering, keyboard navigation, and instant data reactivity.

### Issue #5: [INFRA] Setup Vitest Test Suite for Continuous Feedback Loop
- **Severity:** Medium (Maintainability)
- **Problem:** Lack of automated test runner allows silent regressions in financial calculation logic.
- **Specification:** Install `vitest`, configure `npm test`, and link all domain test suites.
