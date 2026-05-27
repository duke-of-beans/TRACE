"""
TRACE YUMA Gate - Pre-deploy Quality Checkpoint
================================================
Run before every deploy. Catches the classes of bugs
we've encountered during development:

  python tests/yuma.py

Exit code 0 = all clear, deploy safe.
Exit code 1 = issues found, fix before deploying.

Categories:
  ROUTE_SYNC  - Vercel entry point matches local dev routes
  VOICE       - No banned words in user-facing strings
  EMDASH      - No em/en dashes in user-facing strings
  LEAK        - No personal URLs, usernames, or API keys
  STRUCTURE   - All expected files exist
  SECURITY    - No dev console.logs leaking sensitive data
  IMPORTS     - All imports in entry points resolve to real files
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASS = 0
FAIL = 0
WARN = 0

def ok(cat, msg):
    global PASS
    PASS += 1

def fail(cat, msg):
    global FAIL
    FAIL += 1
    print(f"  FAIL [{cat}] {msg}")

def warn(cat, msg):
    global WARN
    WARN += 1
    print(f"  WARN [{cat}] {msg}")

def read(path):
    try:
        return open(os.path.join(ROOT, path), "r", encoding="utf-8").read()
    except:
        return None

def lines(path):
    content = read(path)
    return content.split("\n") if content else []


# ============================================================
# TEST 1: ROUTE SYNC (Vercel entry must match local dev)
# ============================================================
def test_route_sync():
    print("\n[1] ROUTE SYNC (api/index.ts vs src/index.ts)")
    vercel = read("api/index.ts") or ""
    local = read("src/index.ts") or ""

    if not vercel:
        fail("ROUTE_SYNC", "api/index.ts not found")
        return
    if not local:
        fail("ROUTE_SYNC", "src/index.ts not found")
        return

    # Extract all .route("/path", routerName) calls (exclude base path)
    def extract_routes(content):
        routes = set(re.findall(r'\.route\(["\']([^"\']+)["\']', content))
        routes.discard("/api/v1")  # base path differs by design
        return routes

    local_routes = extract_routes(local)
    vercel_routes = extract_routes(vercel)

    missing = local_routes - vercel_routes
    extra = vercel_routes - local_routes

    for r in missing:
        fail("ROUTE_SYNC", f"Route '{r}' in src/index.ts but MISSING from api/index.ts")
    for r in extra:
        warn("ROUTE_SYNC", f"Route '{r}' in api/index.ts but not in src/index.ts")
    if not missing:
        ok("ROUTE_SYNC", f"All {len(local_routes)} routes synced")

    # Also check middleware (operatorOnly, adminOnly)
    local_middleware = set(re.findall(r'\.use\(["\']([^"\']+)["\'],\s*(\w+)', local))
    vercel_middleware = set(re.findall(r'\.use\(["\']([^"\']+)["\'],\s*(\w+)', vercel))
    missing_mw = local_middleware - vercel_middleware
    for path, mw in missing_mw:
        if mw in ["operatorOnly", "adminOnly"]:
            fail("ROUTE_SYNC", f"Middleware {mw} on '{path}' missing from api/index.ts")


# ============================================================
# TEST 2: VOICE GUIDE COMPLIANCE
# ============================================================
def test_voice():
    print("\n[2] VOICE GUIDE (banned words in user-facing strings)")
    BANNED = ["designed to", "ensures", "seamlessly", "robust", "empower",
              "leverage", "utilize", "state-of-the-art", "cutting-edge",
              "revolutionize", "next-gen", "best-in-class"]

    user_dirs = ["pwa/src", "operator/src", "pwa/public"]
    skip = {"node_modules", "dist", ".git"}
    found = 0

    for ud in user_dirs:
        full = os.path.join(ROOT, ud)
        for dirpath, dirnames, files in os.walk(full):
            dirnames[:] = [d for d in dirnames if d not in skip]
            for f in files:
                if not any(f.endswith(ext) for ext in [".tsx", ".ts", ".html"]):
                    continue
                fpath = os.path.join(dirpath, f)
                rel = os.path.relpath(fpath, ROOT)
                try:
                    content_lines = open(fpath, "r", encoding="utf-8").readlines()
                except:
                    continue
                for i, line in enumerate(content_lines, 1):
                    low = line.lower().strip()
                    if low.startswith("//") or low.startswith("*") or low.startswith("/*"):
                        continue
                    for b in BANNED:
                        if b in low:
                            fail("VOICE", f"{rel}:{i} [{b}]")
                            found += 1
    if found == 0:
        ok("VOICE", "No banned words found")

# ============================================================
# TEST 3: EM DASH CHECK (user-visible strings only)
# ============================================================
def test_emdash():
    print("\n[3] EM DASHES (user-visible strings)")
    user_dirs = ["pwa/src", "operator/src", "pwa/public"]
    skip = {"node_modules", "dist", ".git"}
    found = 0

    for ud in user_dirs:
        full = os.path.join(ROOT, ud)
        for dirpath, dirnames, files in os.walk(full):
            dirnames[:] = [d for d in dirnames if d not in skip]
            for f in files:
                if not any(f.endswith(ext) for ext in [".tsx", ".ts", ".html"]):
                    continue
                fpath = os.path.join(dirpath, f)
                rel = os.path.relpath(fpath, ROOT)
                try:
                    content_lines = open(fpath, "r", encoding="utf-8").readlines()
                except:
                    continue
                for i, line in enumerate(content_lines, 1):
                    if "\u2014" not in line and "\u2013" not in line:
                        continue
                    stripped = line.strip()
                    # Skip comment lines
                    if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("/*"):
                        continue
                    # Only flag if inside a string literal
                    if any(c in stripped for c in ["'", '"', "`"]):
                        fail("EMDASH", f"{rel}:{i} {stripped[:80]}")
                        found += 1
    if found == 0:
        ok("EMDASH", "No em dashes in user-visible strings")


# ============================================================
# TEST 4: LEAK CHECK (personal info, URLs, keys)
# ============================================================
def test_leaks():
    print("\n[4] LEAK CHECK (personal info, URLs)")
    PATTERNS = [
        ("trace-jet.vercel.app", "Personal Vercel URL"),
        ("davids-projects", "Vercel project slug"),
        ("DKdKe", "Windows username"),
    ]
    skip = {"node_modules", ".git", "dist", ".vercel", "data", "tests"}
    gitignored = {".env", ".env.local", ".env.neon", ".env.production",
                  "HANDOFF.md", "deploy.bat"}
    found = 0

    for dirpath, dirnames, files in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for f in files:
            if f in gitignored:
                continue
            if not any(f.endswith(ext) for ext in [".ts", ".tsx", ".html", ".md", ".json", ".css"]):
                continue
            fpath = os.path.join(dirpath, f)
            rel = os.path.relpath(fpath, ROOT)
            try:
                content = open(fpath, "r", encoding="utf-8").read()
            except:
                continue
            for pattern, desc in PATTERNS:
                if pattern in content:
                    fail("LEAK", f"{rel} contains '{pattern}' ({desc})")
                    found += 1
    if found == 0:
        ok("LEAK", "No personal info leaked")

# ============================================================
# TEST 5: STRUCTURE CHECK (expected files exist)
# ============================================================
def test_structure():
    print("\n[5] STRUCTURE (expected files exist)")
    required = [
        # Route files
        "src/api/sightings/index.ts", "src/api/vehicles/index.ts",
        "src/api/actors/index.ts", "src/api/auth/index.ts",
        "src/api/admin/index.ts", "src/api/geo/index.ts",
        "src/api/dispatch/index.ts", "src/api/setup/index.ts",
        "src/api/tags/index.ts", "src/api/integrations/index.ts",
        "src/api/import/index.ts", "src/api/plates/index.ts",
        "src/api/harassment/index.ts", "src/api/incidents/index.ts",
        # Services
        "src/services/carapi.ts", "src/services/spokeo.ts",
        # Entry points
        "api/index.ts", "src/index.ts",
        # Reporter pages
        "pwa/src/pages/submit.tsx", "pwa/src/pages/alert.tsx",
        "pwa/src/pages/history.tsx", "pwa/src/pages/reporter-map.tsx",
        # Operator pages
        "operator/src/pages/dashboard.tsx", "operator/src/pages/triage.tsx",
        "operator/src/pages/intelligence.tsx", "operator/src/pages/dispatches.tsx",
        "operator/src/pages/incidents.tsx", "operator/src/pages/harassment.tsx",
        "operator/src/pages/vehicles.tsx", "operator/src/pages/actors.tsx",
        "operator/src/pages/admin.tsx",
        "operator/src/pages/security.tsx",
        # Config
        "vercel.json", "pwa/public/guide.html",
    ]
    for f in required:
        if os.path.exists(os.path.join(ROOT, f)):
            ok("STRUCTURE", f)
        else:
            fail("STRUCTURE", f"Missing: {f}")

# ============================================================
# TEST 6: SECURITY (dev console.logs, raw secrets)
# ============================================================
def test_security():
    print("\n[6] SECURITY (sensitive console.logs, secrets)")
    auth_content = read("src/api/auth/index.ts") or ""

    # Check for ungated console.logs that leak reporter info
    for i, line in enumerate(auth_content.split("\n"), 1):
        low = line.strip().lower()
        if "console.log" in low and ("reporter" in low or "callsign" in low or "token" in low or "magic" in low):
            # Acceptable if gated behind NODE_ENV
            context_start = max(0, i - 5)
            context = "\n".join(auth_content.split("\n")[context_start:i])
            if "NODE_ENV" not in context and "process.env" not in context:
                fail("SECURITY", f"src/api/auth/index.ts:{i} Ungated console.log with sensitive data")

    # Check no .env files are tracked by git
    skip = {"node_modules", ".git", "dist", ".vercel"}
    for dirpath, dirnames, files in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for f in files:
            if f in [".env", ".env.local", ".env.production", ".env.neon"]:
                # These should exist on disk but be gitignored
                gitignore = read(".gitignore") or ""
                if f not in gitignore and "*.env*" not in gitignore:
                    fail("SECURITY", f"{f} exists but may not be gitignored")

    ok("SECURITY", "Auth console.logs checked")


# ============================================================
# TEST 7: IMPORT RESOLUTION (entry point imports exist)
# ============================================================
def test_imports():
    print("\n[7] IMPORTS (Vercel entry point imports resolve)")
    vercel = read("api/index.ts") or ""
    imports = re.findall(r'from\s+["\']([^"\']+)["\']', vercel)

    for imp in imports:
        if imp.startswith("hono") or imp.startswith("drizzle"):
            continue  # npm packages
        # Resolve relative to api/ directory
        resolved = imp.replace("../", "").replace("./", "api/")
        # Try with .ts extension
        candidates = [
            os.path.join(ROOT, resolved),
            os.path.join(ROOT, resolved + ".ts"),
            os.path.join(ROOT, resolved.replace(".js", ".ts")),
        ]
        found = any(os.path.exists(c) for c in candidates)
        if found:
            ok("IMPORTS", resolved)
        else:
            fail("IMPORTS", f"Import '{imp}' does not resolve to a file")

# ============================================================
# TEST 8: NAV CONSISTENCY (sidebar items match pages)
# ============================================================
def test_nav():
    print("\n[8] NAV CONSISTENCY (sidebar matches rendered pages)")
    app = read("operator/src/app.tsx") or ""

    # Extract NAV keys
    nav_keys = re.findall(r'key:\s*["\'](\w+)["\']', app)
    # Extract page renders
    page_renders = re.findall(r'page\s*===\s*["\'](\w+)["\']', app)

    nav_set = set(nav_keys)
    render_set = set(page_renders)

    for k in nav_set:
        if k not in render_set:
            fail("NAV", f"Sidebar has '{k}' but no page render for it")
    for r in render_set:
        if r not in nav_set and r not in ["security"]:  # security renders under settings
            warn("NAV", f"Page '{r}' renders but not in sidebar NAV")

    if not (nav_set - render_set):
        ok("NAV", f"All {len(nav_set)} sidebar items have page renders")

# ============================================================
# TEST 9: REPORTER NAV CONSISTENCY
# ============================================================
def test_reporter_nav():
    print("\n[9] REPORTER NAV (bottom tabs match pages)")
    app = read("pwa/src/app.tsx") or ""

    # Extract Page type
    page_type = re.search(r'type Page = (.+?);', app)
    if page_type:
        types = re.findall(r'"(\w+)"', page_type.group(1))
    else:
        types = []

    # Check each type has a render
    for t in types:
        if f'page === "{t}"' in app:
            ok("REPORTER_NAV", f"Page '{t}' has render")
        else:
            fail("REPORTER_NAV", f"Page type '{t}' declared but no render")

# ============================================================
# TEST 10: GUIDE.HTML SCROLL NAV MATCHES SECTIONS
# ============================================================
def test_guide_nav():
    print("\n[10] GUIDE NAV (scroll dots match sections)")
    guide = read("pwa/public/guide.html") or ""

    nav_hrefs = re.findall(r'scroll-nav-dot.*?href="#([^"]+)"', guide)
    section_ids = re.findall(r'id="(step-\d+|complete)"', guide)

    for href in nav_hrefs:
        if href in section_ids:
            ok("GUIDE_NAV", f"#{href} has matching section")
        else:
            fail("GUIDE_NAV", f"Scroll nav links to #{href} but no section with that id")

# ============================================================
# TEST 11: KEYBOARD SHORTCUT ACCURACY
# ============================================================
def test_shortcuts():
    print("\n[11] KEYBOARD SHORTCUTS (count matches NAV length)")
    app = read("operator/src/app.tsx") or ""

    # Count NAV items with non-empty shortcuts
    nav_count = len(re.findall(r'shortcut:\s*["\'][1-9]["\']', app))
    # Check keyboard overlay
    overlay = read("operator/src/components/ux/keyboard-overlay.tsx") or ""
    shortcut_range = re.search(r'"(\d+)-(\d+)"', overlay)

    if shortcut_range:
        declared_max = int(shortcut_range.group(2))
        if declared_max == nav_count:
            ok("SHORTCUTS", f"Overlay says 1-{declared_max}, NAV has {nav_count} items")
        else:
            fail("SHORTCUTS", f"Overlay says 1-{declared_max} but NAV has {nav_count} items")


# ============================================================
# TEST 12: CSS VARIABLE CONSISTENCY
# ============================================================
def test_css_vars():
    print("\n[12] CSS VARS (critical variables defined in both themes)")
    styles = read("pwa/src/styles.css") or ""
    critical_vars = ["--accent", "--bg", "--surface", "--text", "--border",
                     "--text-sec", "--text-muted", "--danger", "--warning", "--success"]

    # Check light theme
    light_section = styles.split("[data-theme='light']")[1].split("}")[0] if "[data-theme='light']" in styles else ""
    dark_section = styles.split("[data-theme='dark']")[1].split("}")[0] if "[data-theme='dark']" in styles else ""

    if not light_section and not dark_section:
        # Try :root
        root_section = styles.split(":root")[1].split("}")[0] if ":root" in styles else ""
        if root_section:
            for v in critical_vars:
                if v + ":" in root_section:
                    ok("CSS", f"{v} in :root")
                else:
                    fail("CSS", f"{v} missing from :root")
    else:
        for v in critical_vars:
            if light_section and v + ":" not in light_section:
                warn("CSS", f"{v} missing from light theme")
            if dark_section and v + ":" not in dark_section:
                warn("CSS", f"{v} missing from dark theme")


# ============================================================
# TEST 13: TOAST API CONSISTENCY
# ============================================================
def test_toast_api():
    print("\n[13] TOAST API (correct calling convention)")
    # useToast() returns a function: toast(msg, type)
    # NOT toast.success(msg) or toast.error(msg)
    bad_patterns = ["toast.success", "toast.error", "toast.info", "toast.warning"]
    skip = {"node_modules", "dist", ".git", "tests"}
    found = 0

    for dirpath, dirnames, files in os.walk(os.path.join(ROOT, "operator", "src")):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for f in files:
            if not f.endswith(".tsx"):
                continue
            fpath = os.path.join(dirpath, f)
            rel = os.path.relpath(fpath, ROOT)
            try:
                content_lines = open(fpath, "r", encoding="utf-8").readlines()
            except:
                continue
            for i, line in enumerate(content_lines, 1):
                for bp in bad_patterns:
                    if bp in line:
                        fail("TOAST_API", f"{rel}:{i} Use toast(msg, 'type') not {bp}(msg)")
                        found += 1
    if found == 0:
        ok("TOAST_API", "All toast calls use correct API")


# ============================================================
# RUNNER
# ============================================================
def main():
    print("=" * 60)
    print("TRACE YUMA GATE")
    print("=" * 60)

    test_route_sync()
    test_voice()
    test_emdash()
    test_leaks()
    test_structure()
    test_security()
    test_imports()
    test_nav()
    test_reporter_nav()
    test_guide_nav()
    test_shortcuts()
    test_css_vars()
    test_toast_api()

    print("\n" + "=" * 60)
    total = PASS + FAIL + WARN
    if FAIL == 0:
        print(f"YUMA GATE: PASSED ({PASS} ok, {WARN} warnings)")
        print("=" * 60)
        sys.exit(0)
    else:
        print(f"YUMA GATE: FAILED ({FAIL} failures, {WARN} warnings, {PASS} ok)")
        print("Fix all FAIL items before deploying.")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()
