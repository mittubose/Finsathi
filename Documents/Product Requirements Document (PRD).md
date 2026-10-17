<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Product Requirements Document (PRD)

## Product

**Name:** FinSathi Web
**Type:** React web application for personal finance, tax intelligence, trading records, reminders, and document ingestion
**Version:** 2.0
**Date:** May 1, 2026

## Document purpose

This PRD defines the product requirements for a React-based financial operating system focused on Indian salary tax, capital gains tracking, recurring obligations, OCR-led expense capture, Notion/Keep/image ingestion, and secure long-term record keeping. It is written to support both human-led and agentic development, with requirements designed for modular execution, testability, and phased delivery.[^1][^2]

## Product vision

FinSathi Web should become a single source of truth for an individual who earns salary, trades in equities, logs manual income and expenses, and wants ongoing tax awareness rather than year-end tax panic. The product should reduce fragmented workflows across spreadsheets, broker exports, images, reminder apps, and notes tools while preserving control, security, and auditability.[^3][^4]

## Problem statement

Users with mixed financial activity often manage data in multiple places: salary records in email or spreadsheets, expenses in images or notes, trading records in broker exports, and tax calculations in calculators or ad hoc spreadsheets. This creates delayed visibility, duplicate data entry, reconciliation errors, missed deductions, missed recurring payments, and weak historical records when files or devices change.[^5][^3]

## Goals

- Provide accurate year-round tax estimation for salary and trading activity.
- Support structured and unstructured ingestion from CSV, Excel, images, and notes tools.
- Keep the app usable with manual entry even when integrations fail.
- Use a React architecture that can scale cleanly with offline-first sync, background processing, and modular agents.[^2][^6][^1]
- Protect sensitive financial data with browser-safe, database-enforced access control and auditable changes.[^4][^7]


## Non-goals for MVP

- Direct filing of income tax returns.
- Automated derivatives/F\&O tax audit workflows.
- Bank account aggregation via regulated banking connectors.
- Family shared ledger and multi-user household planning.
- AI-generated investment recommendations.


## Primary users

### Primary persona

A salaried professional in India with active swing trading and long-term investing, comfortable with digital tools, who wants a modern web app to track salary, expenses, capital gains, reminders, and deductions with minimal manual reconciliation.

### Secondary persona

A meticulous self-tracker who currently uses Notion, Google Keep, and spreadsheets and wants a unified archive with better reminders, OCR, and tax intelligence.

## Product principles

- **Accuracy before automation**: all automation must remain reviewable.
- **Manual fallback always available**: no feature should block the user when parsing or sync fails.
- **Local-first interaction**: the UI should remain responsive even with poor connectivity or long-running imports.[^6][^1]
- **Security by default**: authorization must be enforced in the database, not just the client.[^4]
- **Agent-ready modularity**: each feature area must be independently specifiable, testable, and mergeable.


## Success metrics

| Metric | Target | Why it matters |
| :-- | --: | :-- |
| Time to first usable dashboard | under 10 minutes | Faster setup increases activation |
| Time to import broker CSV | under 2 minutes for common files | Reduces friction in trading workflows |
| OCR review completion rate | above 80% | Measures practical value of receipt scanning |
| Reminder completion rate | above 65% | Indicates reminders are actionable |
| Tax estimate confidence issues | under 2% flagged sessions | Reflects engine trustworthiness |
| Data sync failure rate | under 1% of sync jobs | Critical for financial reliability |

## Platform and architecture

### Frontend

- React with TypeScript
- Vite or Next.js App Router for the web shell
- TanStack Query for server sync and cache orchestration
- Zustand or Redux Toolkit for app state where local transactional state is needed
- React Hook Form + Zod for structured forms
- Tailwind CSS or a token-based component system
- Recharts or a lightweight charting library for dashboards


### Backend

- Supabase for Auth, Postgres, storage, and Row Level Security.[^2][^4]
- Supabase Edge Functions or serverless workers for heavy parsing, reminders, and tax rule updates.[^2]
- Background job queue for imports, OCR post-processing, and scheduled reminders


