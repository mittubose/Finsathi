# FinSathi v2 — Production-Ready UI/UX Redesign

The current implementation scaffolded many powerful financial planning modules rapidly, but the result is visually cluttered, inconsistent, and feels unfinished. This plan systematically transforms every surface into a premium, intuitive experience.

## User Review Required

> [!IMPORTANT]
> **Sidebar Restructuring**: The current sidebar has 19 flat links with shallow indentation. The plan consolidates these into **5 collapsible groups** (Dashboard, Ledger, Planning & Wealth, Tax & Trades, Settings). This reduces cognitive load dramatically.

> [!IMPORTANT]
> **Navigation Consolidation**: Several standalone pages (Insurance, Loss Harvesting, Debt Optimizer, Budget Buckets, Education Planner, Wealth Projector) will become **tab panels within their parent page** rather than separate routes. For example, the Planning page will have tabs: Budget · Debt · Education · Wealth. This means fewer sidebar items and a more focused experience.

> [!WARNING]
> **Terminal aesthetic moderation**: The `CMD_PREFIX >` and `EXECUTE` paradigm is great for the Ledger (where it feels like a power-user tool), but it looks jarring in planning calculators and family management. These will use a cleaner **card-based form** pattern instead.

## Proposed Changes

### 1. Sidebar Restructuring
#### [MODIFY] [Sidebar.tsx](./finsathi-app/src/shared/ui/Sidebar.tsx)
#### [MODIFY] [Sidebar.css](./finsathi-app/src/shared/ui/Sidebar.css)

**Changes:**
- Replace flat nav list with **collapsible groups** using `<details>/<summary>` or state-driven toggles
- 5 groups: **Dashboard** (single link), **Ledger** (Ledger, Imports, Excel Import), **Reports & Analytics** (Reports, Insights, FY Summary, Inflation, Calculators), **Planning & Wealth** (Family Hub, Budget, Debt, Insurance, Education, Wealth), **Tax & Trades** (Tax Engine, Advance Tax, Trades, Loss Harvesting), **Settings** (Settings, Global Variables, Audit)
- Each group gets a subtle divider and group header label
- Active group auto-expands; collapsed groups show a compact icon
- Add a proper **FY selector dropdown** in the sidebar brand area (replace the static text)

---

### 2. Dashboard — Hero + Bento Grid Polish
#### [MODIFY] [Dashboard.tsx](./finsathi-app/src/domains/ledger/Dashboard.tsx)
#### [MODIFY] [Dashboard.css](./finsathi-app/src/domains/ledger/Dashboard.css)

**Changes:**
- Add **Month filter bar** at the top (pill-style selectors: Apr–Mar + "All" for full FY view)
- All widget calculations respect the selected month/FY filter
- Hero section: cleaner layout with a subtle gradient glow behind the net income figure
- Bento grid: standardize all widget cards to consistent `min-height`, header+body pattern
- **Net Worth Snapshot**: Add a mini stacked bar chart (assets vs liabilities) instead of just text
- **Upcoming Notifications**: Empty state with a calming "All clear" message + icon instead of just hiding the widget
- **Quick Actions**: Redesign as floating circular icon buttons with tooltips instead of horizontal pill strip
- **Recent Activity**: add category-specific icons (salary → `payments`, grocery → `shopping_bag`, savings → `savings`, etc.)
- All widgets get a subtle **hover elevation** animation

---

### 3. Planning Domain — Consolidated Tabbed View
#### [MODIFY] [BudgetBuckets.tsx](./finsathi-app/src/domains/planning/BudgetBuckets.tsx)
#### [MODIFY] [DebtOptimizer.tsx](./finsathi-app/src/domains/planning/DebtOptimizer.tsx)
#### [MODIFY] [EducationPlanner.tsx](./finsathi-app/src/domains/planning/EducationPlanner.tsx)
#### [MODIFY] [WealthProjector.tsx](./finsathi-app/src/domains/planning/WealthProjector.tsx)
#### [NEW] [PlanningHub.tsx](./finsathi-app/src/domains/planning/PlanningHub.tsx)
#### [NEW] [PlanningHub.css](./finsathi-app/src/domains/planning/PlanningHub.css)

