# White Paper Design Document
## "Format-Preserving Encryption as Real-Time Deception Middleware"

This document designs the paper before writing it. Every structural decision is justified.

---

## 1. Audience Analysis

This paper has three audiences reading it for three different reasons. The design must serve all three without compromising for any.

### Audience A: Cybersecurity Professionals (Primary)

**Who they are:** Working security engineers, penetration testers, CISOs, red team operators, deception technology practitioners. The person you're meeting in a few days.

**What they're looking for:** "Is this real or is this another thought-leadership fluff piece?" They'll scan the prior art section first to see if you've done the homework. They'll look for the threat model to see if you understand real adversaries. They'll look for the weakness analysis to see if you're honest. They'll skip anything that smells like marketing.

**What earns their respect:**
- Citing Bellare/Rogaway, not just "we use encryption"
- Acknowledging the known-plaintext weakness before they point it out
- A threat model that sounds like it came from real operations, not a textbook
- The phrase "no identified prior art" backed by specific searches, not hand-waving
- Implementation-aware language (they'll notice if you've never built anything)

**What loses them immediately:**
- Overclaiming ("revolutionary," "paradigm shift," "unprecedented")
- Ignoring existing vendors (Attivo/SentinelOne, CounterCraft, Illusive)
- No weakness analysis (they'll assume you don't understand your own construction)
- Academic tone without practical grounding
- Vague threat model

### Audience B: Academic Researchers (Secondary)

**Who they are:** People publishing in USENIX Security, ACM CCS, IEEE S&P, or the MTD/HotSec workshop track. They might find this via Google Scholar or citation search.

**What they're looking for:** A citable contribution they can reference or build on. Clear delineation of what's new vs. what's prior art. Enough formalism to cite without embarrassment. A threat model they can extend.

**What earns their respect:**
- Proper citation format (author, venue, year - not just URLs)
- The structural-fidelity vs. known-plaintext tradeoff framed as an open problem
- Explicit "future work" section they could pick up
- Honest novelty claims scoped precisely

**What loses them:**
- Sloppy citations
- Claims that ignore published work they know about
- No formalism at all (they need something to cite)
- Too much practitioner language without theoretical grounding

### Audience C: Visitors to davidkirsch.me (Tertiary)

**Who they are:** People checking out your work - potential collaborators, employers, partners, curious technologists. They landed on the research page and are scanning.

**What they're looking for:** Evidence of original thinking. Depth. Signal that this person builds real things, not just talks about them.

**What earns their respect:**
- The page entry (1,300 words) does this job. They don't need the full paper.
- The fact that a downloadable PDF exists signals depth.
- The status table with "in progress" papers signals ongoing work.

**What loses them:**
- A 40-page PDF they'll never read
- Academic jargon that locks out non-specialists

---

## 2. Purpose Hierarchy

In order of importance:

1. **Establish intellectual priority with a public timestamp.** This is the primary function. The paper needs to be specific enough that if a vendor ships this in 2027, your 2026 publication clearly predates it. This means the construction must be described in implementable detail - not pseudocode, but clear enough that a competent engineer could build it.

2. **Create a reference document for the cybersec conversation.** The person you're talking to should be able to read this in 15-20 minutes and come to the meeting with a technical opinion. That means ~3,500 words, not 8,000.

3. **Seed a potential academic submission.** If you decide to submit to MTD or HotSec, the paper should be restructurable into workshop format (6-8 pages) without major rewrites. This means the content needs to be there even if the formatting is different.

4. **Build credibility on the personal site.** The PDF exists. The page summary points to it. Visitors who care will download it. This is the lowest-priority function and should not drive any structural decisions.

---

## 3. What Belongs in the Paper

### MUST INCLUDE (structural integrity depends on these)

**Threat model.** Not generic - specific to the insider-aware scenario. Who is the adversary? What do they already know? What are they trying to learn? What access do they have? This is what separates a serious paper from a blog post. The threat model from the TRACE security architecture (physical threats to field operatives, compromised insiders, stolen credentials) is more compelling than a generic "enterprise insider threat" framing because it's real.

