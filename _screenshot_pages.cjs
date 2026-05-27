/**
 * YUMA-D: Visual regression screenshots with proper auth.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BRAVE = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const BASE = 'https://trace-jet.vercel.app';
const OUT = 'D:\\Projects\\TRACE\\screenshots';

const PAGES = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'triage', label: 'Triage' },
  { name: 'intel', label: 'Activity Map' },
  { name: 'dispatches', label: 'Dispatches' },
  { name: 'incidents', label: 'Incidents' },
  { name: 'harassment', label: 'Harassment' },
  { name: 'vehicles', label: 'Vehicles' },
  { name: 'actors', label: 'Actors' },
  { name: 'admin', label: 'Admin' },
  { name: 'security', label: 'Security' },
];

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  
  // First, get a real auth token
  console.log('Authenticating...');
  const authRes = await fetch(`${BASE}/api/v1/auth/operator-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callsign: 'OPERATOR', accessCode: 'trace2025' }),
  });
  const authData = await authRes.json();
  const token = authData.token || authData.sessionToken;
  if (!token) {
    console.error('Auth failed:', authData);
    process.exit(1);
  }
  console.log('  Token obtained');

  console.log('Launching Brave...');
  const browser = await puppeteer.launch({
    executablePath: BRAVE,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(`${BASE}/operator/`, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Set auth token and skip onboarding
  await page.evaluate((t) => {
    localStorage.setItem('trace_op_token', t);
    localStorage.setItem('trace_op_onboarded', 'true');
  }, token);
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  for (const p of PAGES) {
    console.log(`  ${p.name}...`);
    // Click sidebar nav
    await page.evaluate((label) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        if (text === label || text?.includes(label)) { btn.click(); return true; }
      }
      return false;
    }, p.label);
    
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), fullPage: false });
    console.log(`    saved`);
  }

  await browser.close();
  console.log(`\n${PAGES.length} screenshots → ${OUT}`);
})().catch(e => { console.error(e.message); process.exit(1); });
