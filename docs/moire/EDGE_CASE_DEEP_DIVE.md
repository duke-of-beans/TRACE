# FPE Deception Middleware - Edge Case Analysis & Improvements

## What Breaks It

These are the attacks and failure modes that the white paper doesn't address. Some are fatal if unmitigated. Some are inherent tradeoffs. All of them are things a competent reviewer or adversary would find.

---

### 1. Search Inversion Attack

**The problem:** The distortion layer transforms query RESULTS. But what about query INPUTS? If an insider searches for "blue Corolla" (a distorted value they saw on screen), the query goes to the real database, which has no blue Corolla - it has a red Civic. The search returns nothing. Empty results on a term the user just saw on screen is an immediate tell.

**Severity:** Fatal if unmitigated. This breaks the deception on first interaction.

**Mitigation:** The distortion layer must be BIDIRECTIONAL. It intercepts both query results (real -> distorted) AND query inputs (distorted -> real). When the ghost user searches for "blue Corolla," the middleware reverse-maps the search term through the distortion function to "red Civic," queries the real database, gets results, then forward-maps the results back through distortion before rendering. Same for filters, sorts, and any parameterized query.

**Implementation cost:** Significant. Every query pathway in the application must pass through the distortion layer in both directions. This is the hardest engineering challenge in the entire construction.

---

### 2. Map Tile Mismatch

**The problem:** The application renders sighting pins on a real map (OpenStreetMap tiles). The distorted GPS coordinates point to real streets - but the street names on the map won't match any address text in the sighting records. An insider who reads "1425 Oak Street" and sees the pin sitting on Maple Avenue knows something is wrong.

**Severity:** High. Geographic data is the most visually verifiable.

**Mitigation options:**
- **Option A: Strip street names from sighting records.** Show coordinates only, no human-readable addresses. Removes the mismatch but reduces usability.
- **Option B: Reverse-geocode the distorted coordinates** and replace address text with the actual address at the distorted location. "1425 Oak Street" becomes "872 Maple Avenue" - which matches where the pin actually sits. This requires a geocoding service but produces full consistency.
- **Option C: Use an unlabeled map layer.** Render map tiles without street names or labels. The pins show geographic clustering but the user can't cross-reference against street names. Works for the "geospatial intelligence" use case but reduces operational utility.

**Recommendation:** Option B (reverse-geocode distorted coordinates) for maximum fidelity. Fall back to Option C for chapters without geocoding infrastructure.

---

### 3. Real-Time Timing Correlation

**The problem:** The ghost environment shows real-time updates - new sightings appear as they happen in the real system. An insider who submitted a test sighting at 3:00 PM and sees a new record appear at 3:00 PM + the timestamp offset has discovered the offset value. With the offset known, all timestamps can be corrected.

**Severity:** Medium-high. Requires the insider to be able to create test data, which means they need submit access.

**Mitigation:** Don't pass new records through to ghost mode in real time. Batch new records with random delay (5-30 minute window). The ghost environment updates periodically, not continuously. Real-time WebSocket events in ghost mode fire on the batch schedule, not on actual submission events. The insider sees "the system updates every few minutes" rather than instant reflection of their own actions.

**Tradeoff:** This makes ghost mode feel slightly less responsive than production, which could itself be a tell if the insider is familiar with the system's normal responsiveness. Mitigate by making the batch delay match the system's existing notification jitter (which is already in the TRACE spec at +/- 30 seconds for real users).

---

### 4. Cardinality Anchor Attack

**The problem:** The white paper says aggregate statistics pass through undistorted - real counts, real distributions. An insider who knows "we had exactly 47 active vehicles yesterday" and sees 47 in ghost mode has confirmed the counts are real. If they then add a test vehicle and the count goes to 48 in both the real and ghost environments, they've confirmed real-time data pass-through. They can now use known counts as anchors to probe for distortion.

**Severity:** Medium. Requires the insider to know specific aggregate numbers with certainty.

**Mitigation:** Apply a small, consistent offset to aggregate counts (+/- 2-5%, derived from key). The ghost environment shows 45 or 49 instead of 47. This weakens the "aggregates are real" claim but prevents cardinality anchoring. The offset should be consistent within a session (same count always shows the same offset) so the numbers don't fluctuate suspiciously.

**Tradeoff:** Distorted counts mean the ghost environment's statistics don't perfectly match reality. An insider who has no external anchor won't notice. An insider comparing ghost-mode counts against a known external source (like a report they received last week) might notice the discrepancy. Acceptable for most threat models.

