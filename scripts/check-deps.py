"""
TRACE — Dependency Staleness Checker
Reads git diff and maps changed files to dependent artifacts.
Run before commit: python scripts/check-deps.py
"""
import subprocess, sys, re

# Dependency graph: source pattern → list of dependents
GRAPH = {
    "src/db/schema/": [
        "migrations/*",
        "docs/CHAPTER_SETUP.md (§5 SQL bootstrap)",
        "README.md (architecture)",
        "docs/pdf/* (regenerate)",
        "HANDOFF.md (database section)",
    ],
    "src/api/auth/": [
        "operator/src/lib/auth-gate.tsx",
        "docs/CHAPTER_SETUP.md (§5-6 auth/security)",
        "README.md (security)",
        ".env.example",
        "docs/pdf/* (regenerate)",
        "HANDOFF.md (auth section)",
    ],
    "src/api/setup/": [
        "operator/src/lib/auth-gate.tsx",
        "docs/CHAPTER_SETUP.md (§5 bootstrap)",
        "README.md (quick deploy)",
        "docs/pdf/* (regenerate)",
    ],
    "src/api/dispatch/": [
        "operator/src/pages/triage.tsx",
        "operator/src/pages/intelligence.tsx",
        "pwa/src/pages/reporter-map.tsx",
        "DISPATCH_DESIGN.md",
        "docs/pdf/TRACE_Dispatch_Design.pdf",
        "HANDOFF.md (dispatch section)",
    ],
    "shared/design/": [
        "operator CSS/theme",
        "reporter CSS/theme",
        "scripts/gen-pdfs.py (brand constants)",
        "favicons (if brand colors change)",
    ],
    "VOICE_GUIDE.md": [
        "all UI copy (operator + reporter)",
        "all doc prose",
        "docs/pdf/* (regenerate)",
    ],
    "DESIGN_SYSTEM.md": [
        "shared/design/ tokens",
        "scripts/gen-pdfs.py (brand constants)",
    ],
    "README.md": [
        "docs/pdf/TRACE_Overview.pdf (regenerate)",
    ],
    "docs/CHAPTER_SETUP.md": [
        "docs/pdf/TRACE_Chapter_Setup_Guide.pdf (regenerate)",
    ],
    "DISPATCH_DESIGN.md": [
        "docs/pdf/TRACE_Dispatch_Design.pdf (regenerate)",
    ],
}

def get_changed_files():
    """Get files changed since last commit."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True, text=True, check=True
        )
        staged = subprocess.run(
            ["git", "diff", "--name-only", "--staged"],
            capture_output=True, text=True, check=True
        )
        files = set(result.stdout.strip().split("\n") + staged.stdout.strip().split("\n"))
        return [f for f in files if f]
    except subprocess.CalledProcessError:
        return []

def check_dependencies(changed_files):
    """Map changed files to their dependents."""
    alerts = {}
    for f in changed_files:
        f_normalized = f.replace("\\", "/")
        for pattern, dependents in GRAPH.items():
            if f_normalized.startswith(pattern) or f_normalized == pattern:
                for dep in dependents:
                    if dep not in alerts:
                        alerts[dep] = []
                    alerts[dep].append(f_normalized)
    return alerts

if __name__ == "__main__":
    changed = get_changed_files()
    if not changed:
        print("No changed files detected.")
        sys.exit(0)

    print(f"Changed files: {len(changed)}")
    for f in sorted(changed):
        print(f"  {f}")

    alerts = check_dependencies(changed)
    if not alerts:
        print("\nNo dependency alerts.")
        sys.exit(0)

    print(f"\n{'=' * 50}")
    print(f"DEPENDENCY ALERTS ({len(alerts)} items)")
    print(f"{'=' * 50}")
    for dep, sources in sorted(alerts.items()):
        print(f"\n  UPDATE NEEDED: {dep}")
        for s in sources:
            print(f"    triggered by: {s}")

    # Check if PDFs need regeneration
    pdf_needed = any("pdf" in d.lower() for d in alerts)
    if pdf_needed:
        print(f"\n  Run: python scripts/gen-pdfs.py")

    sys.exit(1 if alerts else 0)