### Local-first strategy

- Browser storage layer for draft transactions, queued uploads, and unsynced form changes
- Sync queue with retry, conflict markers, and operation history
- Long-running imports and heavy calculations offloaded to web workers to prevent UI freezing in financial dashboards.[^1]


## Scope overview

The product will be delivered in phases so the system can remain stable while agentic development scales from simple components to risk-sensitive modules.

### Phase 1: Core ledger and tax visibility

- Authentication
- Dashboard shell
- Manual entry for income, expense, and trade records
- Salary + capital gains tax estimator
- Recurring reminders manual setup
- Basic reports


### Phase 2: File and image ingestion

- CSV/Excel import
- OCR for receipts and tax/utility documents
- Import review workflows
- Deduplication and reconciliation


### Phase 3: Connected intelligence

- Notion sync
- Google Keep import pipeline via forwarding/manual bridge
- Inflation calculator by category
- Tax-saving suggestions and advance-tax planning


### Phase 4: Hardening and scale

- Advanced audit trail
- Rule versioning for tax law changes
- Better sync conflict resolution
- Export packs for accountant review


## Detailed requirements

## 1. Authentication and access

### User story

As a user, I want a secure but simple login so I can access my finance records quickly without creating fragile password habits.

### Functional requirements

- Support email OTP or phone OTP login.
- Support persistent sessions with secure re-auth prompts for sensitive actions.
- Support optional passcode lock inside the web app for shared desktop scenarios.
- Support onboarding choices for financial year, preferred tax regime, and data source preferences.


### Acceptance criteria

- A new user can sign in and reach dashboard setup in under 3 steps.
- A returning user can access the app without re-entering all onboarding data.
- Sensitive sections such as tax exports and document vault can require re-verification.


### Edge cases

- OTP expires before entry.
- User opens multiple tabs and signs out in one tab.
- Session refresh fails during file upload.
- User starts onboarding on mobile and resumes on desktop.


## 2. Dashboard

### User story

As a user, I want a clean dashboard that shows financial position, tax liability, upcoming obligations, and sync health at a glance.

### Functional requirements

- Show net income, total expenses, realized trading gains, estimated tax, upcoming reminders, and recent imports.
- Show current sync state and data freshness markers.
- Provide quick actions for add income, add expense, add trade, import file, scan image, and create reminder.
- Provide monthly trend widgets and tax-saving opportunity cards.


### Acceptance criteria

- The first screen must remain useful with no imports present.
- Widgets should degrade gracefully when data is incomplete.
- Dashboard should load skeletons first, then partial data, instead of blocking on all queries.[^1]


### UX requirements

- One clear visual hierarchy: financial status, tax status, obligations, and recent activity.
- Avoid dense fintech clutter; prioritize actionable cards over noisy charts.
- Use progressive disclosure for details instead of overwhelming the first view.[^3]


### Edge cases

- No data yet.
- Mixed financial year data imported.
- Future-dated obligations only.
- Trading losses exceed salary tax benefit logic.
- Partial import still processing.


## 3. Manual ledger entry

### User story

As a user, I want fast manual entry so I can record items even when files, APIs, or OCR are unavailable.

### Functional requirements

- Create, edit, archive, and delete income records.
- Create, edit, archive, and delete expense records.
- Create trade entries with buy date, sell date, quantity, price, charges, asset type, and notes.
- Attach tags, notes, and supporting files to any record.
- Support draft mode for partially completed forms.


### Acceptance criteria

- A user can add an expense in under 20 seconds.
- Form validation prevents invalid dates, malformed numbers, and impossible trade ranges.
- Monetary values must store in paise/cents integer form or decimal-safe representation.


### Edge cases

- Duplicate manual entry within minutes.
- Expense marked as recurring but with changing amounts.
- Income entered in a different currency.
- Trade sell date earlier than buy date.
- Charges missing from broker note.


## 4. Salary tax engine

### User story

