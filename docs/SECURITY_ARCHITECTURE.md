# TRACE — Security Architecture v1.0

> **TRACE** — Tracking, Reporting, Analysis & Community Evidence
> Security-first. Invisible armor. The system protects people who are protecting their communities.

**Date:** 2026-05-24
**Status:** Architecture definition
**Lineage:** Inherits patterns from Forme (Invisible Armor), Tranche (two-layer split), Oktyv Vault (AES-256 + keychain)

---

## 1. Threat Model

TRACE operates in a higher-threat environment than most software. The people using this system are tracking criminals who have been observed following spotters. The threat model is physical, not just digital.

### 1.1 Threat Actors

| Actor | Capability | Goal | Likelihood |
|-------|-----------|------|------------|
| **Targeted criminal** | Physical access to reporter's phone, social engineering, intimidation | Identify who is reporting on them, destroy evidence | HIGH |
| **Criminal associate** | Social engineering, may attempt to join as reporter | Infiltrate chapter, feed misinformation, identify other reporters | MEDIUM |
| **Compromised device** | Full access to reporter's phone (stolen, seized, or malware) | Extract reporter identity, sighting history, other reporters' data | MEDIUM |
| **Compromised cell server** | Full disk/memory access to the chapter's server | Extract all chapter data, reporter identities, evidence | LOW-MEDIUM |
| **Rogue insider** | Legitimate operator or admin credentials | Misuse data, leak identities, tamper with evidence | LOW |
| **Law enforcement subpoena** | Legal authority to compel data disclosure | Access reporter identities, raw evidence, communications | LOW |
| **Network observer** | Passive monitoring of internet traffic | Correlate reporter activity with sighting submissions | LOW |

### 1.2 Assets to Protect (Priority Order)

1. **Reporter real identities** — exposure = physical danger. This is the crown jewel.
2. **Reporter-to-sighting linkage** — even pseudonymous, if you can link a pseudonym to a pattern of locations, you can identify the reporter.
3. **Evidence integrity** — tampered evidence destroys legal credibility.
4. **Actor/criminal database** — intelligence about known criminals is sensitive and could trigger retaliation if leaked.
5. **Operational patterns** — which areas are being watched, when, by how many people.
6. **Chapter membership** — the full list of who participates.

---

## 2. Security Principles

Inherited from Forme's "Invisible Armor" doctrine, adapted for TRACE:

**P1 — Security is the default, never opt-in.** There is no "enable encryption" toggle. The system is encrypted or it doesn't run. A reporter never thinks about security because security is the only way the system works.

**P2 — Identity separation is architectural, not policy.** Reporter real identities and operational pseudonyms live in physically separate data stores with separate encryption keys. A database dump of the operational data reveals zero real identities — not because of access controls, but because the data literally isn't there.

**P3 — The cell is the trust boundary.** Raw media, reporter identities, and unprocessed data never leave the cell. The mesh only sees anonymized vehicle profiles and pattern metadata. A compromised mesh node gains zero chapter-specific intelligence.

**P4 — Evidence integrity is cryptographic, not procedural.** Every piece of evidence carries a hash chain from point of capture. Integrity is verifiable by anyone with the case package — no trust in the system operator required.

**P5 — Assume device compromise.** The reporter PWA is designed so that a seized phone reveals the minimum possible data. No cached identities of other reporters. No operator credentials. No chapter intelligence beyond the reporter's own submission history.

**P6 — Audit everything, immutably.** Every data access, every level change, every export is logged to an append-only audit trail. The audit log itself is integrity-hashed. An admin can review who accessed what — and the admin's review is itself logged.

---

## 3. Security Layers

### Layer 1 — Transport

| Surface | Protection | Detail |
|---------|-----------|--------|
| Reporter PWA → Cell | TLS 1.3 | Certificate pinning in PWA service worker. No fallback to TLS 1.2. |
| Operator → Cell | TLS 1.3 | Same as above. Operator interface served from cell directly. |
| Cell → Mesh | WireGuard VPN | Point-to-point encrypted tunnel between cells. No data traverses public internet unencrypted. |
| Push notifications | Web Push Protocol | Encrypted payload via PWA push. Notification content is a signal, not data ("new sighting available" not "vehicle X spotted at location Y"). |

**DNS:** Cells should use DNS-over-HTTPS or DNS-over-TLS to prevent DNS-level traffic analysis revealing which reporters are connecting.

### Layer 2 — Storage (Data at Rest)

