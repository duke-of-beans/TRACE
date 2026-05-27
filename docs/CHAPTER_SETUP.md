# Chapter Setup Guide

**TRACE**. **T**racking, **R**eporting, **A**nalysis & **C**ommunity **E**vidence

How to set up TRACE for your neighborhood chapter. No coding required. Takes about 20 minutes.

## What you are setting up

TRACE has two parts:

1. **Reporter app.** A website that works like a phone app. Reporters open it on their phone, type a plate, describe what they saw, and submit. Takes 15 seconds per report.

2. **Operator console.** A desktop dashboard where you (the operator) see incoming reports, track vehicles over time, drop dispatch pins on a map, and send reporters to locations.

Both run from the same website. Reporters go to the main URL. Operators go to `/operator/`.

## What you need before you start

- A computer with a web browser
- A GitHub account (free at github.com)
- 20 minutes

You do not need to install anything on your computer. Everything runs in the cloud.

## Step 1: Copy the code

1. Go to [github.com/duke-of-beans/TRACE](https://github.com/duke-of-beans/TRACE)
2. Click the green **Fork** button in the top right
3. On the fork page, keep the defaults and click **Create fork**
4. You now have your own copy of TRACE

## Step 2: Create the database

TRACE stores all data in a PostgreSQL database hosted by Neon (free for small chapters).

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub login works)
2. Click **Create Project**
3. Name it something like `trace-yourchapter`
4. Change the database name to `trace`
5. Pick the region closest to your chapter
6. Click **Create Project**

You will see a connection string that looks like this:
```
postgresql://neondb_owner:abc123@ep-something.us-east-1.aws.neon.tech/trace?sslmode=require
```
Copy this. You will need it twice.

## Step 3: Deploy to Vercel

Vercel hosts the website and API for free.

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **Add New** > **Project**
3. Find your `TRACE` fork in the list and click **Import**
4. Under **Environment Variables**, add one variable:
   - Name: `DATABASE_URL`
   - Value: your Neon connection string from Step 2
5. Click **Deploy**

The build takes about 2 minutes. When it finishes, you get a URL like `trace-abc123.vercel.app`. This is your TRACE instance.

Optional: In Vercel project settings > Domains, you can add a custom domain.

## Step 4: Set up the database tables

