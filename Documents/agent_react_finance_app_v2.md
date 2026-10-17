# AGENT.md — Updated Additions for FinSathi Web

## New module expansion
The product now includes recurring income, recurring expenses, recurring savings, intelligent document import, payslip/Form 16 understanding, advance tax help, multi-account trading P&L, multi-year reporting, ledger editing, and full activity logging.

## New domain slices
- recurring-rules
- document-intelligence
- salary-import
- tax-education
- trading-accounts
- multi-year-reports
- activity-audit

## Task routing update
### Highest-tier model required for
- payroll parsing logic,
- tax engine inference from Form 16 and payslip data,
- advance tax rule explanation,
- multi-account tax P&L design,
- loss harvesting or tax-sensitive suggestions,
- and document type inference rules.

### Mid-tier model suitable for
- recurring item CRUD,
- import review screens,
- ledger detail views,
- reporting pages,
- activity log tables,
- and help-panel UI.

### Lower-tier model suitable for
- calendar recurrence widgets,
- form layout components,
- list rows and empty states,
- tag chips,
- and basic report cards.

## Import intelligence rules
Agents working on imports must follow this order:
1. Detect file type.
2. Detect document type.
3. Explain document meaning.
4. Extract key fields.
5. Show confidence.
6. Ask for confirmation.
7. Save raw file and parsed result.
8. Write an import activity log.

## Salary document parsing rules
When parsing payslips or Form 16:
- identify basic, HRA, allowances, PF, tax, and net pay,
- detect old-regime specific fields such as HRA exemption,
- do not auto-apply deductions without validation,
- preserve source mapping for each field,
- and always store extraction confidence.

## Recurrence rules
A recurring item may be:
- income,
- expense,
- savings,
- tax reminder,
- or transfer.
Each item must support weekly, monthly, quarterly, yearly, and custom intervals.

## Activity logging rules
Every meaningful mutation must create a log entry:
- create,
- update,
- delete,
- import,
- parse,
- sync,
- reminder trigger,
- reminder snooze,
- and tax calculation refresh.

## Reporting rules
Reports must support:
- per financial year,
- multi-financial-year comparison,
- multi-account investment/trading views,
- salary and deduction summaries,
- and export-ready audit views.

## Safety rules for agents
- Never merge parsed data directly into tax calculations without review status.
- Never mix savings with expenses in the same dashboard bucket.
- Never treat one imported field as complete truth when the source is ambiguous.
- Never remove the activity log from a task to simplify scope.
- Never discard source files after parsing.

## Hand-off priorities
### Do first
- recurrence model,
- import type detection,
- activity log schema,
- multi-year report filters.

### Do next
- payslip/Form 16 extraction,
- tax help panel,
- multi-account trading P&L.

### Do later
- advanced inference for rare documents,
- more complex tax suggestion rules,
- deeper reconciliation across sources.