**Two-vault architecture** — operational data and identity data are physically separate:

**Vault A — Operational Database (PostgreSQL + PostGIS)**
- Contains: vehicles, sightings, actors, types, suspicion levels, patterns, case packages, audit logs
- Encryption: AES-256 full-disk encryption (LUKS on Linux) + PostgreSQL TDE where available
- Reporter references: pseudonymous IDs only (`reporter_7f3a2b`). No names, no real contact info, no device identifiers.
- Sighting photos: stored on encrypted filesystem, referenced by hash. EXIF stripped of device-identifying info (camera model, serial number) but GPS and timestamp preserved (operational value).

**Vault B — Identity Store (separate encrypted database)**
- Contains: reporter real names, contact info, device fingerprints, pseudonym mapping table
- Encryption: AES-256-GCM with a separate master key stored in OS keychain (Oktyv Vault pattern)
- Access: Admin role only. Operator cannot access. No API endpoint exposes this data to the application layer.
- Physical separation: different database file, different encryption key, different backup schedule. If Vault A is compromised, Vault B remains sealed.
- Key rotation: master key rotatable without re-encrypting all records (envelope encryption — each record has a data encryption key, wrapped by the master key).

**Vault C — Evidence Locker (immutable)**
- Contains: original photos/videos as submitted, with cryptographic hashes computed at ingestion
- Write-once: files cannot be modified or deleted after ingestion. Even admin cannot alter evidence.
- Hash manifest: SHA-256 hash of every file, plus a Merkle tree root hash for the entire evidence set. Case packages include the manifest for independent verification.

### Layer 3 — Metadata Protection

