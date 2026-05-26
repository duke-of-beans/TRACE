/**
 * TRACE — API Contract Test Runner
 * Usage: npx tsx scripts/test-api.ts <test-name>
 */
const API = "http://localhost:3100/api/v1";

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "operator@trace.local" }),
  });
  const data = await res.json() as any;
  if (!data.sessionToken) throw new Error("No token returned");
  return data.sessionToken;
}

async function authedGet(path: string): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const tests: Record<string, () => Promise<void>> = {
  async vehicles() {
    const data = await authedGet("/vehicles");
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`OK: ${data.length} vehicles`);
  },
  async actors() {
    const data = await authedGet("/actors");
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`OK: ${data.length} actors`);
  },
  async "vehicle-types"() {
    const data = await authedGet("/admin/vehicle-types");
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`OK: ${data.length} vehicle types`);
  },
  async "suspicion-levels"() {
    const data = await authedGet("/admin/suspicion-levels");
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`OK: ${data.length} suspicion levels`);
  },
  async sightings() {
    const data = await authedGet("/sightings");
    if (!Array.isArray(data)) throw new Error("Expected array");
    console.log(`OK: ${data.length} sightings`);
  },
  async triage() {
    const token = await getToken();
    const sightings = await authedGet("/sightings?untriaged=true");
    if (!Array.isArray(sightings)) throw new Error("Expected array");
    if (sightings.length === 0) { console.log("OK: no untriaged sightings"); return; }
    const id = sightings[0].id;
    const res = await fetch(`${API}/sightings/${id}/triage`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (!res.ok) throw new Error(`Triage failed: ${res.status}`);
    console.log(`OK: triaged ${id}`);
  },
  async "generate-invite"() {
    const token = await getToken();
    const res = await fetch(`${API}/admin/reporters/generate-invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ callsign: "YUMA-TEST" }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json() as any;
    if (!data.inviteCode) throw new Error("No invite code");
    console.log(`OK: code ${data.inviteCode}`);
  },
  async "nuke-dry"() {
    // Just verify the endpoint exists and requires auth
    const res = await fetch(`${API}/admin/nuke`, { method: "POST" });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    console.log("OK: nuke endpoint requires auth");
  },
};

const testName = process.argv[2];
if (!testName || !tests[testName]) {
  console.error(`Usage: npx tsx scripts/test-api.ts <${Object.keys(tests).join("|")}>`);
  process.exit(1);
}

tests[testName]()
  .then(() => process.exit(0))
  .catch((err) => { console.error(`FAIL: ${err.message}`); process.exit(1); });
