/**
 * TRACE — Regression + Chain Test Runner
 * Usage: npx tsx scripts/test-regression.ts <test-name>
 *
 * Regression: tests for bugs that were fixed (prevent recurrence)
 * Chain: multi-step workflow verifications
 */
const API = "http://localhost:3100/api/v1";

async function getToken(email = "operator@trace.local"): Promise<string> {
  const res = await fetch(`${API}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json() as any;
  if (!data.sessionToken) throw new Error(`No token for ${email}`);
  return data.sessionToken;
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const tests: Record<string, () => Promise<void>> = {

  // ============================================================
  // REGRESSION: bugs that were fixed, must not recur
  // ============================================================

  // Fixed: operator@trace.local was getting role "reporter" instead of "operator"
  async "operator-role"() {
    const res = await fetch(`${API}/auth/dev-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "operator@trace.local" }),
    });
    const data = await res.json() as any;
    if (data.role !== "operator" && data.role !== "admin") throw new Error(`Expected operator/admin role, got ${data.role}`);
    console.log(`OK: elevated role assigned (${data.role})`);
  },

  // Fixed: admin routes were rejecting operator role (required admin)
  async "operator-admin-access"() {
    const token = await getToken();
    const res = await fetch(`${API}/admin/vehicle-types`, { headers: headers(token) });
    if (!res.ok) throw new Error(`Admin route rejected operator: ${res.status}`);
    console.log("OK: operator can access admin routes");
  },

  // Fixed: invite code contained confusing chars (0/O/1/I)
  async "invite-code-chars"() {
    const token = await getToken();
    const res = await fetch(`${API}/admin/reporters/generate-invite`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ callsign: "CHAR-TEST" }),
    });
    const data = await res.json() as any;
    const code = data.inviteCode.replace("-", "");
    const forbidden = /[0O1I]/;
    if (forbidden.test(code)) throw new Error(`Code contains confusing chars: ${data.inviteCode}`);
    if (code.length !== 8) throw new Error(`Code wrong length: ${code.length}`);
    console.log(`OK: code ${data.inviteCode} has no confusing chars`);
  },

  // Fixed: unauthenticated requests to protected routes must return 401
  async "auth-required"() {
    const routes = ["/vehicles", "/actors", "/sightings", "/admin/vehicle-types"];
    for (const route of routes) {
      const res = await fetch(`${API}${route}`);
      if (res.status !== 401) throw new Error(`${route} returned ${res.status}, expected 401`);
    }
    console.log(`OK: all ${routes.length} protected routes return 401 without auth`);
  },

  // Fixed: nuke endpoint must require operator role, not just any auth
  async "nuke-requires-operator"() {
    // Create a reporter-role token
    const res = await fetch(`${API}/auth/invite-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TEST-CODE" }),
    });
    const data = await res.json() as any;
    const reporterToken = data.sessionToken;

    // Try to nuke with reporter token
    const nukeRes = await fetch(`${API}/admin/nuke`, {
      method: "POST",
      headers: headers(reporterToken),
    });
    if (nukeRes.status !== 403) throw new Error(`Nuke with reporter token: ${nukeRes.status}, expected 403`);
    console.log("OK: nuke requires operator role");
  },

  // ============================================================
  // CHAIN: multi-step workflow verifications
  // ============================================================

  // Full reporter lifecycle: generate invite -> use code -> submit sighting -> verify
  async "reporter-lifecycle"() {
    const suffix = Date.now().toString(36);
    const opToken = await getToken();
    const inviteRes = await fetch(`${API}/admin/reporters/generate-invite`, {
      method: "POST",
      headers: headers(opToken),
      body: JSON.stringify({ callsign: `CHAIN-R-${suffix}` }),
    });
    const invite = await inviteRes.json() as any;
    if (!invite.inviteCode) throw new Error("No invite code generated");
    console.log(`  1. Invite generated: ${invite.inviteCode}`);

    // Step 2: reporter uses code (strip the dash for API)
    const code = invite.inviteCode.replace("-", "");
    const authRes = await fetch(`${API}/auth/invite-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const auth = await authRes.json() as any;
    if (!auth.sessionToken) throw new Error("Invite code auth failed");
    console.log(`  2. Reporter authenticated`);

    // Step 3: reporter submits sighting
    const sightRes = await fetch(`${API}/sightings`, {
      method: "POST",
      headers: headers(auth.sessionToken),
      body: JSON.stringify({
        lat: 34.27, lng: -118.78, plate: "CHAIN-001",
        activityDescription: "YUMA chain test sighting",
        observedAt: new Date().toISOString(),
      }),
    });
    if (!sightRes.ok) throw new Error(`Sighting submit failed: ${sightRes.status}`);
    console.log(`  3. Sighting submitted`);

    // Step 4: operator sees it in sightings
    const listRes = await fetch(`${API}/sightings`, { headers: headers(opToken) });
    const sightings = await listRes.json() as any[];
    const found = sightings.find((s: any) => s.plate === "CHAIN-001");
    if (!found) throw new Error("Sighting not found in operator view");
    console.log(`  4. Operator sees sighting: ${found.id}`);

    console.log("OK: reporter lifecycle complete");
  },

  // Suspicion configuration chain: levels -> predicates -> verify structure
  async "suspicion-config"() {
    const token = await getToken();

    // Step 1: get suspicion levels
    const levelsRes = await fetch(`${API}/admin/suspicion-levels`, { headers: headers(token) });
    const levels = await levelsRes.json() as any[];
    if (!Array.isArray(levels) || levels.length === 0) throw new Error("No suspicion levels");
    console.log(`  1. ${levels.length} suspicion levels`);

    // Step 2: verify levels have required fields
    for (const level of levels) {
      if (!level.label || level.rank === undefined || level.rank === null || !level.id) throw new Error(`Level missing fields: ${JSON.stringify(level)}`);
    }
    console.log(`  2. All levels have label, rank, id`);

    // Step 3: get actor suspicion levels
    const actorLevelsRes = await fetch(`${API}/admin/actor-suspicion-levels`, { headers: headers(token) });
    const actorLevels = await actorLevelsRes.json() as any[];
    if (!Array.isArray(actorLevels) || actorLevels.length === 0) throw new Error("No actor suspicion levels");
    console.log(`  3. ${actorLevels.length} actor suspicion levels`);

    // Step 4: get identifier types
    const idTypesRes = await fetch(`${API}/admin/actor-identifier-types`, { headers: headers(token) });
    const idTypes = await idTypesRes.json() as any[];
    if (!Array.isArray(idTypes) || idTypes.length === 0) throw new Error("No identifier types");
    console.log(`  4. ${idTypes.length} identifier types`);

    console.log("OK: suspicion config chain complete");
  },

  // Device kill chain: create reporter -> kill -> verify sessions revoked
  async "device-kill"() {
    const suffix = Date.now().toString(36);
    const opToken = await getToken();
    const inviteRes = await fetch(`${API}/admin/reporters/generate-invite`, {
      method: "POST",
      headers: headers(opToken),
      body: JSON.stringify({ callsign: `KILL-${suffix}` }),
    });
    const invite = await inviteRes.json() as any;
    const reporterId = invite.reporterId;
    console.log(`  1. Reporter created: ${reporterId}`);

    // Step 2: reporter authenticates
    const code = invite.inviteCode.replace("-", "");
    const authRes = await fetch(`${API}/auth/invite-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const auth = await authRes.json() as any;
    console.log(`  2. Reporter authenticated`);

    // Step 3: operator kills
    const killRes = await fetch(`${API}/admin/reporters/${reporterId}/kill`, {
      method: "POST",
      headers: headers(opToken),
    });
    if (!killRes.ok) throw new Error(`Kill failed: ${killRes.status}`);
    console.log(`  3. Kill signal sent`);

    // Step 4: reporter's token should be invalid
    const checkRes = await fetch(`${API}/vehicles`, { headers: headers(auth.sessionToken) });
    if (checkRes.status !== 401) throw new Error(`Killed reporter still has access: ${checkRes.status}`);
    console.log(`  4. Reporter session revoked (401)`);

    console.log("OK: device kill chain complete");
  },
};

const testName = process.argv[2];
if (!testName || !tests[testName]) {
  console.error(`Usage: npx tsx scripts/test-regression.ts <${Object.keys(tests).join("|")}>`);
  process.exit(1);
}

tests[testName]()
  .then(() => process.exit(0))
  .catch((err) => { console.error(`FAIL: ${err.message}`); process.exit(1); });
