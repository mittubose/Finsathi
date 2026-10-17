# Product

## Register

product

## Users

Indian salaried professionals (25-45) who actively trade equities and want year-round tax awareness instead of year-end panic. They currently juggle spreadsheets, broker exports, images of receipts, and note apps. They are comfortable with digital tools and expect precision over hand-holding. Secondary users are meticulous self-trackers migrating from Notion/Keep/spreadsheets who want a unified archive with better reminders and tax intelligence.

## Product Purpose

FinSathi Web is a personal financial operating system for Indian salary tax, capital gains tracking, expense management, recurring obligations, and document ingestion. It replaces fragmented workflows across spreadsheets, broker exports, images, reminder apps, and notes tools. Success looks like: the user knows their estimated tax liability at any point in the financial year, can compare Old vs New regime confidently, tracks realized trading gains with FIFO lot matching, and never misses a recurring payment.

## Brand Personality

Cold, disciplined, sophisticated. A digital vault, not a friendly assistant. The interface communicates total control, professional-grade tooling, and technical nostalgia. It respects the user's intelligence and never patronizes.

## Anti-references

- Generic fintech dashboards (navy + gold, rounded cards, friendly illustrations, gradient accents)
- Cluttered trading terminals (information overload without hierarchy)
- "Friendly" expense apps (Mint, YNAB, Walnut): too casual, too colorful, too much personality
- SaaS-cream aesthetic (off-white backgrounds, teal accents, card-heavy layouts)
- Cookie-cutter React admin templates (Material UI defaults, generic sidebar + topbar)

## Design Principles

1. **Data is the hero.** Every pixel serves information density. Decorative elements exist only when they reinforce the vault metaphor.
2. **Accuracy before automation.** All automation remains reviewable. Show assumptions, confidence levels, and source markers.
3. **Manual fallback always available.** No feature blocks the user when parsing, sync, or OCR fails.
4. **Terminal precision.** Uppercase labels, monospaced numbers, sharp corners, segmented progress bars. The interface reads like instrumentation, not decoration.
5. **Financial year thinking.** Every calculation, every view, every filter defaults to the Indian financial year (April 1 to March 31).

## Accessibility & Inclusion

- WCAG 2.1 AA minimum
- High contrast already inherent in dark theme (light text on dark backgrounds)
- Keyboard navigation for all interactive elements
- Reduced motion support via `prefers-reduced-motion`
- Color-blind safe: green/amber accent system tested for deuteranopia
- Screen reader labels for all financial data, charts, and status indicators