---

### 5. Relational Consistency Under Distortion

**The problem:** If Vehicle A is linked to Actor B, and Actor B is linked to Vehicles A, C, and D, the distortion must maintain these relationships consistently across ALL views. If the vehicle dossier shows Actor "Tall Steve" but the actor profile page shows a different distorted name for the same entity, the deception is exposed.

**Severity:** Fatal if unmitigated. Relational inconsistency is the most likely implementation bug.

**Mitigation:** The distortion function must be ENTITY-AWARE. It doesn't just transform individual field values - it maintains a session-scoped mapping table. Entity X always maps to the same distorted entity X' within a session, regardless of which query or view surfaces it. This mapping table is generated lazily (on first encounter of each entity) and cached for the session duration.

**Implementation:** The distortion layer maintains an in-memory dictionary: {real_entity_id: distorted_entity_id} for each data type. When a query result contains entity_id 47, the layer checks the dictionary. If 47 has been seen before, return the cached distortion. If not, generate a new distortion, cache it, and return it. This guarantees relational consistency.

---

### 6. Multi-Session Inconsistency

**The problem:** If the same insider enters ghost mode twice (different sessions, different keys), they see different distorted data each time. If they kept notes from session 1 and compare against session 2, the inconsistency between sessions is a strong detection signal - no legitimate system produces different data on successive logins.

**Severity:** Medium-high for repeat-access scenarios.

**Mitigation options:**
- **Option A: Credential-pinned keys.** A given canary credential always derives the same session key. Same credential = same distortion = consistent experience across sessions. Weakens the attribution chain (can't distinguish different uses of the same credential) but eliminates multi-session detection.
- **Option B: Accept the risk.** If the insider accesses ghost mode twice, they're already deep enough that detection is less damaging than the intelligence gained from their first session. The first session captured their behavioral profile. The second session confirming they're in ghost mode doesn't undo that intelligence.

**Recommendation:** Option A (credential-pinned keys) as default. If attribution granularity is needed, use Option B with time-bucketed keys (same key for a 24-hour window, new key after that).

---

### 7. Side-Channel Timing

**The problem:** The FPE distortion layer adds computational overhead to every query. If ghost mode queries take measurably longer than production queries (even 50-100ms), a sophisticated insider could benchmark response times and detect the difference.

**Severity:** Low-medium. Requires technical sophistication and deliberate benchmarking.

**Mitigation:** Add artificial latency to ALL queries (real and ghost) so the baseline includes enough variance to mask the FPE overhead. Alternatively, pre-compute distorted views for the most common queries and serve from cache. FPE on individual values is fast (microseconds per operation), so the overhead may be negligible in practice - but this needs benchmarking during implementation.

---

### 8. Open Source Code Exposure

**The problem:** TRACE is planned as open source. An insider who reads the source code will discover the distortion middleware's existence. They'll know ghost mode is architecturally possible. They may attempt to detect whether they're currently in it.

**Severity:** Medium. Knowledge that ghost mode exists doesn't automatically enable detection, but it changes the adversary's approach.

**Mitigation:** The distortion middleware's existence can be public knowledge (it's a security feature, not a secret). What must remain secret is: which credentials are canaries, what the session keys are, and what the distortion parameters are. This is consistent with Kerckhoffs's principle - the system should be secure even if the adversary knows how it works. Security depends on the key, not on the algorithm's secrecy.

**Additional mitigation:** The middleware should be architecturally indistinguishable from normal query processing middleware (logging, caching, access control). Its presence in the codebase shouldn't scream "deception layer." Name it something boring: `query_transform_middleware` or `data_normalization_layer`.

---

### 9. Photo-Data Mismatch (Expanded)

**The problem:** The white paper acknowledges this but underspecifies the solution. If the real system has a photo of a red Honda Civic and the distortion changes the description to "blue Toyota Corolla," the photo still shows a red Honda Civic. Instant detection.

**Severity:** Fatal in any system that displays photos alongside structured data.

**Mitigation hierarchy:**
1. **Best:** Maintain a reference image library organized by (body_type, color). When distortion maps "red sedan" to "blue sedan," serve a reference photo of a blue sedan from the library. The photo won't be the exact vehicle, but in a ghost session the insider has no way to verify that.
2. **Good:** Strip photos entirely from ghost mode. Display "media loading" or "photo unavailable" consistently. Simple but reduces realism.
3. **Future:** Apply visual style transfer to the actual photo - change the car's color computationally. Technically possible with current ML (pix2pix, style transfer models) but heavy and potentially detectable via artifacts.

