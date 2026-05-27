# TRACE — Security Edge Cases & Hardening

> Addendum to TRACE Security Architecture v1.0
> This document covers the attacks that don't show up in standard security checklists — the ones that matter when your adversary knows where you live.

---

## 1. Reporter Correlation Attacks

Even with pseudonymity, patterns can unmask a reporter without ever touching the identity vault.

### 1.1 Geographic Fingerprinting

**Attack:** A criminal notices sightings are always reported from the same 3-block radius. They don't need a name — they know someone in that area is reporting. They start watching who walks with their phone out.

**Counter-measures:**
- **Reporter location fuzzing (optional, admin-configurable):** Sighting GPS coordinates can be fuzed by ±50-200 meters in the operational database. The true coordinates are stored in the evidence locker (Vault C) for case packages, but the operational map shows the fuzzed location. This breaks geographic fingerprinting while preserving evidence integrity.
- **Cluster detection alert:** If the system detects that a single reporter's submissions cluster tightly around a single point (likely their home or workplace), it alerts the admin — not the reporter directly (to avoid spooking them). Admin can counsel the reporter to vary their patrol routes.
- **Minimum sighting radius:** Admin can set a rule: "no sightings accepted within X meters of a reporter's registered home location." This requires Vault B to store a reporter's approximate home zone — but that data never enters Vault A. The PWA silently warns the reporter: "this location is too close to your registered zone."

### 1.2 Temporal Fingerprinting

**Attack:** "This pseudonym only submits between 6pm and 8pm on weekdays. That's the shift pattern of the security guard at the strip mall on Oak Street."

**Counter-measures:**
- **Submission timing jitter** (already in architecture: ±30 seconds). Expand to ±1-5 minutes for chapters under active threat.
- **Delayed submission mode:** Reporter can queue sightings and batch-submit at a random time within a configurable window (e.g., "submit my queue sometime in the next 2 hours"). The PWA handles this silently via service worker.
- **Temporal pattern detection:** Same as geographic — if the system detects a pseudonym's submissions follow a predictable time pattern, alert the admin.

### 1.3 Sequential Route Tracing

**Attack:** A reporter submits 5 sightings in 12 minutes along a straight path. That path IS the reporter's physical route. Anyone who knows the neighborhood can infer "they walked from the gas station to the park."

**Counter-measures:**
- **Submission batching with shuffle:** When a reporter submits multiple sightings in a short window, the system shuffles their order and applies variable time jitter to each. The operational database shows them arriving in random order with staggered timestamps.
- **Route detection warning:** If 3+ sightings from one reporter in one session form a linear path, the PWA warns: "Your submissions may reveal your route. Consider submitting from a different location or batching for later."

### 1.4 Photographic Style Analysis

**Attack:** A sophisticated adversary analyzes submitted photos across pseudonyms. Same camera height, same framing habits, same shooting angle — even without EXIF, photographic style can be a fingerprint.

**Counter-measures:**
- **Photo normalization pipeline (optional):** Light automatic adjustments to submitted photos — random minor crop variations, slight brightness/contrast shifts. Not enough to degrade evidence, enough to break style matching across a large corpus.
- **This is a documented risk, not a fully solvable one.** The onboarding documentation should advise reporters to vary their approach angles and distance when possible.

### 1.5 Reflection and Shadow Attacks

**Attack:** A criminal examines submitted photos of their vehicle. In the chrome bumper reflection, they can see who took the photo. In the shadow on the ground, they can estimate height and build.

**Counter-measures:**
- **Reporter training (onboarding):** Teach reporters to be aware of reflective surfaces and their own shadow. Shoot from angles that don't include reflections. Use zoom instead of approaching closely.
- **Automated reflection detection (future/VIGIL):** Computer vision scan of submitted photos that flags images where a human figure is visible in reflective surfaces. Flag for operator review before the sighting enters the general database.
- **Shadow detection is harder.** Document the risk. Advise shooting with the sun at the reporter's back (shadow falls behind them, not toward the vehicle).

---

## 2. Infiltration & Social Engineering

### 2.1 Infiltration via Reporter Enrollment

**Attack:** A criminal or associate signs up as a reporter to gain inside access. They can see the PWA interface, understand how the system works, and potentially identify other reporters through timing correlation.

