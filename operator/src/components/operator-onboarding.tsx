/**
 * TRACE Operator — Onboarding
 * Redesigned: visual-first, fixed card, pinned nav.
 */
import { useState } from "react";
import { Icon } from "./icon.js";

const STEPS = [
  {
    icon: "shield", title: "Welcome to TRACE",
    body: "Tracking, Reporting, Analysis, and Community Evidence. Your reporters collect sightings. This console is where you triage, investigate, and dispatch.",
    detail: null,
  },
  {
    icon: "grid", title: "Your workspace",
    body: "The sidebar navigates between Dashboard, Triage, Activity Map, Vehicles, Actors, Reports, and more. Number keys 1-9 switch pages instantly. Press ? for all shortcuts.",
    detail: "Dashboard (1). Triage (2): incoming sightings. Activity Map (3): geospatial view with filters. Dispatches (4). Harassment (5): phone reports. Vehicles (6)/Actors (7): case files. Reports (R): behavior and co-occurrence. Admin (8). Security (9).",
  },
  {
    icon: "zap", title: "Triage incoming sightings",
    body: "New reports land here. Each shows MATCH or NEW PLATE. Approve, flag, dismiss, or escalate. All keyboard-driven.",
    detail: "Shortcuts: A (approve), F (flag), D (dismiss), E (escalate), N/P (next/previous). New sightings appear in real time.",
  },
  {
    icon: "map-pin", title: "Activity Map",
    body: "Every sighting on a satellite map with heatmap, corridors, and co-occurrence zones. Set watchpoints to monitor specific locations. The Filters panel lets you slice by time, vehicle, concern level, dispatches, and linked actors.",
    detail: "Right-click the map to drop a dispatch pin or save a watchpoint. Watchpoints track which vehicles pass through an area. Use the time slider to replay patterns hour by hour.",
  },
  {
    icon: "car", title: "Vehicle tracking",
    body: "Every vehicle starts at the lowest concern level. As sightings accumulate, promote through the ladder. Each vehicle record shows photos, a sighting map, activity patterns, and which other vehicles it is frequently seen with.",
    detail: "Multi-photo gallery with primary selection. Behavior report shows repeat visit locations and time-of-day patterns. Co-occurrence pairs flag possible coordination between vehicles.",
  },
  {
    icon: "user", title: "Invite reporters",
    body: "Generate an invite code in Admin. Hand it over in person or via Signal. No email, no account creation. Reporters are identified by callsign only.",
    detail: "Invite codes: XXXX-XXXX format, single-use, valid 7 days. Real identities are encrypted in a separate vault inaccessible during normal operations.",
  },
  {
    icon: "file-text", title: "Reports",
    body: "Two analytical reports. Behavior: which vehicles show up at the same location repeatedly. Co-occurrence: which vehicles operate together within a time window. Both can be copied as plain text for sharing.",
    detail: "Filter by date range and vehicle. Behavior clusters sightings by location and surfaces time-of-day patterns. Co-occurrence finds vehicle pairs seen near each other within configurable distance and time thresholds.",
  },
  {
    icon: "shield", title: "Remote device controls",
    body: "Lost phone? Compromised reporter? Suspend blocks access (reversible). Kill erases TRACE data from the device. Both take effect on next check-in.",
    detail: "Nuke All: wipe every device in the chapter (double-confirmed). Auto-wipe: devices that go offline for 72 hours erase themselves automatically.",
  },
  {
    icon: "sliders", title: "Integrations",
    body: "TRACE works without external services. Optional API keys for CarAPI (vehicle lookups) and Spokeo (caller ID) are configured in Admin.",
    detail: "CarAPI resolves plates to make, model, year, and color. Spokeo identifies phone numbers. Keys are encrypted server-side. Each lookup is metered and visible in Admin.",
  },
  {
    icon: "compass", title: "Try it out",
    body: "Explore the Activity Map filters, check the Reports page, review vehicle records with their photo galleries and pattern data. When ready, clear demo data from Admin and start real operations.",
    detail: "Node Settings (key 0) is where you configure networking, security, local AI, or peer sharing when you are ready to go deeper.",
  },
];

type OperatorOnboardingProps = { onComplete: () => void };

export function OperatorOnboarding({ onComplete }: OperatorOnboardingProps) {
  const [step, setStep] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const handleComplete = () => { localStorage.setItem("trace_op_onboarded", "true"); onComplete(); };

  const goNext = () => {
    if (isLast) { handleComplete(); return; }
    setShowDetail(false);
    setStep(s => s + 1);
  };
  const goBack = () => { setShowDetail(false); setStep(s => s - 1); };

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--bg)", zIndex: 9998 }}>
      <div style={{
        textAlign: "center", maxWidth: 420, width: "100%",
        height: "min(520px, 80vh)",
        display: "flex", flexDirection: "column",
        padding: 28, borderRadius: 16,
        background: "var(--surface)", border: "1px solid var(--border)",
      }}>
        {/* Icon area */}
        <div style={{
          height: 100, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {step === 0 ? (
            <div>
              <span style={{
                fontFamily: "'Exo 2', system-ui, sans-serif",
                fontWeight: 100, fontSize: 36, letterSpacing: "0.22em",
                color: "var(--accent)", display: "block",
              }}>TRACE</span>
              <span style={{ display: "block", position: "relative" as const, height: 1, background: "var(--accent)", opacity: 0.4, marginTop: 6 }}>
                <span style={{ position: "absolute" as const, right: -3, top: -2, width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", opacity: 1 }}></span>
              </span>
              <span style={{ display: "block", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 6 }}>OPERATOR CONSOLE</span>
            </div>
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "rgba(99,102,241,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--accent)",
            }}>
              <Icon name={current.icon} size={28} />
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "flex-start", minHeight: 0,
          textAlign: "center", padding: "0 8px", overflow: "auto",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "var(--text)", lineHeight: 1.3 }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-sec)", lineHeight: 1.7, marginBottom: 12 }}>
            {current.body}
          </p>
          {current.detail && (
            <div style={{ marginTop: "auto" }}>
              {!showDetail ? (
                <button onClick={() => setShowDetail(true)} style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  fontSize: 11, cursor: "pointer", textDecoration: "underline", opacity: 0.7,
                }}>Details</button>
              ) : (
                <div style={{
                  fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6,
                  background: "var(--bg)", borderRadius: 8, padding: "10px 14px", textAlign: "left",
                }}>{current.detail}</div>
              )}
            </div>
          )}
        </div>

        {/* Navigation — PINNED at bottom */}
        <div style={{ flexShrink: 0, paddingTop: 16 }}>
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={goBack}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-sec)", flex: 1 }}>
                Back
              </button>
            )}
            <button onClick={goNext}
              className="py-2.5 rounded-lg text-sm font-semibold transition"
              style={{ background: "var(--accent)", color: "var(--accent-text)", flex: step > 0 ? 2 : 1 }}>
              {isLast ? "Enter Dashboard" : "Continue"}
            </button>
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 6, marginTop: 12,
          }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 16 : 6, height: 6,
                borderRadius: 3,
                background: i === step ? "var(--accent)" : i < step ? "var(--accent)" : "var(--border)",
                opacity: i < step ? 0.4 : 1,
                transition: "width 0.2s, opacity 0.2s",
              }} />
            ))}
            {!isLast && (
              <button onClick={handleComplete} style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: 11, marginLeft: 8, opacity: 0.6,
              }}>skip</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function needsOperatorOnboarding(): boolean {
  return localStorage.getItem("trace_op_onboarded") !== "true";
}
