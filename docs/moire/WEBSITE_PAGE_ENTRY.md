## MOIRÉ
### Cryptographic deception through format-preserving data distortion

Most security systems try to keep attackers out. Some detect them when they get in. This one lets them in on purpose - into a version of reality that's cryptographically wrong in every specific detail, structurally identical in every pattern, and mathematically traceable back to the exact breach that let them through.

The core idea: instead of building a fake environment with synthetic data (which any insider will recognize as fake), run the real system against the real database, but pass every data point through a keyed distortion layer before it hits the screen. The attacker sees real patterns, real activity volumes, real statistical distributions. Every specific value - every name, every coordinate, every identifier - is wrong.

Named after the moiré pattern - the interference effect that emerges when two regular patterns overlap at slightly different angles, producing a third pattern that looks structured but doesn't exist in either original.

The distortion is format-preserving encryption. NIST standardized it (SP 800-38G, modes FF1 and FF3-1). It's already used in PCI-DSS payment tokenization. Nobody's applied it as a deception layer.

---

### The Construction

A middleware layer sits between the database and the application. The application doesn't know it's in deception mode - same queries, same rendering, same business logic. Query results pass through a transformation parameterized by a session-specific cryptographic key before reaching the app.

Properties of the distortion:

  - **Deterministic** - same input + same key = same output. The environment is internally consistent.
  - **Structurally preserving** - patterns, relationships, clustering, timing, counts all survive.
  - **Format-preserving** - a license plate still looks like a plate. A GPS coordinate still points to a real street.
  - **Session-keyed** - different sessions produce different distortions. Leaked data traces back to the session that produced it.
  - **Irreversible without the key** - this isn't noise. It's encryption.

---

### Distortion by Data Type

| Data Type | Method | What's Preserved | What Changes |
|-----------|--------|------------------|--------------|
| GPS coordinates | Rigid-body rotation + translation | Relative distances, clustering, density, corridor shapes | Absolute locations |
| Identifiers | FPE (FF1 mode), keyed bijection | Format, consistency across views | Every specific value |
| Timestamps | Uniform offset derived from key | Sequence, gaps, temporal clustering | Absolute dates and times |
| Categorical fields | Keyed substitution within equivalence class | Category structure (sedan stays sedan) | Specific values |
| Aggregate statistics | Pass-through | Everything | Nothing - real numbers |
| Structural metadata | Pass-through | Intelligence shape | Nothing - real distributions |

The coordinate transformation is the critical piece. Random noise on GPS points would destroy clustering patterns and be statistically detectable. A rigid-body transformation (rotation + translation) applied to all coordinates simultaneously preserves every geometric relationship. Two points 200 meters apart stay 200 meters apart. A corridor pattern stays a corridor - just a different corridor. The patterns look like real intelligence because they are real intelligence, mapped onto different geography.

---

### Why It's Hard to Detect

An insider who knows the real system sees the right number of records, the right activity patterns, the right statistical distributions, realistic geographic clustering, recent timestamps, real-time updates. Every aggregate metric matches reality. But every specific value is wrong.

To detect the distortion, you'd need to already know specific real data points, notice they're slightly different, and rule out the possibility that you're misremembering or that the data changed legitimately. If you know one identifier should be "ABC-1234" and you see "DEF-5678" - the coordinates are also shifted, the names are also different, the timeline is also offset. Everything is consistently shifted in a way that reads as a different version of reality, not an obvious fabrication.

---

### The Attribution Chain

Because each session uses a unique key, the distortion is reversible by the system operator:

1. Adversary acts on distorted data in the physical world
2. Operator runs each session key against the surfaced data points
3. One key reverse-maps the distorted values to real values
4. That key identifies the exact session, which maps to the exact credential used
5. The credential maps to the breach vector

This is a cryptographic proof of attribution from physical-world adversary behavior back through a digital deception environment to the specific point of compromise. It's the intelligence community's "barium meal" technique (Wright, *Spycatcher*, 1987) formalized with real math instead of unique paragraph variations.