As a salaried user, I want ongoing tax estimates so I can see projected liability and tax-saving actions before the financial year ends.

### Functional requirements

- Capture annual salary structure including gross salary, basic pay, HRA, deductions at source, bonus, and other taxable components.
- Support comparison between old and new tax regime.
- Support deductions such as 80C, 80D, and other configurable exemptions where applicable.
- Show estimated tax due, projected monthly withholding gap, and actionable deduction suggestions.
- Keep rule tables versioned and updateable when tax law changes.


### Acceptance criteria

- Engine can compute tax from manual salary input only.
- Engine can compare regimes side by side.
- Any tax estimate must display assumptions and confidence level.


### Edge cases

- Mid-year job switch.
- Bonus paid after quarter-end.
- Missing HRA details.
- Company payroll tax already withheld but underreported.
- Tax slabs changed after a product release.


## 5. Trading and capital gains engine

### User story

As an equity trader and investor, I want my trades classified and taxed correctly so I know realized gains, losses, and probable tax impact.

### Functional requirements

- Support equity delivery trades for short-term and long-term capital gains.
- Distinguish short-term and long-term holdings based on holding period.
- Track realized gains, realized losses, and carry-forward logic flags.
- Capture brokerage charges and transaction costs.
- Maintain lot matching strategy, defaulting to FIFO, with explicit auditability.
- Flag unsupported trade types for manual review.


### Acceptance criteria

- Imported or manual trades produce an auditable gain/loss breakdown.
- Users can inspect how a trade lot was matched and taxed.
- Unsupported instruments are not silently misclassified.


### Edge cases

- Partial sells across multiple lots.
- Stock split or bonus issue affecting cost basis.
- Missing ISIN/ticker symbols.
- Duplicate import from same broker export.
- Intraday and delivery transactions mixed in one file.


## 6. Recurring obligations and reminders

### User story

As a user, I want recurring reminders for building tax, maintenance, subscriptions, insurance, and tax deadlines so that I do not miss important payments.

### Functional requirements

- Create recurring reminders with monthly, quarterly, annual, or custom cadence.
- Support reminder lead times such as 30 days, 7 days, 3 days, and due date.
- Support variable amount reminders with “confirm amount” status before settlement.
- Allow one-click conversion of a reminder into an expense record.
- Provide notification inbox inside the app and optional email reminders.


### Acceptance criteria

- Recurring reminders survive month/year transitions correctly.
- Marking a reminder as paid updates both reminder state and ledger.
- Overdue reminders are clearly surfaced without becoming spammy.


### Edge cases

- Building tax amount unknown until notice is uploaded.
- Due date falls on a weekend/holiday.
- User dismisses reminder but does not pay.
- Annual reminder created on Feb 29.


## 7. CSV and Excel ingestion

### User story

As a user, I want to upload broker and expense files so the app can save me manual entry time and keep my calculations current.

### Functional requirements

- Upload CSV and Excel files from desktop and mobile web.
- Detect file type and offer template-specific parsers where known.
- Offer column mapping UI for unknown formats.
- Validate rows, show preview, and allow partial import.
- Keep import logs and row-level error reports.
- Deduplicate against existing transactions using source fingerprinting.


### Acceptance criteria

- Common broker CSV files can be imported with minimal mapping.
- Malformed rows do not block the entire import.
- Users can review before commit.


### UX requirements

- Import should feel guided, not technical.
- Errors should be row-specific and actionable.
- Progress states should be explicit for large files.[^5]


### Edge cases

- Multiple sheets in Excel.
- Mixed delimiters or bad encoding.
- Headers in row 2 or row 3.
- File over size threshold.
- Same file uploaded twice.


## 8. Image ingestion and OCR

### User story

As a user, I want to upload receipts, bills, and notices from images so the app can extract financial information and reduce typing.

### Functional requirements

- Accept camera captures and uploaded images.
- Extract merchant/entity, amount, date, and candidate category.
- Support bill/notice ingestion for items like building tax and insurance notices.
- Present a review-and-confirm screen before saving.
- Store original image in secure storage with metadata link.


