# PRD — FinSathi Web (Updated Additions)

## 1. Scope Update
This update adds recurring financial tracking, intelligent document import, trading P&L across multiple accounts, multi-financial-year reporting, detailed ledger editing, and full activity logging. The product remains a React web app with Supabase-backed security and a local-first UX for drafts, imports, and review states.[web:30][web:27]

## 2. New Product Areas
### 2.1 Recurring income
The app must support recurring income such as salary, consulting retainers, rent received, and any periodic inflow that repeats on a schedule. Recurrence patterns must support weekly, monthly, quarterly, and yearly cycles.

### 2.2 Recurring expenses
The app must support recurring expense templates for rent, electricity, internet, food, transport, groceries, entertainment, subscriptions, auto insurance, card payments, and property tax. Users must be able to mark a recurring expense as fixed, variable, or estimate-based.

### 2.3 Recurring savings and investments
The app must support recurring saving/investment tracks such as equity SIPs, mutual fund SIPs, chit fund contributions, recurring deposits, and other systematic saving plans. Each savings stream must be tracked separately from expenses because it is not always a deductible expense.

## 3. Recurrence model
| Field | Description |
|---|---|
| Title | Human-friendly label such as Rent or Salary |
| Type | Income, expense, savings, tax, or transfer |
| Frequency | Weekly, monthly, quarterly, yearly, or custom |
| Amount rule | Fixed, variable, formula, or reminder-only |
| Start date | First expected occurrence |
| End date | Optional stop date |
| Next due date | Auto-computed from recurrence rule |
| Source | Manual, import, OCR, Notion, Form 16, payslip |
| Status | Active, paused, completed, overdue |

## 4. Intelligent imports
### 4.1 Supported import types
- CSV
- Excel
- PDF
- Image
- Word document where feasible

### 4.2 Import intent understanding
The import flow must not only extract numbers; it must also explain what the document is. Example cases include monthly payslips, Form 16, broker statements, bank statements, utility bills, subscription invoices, and tax notices.[web:55][web:58][web:59]

### 4.3 Document understanding flow
1. Detect document type.
2. Explain probable purpose in plain language.
3. Show extracted fields and confidence.
4. Let the user confirm or correct the mapping.
5. Save raw file, parsed output, and audit log.

### 4.4 Payslip and Form 16 understanding
The system must understand payslip and Form 16 layouts from PDF, Word, Excel, and images. It must recognize salary heads such as Basic, HRA, allowances, PF, taxes, ELSS references, deductions, and net pay, then prefill tax-related fields where confidence is high.[web:55][web:57][web:61][web:64]

### 4.5 Import edge cases
- Multiple pages with different layouts.
- Same employee with revised payslip or arrears.
- Missing headings or merged cells in Excel.
- OCR confusion between tax, PF, and deduction columns.
- Form 16 Part A and Part B arriving separately.
- PDF or image scan with low confidence.

## 5. New financial entities
### 5.1 Ledger categories
The ledger must support income, expense, savings, transfer, trading, tax, deduction, and adjustment entries.

### 5.2 Trading and investment accounts
The app must support multiple trading accounts and multiple investment accounts. Each account should have its own ledger view, tax P&L, dividend gain tracking, capital gain tracking, and import history.

### 5.3 Tax P&L views
The app must show separate summaries for:
- Salary tax view
- Dividend income view
- Capital gains view
- Mutual fund tax view
- ELSS and deduction-related views
- Multi-account trading P&L

## 6. Reports
Reports must support multiple financial years, not only the current year.

### Required report views
- Monthly report
- Quarterly report
- Yearly report
- Financial-year comparison report
- Multi-year trend report
- Trading P&L by account
- Salary and deduction report
- Tax-saving summary by year
- Activity log report

### Report edge cases
- User changes FY selection.
- Imported data belongs to multiple years.
- Partial year due to onboarding after April.
- Old regime and new regime comparisons across years.

## 7. Ledger editing and detail views
The ledger must allow edit, view, archive, and delete actions with a detail drawer or detail page. Every record should show the source, creation time, update history, and linked documents where available.

### Required behaviors
- Inline edit for common fields.
- Detail view for source documents and notes.
- Change history visible for critical records.
- Soft delete with recovery period.

## 8. Activity log
The app must maintain a full activity log for user actions and system actions.

### Logged actions
- Login and logout
- Import started, failed, completed
- Record create, update, delete
- Reminder created, snoozed, completed
- Tax rule update applied
- OCR review accepted or rejected
- Sync conflict detected and resolved

### Activity log rules
- Every action must show timestamp, actor, object, and result.
- Sensitive actions should include before/after summaries.
- Logs must be filterable by date, entity, and action type.

## 9. Tax engine additions
The tax engine must be able to infer some values from payslip or Form 16 imports and then let the user validate them.

### Common auto-populated fields
- Gross salary
- Basic salary
- HRA
- PF
- Professional tax
- Eligible deductions where visible
- TDS or tax already deducted
- Net pay