---

### The Tradeoff

There's a fundamental tension between structural fidelity and resistance to known-plaintext analysis. The rigid-body GPS transformation preserves distances and clustering perfectly - but if an attacker already knows two real GPS coordinates and can identify their distorted equivalents, they can solve for the rotation angle and translation vector with basic linear algebra. More faithful structure preservation means more solvable transformations.

This tradeoff is the interesting research question. The security guarantee depends on the adversary's knowledge assumptions: an outsider with no ground truth can't detect anything. An insider with partial knowledge faces a harder problem. An insider with verified real-time ground truth on specific data points could potentially reverse portions of the transformation.

The mitigation space includes non-linear transformations (break distance preservation but increase security), per-region sub-transformations (different rotations per grid cell), and accepting the limitation where the threat model doesn't include real-time verified ground truth.

---

### Prior Art and Positioning

Format-preserving encryption: Bellare, Rogaway, Spies (2009). NIST SP 800-38G.

Deception technology: Spitzner / Honeynet Project (1999). MITRE Engage framework (2022). Heckman, Stech et al., *Cyber Denial, Deception and Counter Deception* (Springer, 2015).

Application-layer deception: Kahlhofer & Rass, *Application Layer Cyber Deception without Developer Interaction* (arXiv 2405.12852, 2024) - identifies the subfield as underdeveloped.

Shadow systems: Anagnostakis et al., *Shadow Honeypots* (USENIX Security, 2005). Araujo & Hamlen, *Honey-Patches* (ACM CCS, 2014).

Cross-domain tracer data: Wright, *Spycatcher* (1987) - "barium meal." Clancy, *Patriot Games* (1987) - "canary trap." Thinkst CanaryTokens - digital tripwires.

The gap: FPE applied as real-time deception middleware with structural-fidelity-preserving distortion. No identified prior art for this specific construction.

---

### Related Doctrine: Turned-Asset Protocol

The distortion layer enables a broader operational doctrine. When a legitimate insider is confirmed compromised - coerced, bribed, or turned - the standard response is to revoke access. This alerts the adversary that you've detected them.

The alternative: silently route the compromised insider's session through the distortion layer. They continue to believe the system is functioning normally. Their handler continues to receive "intelligence." Meanwhile, the operator observes what the compromised insider searches for (revealing their handler's priorities), the distorted data they exfiltrate (creating traceable artifacts), and the behavioral patterns of their access (building an evidence trail).

This is intelligence tradecraft - running a double agent - encoded into software architecture. MITRE Engage's own build guidance acknowledges this gap: "if you are attempting to identify an insider threat, an isolated environment may not be useful." The distortion layer makes it useful - because the environment isn't isolated. It's the same environment, just wrong.

No vendor, framework, or academic paper currently formalizes this as a named doctrine.

---

### Applicability

This construction isn't domain-specific. Any system where:

- Insiders have legitimate access to real data
- The threat model includes compromised insiders or stolen credentials
- Structural patterns in the data carry operational meaning
- Leaked data could cause real-world harm
- Attribution of the leak source matters

...could benefit from a distortion middleware layer. The technique is most valuable where the data has geographic, temporal, and relational structure that an insider would recognize - because that's exactly the structure the distortion preserves.

---

### Status

| Item | State |
|------|-------|
| Conceptual framework | Complete |
| Threat model and security analysis | Complete |
| FPE implementation (FF1/FF3-1) | Libraries available, not yet integrated |
| Structural-fidelity vs. known-plaintext analysis | Characterized, not formally proven |
| Prototype implementation | Planned |
| Human distinguishability evaluation | Planned |

### Papers

| Title | Status |
|-------|--------|
| MOIRÉ: Format-Preserving Encryption as Real-Time Deception Middleware | In progress |
| Security Analysis of Structure-Preserving Data Distortion for Active Defense | Planned |
