# MOIRÉ Adversarial Meta-Game
## How sophisticated attackers detect, defeat, and force adaptation of cryptographic deception

The white paper treats the adversary as someone who stumbles into a MOIRÉ environment and tries to use what they see. That's the naive case. The real threat is an adversary who knows MOIRÉ exists, expects it, and has developed techniques to detect it before acting on any data. This document maps that adversarial landscape.

---

## Part 1: The Detection Game

### What an attacker looks for when they suspect deception

A MOIRÉ-aware adversary doesn't ask "is this data real?" They ask a series of increasingly specific questions:

**Test 1: Self-verification.** The simplest detection. The insider submits a piece of data they control - a sighting, a report, a record - and immediately checks whether it appears correctly. If they report a red Toyota at 1st and Main, and the system shows a blue Honda at 5th and Oak, they know they're in a distorted environment. This is the most dangerous test because it requires almost no sophistication and is nearly impossible to defeat without making the insider's own submissions real.

**Test 2: External cross-reference.** The insider verifies specific data points against an external source they trust. They call a colleague: "What was the plate on that vehicle from yesterday?" If the answer doesn't match what they see, they know. Or they physically drive to a location shown on the map and verify whether the claimed activity is actually there. Geographic data is uniquely vulnerable to this because the physical world is an oracle.

**Test 3: Social consistency check.** The insider asks another user about a specific record: "Hey, did you see the silver Camry on Oak Street last Tuesday?" If the other user is in real mode and doesn't recognize the reference (because the silver Camry on Oak Street is a MOIRÉ distortion), the inconsistency is exposed. If the other user IS in real mode and confirms it exists under a different description, same result.

**Test 4: Statistical fingerprinting.** A technically sophisticated adversary runs statistical tests on the data. FPE preserves format and, in the case of coordinates, preserves distances. But it may introduce subtle distributional artifacts. For example: if the coordinate rotation maps points from a residential area to an industrial zone, the density-per-land-use distribution changes. Street-level clustering in the original data follows road grids at specific angles - the rotated version follows road grids at a different angle, but the underlying city's road grid is visible on the map tiles. A mismatch between clustering orientation and visible road grid orientation is a statistical tell.

**Test 5: Temporal canary.** The insider observes timing patterns. If the system batches ghost-mode updates (as recommended in the edge case analysis), the update frequency differs from production. An insider who knows the system updates in real-time and suddenly sees 5-minute batch delays knows something changed. Alternatively, they submit a record and time how long until it appears - if it takes 15 minutes instead of the expected 2 seconds, that's a signal.

**Test 6: Behavioral probe.** The insider deliberately performs actions that should trigger specific system responses - an alert, a notification to another user, a change in aggregate counts - and checks whether the expected downstream effects occur. If they escalate a vehicle to "Confirmed" and the operator doesn't respond as expected (because the escalation happened in ghost mode and the operator never saw it), the insider infers distortion.

**Test 7: Canary credential detection.** Before even logging in, a sophisticated adversary examines the credential itself. Was this credential "found" too easily? Did it appear in a place that looks planted? Does it have suspiciously broad access? Does the session behave slightly differently from what they'd expect (different response headers, different cookie patterns, different TLS certificate)? Canary credentials that are too perfect or too conveniently discovered are themselves a detection signal.

---

## Part 2: The Real Data Problem

### What MUST be real for the deception to hold

The user's insight is critical: MOIRÉ can't distort everything. Some data must be real, and the boundary between real and distorted is where the deception lives or dies.

**Data that MUST remain real:**

1. **The insider's own submissions.** If an insider submits a record and it comes back distorted, detection is instant. Their own data must render correctly. This means the distortion layer needs to RECOGNIZE which records were submitted by the current session and exempt them from transformation.

   This creates an attack: submit 10 test records, then compare them against the full dataset. Your records are real. Everything else might not be. If you can identify which records are "yours" vs "not yours" by checking consistency with external ground truth, you can map the distortion boundary.

2. **Aggregate statistics that are externally verifiable.** If the chapter had a meeting last week where someone said "we have 47 active vehicles," and ghost mode shows 47, the insider has a confirmed anchor. If it shows 45, they know something is off. But if you distort aggregates (as the edge case analysis suggests), you lose the anchor... and potentially create a different detection signal if the insider remembers the real number from an external context.

3. **System behavior and UX.** Login flow, page load times, feature availability, notification patterns, UI layout - all must be identical to production. Any behavioral difference between real and ghost mode is a side channel.

4. **Shared context that exists outside the system.** If team members discuss specific sightings in person, on the phone, or in a separate chat, that conversation creates ground truth that MOIRÉ can't distort. The system doesn't control what happens outside the system.

5. **Historical data the insider has already memorized.** An insider who has been in the system for months has mental models of the data - approximate vehicle counts, which neighborhoods are active, who the known actors are. MOIRÉ can't erase their memory. The distorted environment must be plausible against their prior knowledge, even if every specific detail is different.

**The fundamental constraint:** The more the insider knows independently of the current session, the more real data must be present, and the narrower the distortion space becomes. A brand-new insider can be fully deceived. A veteran insider who has been in the system for two years and has extensive external knowledge is nearly impossible to fully deceive.