### Important rule
The app must never treat imported fields as final tax truth without user confirmation unless the confidence level and source mapping are high enough.

## 10. Help and education UX
The app must include help icons and inline education prompts for tax terms.

### Required help content
- What is advance tax?
- What is Form 16?
- What is HRA?
- What is PF deduction?
- What is capital gain?
- What is dividend income?
- What is loss harvesting?
- What is the difference between tax deduction and tax exemption?

### UX rules
- Help should open in a short bottom sheet or side panel.
- Definitions should be plain language, not legal jargon.
- Show a “why this matters” example whenever possible.
- Keep help contextual to the field the user is viewing.

## 11. New user journeys
### Journey A: Recurring salary and expense setup
1. User enters salary as recurring monthly income.
2. User adds recurring rent, electricity, internet, and food patterns.
3. User sets annual building tax and insurance reminders.
4. Dashboard begins showing month-by-month expected cash flow.

### Journey B: Import payslip or Form 16
1. User uploads PDF, Excel, Word, or image.
2. System identifies document as payslip or Form 16.
3. System explains key fields and prepopulates salary tax data.
4. User confirms or edits values.
5. Tax engine updates instantly.

### Journey C: Trading and investment reporting
1. User imports multiple broker accounts.
2. System groups trades by account and financial year.
3. System calculates capital gain, dividend income, and realized P&L.
4. User reviews tax P&L and export-ready summary.

## 12. Prioritized delivery
### High priority
- Recurring income and recurring expenses
- Intelligent payslip/Form 16 import
- Multi-account trading P&L
- Multi-year reporting
- Activity log

### Medium priority
- Recurring savings schedules
- Help icons and tax education content
- Ledger detail views
- Tax P&L by income type

### Lower priority
- Word document import if PDF/Excel/image already work well
- Advanced explanation of rare tax cases
- Deep multi-entity reconciliation

## 13. Do and don’t
### Do
- Do make recurrence easy to define and edit.
- Do allow manual correction after intelligent import.
- Do keep raw source files attached to parsed records.
- Do show separate views for income, expense, savings, and trading.
- Do preserve audit history for every important record.

### Don’t
- Don’t hide imported data transformation.
- Don’t assume a payslip field is tax-exempt because of the label.
- Don’t combine savings with expenses.
- Don’t limit reports to a single financial year.
- Don’t remove activity logs from the MVP.

## 14. Acceptance criteria summary
- Users can create recurring income, expense, and savings items with flexible recurrence rules.
- Users can import PDF, Excel, CSV, and image documents and understand what the file represents.
- Payslip and Form 16 imports can populate tax inputs with review.
- Users can manage multiple trading accounts and view tax P&L by account.
- Reports support multiple financial years.
- Ledger records are editable with details and history.
- Every meaningful action is recorded in the activity log.


## 15. New additions from scope update
### 15.1 Recurring income
The app must support recurring income items such as salary and other periodic inflows. Salary should be modeled as a recurring income stream with optional variable components such as bonus and arrears.

### 15.2 Recurring expenses
The app must support recurring expenses for rent, electricity, internet, food, transport, groceries, entertainment, subscriptions, auto insurance, card payments, and property tax. Each recurring expense must support weekly, monthly, quarterly, and yearly schedules.

### 15.3 Recurring savings
The app must support recurring savings or investment contributions such as equity SIPs, mutual fund SIPs, chitt fund contributions, and other periodic allocations. These should be visually separated from expenses so the user can distinguish consumption from saving behavior.

### 15.4 Intelligent document import
Imports must accept CSV, Excel, PDF, image, and Word documents where feasible. The system must detect what the document is, explain it in plain language, and extract relevant fields with a confidence score before committing data.

### 15.5 Payslip and Form 16 understanding
The app must be able to read monthly payslips and Form 16 documents in PDF, Word, Excel, and image formats. It should infer salary heads like Basic, HRA, PF, deductions, tax, ELSS-related entries, and net pay, then prefill the tax engine where confidence is high and ask for validation where confidence is low.[web:55][web:58][web:61][web:64]

### 15.6 Advance tax education
The UI must include a help icon or help panel for advance tax, including a plain-language explanation, why it matters, and due dates. Advance tax should be shown as a guidance and reminder concept when projected tax after TDS exceeds the threshold.[web:59][web:65]

### 15.7 Trading P&L and investment tax views
The app must add multiple trading account support and tax P&L views across equity gains, dividend income, mutual fund gains, ELSS-related tracking, and capital gains. Each source of return should remain separately identifiable so the app can produce a combined but auditable tax summary.[web:60][web:63][web:66]

### 15.8 Multi-year reporting
Reports must support multiple financial years and side-by-side comparison across years. Users should be able to inspect salary, deductions, trades, gains, and taxes across more than one FY.

### 15.9 Ledger editing and activity log
Ledger entries must support edit, view details, history, and soft delete. The app must also keep a full activity log for all user actions and important system actions, especially import, edit, delete, tax calculation, and sync operations.
