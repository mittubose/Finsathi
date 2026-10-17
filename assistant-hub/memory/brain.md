# Brain - Central Knowledge & Navigation Hub

This hub connects the AI assistant's memory layer to prevent context loss across sessions without causing context window bloat.

## Quick References & Working Memory
- **Task Board & Backlog:** [roadmap.md](./roadmap.md)
- **Decisions & History:** [project_log.md](./project_log.md)

---

## Agent Navigation Rules
1. **Always read `roadmap.md` first** when starting a new session or feature to know active priorities.
2. **Consult `project_log.md` sparingly**: Only inspect the most recent 3-5 entries unless looking up a specific past architectural decision.
3. **Before ending any session**, append an entry into `project_log.md` detailing:
   - What was requested
   - Decisions made & rationale
   - What was shipped or changed
4. **Never rewrite or summarize past history** in `project_log.md` (append-only).