**Counter-measures:**
- **Reporter vetting is human, not automated.** Admin must personally approve every reporter enrollment. No self-registration. The magic link is invitation-only.
- **Probationary period:** New reporters' submissions are tagged `probationary` for a configurable period (default 30 days). Probationary reporters see a reduced interface — no vehicle search, no historical data, submit-only.
- **Anomaly detection on reporter behavior:** If a reporter never submits sightings but frequently uses the vehicle search function, that's suspicious. Alert the admin.
- **Reporter-to-reporter invisibility (already in architecture):** Even an infiltrator sees only their own submissions. They cannot infer the existence, count, or activity patterns of other reporters.

### 2.2 Honey Pot Vehicles

**Attack:** Criminal parks a distinctive vehicle (e.g., bright green modified Civic) in a specific spot and watches from nearby to see who photographs it. If a sighting of that vehicle appears in the system, they know someone in that area at that time is a reporter.

**Counter-measures:**
- **This is the hardest attack to defend against systemically.** It's a physical-world counterintelligence operation.
- **Reporter training:** Warn reporters that criminals may bait with conspicuous vehicles. Don't approach unusual vehicles in isolated locations. Use zoom. Photograph from inside your own vehicle when possible.
- **Delayed submission:** If the reporter queues the sighting and submits it 2 hours later from home, the criminal watching the honey pot can't correlate the submission with anyone they observed.
- **Covert photography mode in PWA:** Camera interface that looks like a normal phone activity (texting, browsing, checking maps). No visible camera UI elements. Photo captured via volume button or subtle gesture.

### 2.3 Admin/Operator Coercion

**Attack:** A criminal threatens the operator or admin to extract reporter identities or tamper with evidence.

**Counter-measures:**
- **Duress code:** Admin and operator can enter a special code during login that appears to work normally but silently triggers a lockdown protocol: alert a designated emergency contact (out-of-band, pre-configured), restrict all Vault B access to read-only, and begin logging all actions at elevated detail. The system looks normal to the coerced user and to the criminal watching over their shoulder.
- **Split admin for Vault B:** The identity vault can require two-admin consensus for bulk operations (export all identities, delete all records). Single-admin access is limited to individual reporter lookups with mandatory justification logging.
- **Dead man's switch (optional, inherited from Forme architecture):** If the admin fails to check in within a configurable period, automated actions trigger: notify emergency contacts, rotate encryption keys, and optionally wipe Vault B (nuclear option, admin pre-configures whether to enable).
- **No bulk export of Vault B.** There is no API endpoint, no UI button, no admin tool that exports all reporter identities at once. Individual lookups only, each logged. This limits what a coerced admin can extract in a time-pressured situation.

---

## 3. Device-Level Threats

### 3.1 Forensic Recovery After Panic Wipe

**Attack:** Reporter triggers panic wipe, but law enforcement or a sophisticated criminal recovers data from the device using mobile forensic tools (Cellebrite, GrayKey, etc.).