### Acceptance criteria

- OCR result is never auto-posted to ledger without review.
- Low-confidence fields are visibly flagged.
- Original image remains retrievable for audit.


### Edge cases

- Blurry or rotated image.
- Multiple totals in one bill.
- OCR reads GST/tax line instead of grand total.
- No date detected.
- Handwritten note with poor recognition.


## 9. Notion and note-source ingestion

### User story

As a user, I want to bring records from Notion and note-like sources into the app so I can consolidate finance tracking.

### Functional requirements

- Connect Notion databases through user-authorized API connection.
- Map finance-related properties such as date, amount, merchant, category, tags, notes, and type.
- Support one-way import first; bidirectional sync later.
- Support image-based import from screenshots exported from Keep or note sources as a fallback.
- Provide a “review before sync” workflow for records from loosely structured sources.


### Acceptance criteria

- User can map a Notion table without code.
- Sync actions are logged with counts of created, updated, skipped, and conflicted items.
- Note-source ingestion never silently overwrites manual records.


### Edge cases

- Notion schema changes after initial mapping.
- User revokes Notion token.
- Duplicate records across Notion and CSV imports.
- Keep has no formal API path for direct sync, requiring fallback ingestion patterns.


## 10. Inflation calculator

### User story

As a user, I want to see how inflation affects my spending categories so I can adjust budgets realistically.

### Functional requirements

- Provide sector/category inflation display for food, housing, transport, healthcare, education, and utilities where data is available.
- Map user expense categories to inflation categories.
- Show personal effective inflation rate based on actual spending mix.
- Show simple budget adjustment suggestions.


### Acceptance criteria

- Inflation views must display source date and freshness.
- Category mapping should be editable by the user.
- Missing sector data should not break the feature.


### Edge cases

- No matching category data.
- User has very little history.
- Expense categories too custom to map automatically.


## 11. Security and record safety

### User story

As a user, I want my records to stay private, recoverable, and auditable so I can trust the app with long-term financial history.

### Functional requirements

- Enforce Row Level Security on all user-owned financial tables.[^4]
- Encrypt sensitive file storage paths and avoid public buckets.
- Maintain audit logs for create/update/delete/import actions.
- Support export of all user data.
- Support soft delete and recovery window for records.
- Store secrets only in secure backend environments, never in the React client.[^2][^4]


### Acceptance criteria

- A user cannot access another user’s records, even through crafted client requests.[^4]
- Audit trail is preserved for financial record mutations.
- Deleted records are recoverable for a limited period.


### Edge cases

- Browser shared on family computer.
- Stale session token during mutation.
- Upload completes but DB write fails.
- User requests complete account deletion.


## 12. Reports and exports

### User story

As a user, I want downloadable reports so I can review my finances and share structured summaries with an accountant.

### Functional requirements

- Monthly summary report.
- Financial year tax summary.
- Capital gains ledger with lot-level detail.
- Expense-by-category and recurring obligations report.
- Export to CSV and PDF-ready summaries.


### Acceptance criteria

- Reports match visible app calculations.
- Exported files have clear timestamps and financial-year scope.
- Missing data is surfaced as assumptions, not hidden.


## User journeys

### Journey 1: First-time setup

1. User lands on marketing-free product shell and signs in.
2. User selects “salary + trading” as financial profile.
3. User chooses manual start or import-first setup.
4. User enters salary snapshot and first recurring obligation.
5. Dashboard shows first tax estimate and next due reminder.

### Journey 2: Broker import

1. User opens import flow.
2. User uploads broker CSV.
3. App recognizes template or requests column mapping.
4. User reviews parsed rows and warnings.
5. Import completes, tax and P\&L widgets refresh.

### Journey 3: Receipt to ledger

1. User uploads a receipt image.
2. OCR extracts probable date, amount, merchant, and category.
3. User corrects low-confidence values.
4. User saves entry.
5. Entry appears in expense timeline and category totals.

