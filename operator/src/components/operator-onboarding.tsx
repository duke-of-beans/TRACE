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
    title: "How Data is Separated",
    icon: "lock",
    plain: "Your chapter's data is split into three separate locked boxes. Operational data (vehicles, sightings) is in one box. Reporter identities are in a second box with a different lock. Evidence is in a third box that can only be added to, never changed or deleted. If one box is compromised, the others stay locked.",
    content: `Vault A (Operational): Vehicles, sightings, actors, suspicion levels. Pseudonymous. A complete dump contains zero reporter identities.

Vault B (Identity): Reporter names, authentication tokens, sessions. Encrypted at rest with a separate key.

Vault C (Evidence): Write-once evidence locker. SHA-256 hash chain. Cannot be modified or deleted.

Each vault uses a separate database role with minimal privileges.`,
  },
  {
    title: "Reviewing Reports",
    icon: "zap",
    plain: "When reporters submit sightings from the field, they land in your Triage queue. You review each one and decide what to do with it: add it to tracking, flag it for follow-up, dismiss it, or mark it as high priority.",
    content: `Approve: valid sighting, add to vehicle tracking.
Flag: needs follow-up or context.
Dismiss: not actionable.
Escalate: high priority, fast-track.

Keyboard driven. A, F, D, E for actions. N/P to navigate. Press ? for the full shortcut list.`,
  },
  {
    title: "Suspicion Levels",
    icon: "alert-triangle",
    plain: "Each vehicle gets a suspicion level that goes up as more evidence comes in. Think of it like a threat meter: starts at Noted (seen once), then Watching, Suspicious, Confirmed, and finally Priority. You can set rules for when vehicles automatically move up.",
    content: `Noted, Watching, Suspicious, Confirmed, Priority.

Each level has configurable predicates. Example: promote to Watching when sighting count reaches 3 across 2 or more distinct days.

Levels, colors, and promotion rules are editable in Admin. Actors have a parallel ladder.`,
  },
  {
    title: "Managing Reporters",
    icon: "user",
    plain: "To add a reporter, you generate an invite code and give it to them in person or through a secure channel like Signal. No email is needed. In the system, reporters are identified only by their callsign (a code name), never by their real name.",
    content: `Each code is single-use, XXXX-XXXX format, valid 7 days.

Reporters appear in operational data by callsign only. Real identities, if collected, are encrypted separately. Day-to-day operations use callsigns exclusively.`,
  },
  {
    title: "Controlling Devices",
    icon: "skull",
    plain: "You can remotely erase TRACE data from any reporter's phone. There are three levels: Suspend (block their access, reversible), Kill (erase one phone), and Nuke All (erase every phone in the chapter at once). If a phone has been offline too long, it erases itself automatically after 72 hours.",
    content: `Suspend: revokes sessions. Reversible.

Kill: suspends and pushes a kill signal. The device clears all TRACE data on next server contact.

Nuke All: every reporter in the chapter. Double-confirmed.

Offline devices: check-in timer handles it. Default 72 hours.`,
  },
  {
    title: "Demo Data",
    icon: "info",
    plain: "This system has been loaded with fake example data so you can see how everything works. Vehicles are labeled FAKE-001, actors are named GHOST (DEMO), and so on. Explore the dashboard to understand the layout. Delete the demo data from Admin when you are ready to use the system for real.",
    content: `Vehicles: FAKE-001 through TEST-005.
Actors: GHOST (DEMO), SPARKS (DEMO), NINE (DEMO).
Sightings, identifiers, suspicion levels: all prefixed DEMO.`,
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

          {current.plain && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text)", fontWeight: 500 }}>
              {current.plain}
            </p>
          )}

          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>
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
