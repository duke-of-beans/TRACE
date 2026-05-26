/**
 * TRACE Operator — Onboarding
 *
 * First-time briefing for operators. Covers:
 * - What TRACE is and the full acronym
 * - Three-vault architecture
 * - Triage workflow
 * - Reporter management + invite codes
 * - Remote kill capabilities
 * - Demo data notice
 */
import { useState } from "react";
import { Icon } from "./icon.js";

const STEPS = [
  {
    title: "Welcome",
    icon: "shield",
    useWordmark: true,
    content: `TRACE — Tracking, Reporting, Analysis & Community Evidence — is a secure platform for community vehicle surveillance operations.

You're logging in as an operator. You manage reporters, review incoming sightings, track vehicles and actors, and control device security for your chapter.

This briefing covers the key systems you'll be working with. Takes about 3 minutes.`,
  },
  {
    title: "Three-Vault Architecture",
    icon: "lock",
    content: `TRACE separates all data into three cryptographically isolated vaults:

Vault A (Operational) — Vehicles, sightings, actors, suspicion levels. Everything is pseudonymous. A full dump reveals zero personal information about reporters.

Vault B (Identity) — Reporter real names, emails, authentication. Encrypted at rest with a separate key. Only accessible during auth flows.

Vault C (Evidence) — Write-once evidence locker with SHA-256 hash chain. Cannot be modified or deleted. Provides tamper-evident, legal-grade evidence integrity.

Each vault uses a separate database role with minimal privileges. This means a breach of one vault does not compromise the others.`,
  },
  {
    title: "Triage Workflow",
    icon: "zap",
    content: `When reporters submit sightings from the field, they arrive in your Triage queue.

For each sighting, you review the plate, vehicle description, activity, photos, and location, then take one of four actions:

Approve — Valid sighting, add to vehicle tracking.
Flag — Needs follow-up or additional context.
Dismiss — Not actionable (false positive, duplicate, etc.).
Escalate — Urgent or high-priority, fast-track to confirmed status.

Triage is keyboard-driven: A, F, D, E for actions, N/P to navigate. Press ? anywhere in the dashboard for the full shortcut list.`,
  },
  {
    title: "Suspicion Ladder",
    icon: "alert-triangle",
    content: `Vehicles are assigned suspicion levels that escalate as evidence accumulates:

Noted → Watching → Suspicious → Confirmed → Priority

Each level has configurable predicates — rules that define when a vehicle should be promoted. For example: "Promote to Watching when sighting count ≥ 3 across ≥ 2 distinct days."

You can customize these levels, their colors, and their promotion rules in the Admin section. Actors have their own parallel suspicion ladder.`,
  },
  {
    title: "Reporter Management",
    icon: "user",
    content: `Reporters join your chapter using invite codes. You generate these in Admin → Reporters.

Each code is a single-use XXXX-XXXX format, valid for 7 days. Give it to the reporter in person or via a secure channel. No email is required — reporters authenticate with the code and a device PIN.

Reporters are identified only by callsigns in the operational vault. Their real identities (if collected) are encrypted separately in Vault B. You work with callsigns, never real names, in your day-to-day operations.`,
  },
  {
    title: "Device Security Controls",
    icon: "skull",
    content: `You have three levels of remote device control:

Suspend — Revokes the reporter's sessions. They lose access on next API call. Reversible.

Kill — Suspends the reporter AND sends a push kill signal. The reporter's device wipes all TRACE data on next contact. Not easily reversible.

Nuke All — Emergency kill for every reporter in the chapter simultaneously. Double-confirmed. Use only when the chapter's operational security has been fundamentally compromised.

If a device is offline, the dead man's switch will fire after the check-in window (default 72 hours), automatically wiping the device.`,
  },
  {
    title: "Demo Data",
    icon: "info",
    content: `This instance has been seeded with obviously fake demo data so you can see how the system works:

• Vehicles with plates like FAKE-001, FAKE-002, TEST-004
• Actors named GHOST (DEMO), SPARKS (DEMO), NINE (DEMO)
• Sightings, identifier types, suspicion levels — all marked (DEMO)

Explore the dashboard to see how vehicles, actors, sightings, and the suspicion ladder work together. When you're ready to go live, delete all demo records from Admin and replace them with your chapter's real configuration.

You're all set. Welcome to TRACE.`,
  },
];

type OperatorOnboardingProps = { onComplete: () => void };

export function OperatorOnboarding({ onComplete }: OperatorOnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleComplete = () => {
    localStorage.setItem("trace_op_onboarded", "true");
    onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg)" }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className="rounded-full" style={{
              width: 8, height: 8,
              background: i === step ? "var(--accent)" : i < step ? "var(--accent)" : "var(--border)",
              opacity: i < step ? 0.4 : 1,
              transition: "all 150ms ease",
            }} />
          ))}
        </div>

        {/* Content card */}
        <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            {current.useWordmark ? (
              <div style={{ display: "inline-block" }}>
                <span style={{ fontFamily: "'Exo 2', system-ui, sans-serif", fontWeight: 100, fontSize: 32, letterSpacing: "0.22em", color: "var(--text)" }}>TRACE</span>
                <span style={{ display: "block", height: 1, background: "var(--accent)", opacity: 0.5, marginTop: 4 }}></span>
              </div>
            ) : (
              <>
                <span style={{ color: "var(--accent)" }}><Icon name={current.icon} size={22} /></span>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>{current.title}</h2>
              </>
            )}
          </div>

          {/* Body */}
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-sec)" }}>
            {current.content}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition"
              style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
              Back
            </button>
          )}
          <button
            onClick={isLast ? handleComplete : () => setStep(s => s + 1)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
            {isLast ? "Enter Dashboard" : "Continue"}
          </button>
        </div>

        <p className="text-center mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}

export function needsOperatorOnboarding(): boolean {
  return localStorage.getItem("trace_op_onboarded") !== "true";
}