**The FPE middleware construction.** The core technical contribution. Database -> distortion layer -> application. Data-type-specific transformations. Session-keyed. Format-preserving. This must be described precisely enough to implement. Include the distortion-by-data-type table.

**The coordinate rotation specifically.** This is the most technically interesting piece and the one most likely to generate discussion. Why rigid-body transformation instead of noise? Why it preserves clustering. Why it's vulnerable to known-plaintext with 2 known points. This deserves its own subsection.

**Prior art survey.** Honest, specific, cited. Bellare/Rogaway (FPE), Anagnostakis (shadow honeypots), Araujo/Hamlen (honey-patches), MITRE Engage (framework), Heckman/Stech (Cyber D&D), Wright (barium meal), Thinkst (honeytokens), Kahlhofer/Rass (application-layer deception). The survey must explicitly name the gap: FPE as deception middleware is unoccupied.

**The known-plaintext tradeoff.** This is the weakness, and addressing it honestly is what separates a credible paper from a pitch deck. Frame it as: structural fidelity and known-plaintext resistance are in tension. Characterize the adversary knowledge assumptions under which the construction is secure. Acknowledge where it breaks.

**The attribution chain.** Session-keyed distortion enables reverse-mapping of leaked data to the breach source. This is the "so what" of the construction - it's not just deception, it's attribution.

**The turned-asset doctrine.** This is the second novelty claim (and the stronger one per the research). The operational concept of silently routing a compromised insider through the distortion layer while maintaining the appearance of normalcy. Cite the MITRE Engage gap. Position this as the strategic contribution that the FPE construction enables.

### SHOULD INCLUDE (strengthens the paper but not structurally required)

**Behavioral intelligence from ghost sessions.** What the intruder searches for reveals their priorities. This is established in prior art (Valeros/Rigaki/Garcia 2023) so it's not a novelty claim, but it completes the operational picture.

**The canary credential entry mechanism.** How the attacker ends up in the distorted environment. Planted credentials, duress codes. Brief treatment - this is the "how they get in" not the core contribution.

**Cross-domain tracer data concept.** Marked entities that surface in physical-world adversary behavior. Cite the barium meal lineage. Brief treatment - this is the intelligence-tradecraft framing, not the technical contribution.

**Applicability beyond the originating use case.** One paragraph noting that the construction is domain-agnostic. Any system with geographic, temporal, and relational data structure. Don't list specific products (TRACE, Tranche, Forme) - keep it generic.

### SHOULD NOT INCLUDE (weakens the paper or distracts)

**Implementation details.** No code. No framework choices. No Docker configurations. This is a conceptual and architectural paper, not a build guide. Implementation details date immediately and make the paper look like product documentation.

**Specific product names (TRACE, Tranche, Forme).** The paper describes a general construction. Tying it to a specific product narrows the perceived contribution. Mention "a community safety platform" as the motivating use case without naming it.

**Marketing language.** No "revolutionary," "game-changing," "next-generation." The cybersec audience will close the PDF immediately.

**Excessive formalism.** This isn't a crypto paper. The FPE construction is applied, not novel cryptography. Don't write proofs. Do write precise descriptions. The formalism level should match Araujo & Hamlen (2014) - clear enough to implement, not trying to be a theory paper.

**Legal analysis.** The ECPA / wiretap implications of ghost mode are real but belong in a separate treatment. A footnote acknowledging that legal review is necessary is sufficient. Don't try to be a lawyer in a security paper.

**The full edge case catalog.** The TRACE security edge cases document has 8 sections of detailed scenarios. The paper should reference the threat model and the turned-asset doctrine. It should NOT reproduce the entire catalog of reporter correlation attacks, panic wipe procedures, and notification security. Those are operational details, not the contribution.

---

## 4. What Should NOT Be in It and Why

**No executive summary.** This isn't a vendor white paper trying to sell a product to a CISO who won't read past page 2. Your audience will read the whole thing or not at all. An executive summary signals "I expect you not to read this" which is the wrong frame for a research contribution.