**For the paper:** Acknowledge this as a limitation for media-rich applications. The construction is strongest for structured data (text, numbers, coordinates). Media requires additional handling that's outside the core FPE contribution.

---

### 10. False Positive Ghost Mode Activation

**The problem:** What if an operator is incorrectly placed in ghost mode? They'll make triage decisions, escalate vehicles, and build case packages based on distorted data. In the TRACE context, this means real criminal activity could go unreviewed while the operator works with phantom records.

**Severity:** Critical for operational systems where decisions have real-world consequences.

**Mitigation:**
- Ghost mode should ONLY be triggered by explicit canary credentials, NEVER by automated anomaly detection. False positive canary triggers don't happen - a canary credential is either used or it isn't.
- Ghost mode sessions should have a MAXIMUM DURATION (configurable, default 4 hours) after which the session terminates and the admin is notified for manual review.
- A parallel alert ensures the admin knows ghost mode is active. If ghost mode triggers unexpectedly, the admin can investigate and terminate it immediately.
- All actions taken during a ghost session (triage decisions, level changes) are recorded but NOT applied to the real database. They exist only in the forensic capture log.

---

## What's Missing From the Construction

### 11. Key Derivation Specification

**Gap:** The paper says "session-specific cryptographic key" but doesn't specify how that key maps to transformation parameters. A proper construction needs:

```
master_session_key (256-bit, from canary credential)
    |
    HKDF-SHA256 expand
    |
    +-- rotation_angle (derived, 0-360 degrees)
    +-- translation_dx (derived, bounded to metro area)
    +-- translation_dy (derived, bounded to metro area)
    +-- fpe_key_identifiers (derived, 128-bit FF1 key)
    +-- fpe_key_timestamps (derived, 128-bit)
    +-- timestamp_offset (derived, bounded to +/- 14 days)
    +-- substitution_seed_names (derived, seeds the name dictionary)
    +-- substitution_seed_categories (derived, seeds color/type swaps)
    +-- count_offset_factor (derived, +/- 5%)
```

All parameters derived from a single master key via HKDF ensures: one key controls the entire distortion, the key is never used directly (only derived subkeys are), and the derivation is deterministic (same master key always produces same parameters).

### 12. Distortion Boundary Constraints

**Gap:** The paper doesn't specify bounds on the distortion. Unbounded rotation could place coordinates in the ocean. Unbounded timestamp offset could show dates in the future. Unbounded name substitution could produce implausible names.

**Specification needed:**
- GPS rotation/translation must keep all coordinates within the metro area boundary (bounding box defined per chapter)
- Timestamp offset must keep all dates in the past (never show future sightings)
- Name substitution must draw from a culturally plausible dictionary for the region
- Vehicle make/model substitution must use models that actually exist and are plausible for the region
- License plate FPE must produce format-valid plates for the relevant state/jurisdiction

### 13. Gradual Distortion (Alternative Construction)

**Not in the paper but worth considering:** Instead of binary real/ghost (100% real or 100% distorted), apply partial distortion: 5-10% of records are distorted, 90-95% are real. 

**Advantages:** Much harder to detect statistically. The data mostly looks correct. The distorted records are "needles" that produce traceable artifacts if exfiltrated.

**Disadvantages:** Weakens the attribution chain (which specific records were distorted?). Requires the distorted records to be individually marked (not just session-keyed). If the insider happens to check a real record, they see correct data and gain false confidence.

**Assessment:** This is a separate construction, not an improvement to the current one. Worth mentioning in the "future work" section as an alternative approach.

### 14. Layered Distortion (Strengthening Against Known-Plaintext)

**The biggest weakness in the paper is the known-plaintext vulnerability of the coordinate rotation.** Two known point correspondences solve the transformation. Here's a concrete strengthening:

After the rigid-body rotation, apply FPE to the coordinate digits themselves. Take the latitude 34.2587 - after rotation it becomes (say) 34.1923. Now apply FF1 encryption to the digit string "341923" with the session key, producing "347156" -> latitude 34.7156. 

This adds an algebraic layer on top of the geometric layer. Even if the attacker solves the rotation (from known point pairs), they still face the FPE layer on the individual coordinates. The FPE layer can't be solved without the key, regardless of how many known pairs the attacker has.

**Tradeoff:** This BREAKS distance preservation. After FPE on the digits, two points that were 200m apart may now be 3km apart. The clustering structure is destroyed at the fine-grained level but roughly preserved at the city level.

