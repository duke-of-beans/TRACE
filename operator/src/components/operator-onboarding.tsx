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

Your reporters are out in the field collecting sightings. This dashboard is where you make sense of it all. Review reports, build vehicle profiles, spot patterns, and manage your team.

This quick tour covers the main tools. Takes about 2 minutes.`,
  },
  {
    title: "Your Dashboard",
    icon: "grid",
    plain: "The sidebar on the left is your main navigation. Dashboard gives you the overview. Triage is where new sightings arrive. Intel Map shows everything on a map. Vehicles and Actors are your case files. Admin is where you configure the system. You can also use number keys 1 through 7 to switch pages.",
    content: `Dashboard: stats at a glance.
Triage: review incoming sightings.
Intel Map: geospatial view with filtering and time playback.
Vehicles: dossiers, search, status tracking.
Actors: profiles of known individuals.
Admin: configure types, levels, reporters, notifications.
Security: device management and remote controls.

Keyboard shortcut overlay: press ? on any page.`,
  },
  {
    title: "Reviewing Sightings",
    icon: "zap",
    plain: "When a reporter sees something, it lands in your Triage queue. You open each sighting, read the details, and pick an action. Approve adds it to tracking. Flag marks it for follow-up. Dismiss removes it. Escalate marks it urgent. You can do all of this with your keyboard.",
    content: `A = Approve, F = Flag, D = Dismiss, E = Escalate.
N = Next sighting, P = Previous.

New sightings appear in real time when the server is running locally. On the hosted version, refresh to check for new entries.`,
  },
  {
    title: "Tracking Vehicles",
    icon: "car",
    plain: "Every vehicle starts at the lowest suspicion level. As more sightings come in, you can promote it up the ladder. The levels are configurable, but the defaults are: Noted, Watching, Suspicious, Confirmed, Priority. You can also set rules in Admin so vehicles promote automatically when they hit certain thresholds.",
    content: `Each vehicle has a dossier: plate, description, sighting history, map of locations, linked actors.

Suspicion levels and their promotion rules are fully editable in Admin. Actors (known individuals) have their own parallel ladder.`,
  },
  {
    title: "Adding Reporters",
    icon: "user",
    plain: "To bring someone onto your team, go to Admin and generate an invite code. Hand it to them in person or through a secure channel. They enter the code in the reporter app and they are in. No email or account creation needed. You will know them only by their callsign.",
    content: `Invite codes: XXXX-XXXX format, single-use, valid 7 days.
Reporters identified by callsign only. Real names are never visible in operational data.`,
  },
  {
    title: "Device Controls",
    icon: "shield",
    plain: "If a reporter's phone is lost or a situation changes, you have remote controls in the Security section. Suspend blocks their access (reversible). Kill erases TRACE data from their device on its next check-in. There is also an option to do this for every device at once. Phones that go offline for 72 hours erase themselves automatically.",
    content: `Suspend: blocks access, reversible.
Kill: erases device data on next server contact.
Nuke All: every device in the chapter. Double-confirmed.
Auto-wipe: 72-hour offline timer, handled by the device.`,
  },
  {
    title: "Try It Out",
    icon: "compass",
    plain: "The system is loaded with demo data so you can explore without consequences. Vehicles are labeled FAKE-001 through TEST-005, actors are named GHOST, SPARKS, and NINE. Click around, try the triage keyboard shortcuts, open a vehicle dossier, check the Intel Map. When you are ready for real data, clear the demo entries from Admin.",
    content: `Demo vehicles: FAKE-001, FAKE-002, FAKE-003, TEST-004, TEST-005.
Demo actors: GHOST (DEMO), SPARKS (DEMO), NINE (DEMO).
Demo sightings, identifiers, and suspicion levels all prefixed DEMO or TEST.`,
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
      <div style={{
        maxWidth: 520, width: "100%",
        height: "min(600px, 85vh)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Dots — fixed at top */}
        <div className="flex gap-1.5 justify-center mb-6" style={{ flexShrink: 0 }}>
          {STEPS.map((_, i) => (
            <div key={i} className="rounded-full" style={{
              width: 8, height: 8,
              background: i === step ? "var(--accent)" : i < step ? "var(--accent)" : "var(--border)",
              opacity: i < step ? 0.4 : 1,
              transition: "all 150ms ease",
            }} />
          ))}
        </div>

        {/* Card — scrollable content */}
        <div className="rounded-xl p-8" style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          flex: 1, minHeight: 0, overflowY: "auto",
        }}>
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

          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text-sec)" }}>
            {current.content}
          </p>
        </div>

        {/* Navigation — pinned at bottom */}
        <div style={{ flexShrink: 0, paddingTop: "var(--sp-6, 24px)" }}>
          <div className="flex gap-3">
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
          <p className="text-center mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
            {step + 1} of {STEPS.length}
          </p>
        </div>
      </div>
    </div>
  );
}

export function needsOperatorOnboarding(): boolean {
  return localStorage.getItem("trace_op_onboarded") !== "true";
}