**Changes:**
- Create `PlanningHub` as a tabbed container with 4 tabs: **Budget** · **Debt** · **Education** · **Wealth**
- Each tab renders its component inline (no separate routes needed, though routes still work for deep linking)
- Replace `terminal-command-bar` pattern with a **clean card-based form** using `vault-field`, `vault-input`, `vault-btn--primary`
- Add proper **empty states** with illustrations/icons and call-to-action
- Budget Buckets: Add a visual pie chart preview of bucket allocations
- Debt Optimizer: Add amortization progress bar per loan
- Education Planner: Add a year-by-year growth visualization
- Wealth Projector: Add a simple growth curve chart

---

### 4. Family Hub — Premium Redesign
#### [MODIFY] [FamilyHub.tsx](./finsathi-app/src/domains/family/FamilyHub.tsx)
#### [MODIFY] [Family.css](./finsathi-app/src/domains/family/Family.css)

**Changes:**
- Members list: Show as **avatar cards** with relation badges (👤 icons with color coding by relation)
- Assets: Grouped by member with expandable sections
- Cashflows: Timeline-style layout with probability indicators (color-coded dots)
- Replace `terminal-command-bar` with slide-in **modal forms** (using the existing `Modal` component)
- Add asset totals summary card at the top of the assets tab
- Empty states with friendly messaging

---

### 5. Risk (Insurance) & Tax (Loss Harvesting) — Polish
#### [MODIFY] [InsurancePortfolio.tsx](./finsathi-app/src/domains/risk/InsurancePortfolio.tsx)
#### [MODIFY] [LossHarvesting.tsx](./finsathi-app/src/domains/tax/LossHarvesting.tsx)

**Changes:**
- Insurance: Replace command-bar with modal form; show policies as **cards with renewal countdown badges**
- Insurance: Add type-specific icons (🏥 health, 🚗 vehicle, ❤️ life, 🏠 property)
- Loss Harvesting: Already clean layout, just needs proper icons and better card spacing
- Add info tooltips explaining STCG/LTCG rules on hover

---

### 6. Global Variables — Settings-Grade UI
#### [MODIFY] [GlobalVariables.tsx](./finsathi-app/src/domains/settings/GlobalVariables.tsx)

**Changes:**
- Replace raw `<input>` elements with proper `vault-input-wrap` + `vault-field` components
- Add range sliders as visual companions (dual input: slider + text field)
- Group by category with subtle section headers

---

### 7. Shared CSS Enhancements
#### [MODIFY] [index.css](./finsathi-app/src/index.css)
#### [MODIFY] [components.css](./finsathi-app/src/shared/ui/components.css)

**Changes:**
- Add `.animate-in` keyframe (fade+slide up) for page transitions
- Add `.widget-hover` class for subtle lift on hover
- Add `.section-header` utility for domain section titles  
- Add `.empty-state` enhanced pattern with icon + title + description + CTA
- Ensure all form inputs have consistent focus ring styling
- Add a `.month-filter-bar` component style

---

### 8. Route Consolidation
#### [MODIFY] [App.tsx](./finsathi-app/src/App.tsx)

**Changes:**
- Add `/planning` route pointing to `PlanningHub`
- Keep individual routes (`/budget`, `/debt-optimizer`, etc.) as redirects to `/planning?tab=X` for backwards compat
- Clean up unused imports

## Verification Plan

### Automated Tests
- Run `npm run build` to verify no TypeScript errors
- Run the dev server and manually navigate all routes
- Check responsive layout at 768px and 1024px breakpoints

### Manual Verification
- Visual inspection of all redesigned pages
- Verify FY/Month filter updates dashboard widgets
- Verify sidebar collapse/expand behavior
- Verify form validation (empty fields, negative numbers)
- Check mobile nav still functions
