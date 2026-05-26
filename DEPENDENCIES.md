# TRACE — Dependency Graph

All documents, portals, and artifacts that must update when upstream sources change.
When you modify any SOURCE, check its DEPENDENTS and create backlog items for each.

## Graph

```
schema (vault-a, vault-b, vault-c)
  → migrations/*
  → docs/CHAPTER_SETUP.md §5 (SQL bootstrap)
  → docs/pdf/TRACE_Chapter_Setup_Guide.pdf
  → README.md (architecture section)
  → docs/pdf/TRACE_Overview.pdf
  → HANDOFF.md (database section)

auth model (src/api/auth, src/api/setup)
  → operator login screen (operator/src/lib/auth-gate.tsx)
  → docs/CHAPTER_SETUP.md §6 (security hardening)
  → docs/CHAPTER_SETUP.md §5 (first operator)
  → README.md (security section)
  → docs/pdf/* (all PDFs)
  → .env.example
  → HANDOFF.md (auth section)

dispatch system (src/api/dispatch, dispatch tables)
  → operator triage (operator/src/pages/triage.tsx)
  → operator intel map (operator/src/pages/intelligence.tsx)
  → reporter map (pwa/src/pages/reporter-map.tsx)
  → DISPATCH_DESIGN.md
  → docs/pdf/TRACE_Dispatch_Design.pdf
  → HANDOFF.md (dispatch section)

design system (shared/design, DESIGN_SYSTEM.md)
  → operator CSS/theme
  → reporter CSS/theme
  → docs/pdf/* (brand colors, fonts)
  → favicons (operator, pwa)

voice guide (VOICE_GUIDE.md)
  → all UI copy (operator, reporter)
  → all docs prose
  → docs/pdf/* prose

operator portal features
  → operator onboarding (operator/src/components/operator-onboarding.tsx)
  → README.md (how it works > operators)

reporter portal features
  → reporter onboarding (pwa/src/components/onboarding.tsx)
  → README.md (how it works > reporters)
  → docs/CHAPTER_SETUP.md §8-9 (reporter invite, app install)
```

## Rules

1. When a SOURCE changes, every DEPENDENT gets a backlog item.
2. PDFs regenerate after any doc change: `python scripts/gen-pdfs.py`
3. Portal copy changes require rebuild + deploy.
4. Schema changes require migration + CHAPTER_SETUP SQL update + PDF regen.
5. HANDOFF.md updates at session close, always.

## Enforcement

Before each commit that touches a source file, check this graph.
CI could automate this with a pre-commit hook that flags stale dependents.

### Pre-commit check (manual for now)

```
Modified file → Check DEPENDENCIES.md → List dependents → Update or create backlog item
```

### Planned: automated staleness checker

A script that reads git diff, maps changed files to this graph,
and prints which dependents need attention. Integrate with PROMETHEUS
backlog system for automatic ticket creation.