---

## Part 3: Attack Surfaces Created by MOIRÉ

### New vulnerabilities that don't exist without deception

MOIRÉ introduces attack surfaces that a system without deception doesn't have:

**1. The distortion layer itself is a high-value target.** If an attacker compromises the distortion middleware (not the database, not the application - the middleware specifically), they can: read the session keys (breaking attribution), disable distortion for their session (accessing real data), or modify distortion parameters to make specific records visible through the distortion. The middleware is now the most sensitive component in the entire architecture. It needs the strongest access controls, the most rigorous auditing, and probably should run in a separate process with its own authentication.

**2. Key management creates a new secret to protect.** The session keys, the master key, the key derivation parameters - these are all secrets that didn't exist before MOIRÉ. Compromise of the key store defeats the entire system. And unlike database credentials (which protect confidentiality), MOIRÉ keys protect the deception's integrity - a subtler and harder-to-detect form of compromise.

**3. The real/distorted boundary is a fingerprinting surface.** Because some data must be real (the insider's own submissions, some aggregates), the boundary between real and distorted data creates a fingerprint. If an attacker can identify which records are real and which are distorted, they've detected the system. Worse: the records that are real are by definition the ones that matter most (the insider's own submissions), so identifying the boundary reveals the most operationally sensitive data.

**4. False positive deployment has operational consequences.** If ghost mode activates incorrectly (canary credential stolen by someone who wasn't the intended target, or a legitimate user accidentally uses a canary credential), the system suppresses real intelligence. An operator in accidental ghost mode makes triage decisions on phantom data while real threats go unreviewed. The cost of false positive deployment is higher than in a system without deception, because the failure mode isn't "access denied" (obvious) but "access granted to wrong reality" (silent).

**5. Ghost mode evidence is legally toxic.** If any artifact from a ghost session - a case package, an exported report, a screenshot - enters a legal proceeding, it's fabricated evidence. Not just wrong - cryptographically designed to be wrong. The chain of custody for real evidence must be provably isolated from ghost mode outputs. And if an adversary learns this, they have a new attack vector: get the organization to accidentally submit ghost-mode evidence, then challenge it in court, potentially discrediting all evidence from the system.

---

## Part 4: Hardening Against MOIRÉ-Aware Adversaries

### Adaptations for the meta-game

**Adaptation 1: Selective distortion (the "mostly real" model).**

The current design distorts everything. Against a sophisticated adversary, this is the wrong approach. Instead: leave 85-95% of data real. Distort only specific high-value records that function as tracers. The insider sees a data environment that is overwhelmingly accurate - accurate enough to pass every casual verification test - with a small number of marked records woven in.

The marked records must be:
- Plausible (not obviously fake)
- Verifiable by the operator (known to be marked)
- Actionable by the adversary (interesting enough that they'd act on them)
- Traceable when acted upon (unique enough to attribute)

This is closer to the traditional "canary trap" / "barium meal" than full-environment distortion. It sacrifices the "cryptographic mirror" concept for operational resilience against sophisticated adversaries. The deception is thinner but harder to detect.

The tradeoff: you lose the "every value is wrong" property. An insider who successfully verifies 20 records against external ground truth and finds them all correct gains (false) confidence. But the 3 marked records they don't verify are the ones that matter.

**Adaptation 2: Graduated deception depth.**

Don't treat deception as binary. Define tiers:

| Suspicion Level | Deception Depth | What's Distorted | Detection Risk |
|----------------|----------------|-----------------|----------------|
| Watch | None (real data) | Nothing | None |
| Elevated | Tracer insertion | 5-10 marked records planted | Very low |
| Confirmed | Partial distortion | High-value records distorted, most data real | Low |
| Active threat | Full MOIRÉ | Everything except insider's own submissions | Medium |
| Burned (detected) | Containment | Access silently restricted, no deception | N/A |

The system escalates deception depth as confidence in the compromise increases. This prevents the "overkill" problem where full MOIRÉ is deployed against someone who turns out to be innocent (false positive), and limits detection risk by using the minimum deception needed for the current threat level.

**Adaptation 3: Anti-probing defenses.**

For each detection test identified in Part 1, a specific countermeasure:

| Detection Test | Countermeasure |
|---------------|---------------|
| Self-verification (submit and check) | Insider's own submissions render correctly in ghost mode. Distortion exempts session-originated records. |
| External cross-reference | No full defense possible. Accept as inherent limitation. Mitigate by distorting recently-added records more aggressively than historical records (the insider's external sources are less reliable for recent data). |
| Social consistency check | If possible, place all potentially compromised users in the same ghost session (same key). They see the same distorted reality and can "verify" with each other. |
| Statistical fingerprinting | Post-rotation, remap coordinates onto the destination area's actual road grid. Use the road network as a constraint surface, not just free-space rotation. Computationally expensive but eliminates grid-angle mismatch. |
| Temporal canary | Match ghost-mode update frequency exactly to production. Accept the risk that the insider's test submissions appear in near-real-time (they must, per self-verification defense). |
| Behavioral probe | Ghost-mode actions (escalations, notifications) must trigger real-looking downstream effects within the ghost session. Notifications fire, status changes propagate, but only within ghost mode. |
| Canary credential detection | Canary credentials must be indistinguishable from real credentials. Same format, same privilege level, same age, same storage location. Don't plant them in obvious honeypot locations. Let them be "found" through realistic breach scenarios. |

**Adaptation 4: The "Schrödinger's Data" approach.**

Don't commit to real or fake until the data is observed. Instead of pre-computing the distorted dataset, compute distortion lazily at query time. The advantage: if the system detects probing behavior (rapid sequential queries on the same record, cross-referencing patterns, systematic boundary testing), it can dynamically adjust the distortion. Records that are being probed can be made more accurate (reducing detection risk) while records that are being ignored remain distorted (maintaining tracer coverage).

This is adaptive deception - the distortion responds to the adversary's behavior in real time. It requires behavioral telemetry on the ghost session and a decision engine that classifies query patterns as "probing" vs "normal use."

The risk: if the adaptive engine is too aggressive, the adversary can use it as an oracle. They probe a record, the system makes it real, they probe the next one, repeat. Eventually they've forced the system to make everything real, defeating the deception entirely. The engine needs rate limiting and a maximum "realness" budget per session.

**Adaptation 5: Acknowledging the detection horizon.**

There exists a sophistication threshold beyond which MOIRÉ cannot work. An adversary who:
- Has extensive independent ground truth
- Has real-time external verification capability
- Knows MOIRÉ exists and has studied the construction
- Has time and incentive to probe systematically
- Has social channels outside the system to cross-reference

...will eventually detect the deception. The question is not "can we prevent detection forever?" but "how much intelligence can we extract before detection occurs?"

This reframes the design goal. MOIRÉ is not a permanent deception. It's a time-limited intelligence window. The design should optimize for:
1. Maximum intelligence extracted per unit time
2. Maximum time-to-detection
3. Graceful degradation when detected (the adversary detecting ghost mode should not give them any additional real data)

---

## Part 5: The Counter-Counter Game

### What happens after MOIRÉ-detection tools exist

If MOIRÉ (or something like it) becomes widely deployed, detection tools will follow. Here's what they look like:

**MOIRÉ Detection Kit (adversary tool):**
1. Submit canary records and verify rendering
2. Cross-reference N random records against external sources
3. Statistical analysis of coordinate clustering vs road grid alignment
4. Response time benchmarking (ghost mode latency fingerprint)
5. Multi-session consistency check (login twice, compare datasets)
6. Aggregate count verification against external sources

**Counter-detection measures:**
1. Canary records exempt from distortion (already addressed)
2. Limit adversary's ability to cross-reference by controlling what leaves the system (no bulk exports from sessions under suspicion)
3. Road-grid-aware coordinate transformation (expensive but defeats statistical analysis)
4. Equalized response times (already addressed)
5. Credential-pinned keys for session consistency (already addressed)
6. Aggregate counts within plausible variance of real values

**The arms race stabilization point:** Eventually, the deception converges on the "mostly real with tracers" model (Adaptation 1). Full-environment distortion is too detectable against sophisticated adversaries. The stable equilibrium is: real data with a small number of strategically placed tracers that are indistinguishable from genuine records. This is where intelligence tradecraft has always settled - the barium meal works precisely because most of the information is real.

---

## Part 6: Implications for the White Paper

### What needs to change

The white paper should NOT include all of this analysis (it would triple the length and shift the focus from the construction to the meta-game). But it should:

1. **Add a "Limitations and Future Work" subsection** acknowledging that MOIRÉ-aware adversaries represent a qualitatively different threat model, and that graduated deception depth and selective distortion are active areas of development.

2. **Reframe the security analysis** to explicitly state the time-limited intelligence window concept. MOIRÉ is not permanent deception - it's a window for intelligence extraction before detection occurs.

3. **Acknowledge the "mostly real with tracers" equilibrium** as the likely stable deployment model for sophisticated threat environments, while positioning full MOIRÉ as the appropriate response for lower-sophistication threats.

4. **Add the self-verification attack** as a named vulnerability (alongside the known-plaintext attack already in the paper). The insider-submits-and-checks attack is more likely and more dangerous than the coordinate rotation known-plaintext attack.

5. **Name the adaptive deception concept** as future work. The "Schrödinger's Data" approach (lazy distortion with behavioral telemetry) is novel enough to be its own paper.

### What this means for the cybersec conversation

The person you're meeting will likely push on exactly these points. Having this analysis ready - not to present, but to respond with when they probe - is what separates "I had an idea" from "I've thought this through." The strongest possible position is:

"Full MOIRÉ works against moderate threats. Against sophisticated adversaries who know what to look for, you converge on selective distortion with tracers - which is what intelligence services have always done, just formalized with better math. The interesting research question isn't 'can you fool everyone forever' - it's 'how much intelligence can you extract in the window before detection, and how do you maximize that window?'"

That's the conversation you want to be having.
