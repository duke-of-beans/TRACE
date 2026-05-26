/**
 * TRACE Operator — Onboarding
 */
import { useState } from "react";
import { Icon } from "./icon.js";

const STEPS = [
  {
    title: "Welcome",
    icon: "shield",
    useWordmark: true,
    content: `Tracking, Reporting, Analysis, and Community Evidence.

TRACE records vehicle sightings from field reporters, organizes them into patterns, and surfaces intelligence for chapter operators.

You are logging in as an operator. You manage reporters, triage sightings, track vehicles and actors, and control device security.

This covers the key systems. Takes about 3 minutes.`,
  },
  {
    title: "Three-Vault Architecture",
    icon: "lock",
    content: `Data is separated into three cryptographically isolated vaults.

Vault A (Operational): Vehicles, sightings, actors, suspicion levels. Pseudonymous. A complete dump contains zero reporter identities.

Vault B (Identity): Reporter names, authentication tokens, sessions. Encrypted at rest with a separate key. Accessed only during auth flows.

Vault C (Evidence): Write-once evidence locker. SHA-256 hash chain. Cannot be modified or deleted. Append-only by architecture, not policy.

Each vault uses a separate database role with minimal privileges. A breach of one vault does not expose the others.`,
  },
  {
    title: "Triage",
    icon: "zap",
    content: `Field reports arrive in the Triage queue.

For each sighting: review plate, vehicle description, activity, location. Then act.

Approve: valid sighting, add to vehicle tracking.
Flag: needs follow-up or context.
Dismiss: not actionable.
Escalate: high priority, fast-track.

Keyboard driven. A, F, D, E for actions. N/P to navigate. Press ? for the full shortcut list.`,
  },
  {
    title: "Suspicion Ladder",
    icon: "alert-triangle",
    content: `Vehicles are assigned suspicion levels that escalate with evidence.

Noted, Watching, Suspicious, Confirmed, Priority.

Each level has configurable predicates. Example: promote to Watching when sighting count reaches 3 across 2 or more distinct days.

Levels, colors, and promotion rules are editable in Admin. Actors have a parallel ladder with their own criteria.`,
  },
  {
    title: "Reporter Management",
    icon: "user",
    content: `Reporters join via invite codes generated in Admin.

Each code is single-use, XXXX-XXXX format, valid 7 days. Hand it to the reporter directly or through a secure channel. No email is involved.

Reporters appear in operational data by callsign only. Real identities, if collected, are encrypted in Vault B. Day-to-day operations use callsigns exclusively.`,
  },
  {
    title: "Device Security",
    icon: "skull",
    content: `Three levels of remote device control.

Suspend: revokes sessions. Reporter loses access on next API call. Reversible.

Kill: suspends the reporter and pushes a kill signal. The device clears all TRACE data on next server contact.

Nuke All: suspends every reporter in the chapter, revokes all sessions, pushes kill to every device. Double-confirmed.

Offline devices are handled by the check-in timer. Default: 72 hours without server contact triggers automatic data clearing.`,
  },
  {
    title: "Demo Data",
    icon: "info",
    content: `This instance contains demo records. All are marked.

Vehicles: FAKE-001, FAKE-002, FAKE-003, TEST-004, TEST-005.
Actors: GHOST (DEMO), SPARKS (DEMO), NINE (DEMO).
Sightings, identifiers, suspicion levels: all prefixed DEMO.

Use these to understand how the system works. Delete them from Admin when you are ready to go live.`,
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

        <div className="rounded-xl p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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

          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-sec)" }}>
            {current.content}
          </p>
        </div>

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
          {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}

export function needsOperatorOnboarding(): boolean {
  return localStorage.getItem("trace_op_onboarded") !== "true";
}
