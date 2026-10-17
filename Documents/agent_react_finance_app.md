# AGENT.md

## Project
**Name:** FinSathi Web  
**Type:** React + TypeScript financial web app  
**Purpose:** Guide agentic development with clear routing of work, context packaging, quality gates, and model escalation strategy.

## Agentic objective
Build the product in a way that lets multiple LLMs or agents contribute safely without causing architectural drift, security regressions, or hidden assumptions. The workflow must make it easy to assign simple UI work to low-cost models and route domain-critical logic to stronger reasoning models.

## Core development principles
- One task, one outcome, one review path.
- Every task must state domain, inputs, outputs, dependencies, and test expectations.
- Any task touching tax, security, sync, parsing, reconciliation, or money calculations is high scrutiny.
- Every generated artifact must be reviewable by another agent or human without chat history.
- Preserve project memory in repository documents, not ephemeral prompts.

## Suggested stack
- React + TypeScript
- Vite or Next.js
- TanStack Query
- Zustand or Redux Toolkit
- React Hook Form + Zod
- Supabase
- Tailwind CSS or tokenized CSS system
- Vitest + React Testing Library
- Playwright for critical end-to-end flows

## Recommended repository memory files
- `PRD.md`
- `AGENT.md`
- `DECISIONS.md`
- `SCHEMA.md`
- `TASKS.md`
- `TEST_CASES.md`
- `PROMPTS/` for reusable prompt templates

## Mandatory task packet format
Every agent task should start with this packet.

```md
# Task Packet
## Task ID
T-000

## Domain
ledger / tax / imports / auth / reminders / integrations / shared-ui

## Objective
One sentence defining the exact deliverable.

## Why
Why this task exists and what user problem it supports.

## Inputs
- Relevant files
- Schema excerpts
- API contracts
- Design references
- Acceptance criteria excerpt

## Output expected
- Code files to create or update
- Tests to add
- Docs to update

## Constraints
- No new package unless approved
- Must use existing patterns
- Must support loading/error/empty states
- No financial math using float

## Done when
Checklist of exact completion conditions.
```

## Model routing strategy
### Tier A: strongest models
Use for reasoning-heavy, risk-heavy, or system-shaping work.

**Examples**
- Tax engine rules and edge cases
- Capital gains computation logic
- Sync and conflict policy design
- Import deduplication strategy
- Security review and RLS policies
- Notion schema mapping and reconciliation
- Background job orchestration

### Tier B: mid-tier models
Use for implementation-heavy but bounded work.

**Examples**
- React feature modules
- Tables and filters
- Import review screens
- Reminder flows
- Settings and onboarding forms
- Report pages
- Worker integration scaffolding

### Tier C: lower-cost models
Use for repetitive, patterned, or low-risk work.

**Examples**
- Component extraction
- Form wiring
- Placeholder states
- Storybook stories
- Copy cleanup
- Test scaffolding
- Type refactors with explicit contracts

## Escalation rules
Escalate to Tier A when:
- a feature changes monetary logic,
- a feature affects access control,
- an import can corrupt existing records,
- the task requires comparing multiple architecture approaches,
- or the task has more than five meaningful edge cases.

## Work decomposition rules
- Break large features into vertical slices, not technical layers only.
- Never ask one agent to “build the entire app.”
- Prefer task batches that can be merged independently within a day.
- Separate design-system tasks from domain-logic tasks.
- Keep parsing logic separate from UI review logic.
- Keep schema migrations separate from frontend rendering.

## Recommended development sequence
### Wave 1: stability foundation
1. App shell
2. Auth
3. Schema
4. RLS
5. Shared design system
6. Audit/event model
7. Local draft persistence

### Wave 2: financial core
1. Manual ledger
2. Dashboard basics
3. Salary tax estimator
4. Trade entry and realized P&L
5. Reminder engine

### Wave 3: ingestion
1. CSV import pipeline
2. Excel support
3. Import preview and errors
4. OCR upload + review
5. Import history

### Wave 4: integrations and intelligence
1. Notion sync
2. Inflation views
3. Tax-saving suggestions
4. Export packs
5. Conflict resolution hardening