**No "about the author" section.** Your website is the about-the-author section. The PDF lives on your site. Anyone who cares already knows where to find you.

**No call to action.** This isn't lead generation. There's no demo to request, no sales call to book. The paper ends with open questions and future work. The implicit call to action is "think about this and tell me if I'm wrong."

**No vendor comparisons.** Don't position this against SentinelOne or CounterCraft or anyone else. The prior art survey acknowledges their existence. The paper's contribution is orthogonal to what they sell. Comparing yourself to vendors makes you look like a vendor. You're a researcher.

**No diagrams of the architecture.** Controversial - most white papers have diagrams. But your existing research page doesn't use them, and the construction is simple enough to describe in text: database -> distortion layer -> application. A diagram adds visual weight but no information. If you add one, make it minimal (the three-box pipeline), not a complex system diagram.

Actually - one diagram. The coordinate rotation. A before/after showing the same cluster of points rotated and translated. That visual communicates instantly what takes 200 words to explain. That one earns its space.

---

## 5. Structure

Based on the above analysis:

```
Title
Subtitle (one line)
Author, date, URL

1. The Problem (300 words)
   - Insider-aware deception is unsolved
   - Static honeypots fail against insiders who know the data
   - The gap: structurally-faithful real-time deception

2. Prior Art (500 words)
   - FPE: Bellare/Rogaway/Spies 2009, NIST SP 800-38G
   - Deception: Spitzner, MITRE Engage, Heckman/Stech 2015
   - Application-layer: Kahlhofer/Rass 2024
   - Shadow systems: Anagnostakis 2005, Araujo/Hamlen 2014
   - Cross-domain tracers: Wright 1987, Thinkst
   - Commercial: SentinelOne, CounterCraft, Acalvio, Illusive
   - The gap stated explicitly

3. Construction (800 words)
   - Middleware architecture
   - Distortion-by-data-type table
   - The coordinate rotation (with the one diagram)
   - Session-keyed attribution chain
   - What's preserved vs. what changes

4. Security Analysis (500 words)
   - Adversary knowledge assumptions
   - The structural-fidelity vs. known-plaintext tradeoff
   - Where it holds, where it breaks
   - Mitigation space

5. Turned-Asset Doctrine (400 words)
   - The operational concept
   - Why revocation is the wrong response
   - The MITRE Engage gap
   - Intelligence output from ghost sessions

6. Applicability and Limitations (300 words)
   - Domain-agnostic construction
   - Where it fits (geographic/temporal/relational data)
   - Where it doesn't (unstructured data, no insider threat model)
   - Legal considerations (footnote-level, not analysis)

7. Open Questions and Future Work (200 words)
   - Formal security proof under stated assumptions
   - Human distinguishability evaluation
   - Non-linear transformation alternatives
   - Integration with existing deception platforms

References (20-25 citations)
```

**Total: ~3,000-3,500 words.** Readable in 15-20 minutes. Dense enough to cite. Short enough to finish.

---

## 6. Voice and Tone

SCRVNR: research environment, modulated toward casual.

- Contractions at ~55-60% (less than personal, more than full academic)
- Direct, declarative sentences
- No hedging ("may potentially" -> "does" or "doesn't")
- Technical precision without jargon inflation
- First person avoided but implied (no "we present" or "I argue" - just present the work)
- Tables over prose for structured comparisons
- Short paragraphs (3-5 sentences max)
- The reader is assumed to be technically competent - don't explain what FPE is, cite Bellare and move on

Match the existing research page voice: "The system doesn't know what it's looking for. It maps everything, and the density tells you where to look."

---

## 7. Format

**Page entry (already drafted):** ~1,300 words. Lives on davidkirsch.me/research. No changes needed.

**PDF white paper:** ~3,000-3,500 words. Clean typography. Single column. No headers/footers except page numbers. One diagram (coordinate rotation before/after). The data-type distortion table. The references.

The PDF should look like it was written by someone who builds things, not by a design agency. Clean, minimal, no branding beyond your name. Think arXiv pre-print aesthetic, not Deloitte report.