**Hybrid approach:** Apply the geometric rotation (preserving clustering) for the MAP VIEW, but apply rotation + digit FPE for EXPORTED DATA and SEARCH RESULTS. The visual map is convincing. The data, if exfiltrated in numeric form, is hardened against known-plaintext attack. This dual-mode distortion is the most robust construction.

---

## Operational Considerations

### 15. Legal Boundaries (Deeper Than a Footnote)

The paper has a one-line legal footnote. For the cybersec conversation, you need to know the actual legal landscape:

**US Federal:**
- **Electronic Communications Privacy Act (18 U.S.C. 2511):** Prohibits intentional interception of electronic communications. Does routing a user's session through a distortion layer constitute "interception"? Key question: is the distortion layer "intercepting" the communication or "modifying" the system's output? If the user is accessing a system they're authorized to access, and the system is configured to serve distorted data to certain sessions, this may not be interception at all - it's the system responding differently to different inputs. This is closer to "the system serving different content" than "intercepting communications."
- **Computer Fraud and Abuse Act (18 U.S.C. 1030):** The insider is accessing the system with valid credentials (even if canary credentials). They're not exceeding authorized access - they're accessing exactly what they're authorized to access. The system is choosing what to serve them.
- **Stored Communications Act (18 U.S.C. 2701):** Restricts unauthorized access to stored communications. Ghost mode doesn't access the insider's stored communications - it serves them modified versions of the system's own data.

**Key legal framing:** The system isn't intercepting the user's communications. The system is serving different data to different sessions based on authentication state. This is architecturally identical to A/B testing, feature flags, or role-based access control - all of which are legally uncontroversial.

**Still need counsel for:** employment law implications (especially if the ghost-mode subject is an employee), union contract considerations, and jurisdiction-specific wiretap statutes (some states are more restrictive than federal law).

### 16. Ethical Time Limits

**How long is it acceptable to run someone in ghost mode?**

If it's an external attacker using stolen credentials - indefinitely, or until the intelligence value is exhausted.

If it's a coerced insider (they're being forced to spy) - there's an ethical obligation to intervene for their safety, not just extract intelligence. Ghost mode should trigger a welfare check, not just a forensic capture.

If it's a voluntarily turned insider (they chose to betray the organization) - the intelligence window should have a defined review period. Recommendation: 72-hour maximum before mandatory admin review of whether to continue, contain, or involve law enforcement.

**For the paper:** A single sentence acknowledging that ghost mode requires defined rules of engagement and periodic review.

### 17. Ghost Mode Indicators for Admin

The admin needs to know at all times:
- How many ghost sessions are currently active
- How long each has been running
- What the ghost user has been searching for (real-time behavioral feed)
- A one-click termination button for each session
- Automatic termination at max duration
- Alert if ghost user attempts to export data or generate case packages

Ghost-mode-generated case packages must NEVER be delivered to external parties (attorneys, law enforcement). A case package generated in ghost mode contains distorted evidence that would contaminate a real investigation. The system must block this pathway entirely.

---

## Improvements to the Paper

### 18. Add the Bidirectional Distortion Requirement

This is the single biggest gap in the current paper. Without bidirectional distortion (query inputs AND results), the construction fails on first search. Add to Section 3.

### 19. Strengthen the Coordinate Section

Add the layered distortion approach (rotation + digit FPE) as a "hardened variant" in Section 4. It directly addresses the known-plaintext weakness that reviewers will attack.

### 20. Add a Threat Model Table

The paper has prose about adversary knowledge tiers but no structured summary. A table mapping adversary capabilities to detection probabilities would strengthen Section 4 significantly.

### 21. Acknowledge Photo Limitation Explicitly

Add one paragraph to Section 6 (Applicability) acknowledging that the construction is strongest for structured data and requires supplementary handling for media-rich applications.

### 22. Name the Construction

Academic constructions that get cited have names. "FPE deception middleware" is descriptive but not memorable. Consider naming it. Options:
- **PRISM** - but taken (NSA program)
- **MIRROR** - descriptive (cryptographic mirror of reality)
- **PARALLAX** - evocative (same data, different perspective based on where you're standing)
- **REFRACT** - what the distortion layer does to data (changes its apparent position without changing its structure)

PARALLAX is the strongest. The construction produces a parallax effect - the same underlying reality appears differently depending on the observer's position (which key they hold). And it's not taken by any existing security tool or framework.