1. Go back to your Neon dashboard at [console.neon.tech](https://console.neon.tech)
2. Click on your project, then click **SQL Editor** in the left sidebar
3. You need to run three SQL files. Open each one from your GitHub fork:
   - `migrations/0000_init.sql`
   - `migrations/0001_dispatch.sql`
   - `migrations/0002_photos-and-fixes.sql`
4. For each file: copy the entire contents, paste into the Neon SQL Editor, click **Run**

If you see errors about things "already existing," that is fine. It means the tables were already created.

## Step 5: Create your chapter and first operator

In the Neon SQL Editor, paste and run this (change the values in CAPS):

```sql
-- 1. Create your chapter
INSERT INTO ops.chapters (id, name, slug, sunset_days)
VALUES (gen_random_uuid(), 'YOUR CHAPTER NAME', 'your-chapter-slug', 90);

-- 2. Create the first operator account
INSERT INTO ops.reporters (id, chapter_id, callsign, status)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM ops.chapters LIMIT 1),
  'YOUR-CALLSIGN',
  'active'
);

-- 3. Give them operator permissions
INSERT INTO ident.reporter_identities (id, reporter_id, role)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM ops.reporters WHERE callsign = 'YOUR-CALLSIGN'),
  'operator'
);

-- 4. Seed default configuration (vehicle types, concern levels, etc.)
-- These are starting defaults. You can customize everything in Admin later.
INSERT INTO ops.vehicle_types (id, label, color, description, sort_order, chapter_id) VALUES
  (gen_random_uuid(), 'Runner',  '#DC2626', 'Transports product between locations', 4, (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Scout',   '#D97706', 'Watches and reports on targets',       3, (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Stash',   '#4F46E5', 'Parked vehicle used for storage',      2, (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Unknown', '#94A3B8', 'Role not yet determined',              0, (SELECT id FROM ops.chapters LIMIT 1))
ON CONFLICT DO NOTHING;

INSERT INTO ops.suspicion_levels (id, label, color, rank, description, chapter_id) VALUES
  (gen_random_uuid(), 'Noted',      '#94A3B8', 1, 'Seen once, no pattern yet',         (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Watching',   '#D97706', 2, 'Multiple sightings, possible pattern', (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Suspicious', '#EA580C', 3, 'Clear pattern, likely operational',  (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Confirmed',  '#DC2626', 4, 'Confirmed operational role',         (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Priority',   '#7C3AED', 5, 'Active and dangerous',              (SELECT id FROM ops.chapters LIMIT 1))
ON CONFLICT DO NOTHING;

INSERT INTO ops.dispatch_event_types (id, label, icon, color, default_priority, description, auto_close_hours, sort_order, chapter_id) VALUES
  (gen_random_uuid(), 'Confirmed Vehicle',    'car',            '#DC2626', 'urgent',  'Known vehicle from database',         2, 5, (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Community Report',     'radio',          '#D97706', 'routine', 'Called in by community member',        4, 4, (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Area Check',           'compass',        '#4F46E5', 'routine', 'General area to patrol',              4, 3, (SELECT id FROM ops.chapters LIMIT 1)),
  (gen_random_uuid(), 'Suspicious Activity',  'eye',            '#EA580C', 'routine', 'Non-vehicle activity to investigate', 4, 1, (SELECT id FROM ops.chapters LIMIT 1))
ON CONFLICT DO NOTHING;
```

Replace:
- `YOUR CHAPTER NAME` with your chapter's display name
- `your-chapter-slug` with a URL-safe version (lowercase, dashes, no spaces)
- `YOUR-CALLSIGN` with the operator's callsign (uppercase letters and numbers)

## Step 6: Lock down security

In Vercel, go to your project > Settings > Environment Variables. Add:

| Variable | Value |
|----------|-------|
| `TRACE_DISABLE_DEV_LOGIN` | `true` |
| `TRACE_DISABLE_TEST_CODE` | `true` |

Click **Save**, then go to Deployments and click the three dots on the latest deployment > **Redeploy**.

With these set, login requires a valid invite code. The operator callsign alone is not enough.

## Step 7: Log in as operator

1. Go to `your-app.vercel.app/operator/`
2. Enter your callsign
3. Enter your access code (if you set `TRACE_DISABLE_DEV_LOGIN=true`, you need an invite code; if you have not set it yet, leave the access code blank)
4. You will see the operator onboarding walkthrough. Read it, then click through.

## Step 8: Invite your first reporter

1. In the operator console, go to **Admin** (sidebar) > **Reporters** tab
2. Enter a callsign for the reporter (this is their operational pseudonym, not their real name)
3. Click **Generate Invite Code**
4. You will see a callsign and a join code. Click **Copy Signal Message** to copy both into a message you can paste into Signal, WhatsApp, or any encrypted chat.
5. Send the message to the reporter

The reporter:
1. Opens `your-app.vercel.app` on their phone
2. Enters the join code
3. Sets a PIN
4. Reads the onboarding walkthrough
5. Starts reporting

## Step 9: Install the app on phones

TRACE is a Progressive Web App. It installs like a regular app from the browser.

**iPhone**
- Must use Safari (Chrome on iPhone does not support PWA install)
- Open the URL > Share button (square with upward arrow) > Add to Home Screen > Add
- The app icon appears on the home screen and runs full-screen

**Android**
- Use Chrome
- Open the URL > Three-dot menu > Add to Home Screen (or "Install App") > Add
- The app installs and appears in the app drawer

**Tip:** Send reporters a short message like this:

> Open this link in Safari (iPhone) or Chrome (Android):
> [your-app.vercel.app](https://your-app.vercel.app)
>
> Then add it to your home screen so it works like an app.
> Your join code is: XXXX-XXXX

## Ongoing Operations

### Adding more reporters

Admin > Reporters > Generate Invite Code. Each code is single-use and expires in 7 days.

### Adding more operators

Currently, new operators must be created in the database. In the Neon SQL Editor:

```sql
INSERT INTO ops.reporters (id, chapter_id, callsign, status)
VALUES (gen_random_uuid(), (SELECT id FROM ops.chapters LIMIT 1), 'NEW-OPERATOR', 'active');

INSERT INTO ident.reporter_identities (id, reporter_id, role)
VALUES (gen_random_uuid(), (SELECT id FROM ops.reporters WHERE callsign = 'NEW-OPERATOR'), 'operator');
```

An admin panel for operator management is planned.

### Removing a reporter

Go to the Security page in the operator console. You can suspend a reporter, which sends a kill signal to their device on the next status check.

### Customizing your chapter

Everything in Admin is configurable:
- **Vehicle Types:** Runner, Scout, Stash, etc. Add your own.
- **Concern Levels:** The evidence ladder. Configure promotion rules (how many sightings before a vehicle moves up).
- **Dispatch Types:** Event categories for dispatch pins. Set icons, colors, and auto-close timers.
- **Actor Identifiers:** What physical identifiers your chapter tracks (tattoos, clothing, etc).

### Updating TRACE

When new versions are released:
1. In your GitHub fork, click **Sync fork** > **Update branch**
2. Vercel auto-deploys the update
3. If there are new migrations, run them in the Neon SQL Editor

---

## Optional: Configure Integrations

TRACE works without external services. If your chapter wants automatic vehicle identification or caller lookup, configure them in Admin, Integrations.

**CarAPI (Vehicle Identification)**
Resolves license plates to VIN, year, make, model, and color. Reporters see make/model during sightings. Operators get full API data. Sign up at [carapi.app](https://carapi.app). Enter the API key in Admin, Integrations, CarAPI. Click Test Connection, then toggle on.

**Spokeo (Caller Identification)**
Identifies phone numbers reported through the harassment system. Returns name, carrier, line type, and spam risk. Contact apisupport@spokeo.com for API access. Enter the key in Admin, Integrations, Spokeo.

When an integration is disabled or not configured, lookup buttons do not appear anywhere in the app. No error messages, no prompts.

---

## Optional: Import Existing Data

If your chapter has existing vehicle data in spreadsheets, import it through Admin, Import.

1. Go to Admin, Import
2. If you are running with demo/seed data, the system prompts you to clear it first. Clear it.
3. Upload your Excel (.xlsx) or CSV file
4. The system auto-maps your columns to TRACE fields (plate, make, model, color, location, date, notes)
5. Review the preview: it shows how many vehicles and sightings will be created, and flags rows with errors
6. Confirm to import

The pipeline handles inconsistent dates, combined vehicle descriptions ("Red 2019 Honda Civic"), dirty plate numbers with spaces or dashes, and duplicate entries. Imported records are marked as pre-triaged.

## Troubleshooting

**"Connection failed. Is the server running?"**
Check that your `DATABASE_URL` environment variable is set correctly in Vercel. It should start with `postgresql://` and end with `?sslmode=require`.

**Reporter cannot install the app**
On iPhone, the app must be opened in Safari. Chrome on iPhone does not support PWA installation. On Android, use Chrome.

**Operator login rejected**
Make sure the account has `role = 'operator'` in the `ident.reporter_identities` table. Reporter accounts cannot access the operator console.

**Invite code not working**
Codes expire after 7 days and are single-use. Generate a new one from Admin > Reporters.

**Maps show gray tiles**
This is a network or tile server issue. Try switching between Light, Dark, and Satellite modes using the toggle in the bottom-left of the map.