## Best UX practices for agentic implementation
- Always design the empty state before the loaded state.
- Every workflow must define loading, success, partial success, failure, and retry states.
- Never auto-commit parsed finance data without review.
- Show provenance for important values: manual, imported, OCR, synced, estimated.
- Prefer guided flows for imports and calculations over crowded single-screen forms.
- Keep destructive actions reversible where possible.
- Make system status visible: sync pending, import processing, reminder overdue, tax assumptions updated.

## Clean lifecycle for feature delivery
1. Read PRD slice.
2. Read related decisions.
3. Create task packet.
4. Generate implementation plan.
5. Build minimal passing slice.
6. Add fixtures and tests.
7. Add failure-state UI.
8. Update docs.
9. Human or higher-tier review for risky domains.
10. Merge only after regression checks.

## Edge-case checklist for every feature
Every feature task must explicitly consider:
- no data,
- partial data,
- stale data,
- duplicate data,
- invalid user input,
- network interruption,
- retry behavior,
- timezone/date edge cases,
- financial year boundary,
- permission/session expiry,
- accessibility behavior,
- and recoverability after failure.

## Development quality gates
No task is complete unless all apply:
- TypeScript passes.
- Lint passes.
- Tests added or intentionally waived with reason.
- Empty/loading/error states implemented.
- Accessibility labels and keyboard support checked.
- No secrets exposed in client code.
- No unauthorized data path introduced.
- Docs updated if architecture, schema, or behavior changed.

## Suggested skill sets to refine
### For product/tech leadership
- React architecture for domain-driven frontends
- Supabase RLS and database policy testing
- Financial data modeling and reconciliation patterns
- Prompt design for multi-agent delivery
- Test strategy for deterministic business rules
- UI systems for dense but calm dashboards

### For agent prompts
- Structured task decomposition
- Explicit acceptance criteria writing
- Edge-case prompting
- Schema-first feature prompts
- Refactor prompts with “do not change behavior” constraints

### For implementation craft
- Web Workers for parsing and large calculations
- Table UX for finance interfaces
- OCR confidence review flows
- State management boundaries
- Background job observability

## Recommended prompt templates
### Architecture prompt
```md
You are the lead architect for a React financial web app.
Use the attached PRD slice, schema, and constraints.
List edge cases first, then compare 2 approaches, then recommend 1.
Return:
1. decisions,
2. data contracts,
3. folder structure impact,
4. implementation plan,
5. risks,
6. test plan.
```

### Feature prompt
```md
Build the React feature described in the attached task packet.
Use existing project patterns only.
Return complete code for the changed files, including loading/error/empty states and tests.
Do not invent backend fields beyond the provided schema.
```

### Refactor prompt
```md
Refactor the attached code for readability and maintainability.
Do not change behavior.
Preserve public interfaces.
List risks before code.
Return diff-friendly output.
```

## Complex vs simple task prioritization
### Do first
- Schema and access control
- Audit model
- Manual ledger core
- Tax engine skeleton with fixtures
- Reminder data model

### Do next
- Dashboard widgets
- Import framework
- CSV parsing
- OCR review UI
- Reports

### Do later
- Notion sync
- Inflation intelligence
- Smart recommendations
- Advanced reconciliation

### Keep simple tasks available for parallel agent work
- Shared UI primitives
- Form components
- Tabs, drawers, modals
- Table columns and row actions
- Skeletons and empty states
- Copywriting and helper text

## Repo governance rules
- No direct commit to main.
- One feature branch per task packet.
- One migration per schema change.
- Every architectural decision recorded in `DECISIONS.md`.
- Any tax-rule update requires version note and regression test update.

## Hand-off checklist
Before giving a task to another agent or a stronger model, provide:
- PRD slice
- current schema
- decision records
- related code files
- known edge cases
- explicit output format
- non-goals for the task

## Final instruction
Optimize for a clean, inspectable lifecycle over speed. A slower but well-bounded agent workflow is preferable to a fast, tangled build that cannot be trusted with financial records.