| Data | Treatment |
|------|-----------|
| Photo EXIF — GPS coordinates | **Preserved** (operational value for sighting location) |
| Photo EXIF — timestamp | **Preserved** (operational value for timeline) |
| Photo EXIF — camera make/model | **Stripped** (identifies reporter's device) |
| Photo EXIF — camera serial number | **Stripped** (uniquely identifies reporter's device) |
| Photo EXIF — software version | **Stripped** (fingerprints reporter's phone) |
| Photo EXIF — thumbnail | **Stripped** (may contain unredacted preview) |
| Submission IP address | **Not logged** in operational database. Logged only in access audit with 30-day auto-purge. |
| Reporter device fingerprint | **Vault B only** (identity store). Never in operational data. |
| Submission timing | **Jittered** ±30 seconds in operational records to prevent timing correlation attacks |

### Layer 4 — Application Security

**Authentication:**
- **Reporters:** Magic link via secure channel (admin sends invite link, reporter clicks, device is enrolled). No passwords. Device-bound session token stored in PWA secure storage. Session token rotates every 7 days silently.
- **Operators:** Magic link + TOTP (time-based one-time password). Two-factor required. No password.
- **Admins:** Magic link + TOTP + device enrollment. Admin sessions are device-bound — a new device requires re-enrollment through a separate admin.

**Authorization (RBAC):**

| Action | Reporter | Operator | Admin |
|--------|----------|----------|-------|
| Submit sighting | ✓ | ✓ | ✓ |
| View own submissions | ✓ | ✓ | ✓ |
| Search vehicles (read-only) | ✓ (limited) | ✓ | ✓ |
| Triage queue | ✗ | ✓ | ✓ |
| Vehicle dossier (full) | ✗ | ✓ | ✓ |
| Actor profiles | ✗ | ✓ | ✓ |
| Suspicion level changes | ✗ | ✓ | ✓ |
| Case package generation | ✗ | ✓ | ✓ |
| Map / geospatial intelligence | ✗ | ✓ | ✓ |
| Notification rule management | ✗ | ✗ | ✓ |
| Reporter management | ✗ | ✗ | ✓ |
| Identity vault access | ✗ | ✗ | ✓ |
| Audit log access | ✗ | ✗ | ✓ |
| System configuration | ✗ | ✗ | ✓ |
| Module toggles (VIGIL, etc.) | ✗ | ✗ | ✓ |

**Session management:**
- Sessions expire after 24 hours of inactivity (reporter), 8 hours (operator), 4 hours (admin)
- Concurrent session limit: 1 per role per user (new login invalidates previous session)
- Session tokens are opaque, non-sequential, cryptographically random (256-bit)

### Layer 5 — Physical/Operational Security

**Reporter field safety (documented in onboarding, enforced where possible by system design):**
- The PWA shows no chapter name, no organization branding on the submission screen. If a criminal sees a reporter's phone, it looks like a generic camera app.
- "Panic wipe" gesture: configurable quick-action (e.g., triple-tap power button or shake gesture) that clears the PWA's local cache, submission queue, and session token. The reporter's historical submissions remain safe on the cell server — only the local device copy is destroyed.
- Reporter-to-reporter invisibility: a reporter cannot see other reporters' submissions, identities, or even the count of other reporters. Each reporter sees only their own submission history.
- No in-app communication between reporters. The system is a data pipe, not a social platform.

**Cell server hardening:**
- Docker containers with minimal base images (Alpine/distroless)
- No SSH password auth (key-only, or no SSH at all — admin manages via local console)
- Automatic security updates for OS packages
- Fail2ban or equivalent for brute-force protection
- Firewall: only ports 443 (HTTPS) and WireGuard exposed. All other ports closed.
- Database not network-accessible (Unix socket only, or localhost-only binding)

---

## 4. Evidence Chain of Custody

Every piece of evidence in TRACE carries an unbroken cryptographic chain from point of capture to case package output.

### 4.1 Chain Steps

```
1. CAPTURE
   Reporter takes photo → PWA computes SHA-256 hash immediately
   Hash + timestamp + GPS stored alongside image
   Image written to local offline queue (encrypted)

2. SUBMISSION
   PWA syncs to cell → cell verifies hash matches uploaded image
   Cell re-hashes and stores both: reporter-computed hash + cell-computed hash
   Any mismatch is flagged and logged (possible tampering in transit)

3. INGESTION
   Cell writes image to Evidence Locker (Vault C, write-once)
   Sighting record created in Operational DB (Vault A)
   Audit log entry: "sighting created, evidence hash X, reporter pseudonym Y"

4. OPERATOR ACTIONS
   Every operator action on a sighting (approve, flag, escalate, annotate)
   is logged with timestamp, operator ID, and the evidence hash at time of action.
   Annotations are additive (append-only), never modify original evidence.

5. CASE PACKAGE
   Package includes: evidence files + hash manifest + Merkle tree root
   + complete audit trail for all included evidence
   + integrity verification page (instructions for independent hash verification)
   Package itself is hashed and signed.
```

### 4.2 Tamper Detection

If any evidence file is modified after ingestion:
- The cell-computed hash no longer matches the stored hash
- The Merkle tree root changes
- Case packages referencing this evidence are automatically flagged as "integrity compromised"
- Audit log records the discrepancy with timestamp

This is automatic and continuous — not a periodic check. Hash verification runs on every evidence access.

---

## 5. Mesh Security

When multiple cells connect via the National Mesh:

### 5.1 What Crosses the Mesh

| Data | Shared? | Detail |
|------|---------|--------|
| Anonymized vehicle profile | ✓ | Make, model, color, body type, distinguishing features. No photos. |
| Plate history | ✓ | Known plates associated with the vehicle (for cross-cell matching). |
| Suspicion level | ✓ | Current level only, no promotion history or criteria. |
| Sighting locations | ✓ | GPS coordinates and timestamps (aggregated, not raw). |
| Vehicle type tags | ✓ | Runner, Scout, etc. (if chapter shares its taxonomy). |
| Actor profiles | ✗ | Stay in originating cell. Too sensitive for mesh. |
| Reporter data | ✗ | Never. Not even pseudonyms. |
| Raw photos/video | ✗ | Never. Too large, too identifying. |
| Operator notes | ✗ | May contain sensitive context. |
| Audit logs | ✗ | Cell-local only. |

### 5.2 Mesh Authentication

- Each cell has a WireGuard keypair generated at setup
- Cell-to-cell connections are pre-authorized by mutual key exchange (admin-to-admin, out-of-band)
- No auto-discovery. A cell only connects to cells it explicitly trusts.
- Mesh messages are signed by the sending cell's key — receiving cell verifies origin.

### 5.3 Cell Compromise Containment

If a cell is compromised:
- The compromised cell's WireGuard key is revoked across all mesh peers
- Data already shared to the mesh is anonymized vehicle profiles only — no reporter exposure
- Other cells' data remains protected (the compromised cell never had access to their raw data)
- The compromised chapter's reporters are notified to re-enroll on a new cell (admin handles out-of-band)

---

## 6. Device Compromise Response

### 6.1 Reporter Phone Seized/Stolen

**What the attacker gets:**
- The TRACE PWA with cached data (if panic wipe wasn't triggered)
- The reporter's own submission history (sightings they personally submitted)
- A session token (expires within 24 hours, or immediately if admin revokes)

**What the attacker does NOT get:**
- Other reporters' identities or submissions
- The operator interface or any administrative data
- The identity vault (Vault B — physically on the cell server, not the phone)
- Chapter intelligence beyond this one reporter's submissions
- The ability to submit false sightings after session expiry (or revocation)

**Admin response protocol:**
1. Admin revokes the reporter's session token (immediate, one-click)
2. Admin generates new pseudonym for the reporter (old pseudonym is soft-deleted, submissions preserved under new linkage)
3. Reporter re-enrolls on a new device with new magic link
4. Old device's cached data decays (PWA cache has 7-day TTL, encrypted local storage key was session-bound)

### 6.2 Cell Server Compromised

**What the attacker gets:**
- Vault A (operational database) — encrypted at rest, but if they have root access, they may access decrypted data in memory
- Vehicle dossiers, sighting records, patterns, actor profiles
- Audit logs

**What the attacker does NOT get (if architecture is followed):**
- Vault B (identity store) — separate encryption key, stored in OS keychain. Root access alone may not be sufficient if keychain requires interactive unlock.
- Vault C (evidence locker) — they can read but not modify (write-once filesystem)
- Other cells' data (mesh data is anonymized and transient)

**Admin response protocol:**
1. Disconnect cell from mesh (revoke WireGuard key)
2. Notify all reporters to cease submissions (out-of-band communication)
3. Rotate Vault B master key on rebuilt cell
4. Re-enroll all reporters with new pseudonyms
5. Forensic review of audit logs to determine scope of access

---

## 7. Legal & Compliance

### 7.1 Subpoena Response

TRACE's architecture limits what can be compelled:

- **Vault A** can be compelled. It contains operational data with pseudonymous reporter IDs — no real names.
- **Vault B** can be compelled but is separately encrypted. Legal counsel should challenge scope (reporter identities are not necessary for vehicle pattern data).
- **Evidence Locker** can be compelled. It contains photos and videos as submitted.
- **Mesh data** — the cell admin can only provide their own cell's data. They physically cannot provide other cells' data.

### 7.2 Data Retention

- Sighting records: indefinite (operational value)
- Retired vehicle records: indefinite (searchable, linkable, may reactivate)
- Audit logs: 2 years minimum, then admin-configurable
- Submission IP addresses: 30-day auto-purge
- Session tokens: purged on expiry
- Reporter enrollment data (Vault B): retained while reporter is active. Admin can purge on reporter departure.

### 7.3 Warrant Canary (Optional)

Chapter admins can enable a warrant canary page — a signed statement updated regularly confirming that no legal demands for user data have been received. If the statement stops updating, reporters know to exercise caution.

---

## 8. Implementation Checklist

### Foundation (Build-Time)

- [ ] Two-vault data model (Vault A operational, Vault B identity, separate keys)
- [ ] Evidence Locker (Vault C) with write-once filesystem and SHA-256 hash chain
- [ ] EXIF metadata stripping pipeline (preserve GPS/timestamp, strip device info)
- [ ] Magic link authentication (no passwords anywhere in the system)
- [ ] TOTP for operator/admin roles
- [ ] RBAC enforcement at API layer (not just UI)
- [ ] Append-only audit log with integrity hashing
- [ ] Session management (expiry, single-device, revocation)
- [ ] PWA secure storage (encrypted local cache, session-bound keys)
- [ ] Panic wipe gesture in PWA
- [ ] Reporter-to-reporter invisibility (no cross-reporter data leakage)
- [ ] Submission timing jitter (±30 seconds)
- [ ] TLS 1.3 with certificate pinning
- [ ] Docker hardening (minimal images, no SSH password, firewall)

### Intelligence Layer

- [ ] Suspicion level change audit trail (who, when, why, evidence hash at time)
- [ ] Actor profile access logging (every view logged)
- [ ] Case package hash manifest + Merkle tree
- [ ] Case package signing

### Mesh

- [ ] WireGuard keypair generation and management
- [ ] Mesh data anonymization pipeline (strip all reporter references before sharing)
- [ ] Cell compromise revocation protocol
- [ ] Mesh message signing and verification

### Operational

- [ ] Reporter onboarding documentation (field safety, panic wipe, device hygiene)
- [ ] Admin security runbook (compromise response, key rotation, reporter re-enrollment)
- [ ] Warrant canary (optional, admin-toggled)
- [ ] Automated security update pipeline for cell OS/Docker
