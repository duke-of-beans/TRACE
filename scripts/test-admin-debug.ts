const API = "http://localhost:3100/api/v1";
async function go() {
  const r = await fetch(`${API}/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "operator@trace.local" }),
  });
  const d = await r.json();
  console.log("role:", d.role);

  const h = { Authorization: `Bearer ${d.sessionToken}` };

  const r2 = await fetch(`${API}/admin/vehicle-types`, { headers: h });
  console.log("vehicle-types:", r2.status, (await r2.json()).length, "items");

  const r3 = await fetch(`${API}/admin/suspicion-levels`, { headers: h });
  console.log("suspicion-levels:", r3.status, (await r3.json()).length, "items");

  const r4 = await fetch(`${API}/admin/actor-suspicion-levels`, { headers: h });
  console.log("actor-suspicion-levels:", r4.status, (await r4.json()).length, "items");

  const r5 = await fetch(`${API}/admin/actor-identifier-types`, { headers: h });
  console.log("actor-identifier-types:", r5.status, (await r5.json()).length, "items");
}
go();