**Counter-measures:**
- **PWA storage uses the Web Crypto API with session-derived keys.** When panic wipe triggers, the encryption key is destroyed — not just the data. Even if forensic tools recover the encrypted blobs, the key no longer exists. The data is cryptographic garbage.
- **No SQLite or IndexedDB for sensitive data.** The PWA uses `CryptoKey` objects in memory and encrypted blobs in `Cache Storage`. Cache storage is more aggressively purged by browsers than IndexedDB.
- **Service worker termination:** Panic wipe also unregisters the service worker and clears all caches, including the app shell itself. The PWA disappears from the device entirely — it's as if it was never installed.
- **Document limitation honestly:** A truly sophisticated forensic operation on a compromised device may recover fragments. The goal is to make recovery difficult and incomplete, not impossible. The real protection is that the sensitive data (other reporters' identities, full chapter intelligence) was never on the device in the first place.

### 3.2 Screen Capture / Screen Recording

**Attack:** Reporter's device has malware that captures screenshots or screen recordings. The PWA interface is captured showing sighting data.

**Counter-measures:**
- **The PWA shows minimal data by default.** The submission view shows only the reporter's own sightings — not vehicles, not patterns, not other reporters. There's nothing valuable to capture.
- **No sensitive data on reporter screens.** The reporter never sees actor profiles, concern levels, pattern analysis, or any intelligence product. They see: camera, submit, their own history. That's it.
- **Operator/admin interfaces display a watermark overlay** with the session ID and timestamp. If a screenshot leaks, the watermark identifies the source session. The watermark is rendered via CSS overlay (not embedded in images) so it doesn't appear in data exports.

### 3.3 Lock Screen Notification Exposure

**Attack:** Reporter's phone is sitting on a table. A push notification arrives: "New sighting of vehicle X at location Y." The criminal sitting next to them reads it.

**Counter-measures:**
- **Notifications are signals, never content.** Push notifications from TRACE contain only: "TRACE: new activity" or "TRACE: action needed." No vehicle descriptions, no locations, no sighting details. The reporter must open the app to see what happened.
- **Admin configures notification verbosity per chapter.** In high-threat chapters, notifications can be reduced to silent badge updates only (no visible notification at all, just a badge count on the PWA icon).

---

## 3.5 Canary Credentials & Theater Mode

This is active counterintelligence at the application layer. Not just defense — a trap.

### The Concept

TRACE maintains a parallel login surface with canary credentials. If a bad actor obtains what they believe is a valid password — through social engineering, shoulder surfing, physical coercion, device theft, or brute force — and uses the canary credential, they enter what appears to be a fully functional system. It isn't. It's theater.

Meanwhile, the real system knows it's been breached and is silently recording everything the intruder does.

### 3.5.1 Canary Credential Architecture

**Setup (admin configures during cell initialization):**
- Admin creates 1-3 canary credential sets per role (operator, admin)
- Each canary credential is a magic-link-style token or a memorable passphrase that looks like a legitimate recovery code
- Canary credentials are stored in a `canary_auth` table in Vault A (not Vault B — they're operational traps, not real identities)
- Canary credentials can be planted strategically: written on a sticky note "hidden" under the keyboard, saved in a notes file named "server passwords.txt" on the cell server, or stored in a phone contact labeled "TRACE backup code"

**Where to plant canary credentials (admin decides per chapter):**
- A text file on the cell server desktop: `admin_recovery.txt`
- A physical notebook near the server with various "passwords" — one of which is the canary
- A "backup credential" card in the server room that looks like a standard IT practice
- The admin's phone contacts (labeled innocuously) — if the phone is seized, the attacker finds a "credential" that's actually a trap

### 3.5.2 Theater Mode

When a canary credential is used, the system enters Theater Mode. The experience must be indistinguishable from the real system to a first-time user.

**What the intruder sees:**

| Element | Theater Version |
|---------|----------------|
| Login | Appears to succeed normally. No delay, no warning, nothing unusual. |
| Dashboard | Shows plausible statistics — vehicle counts, sighting numbers, activity graphs. All synthetic. |
| Vehicle records | Populated with 20-50 realistic but entirely fabricated vehicle records. Real makes/models/colors, fake plates, fake sighting histories. |
| Actor profiles | 5-10 fabricated actor profiles with generic descriptions. No photos. |
| Map | Shows sighting pins distributed realistically across the chapter's operating area. All fabricated locations. |
| Triage queue | A few pending sightings that look real. Fabricated. |
| Audit log | Shows realistic-looking access patterns from "other operators." All synthetic. |
| Notifications | None fire. The system appears quiet. |

**What the intruder does NOT see:**
- Any real vehicle data, real sightings, real actor profiles, or real reporter information
- Any real evidence (photos/videos)
- Any real audit logs
- Any connection to the mesh

**The theater database is pre-generated and static.** It's a snapshot of plausible-looking data created when the admin configures canary credentials. It never touches real data. Even if the intruder exports everything from theater mode, they get nothing real.

### 3.5.3 Marked Data (Canary Tokens in the Theater)

The theater database contains **marked data** — fabricated records designed to be traceable if they surface in the real world.

**Marked vehicles:** The theater database includes 2-3 vehicles with specific, unusual plate numbers that don't exist in any real state DMV database. If a criminal later mentions one of these plates, or if a fabricated vehicle description shows up in criminal communications, it confirms:
1. The canary was triggered
2. The specific canary credential that was used (each canary has different marked data)
3. The intruder is sharing the stolen "intelligence" with their network

**Marked actors:** Theater actor profiles use names that are unique fabrications. If those names appear in any real-world context, it traces back to the breach.

This is the digital equivalent of marked bills in a bank robbery.

### 3.5.4 Silent Alert & Forensic Capture

The moment a canary credential authenticates:

1. **Silent alert fires** to admin and designated emergency contacts via pre-configured out-of-band channel (encrypted messaging, not email, not the TRACE system itself)
2. **Forensic capture begins:**
   - IP address of the intruder's connection
   - TLS fingerprint (JA3/JA4 hash — identifies the browser/client)
   - Precise timestamps of every action taken
   - Every search query entered (reveals what the intruder is looking for — specific vehicles? specific people? everything?)
   - Every page viewed, every record opened, every export attempted
   - Session duration and navigation pattern
   - User-Agent string and browser characteristics
3. **Real system lockdown (optional, admin-configurable):**
   - Vault B access frozen (identity vault sealed until admin manually unlocks with a separate recovery key)
   - All real operator/admin sessions receive a silent banner: "Canary triggered. Exercise caution."
   - Mesh connections paused (prevent any possibility of the theater session leaking into the mesh)

### 3.5.5 Behavioral Intelligence

The forensic capture from a canary session is intelligence gold. What the intruder searches for reveals their priorities:

| Intruder searches for... | This tells you... |
|--------------------------|-------------------|
| A specific vehicle plate | They know they're being tracked and want to see what you have on them |
| A specific person's name | They're trying to identify a reporter or operator |
| "All reporters" or similar | They want the full membership list — highest-threat indicator |
| Specific addresses | They're trying to identify reporter home locations |
| Export/download functions | They want to exfiltrate data to share with their network |
| Admin/settings pages | They're assessing the system for future attacks |
| Nothing — just browsing | Reconnaissance. They're learning the system's capabilities. |

This behavioral profile is logged and available to the admin after the canary session ends.

### 3.5.6 Theater Mode Maintenance

- The theater database should be refreshed periodically (admin-triggered, quarterly minimum) so it doesn't look stale
- Theater sighting dates should be recent (auto-adjusted on each canary login to show "activity" from the past 7 days)
- Theater statistics (dashboard numbers) should be plausible for the chapter's size — not suspiciously high or low
- The theater interface version must match the real interface exactly — same CSS, same layout, same features. If the real system gets a UI update, the theater must update simultaneously. **This is enforced architecturally:** theater mode uses the same frontend code, just pointed at the theater database.

### 3.5.7 Multiple Canary Layers

For maximum coverage, canary credentials can exist at different levels:

| Layer | Canary Type | What it catches |
|-------|-------------|-----------------|
| **Server access** | A canary SSH key or password planted on the server | Someone who has physical or remote access to the server itself |
| **Admin login** | A canary admin credential | Someone who obtained admin-level access (most dangerous) |
| **Operator login** | A canary operator credential | Someone targeting the daily intelligence workflow |
| **API endpoint** | A canary API key in a config file on the server | An attacker with file-level access probing for API access |
| **Database connection** | A canary database credential in a config-like file | An attacker attempting direct database access |

Each layer feeds into the same forensic capture and alert pipeline but provides different intelligence about the attacker's access level and sophistication.

### 3.5.8 Ghost Mode v2 — Real-Time Cryptographic Mirror

The static theater database (3.5.2) works against naive attackers. It fails against insiders — anyone who has seen the real system will notice the vehicle count is wrong, sighting patterns don't match, or a vehicle they know about is missing. The best lies are just left of the truth.

Ghost Mode v2 replaces the static theater with a **real-time cryptographic mirror.** The ghost environment runs the same code, queries the same database, renders the same interface — but every data point passes through a **distortion layer** parameterized by a session-specific cryptographic key before reaching the screen.

**Properties of the distortion:**
- **Deterministic** — same input + same key = same distorted output. The ghost environment is stable and internally consistent.
- **Structurally preserving** — patterns, relationships, clustering, timing, and counts survive. If 3 vehicles cluster in a 4-block area in real data, 3 vehicles cluster in a 4-block area in ghost data. The blocks are different.
- **Format-preserving** — a plate still looks like a plate. A GPS coordinate still points to a real street in the same city. A timestamp is still plausible.
- **Session-keyed** — different ghost sessions produce different distortions. Two intruders see different versions. If data leaks, you can reverse-engineer which session.
- **Mathematically irreversible without the key** — the distortion isn't noise, it's encryption.

**The mathematical backbone: Format-Preserving Encryption (FPE)**

NIST SP 800-38G standardizes FPE modes (FF1, FF3-1) that encrypt data while preserving format and domain. Already used in PCI-DSS tokenization of credit card numbers. We repurpose it as a deception primitive.

**Distortion by data type:**

| Data Type | Method | Preserved | Changed |
|-----------|--------|-----------|---------|
| GPS coordinates | Keyed rigid-body rotation + translation. All points shift together. | Relative distances, clustering, density, corridor shapes | Absolute locations. Oak & 5th → Maple & 12th. |
| License plates | FPE (FF1). Keyed bijection. | Format, plate-to-vehicle consistency | Every specific plate number. |
| Timestamps | Uniform offset from key (e.g., +3d 7h 22m) | Sequence, gaps, temporal clustering, day-of-week | Absolute dates and times. |
| Vehicle descriptions | Keyed substitution within body class. | Body type (sedan→sedan, SUV→SUV) | Color, make, model. Red Civic → Blue Corolla. |
| Actor names | Keyed dictionary substitution. | Name format, associate count | Every specific name. "Big Mike" → "Tall Steve." |
| Addresses | FPE on number + keyed street substitution. | City, general area, format | Specific street and number. |
| Counts & statistics | Pass-through. Real numbers. | Everything | Nothing. Aggregate data is genuine. |
| Concern levels | Pass-through. | Level distribution | Nothing. Intelligence structure is real. |
| Photos | Replaced with reference images matching distorted vehicle description. | Photo presence, approximate appearance | Every specific image. |

**Why the coordinate rotation is critical:**

Random noise on each GPS point would destroy clustering and be statistically detectable. Instead, a single rigid-body transformation (rotation + translation) applies to ALL coordinates. Two sightings 200m apart are still 200m apart. A cluster in a 4-block zone is still a 4-block cluster — just a different 4 blocks. Corridor patterns (vehicle moving along a route) are still corridors, just different corridors. The geometry is perfectly consistent within a session. The patterns look like real intelligence because they ARE real intelligence — just mapped onto different geography.

**Why this is nearly undetectable:**

An insider sees the right number of vehicles, the right activity patterns, the right concern distribution, realistic clustering, recent timestamps, real-time updates. Every aggregate metric matches reality. But every specific detail is wrong. To detect it, the attacker needs to already know specific real data points AND notice they're different AND rule out misremembering or legitimate data changes. If they know plate "ABC 1234" should exist and see "DEF 5678" instead — the GPS is also shifted, the names are also different, the timeline is also offset. Everything is consistently shifted. It reads as a different version of reality, not an obvious fake.

**Cryptographic attribution chain:**

Because each session uses a unique key, the distortion is reversible:

1. Admin learns adversary is acting on data: "They mentioned a blue Corolla, plate DEF 5678, at Maple & 12th"
2. Admin runs each ghost session key against those data points
3. Key #3 reverse-maps: DEF 5678 → ABC 1234, Maple & 12th → Oak & 5th
4. That matches real data — leak confirmed from ghost session #3
5. Session #3 was triggered by canary credential #3 — planted in the server room notebook
6. The adversary who accessed the server room is identified

This is a **cryptographic proof of attribution** from physical breach to identity.

**Implementation: distortion middleware**

```
REAL DATABASE → DISTORTION LAYER (keyed per session) → SAME APP CODE → SCREEN
```

The distortion layer sits between the database and the application as middleware. The application code doesn't know it's in ghost mode — same queries, same components, same logic. The only difference is that query results pass through a transformation before reaching the app. This means no separate codebase, no UI divergence risk, new features appear in ghost mode automatically, and the distortion layer is a single auditable module.

The distortion layer does NOT touch: application logic, UI rendering, session management, or audit logging. Ghost mode has its own forensic capture log.

---

## 4. Data Integrity Attacks

### 4.1 Evidence Planting

**Attack:** A compromised or malicious reporter submits fabricated sightings to frame an innocent person's vehicle as suspicious, or to overwhelm the operator with noise.

**Counter-measures:**
- **Provenance tracking:** Every sighting records which reporter submitted it (pseudonymous). If a pattern of false submissions emerges, the operator can trace them to a single pseudonym and the admin can identify and remove the reporter.
- **Reputation scoring (implicit):** Over time, the system tracks the accuracy rate of each reporter's submissions (how often their sightings are confirmed vs. dismissed by the operator). Reporters with low confirmation rates can be flagged for admin review.
- **EXIF plausibility check:** The system verifies that photo GPS coordinates match the submitted sighting location (within a reasonable radius). A reporter claiming to photograph a vehicle on Oak Street but whose photo EXIF says they were on Elm Street triggers a flag.
- **Duplicate/spam detection:** If a reporter submits the same vehicle from the same location repeatedly within a short window, the system de-duplicates and alerts the operator to possible noise injection.

### 4.2 Sighting Deletion Attack

**Attack:** A compromised operator deletes sighting records to protect a criminal or destroy evidence.

**Counter-measures:**
- **Sightings are soft-deleted only.** There is no hard delete in the operational database. A "deleted" sighting is flagged as inactive but the record and all associated evidence remain in the database and evidence locker.
- **Audit log records all deletions** with the operator's identity, timestamp, and stated reason. The audit log itself is append-only and integrity-hashed — the operator cannot delete their own deletion record.
- **Evidence locker is write-once.** Even if the operational database record is soft-deleted, the original photo/video in Vault C remains permanently. It can be recovered and re-linked.
- **Admin review of deletion patterns.** If an operator's deletion rate exceeds a configurable threshold, the admin is alerted.

### 4.3 Concern Level Manipulation

**Attack:** A compromised operator demotes a confirmed criminal vehicle back to "Noticed" to protect them, or promotes an innocent vehicle to "Active Criminal" to harass the owner.

**Counter-measures:**
- **Every level change requires a justification field** (free text, mandatory, minimum 20 characters). The justification is logged immutably.
- **Level change audit trail includes the evidence hash state** at the time of the change. If someone demotes a vehicle with 15 confirmed sightings and an identified driver, the audit trail makes the manipulation obvious.
- **Demotion alerts:** Any demotion of a vehicle from "Confirmed" or "Active Criminal" triggers an automatic alert to the admin. Demotions are valid (vehicles do get misidentified), but they require admin awareness.
- **Two-person rule (optional, admin-configurable):** For high-stakes level changes (promoting to "Active Criminal" or demoting from "Confirmed"), require both operator and admin to approve. Single-operator chapters can disable this.

---

## 5. Network-Level Threats

### 5.1 Traffic Analysis

**Attack:** An adversary monitoring the reporter's network can observe when TLS connections are made to the cell server's IP. Even without reading the content, the timing and frequency of connections reveals when the reporter is active.

**Counter-measures:**
- **Background sync heartbeat:** The PWA service worker makes periodic background requests to the cell at random intervals (every 5-20 minutes), regardless of whether the reporter has new submissions. This creates constant baseline traffic that masks actual submission events.
- **Submission piggybacking:** Real submissions are sent during the next scheduled heartbeat, not immediately when the reporter taps submit. The reporter sees "submitted" immediately (optimistic UI), but the actual network request waits for the next heartbeat window.
- **VPN guidance in onboarding:** In high-threat environments, reporters should use a general-purpose VPN (not a TRACE-specific one) to mask which server they're connecting to. The cell server should have a generic domain name and serve a benign landing page to unauthenticated visitors.

### 5.2 Cell Server Discovery

**Attack:** A criminal discovers the cell server's IP or domain name and launches attacks against it.

**Counter-measures:**
- **Benign front page:** Unauthenticated requests to the cell's HTTPS port see a generic placeholder page (e.g., "coming soon" or a blank page). Nothing identifies it as TRACE.
- **No public DNS record:** The cell server's domain (if any) is not publicly listed. Reporters receive the URL via the magic link invitation.
- **Rate limiting and fail2ban:** Brute-force login attempts trigger IP blocking after 5 failed attempts.
- **Port obfuscation (optional):** Run HTTPS on a non-standard port. Adds minor obscurity but not true security — defense in depth.
- **Tor hidden service (optional, admin-toggled, inherited from Forme):** For chapters in extremely hostile environments, the cell can be accessible as a `.onion` service. Reporters connect via Tor Browser or Orbot. No IP address is exposed to the public internet.

---

## 6. Backup & Recovery

### 6.1 Backup Security

- **Vault A backups** are encrypted with the Vault A encryption key before writing to backup media.
- **Vault B backups** are encrypted with the Vault B master key. Vault B backups are stored in a physically separate location from Vault A backups. An attacker who seizes one backup set does not get both vaults.
- **Vault C backups** are copies of the write-once evidence files plus the hash manifest. The manifest allows verification that the backup is complete and unmodified.
- **Backup media:** Encrypted external drive, stored off-site (not in the same building as the cell server). Admin rotates backup drives on a schedule.
- **Backup key escrow:** The Vault B master key has a recovery copy sealed in a tamper-evident envelope held by a designated trusted third party (attorney, board member). This key is only used if the admin is incapacitated or compromised. The envelope is inspected quarterly for tampering.

### 6.2 Disaster Recovery

If the cell server is destroyed (fire, seizure, hardware failure):
1. New server is provisioned with fresh TRACE installation
2. Vault A backup is restored (operational data)
3. Vault B backup is restored from separate location (identities)
4. Vault C backup is restored (evidence, verified against hash manifest)
5. All reporter sessions are invalidated (reporters re-enroll with new magic links)
6. WireGuard keys are regenerated (mesh peers updated)
7. System is operational. No data lost if backup schedule was followed.

---

## 7. Reporter Lifecycle Security

### 7.1 Onboarding

1. Admin creates reporter entry in Vault B (real name, contact method)
2. System generates pseudonym and enrollment magic link
3. Admin delivers magic link via secure channel (in-person or encrypted messaging — NOT SMS or email)
4. Reporter opens link on their device, PWA installs, device is enrolled
5. Reporter receives onboarding guide covering: panic wipe, photography safety, route variation, reflection awareness, delayed submission mode

### 7.2 Active Service

- Session token rotates every 7 days silently
- Reporter's device binding is verified on each sync (device fingerprint in Vault B, not in operational data)
- Reporter can request pseudonym rotation through admin (if they believe their pseudonym is compromised)

### 7.3 Departure

1. Admin deactivates reporter in Vault B
2. Reporter's session token is revoked
3. Reporter's pseudonym is soft-deactivated (no new submissions accepted)
4. Historical submissions remain in Vault A under the deactivated pseudonym (evidence preservation)
5. Admin can choose to purge Vault B record (real identity deleted, pseudonym becomes permanently orphaned — no one can re-link submissions to a real person)
6. PWA on reporter's device loses sync ability and eventually clears cached data (7-day TTL)

### 7.4 Compromise (Reporter Turned)

If admin suspects a reporter has been turned (coerced into reporting for the criminals, feeding misinformation):
1. Do NOT alert the reporter
2. Flag their pseudonym as `under_review` — submissions still accepted but quarantined from the main database
3. Operator reviews quarantined submissions separately
4. Admin investigates through out-of-band channels
5. If confirmed, reporter is silently deactivated — their PWA still appears to work (submissions are accepted and queued) but nothing enters the live system. The reporter doesn't know they've been cut off.
6. This "ghost mode" prevents the turned reporter from telling their handler that they've been detected

---

## 8. Security Audit & Testing

### 8.1 Continuous Verification

- **Hash integrity sweep:** Nightly background job verifies all evidence hashes in Vault C against stored manifests. Any discrepancy triggers immediate admin alert.
- **Audit log integrity check:** The audit log's own hash chain is verified daily. A broken chain indicates tampering.
- **Orphaned pseudonym detection:** Weekly check for pseudonyms in Vault A that have no corresponding entry in Vault B (shouldn't happen — indicates data corruption or unauthorized manipulation).

### 8.2 Penetration Testing Priorities

When the system is built, test these attack paths first:
1. Can a reporter access another reporter's submissions? (Reporter isolation)
2. Can an operator access Vault B? (Identity vault separation)
3. Can evidence in Vault C be modified after ingestion? (Write-once enforcement)
4. Does panic wipe actually destroy encryption keys? (Forensic recovery resistance)
5. Can submission timing be correlated to reporter activity? (Timing jitter effectiveness)
6. Can a mesh peer extract raw evidence or reporter data from another cell? (Mesh containment)
7. Can an admin export all identities at once? (Bulk export prevention)
8. Does the duress code look identical to normal login from the outside? (Coercion resistance)