### Journey 4: Building tax reminder

1. User creates or imports a building tax obligation.
2. Reminder triggers before due date.
3. User opens reminder detail, confirms amount, and marks paid.
4. App creates expense record and updates obligation history.

## UX requirements

- Web app must feel calm and structured, not like a cluttered trading terminal.[^3][^1]
- Prioritize one clear action per workflow step.
- Use step-based import flows with preview and confirmation.
- Show confidence, assumptions, and source markers for calculated outputs.
- Keep charts explanatory, not decorative.
- Design empty states, sync states, processing states, and conflict states as first-class experiences.


## Agentic development requirements

This product is intended for agentic development, so the system must be decomposed into stable modules with explicit contracts.

### Required development shape

- Define each domain as a vertical slice: auth, ledger, tax, trades, reminders, imports, OCR, integrations, reports.
- Keep domain schemas and API contracts versioned.
- Require every complex feature to ship with fixtures, deterministic test cases, and failure-state UI.
- Separate simple tasks from reasoning-heavy tasks so higher-tier models are used only where justified.


### Task classification

#### High-complexity tasks for stronger models

- Tax engine design and validation
- Capital gains lot matching and audit flows
- Sync/conflict resolution rules
- Security and RLS policy design
- Notion mapping and reconciliation logic
- Import deduplication logic


#### Medium-complexity tasks

- React feature modules
- Dashboard widgets
- Import preview UI
- Reminder management UI
- Report generation UI
- OCR review workflows


#### Lower-complexity tasks

- Component library implementation
- Form scaffolding
- Empty states and helper text
- Table rendering
- Filter bars
- Storybook examples


## Technical constraints for implementation

- Monetary values must avoid floating point drift.
- Any long-running parse or compute task should run outside the main UI thread where practical.[^1]
- Authorization must not rely on client-only checks.[^4]
- Client should tolerate partial backend outages via queued local interactions.[^6]
- Imports must be resumable or restartable without duplicate corruption.


## Risks

| Risk | Impact | Mitigation |
| :-- | :-- | :-- |
| Tax logic errors | High trust loss | Rule versioning, golden test cases, visible assumptions |
| Sync conflicts | Silent data inconsistency | Operation log, conflict review, immutable import source IDs |
| OCR misreads | Wrong expense records | Human confirmation before commit |
| Over-complex MVP | Delays and unstable delivery | Strict phased scope |
| Security misconfiguration | Severe privacy breach | RLS-first design and policy tests[^4] |

## Dependencies

- Supabase project configuration and RLS-enabled schema.[^2][^4]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://olivertriunfo.com/react-financial-dashboard-design-patterns/

[^2]: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs

[^3]: https://technosoftwares.com/blog/streamlining-financial-dashboards-with-reactjs-a-techno-softwares-guide/

[^4]: https://supabase.com/docs/guides/database/postgres/row-level-security

[^5]: https://www.syncfusion.com/blogs/post/import-excel-csv-files-into-react-app

[^6]: https://oneuptime.com/blog/post/2026-01-15-react-native-offline-architecture/view

[^7]: https://supabase.com/features/row-level-security

[^8]: https://www.telerik.com/blogs/lets-build-a-financial-dashboard-with-react

[^9]: https://lobehub.com/pl/skills/cparicardoaguirre-cell-insightpr-dashboard-react-dashboard

[^10]: https://www.brilworks.com/blog/reactjs-for-fintech-development/

[^11]: https://www.olivertriunfo.com/react-financial-dashboards-architecture/

[^12]: https://www.reddit.com/r/reactnative/comments/1reizfy/open_sourced_an_offline_first_expense_tracker/

[^13]: https://www.telerik.com/campaigns/kendo-ui/wb-financial-dashboard-with-react

[^14]: https://www.robinwaite.com/blog/enhancing-financial-data-analysis-with-react-data-grid

[^15]: https://javascript.plainenglish.io/react-native-2026-mastering-offline-first-architecture-ad9df4cb61ae

