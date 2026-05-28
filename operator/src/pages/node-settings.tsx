/**
 * TRACE Operator  -  Node Settings
 *
 * The source of truth for how this TRACE node is configured.
 * Three audiences:
 * 1. The Organizer who just installed  -  sees status and "what's next"
 * 2. The Privacy-Motivated who wants to harden  -  guided by concern, not technology
 * 3. The Tech Person who took over  -  sees everything, changes anything
 *
 * Organized by CONCERN, not technology:
 * - Status: what's running, system health
 * - Reporters: how they connect, onboarding
 * - Security: encryption, access, emergency
 * - AI: cloud vs local, model selection
 * - Peers: other chapters, sharing
 * - Backup: strategies, last backup
 * - Guide: the full setup reference
 */
import { useState, useEffect } from "react";
import { Icon } from "../components/icon.js";
import { useToast, HelpTip } from "../components/ux/index.js";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

/* ── Style constants ── */
const card = "rounded-lg p-4 mb-3";
const cardBg = { background: "var(--surface)", border: "1px solid var(--border)" };
const badge = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";
const sectionTitle = "text-sm font-semibold mb-3";
const mutedText = { color: "var(--text-muted)" };
const secText = { color: "var(--text-sec)" };

/* ── Status badge component ── */
function StatusBadge({ status, label }: { status: "on" | "off" | "partial" | "unknown"; label: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    on: { bg: "rgba(39,174,96,0.15)", text: "#27ae60" },
    off: { bg: "rgba(149,165,166,0.15)", text: "#95a5a6" },
    partial: { bg: "rgba(241,196,15,0.15)", text: "#f1c40f" },
    unknown: { bg: "rgba(149,165,166,0.1)", text: "#7f8c8d" },
  };
  const c = colors[status];
  return (
    <span className={badge} style={{ background: c.bg, color: c.text }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.text, display: "inline-block" }} />
      {label}
    </span>
  );
}

/* ── Config row: a single setting with its status ── */
function ConfigRow({ icon, title, description, status, statusLabel, children, locked }: {
  icon: string; title: string; description: string;
  status: "on" | "off" | "partial" | "unknown"; statusLabel: string;
  children?: React.ReactNode; locked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={card} style={cardBg}>
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => !locked && setExpanded(!expanded)}>
        <div className="mt-0.5" style={{ color: status === "on" ? "var(--accent)" : "var(--text-muted)" }}>
          <Icon name={icon} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium">{title}</span>
            <StatusBadge status={status} label={statusLabel} />
          </div>
          <p className="text-xs leading-relaxed" style={secText}>{description}</p>
        </div>
        {!locked && (
          <div style={mutedText} className="mt-1">
            <Icon name={expanded ? "chevron-down" : "chevron-right"} size={14} />
          </div>
        )}
      </div>
      {expanded && children && (
        <div className="mt-3 pt-3 ml-7" style={{ borderTop: "1px solid var(--border)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Handoff banner ── */
function HandoffBanner() {
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem("trace_handoff_dismissed"));
  if (dismissed) return null;
  return (
    <div className="rounded-lg p-4 mb-5 flex gap-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
      <div style={{ color: "var(--accent)" }} className="mt-0.5"><Icon name="compass" size={20} /></div>
      <div className="flex-1">
        <p className="text-sm font-medium mb-1">Taking over as admin?</p>
        <p className="text-xs leading-relaxed" style={secText}>
          Everything on this page shows how this node is currently configured.
          Every setting can be changed without starting over. The Guide tab
          explains each option in detail with requirements and trade-offs.
        </p>
      </div>
      <button onClick={() => { setDismissed(true); localStorage.setItem("trace_handoff_dismissed", "1"); }}
        className="self-start" style={mutedText}><Icon name="x" size={14} /></button>
    </div>
  );
}

/* ── Tab: Node Status ── */
function StatusTab() {
  return (
    <div>
      <h3 className={sectionTitle}>Node identity</h3>
      <div className={card} style={cardBg}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
            <Icon name="shield" size={20} />
          </div>
          <div>
            <p className="text-sm font-medium">This node</p>
            <p className="text-xs font-mono" style={mutedText}>Identity key generated at first boot</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded px-3 py-2" style={{ background: "var(--bg)" }}>
            <span style={mutedText}>Database</span>
            <p className="font-medium mt-0.5">SQLCipher AES-256</p>
          </div>
          <div className="rounded px-3 py-2" style={{ background: "var(--bg)" }}>
            <span style={mutedText}>Deployment</span>
            <p className="font-medium mt-0.5">Vercel (hosted)</p>
          </div>
        </div>
      </div>

      <h3 className={sectionTitle} style={{ marginTop: 16 }}>System</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className={card} style={{ ...cardBg, textAlign: "center" as const }}>
          <p className="text-xs" style={mutedText}>Uptime</p>
          <p className="text-lg font-semibold mt-1" style={{ color: "var(--accent)" }}> - </p>
          <p className="text-[10px]" style={mutedText}>Hosted mode</p>
        </div>
        <div className={card} style={{ ...cardBg, textAlign: "center" as const }}>
          <p className="text-xs" style={mutedText}>Storage</p>
          <p className="text-lg font-semibold mt-1"> - </p>
          <p className="text-[10px]" style={mutedText}>Supabase managed</p>
        </div>
        <div className={card} style={{ ...cardBg, textAlign: "center" as const }}>
          <p className="text-xs" style={mutedText}>Version</p>
          <p className="text-lg font-semibold mt-1">1.0.0</p>
          <p className="text-[10px]" style={mutedText}>Current</p>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Reporter Access ── */
function ReporterTab() {
  return (
    <div>
      <h3 className={sectionTitle}>How reporters reach this node</h3>
      <ConfigRow icon="globe" title="Public URL" status="on" statusLabel="Active"
        description="Reporters access TRACE through a web URL. Currently hosted on Vercel with automatic TLS.">
        <p className="text-xs" style={secText}>
          Current URL: <span className="font-mono" style={{ color: "var(--accent)" }}>your-chapter.trace.community</span>
        </p>
        <p className="text-xs mt-2" style={mutedText}>
          When running as a sovereign node, this can be replaced with Tailscale (private mesh),
          Cloudflare Tunnel (public URL with hidden origin), Tor .onion (maximum anonymity),
          or local-network-only access.
        </p>
      </ConfigRow>
      <ConfigRow icon="wifi" title="WiFi hotspot mode" status="off" statusLabel="Not available"
        description="Broadcast a local WiFi network so reporters can connect directly  -  no internet needed. For enforcement events and field deployment."
        locked>
        <p className="text-xs" style={mutedText}>Requires a sovereign node running Linux (Raspberry Pi, laptop, mini PC). Not available in hosted mode.</p>
      </ConfigRow>

      <h3 className={sectionTitle} style={{ marginTop: 16 }}>Reporter onboarding</h3>
      <ConfigRow icon="user" title="Invite codes" status="on" statusLabel="Enabled"
        description="Generate one-time codes that reporters use to register. Codes are created in Admin → Reporters.">
        <p className="text-xs" style={secText}>
          Currently managed through the Admin page. In sovereign node mode, reporters can also
          be onboarded via QR code scan at chapter meetings  -  phone connects directly to the node.
        </p>
      </ConfigRow>
    </div>
  );
}

/* ── Tab: Security ── */
function SecurityTab() {
  return (
    <div>
      <h3 className={sectionTitle}>Data protection</h3>
      <ConfigRow icon="lock" title="Database encryption" status="on" statusLabel="Always on"
        description="All TRACE data is encrypted at rest using AES-256 (SQLCipher). This cannot be disabled  -  it's built into the foundation."
        locked />
      <ConfigRow icon="hard-drive" title="Full-disk encryption" status="unknown" statusLabel="Check your OS"
        description="Encrypts the entire device, not just the TRACE database. Protects temp files, logs, and swap space from forensic extraction.">
        <p className="text-xs" style={secText}>
          <strong className="font-medium">How to check:</strong> On macOS, look for FileVault in System Settings → Privacy.
          On Windows, look for BitLocker. On Linux, check if your drive uses LUKS (run <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: "var(--bg)" }}>lsblk -f</code>).
        </p>
        <p className="text-xs mt-2" style={secText}>
          <strong className="font-medium">Recommended for:</strong> Every dedicated TRACE device (Raspberry Pi, mini PC, server).
          On personal laptops, your OS-level encryption (FileVault / BitLocker) is usually already on.
        </p>
      </ConfigRow>

      <h3 className={sectionTitle} style={{ marginTop: 16 }}>Emergency</h3>
      <ConfigRow icon="alert-triangle" title="Panic wipe" status="off" statusLabel="Disabled"
        description="A hidden shortcut that instantly and permanently destroys all data on this node. Last resort if device seizure is imminent.">
        <div className="rounded-lg p-3 mb-2" style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.15)" }}>
          <p className="text-xs" style={{ color: "#e74c3c" }}>
            <strong className="font-medium">Warning:</strong> This is irreversible. All data is permanently destroyed.
            Only enable if you also have backups stored in a separate, safe location.
          </p>
        </div>
        <p className="text-xs" style={mutedText}>
          Available in sovereign node mode. Configurable as a hidden URL, keyboard shortcut,
          or physical button (GPIO on Raspberry Pi).
        </p>
      </ConfigRow>
      <ConfigRow icon="eye" title="Duress passphrase" status="off" statusLabel="Disabled"
        description="A second passphrase that unlocks a decoy database with innocuous data. The real database remains hidden.">
        <div className="rounded-lg p-3" style={{ background: "rgba(241,196,15,0.08)", border: "1px solid rgba(241,196,15,0.15)" }}>
          <p className="text-xs" style={{ color: "#f39c12" }}>
            <strong className="font-medium">Consult a security trainer before enabling.</strong> This feature can protect or
            endanger depending on your specific situation. It's most effective when the adversary doesn't know
            it exists. It can be dangerous if they do.
          </p>
        </div>
      </ConfigRow>

      <h3 className={sectionTitle} style={{ marginTop: 16 }}>Logging</h3>
      <ConfigRow icon="file" title="Application logs" status="on" statusLabel="7-day retention"
        description="TRACE keeps application logs for 7 days to help diagnose problems. IP addresses are automatically redacted.">
        <p className="text-xs" style={secText}>
          <strong className="font-medium">Zero-log mode</strong> disables all logging entirely. Use only in high-threat
          situations  -  without logs, you can't detect problems or unauthorized access.
        </p>
      </ConfigRow>
    </div>
  );
}

/* ── Tab: AI / Intelligence ── */
function IntelligenceTab() {
  return (
    <div>
      <h3 className={sectionTitle}>AI reasoning engine</h3>
      <p className="text-xs mb-3 leading-relaxed" style={secText}>
        AI powers triage recommendations, import mapping, entity extraction from narratives,
        and natural-language search. TRACE works without AI  -  everything becomes manual.
      </p>
      <ConfigRow icon="zap" title="Cloud AI (Anthropic Claude)" status="on" statusLabel="Active"
        description="Reasoning happens on Anthropic's servers. Best quality. Reporter identities are never sent  -  data is sanitized before API calls.">
        <div className="text-xs space-y-2" style={secText}>
          <p><strong className="font-medium">What's sent:</strong> Vehicle descriptions, plate numbers, location data, incident narratives (sanitized).</p>
          <p><strong className="font-medium">What's never sent:</strong> Reporter names, phone numbers, device IDs, chapter identity.</p>
          <p><strong className="font-medium">Anthropic's policy:</strong> Standard API has 30-day log retention. Data is not used for training.</p>
        </div>
      </ConfigRow>
      <ConfigRow icon="cpu" title="Local AI (Ollama)" status="off" statusLabel="Not configured"
        description="Run AI entirely on this device. No data leaves the node. Requires a capable CPU/GPU.">
        <div className="text-xs space-y-3" style={secText}>
          <p className="font-medium" style={{ color: "var(--text)" }}>Hardware requirements by model size:</p>
          <div className="space-y-2">
            <div className="flex gap-3">
              <span className="font-mono w-8 text-right" style={{ color: "var(--accent)" }}>8B</span>
              <span>8 GB RAM minimum · Good for triage · ~60-70% of cloud quality</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono w-8 text-right" style={{ color: "var(--accent)" }}>14B</span>
              <span>16 GB RAM + 12 GB GPU · Strong import mapping · ~80% of cloud quality</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono w-8 text-right" style={{ color: "var(--accent)" }}>24B</span>
              <span>32 GB RAM + 24 GB GPU · Near-cloud quality · Full engine support</span>
            </div>
            <div className="flex gap-3">
              <span className="font-mono w-8 text-right" style={{ color: "var(--accent)" }}>70B</span>
              <span>48+ GB RAM · Maximum local capability · Requires serious hardware</span>
            </div>
          </div>
          <p style={mutedText}>
            To enable: install Ollama on this device, pull a model, then set the Ollama URL in environment configuration.
            TRACE auto-detects and routes to local AI when available.
          </p>
        </div>
      </ConfigRow>
      <ConfigRow icon="git-merge" title="Hybrid mode" status="off" statusLabel="Not configured"
        description="Local AI handles routine tasks. Complex cases get routed to cloud  -  only with your explicit approval per request.">
        <p className="text-xs" style={secText}>
          Best of both worlds: privacy for the 90% of routine work, cloud power for the 10% that needs it.
          Requires both Ollama and an API key. The operator approves every cloud escalation.
        </p>
      </ConfigRow>
    </div>
  );
}

/* ── Tab: Peers ── */
function PeersTab() {
  return (
    <div>
      <h3 className={sectionTitle}>Connected chapters</h3>
      <div className={card} style={{ ...cardBg, textAlign: "center" as const, padding: "2rem" }}>
        <div style={mutedText}><Icon name="radio" size={32} /></div>
        <p className="text-sm font-medium mt-2">No peers connected</p>
        <p className="text-xs mt-1" style={secText}>
          This node operates standalone. Intelligence stays here unless you explicitly share it.
        </p>
      </div>

      <h3 className={sectionTitle} style={{ marginTop: 16 }}>Sharing method</h3>
      <ConfigRow icon="send" title="Manual file sharing" status="on" statusLabel="Default"
        description="Export selected intelligence as an encrypted .trace file. Send it however you want  -  Signal, email, USB. The other chapter imports it.">
        <p className="text-xs" style={secText}>
          The .trace file is encrypted to the recipient's public key. It's safe on any transport  - 
          the encryption is the protection, not the channel. To share, you'll need the other chapter's
          public key (exchanged at a meeting or over a trusted channel).
        </p>
      </ConfigRow>
      <ConfigRow icon="radio" title="LoRa / Meshtastic alerts" status="off" statusLabel="No radio"
        description="Send short text alerts (sighting notifications, ~200 characters) to nearby chapters via LoRa radio. No internet needed.">
        <p className="text-xs" style={secText}>
          Requires a Meshtastic-compatible radio ($25-$40) connected via USB or Bluetooth.
          LoRa is for short alerts only  -  not database sync. Think of it as encrypted walkie-talkie.
        </p>
      </ConfigRow>

      <h3 className={sectionTitle} style={{ marginTop: 16 }}>How peering works</h3>
      <div className={card} style={cardBg}>
        <div className="space-y-3 text-xs" style={secText}>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>1</div>
            <div><strong className="font-medium" style={{ color: "var(--text)" }}>Meet</strong>  -  Two chapter operators meet in person or over a secure video call.</div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>2</div>
            <div><strong className="font-medium" style={{ color: "var(--text)" }}>Scan</strong>  -  Each shows a QR code with their chapter's public key. Both scan.</div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>3</div>
            <div><strong className="font-medium" style={{ color: "var(--text)" }}>Choose</strong>  -  Each operator selects what to share: vehicle alerts, incidents, evidence  -  per peer, per data type.</div>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>4</div>
            <div><strong className="font-medium" style={{ color: "var(--text)" }}>Share</strong>  -  Export .trace files to that peer whenever you choose. They import. That's it.</div>
          </div>
        </div>
        <p className="text-[10px] mt-3 pt-3" style={{ ...mutedText, borderTop: "1px solid var(--border)" }}>
          Reporter identities never enter the sharing system. They exist only in your local database.
        </p>
      </div>
    </div>
  );
}

/* ── Tab: Backup ── */
function BackupTab() {
  return (
    <div>
      <h3 className={sectionTitle}>Backup strategies</h3>
      <ConfigRow icon="hard-drive" title="Manual encrypted export" status="partial" statusLabel="Available"
        description="Export the full database as an encrypted file. Save to a USB drive or external storage in a separate physical location.">
        <p className="text-xs" style={secText}>
          <strong className="font-medium">Recommended frequency:</strong> Weekly minimum. Daily for high-volume chapters.
          The export is encrypted  -  if the USB is found, it's useless without the passphrase.
        </p>
        <p className="text-xs mt-2" style={mutedText}>
          Export functionality will be available in the sovereign node release.
          Current hosted deployment is backed up by Supabase's managed infrastructure.
        </p>
      </ConfigRow>
      <ConfigRow icon="cloud" title="Encrypted cloud backup" status="off" statusLabel="Not configured"
        description="Automatically upload encrypted backups to a cloud provider (any  -  Google Drive, Backblaze, etc.). The provider sees only ciphertext.">
        <p className="text-xs" style={secText}>
          Available in sovereign node mode. Typical cost: $0-5/month (Backblaze B2 at $0.005/GB).
          A TRACE backup is typically under 1 GB.
        </p>
      </ConfigRow>
      <ConfigRow icon="radio" title="Cross-chapter mutual aid" status="off" statusLabel="No peers"
        description="Two trusted chapters hold encrypted backups of each other's data. If one is seized or destroyed, the other provides recovery.">
        <p className="text-xs" style={secText}>
          Requires at least one connected peer. The backup is encrypted  -  the holding chapter cannot read it.
          The most resilient backup strategy: survives single-point seizure and has no cloud dependency.
        </p>
      </ConfigRow>

      <div className="rounded-lg p-3 mt-4" style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.15)" }}>
        <p className="text-xs" style={{ color: "#e74c3c" }}>
          <Icon name="alert-triangle" size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
          If you enable panic wipe, you <strong className="font-medium">must</strong> have at least one backup method active.
          A wipe without a backup means permanent data loss.
        </p>
      </div>
    </div>
  );
}

/* ── Tab: Guide (the source of truth) ── */
function GuideTab() {
  const [guideSection, setGuideSection] = useState("overview");
  const guideSections = [
    { key: "overview", label: "Overview", icon: "compass" },
    { key: "hardware", label: "Hardware options", icon: "cpu" },
    { key: "network", label: "Network access", icon: "globe" },
    { key: "security", label: "Security hardening", icon: "shield" },
    { key: "ai", label: "Local AI", icon: "zap" },
    { key: "peers", label: "Chapter sharing", icon: "radio" },
    { key: "backup", label: "Backup", icon: "hard-drive" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {guideSections.map((s) => (
          <button key={s.key} onClick={() => setGuideSection(s.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              background: guideSection === s.key ? "var(--accent-soft)" : "var(--surface)",
              color: guideSection === s.key ? "var(--accent)" : "var(--text-sec)",
              border: `1px solid ${guideSection === s.key ? "var(--accent)" : "var(--border)"}`,
              fontWeight: guideSection === s.key ? 600 : 400,
            }}>
            <Icon name={s.icon} size={13} />{s.label}
          </button>
        ))}
      </div>

      {guideSection === "overview" && (
        <div className="space-y-3 text-xs leading-relaxed" style={secText}>
          <div className={card} style={cardBg}>
            <h4 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>TRACE runs on your hardware</h4>
            <p>One app. Every chapter runs the same software. The only differences are what hardware you put it on,
            which options you turn on, and how much you invest in security and capability.</p>
            <p className="mt-2">Every option is independent  -  pick none, pick all, pick three. They compose naturally.
            Turning on Tor doesn't require local AI. Buying a Raspberry Pi doesn't require a LoRa radio.
            The base node works with zero options enabled.</p>
          </div>
          <div className={card} style={cardBg}>
            <h4 className="text-sm font-medium mb-2" style={{ color: "var(--text)" }}>The three paths</h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-8 flex-shrink-0 text-center"><Icon name="zap" size={16} /></div>
                <div><strong className="font-medium" style={{ color: "var(--text)" }}>Just get running</strong>  -  Download the app, set a passphrase, you're live. Everything gets secure defaults. Change things later, or hand off to someone more technical.</div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 flex-shrink-0 text-center"><Icon name="compass" size={16} /></div>
                <div><strong className="font-medium" style={{ color: "var(--text)" }}>Guide me through it</strong>  -  You care about privacy but need plain-language explanations. Each option is described by what it does for you, not what technology it uses.</div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 flex-shrink-0 text-center"><Icon name="sliders" size={16} /></div>
                <div><strong className="font-medium" style={{ color: "var(--text)" }}>Show me everything</strong>  -  You know what you're doing. All options visible, no hand-holding. This is the view you're looking at right now.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {guideSection === "hardware" && (
        <div className="space-y-3">
          {[
            { title: "Your existing laptop", icon: "monitor", cost: "$0", time: "5 min", desc: "TRACE runs when your computer is on. Reporters submit when you're online. If the laptop is lost, data is encrypted." },
            { title: "Raspberry Pi", icon: "cpu", cost: "$75-120", time: "30-60 min", desc: "A $35-80 computer the size of a card. Runs 24/7 on 5 watts. Cheap enough to be disposable. The sweet spot for most chapters." },
            { title: "Repurposed old computer", icon: "monitor", cost: "$0-30", time: "1-2 hrs", desc: "That old laptop nobody uses. Install Linux, run TRACE. More powerful than a Pi  -  can handle local AI with a decent GPU." },
            { title: "Mini PC", icon: "cpu", cost: "$150-400", time: "30-60 min", desc: "Small, quiet, purpose-built for always-on. Powerful enough for local AI. The goldilocks option." },
            { title: "Server hardware", icon: "hard-drive", cost: "$500-5000+", time: "Several hrs", desc: "Maximum performance. Large AI models, many reporters, years of data. Requires a tech person and dedicated space." },
          ].map((hw) => (
            <div key={hw.title} className={card} style={cardBg}>
              <div className="flex items-start gap-3">
                <div style={mutedText}><Icon name={hw.icon} size={18} /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{hw.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>{hw.cost}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--text-muted)" }}>{hw.time} setup</span>
                  </div>
                  <p className="text-xs" style={secText}>{hw.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {guideSection === "network" && (
        <div className="space-y-3">
          {[
            { title: "Local network only", status: "Most secure", desc: "Reporters must be on the same WiFi. The node is invisible from the internet. Zero attack surface. Perfect for chapters that meet regularly." },
            { title: "Tailscale (private mesh VPN)", status: "Recommended", desc: "Reporters install a small app. Only enrolled devices can connect. Based on WireGuard. Free for up to 100 devices. Your node stays hidden from the public internet." },
            { title: "Cloudflare Tunnel (public URL)", status: "Easiest for reporters", desc: "Reporters open a link in any browser. No app install. Cloudflare proxies traffic and hides your IP. Trade-off: Cloudflare (a US company) can see the traffic." },
            { title: "Tor onion service", status: "Maximum anonymity", desc: "A .onion address through the Tor network. Nobody  -  not your ISP, not any company  -  can see who's connecting. Slower (2-10 second latency). Reporters need Tor Browser." },
            { title: "WiFi hotspot (enforcement events)", status: "No internet needed", desc: "The node broadcasts its own WiFi. Reporters connect directly. A captive portal opens TRACE. Works with zero infrastructure. Range: ~30-100m." },
          ].map((net) => (
            <div key={net.title} className={card} style={cardBg}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{net.title}</span>
                <span className={badge} style={{ background: "rgba(99,102,241,0.1)", color: "var(--accent)" }}>{net.status}</span>
              </div>
              <p className="text-xs" style={secText}>{net.desc}</p>
            </div>
          ))}
        </div>
      )}

      {(guideSection === "security" || guideSection === "ai" || guideSection === "peers" || guideSection === "backup") && (
        <div className={card} style={cardBg}>
          <p className="text-xs" style={secText}>
            See the <strong className="font-medium" style={{ color: "var(--accent)", cursor: "pointer" }}>
            {guideSection === "security" ? "Security" : guideSection === "ai" ? "Intelligence" : guideSection === "peers" ? "Peers" : "Backup"}
            </strong> tab on this page for your current configuration and all available options.
            The full reference document with detailed requirements, costs, and trade-offs for every option
            is available at <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>docs/NODE_CONFIG_MENU.md</span>.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
type SettingsTab = "status" | "reporters" | "security" | "intelligence" | "peers" | "backup" | "guide";

const TABS: { key: SettingsTab; label: string; icon: string; desc: string }[] = [
  { key: "status",       label: "Node Status",   icon: "grid",        desc: "Identity, health, deployment" },
  { key: "reporters",    label: "Reporters",      icon: "user",        desc: "How reporters connect" },
  { key: "security",     label: "Security",       icon: "shield",      desc: "Encryption, emergency, logs" },
  { key: "intelligence", label: "Intelligence",   icon: "zap",         desc: "AI engine configuration" },
  { key: "peers",        label: "Peers",          icon: "radio",       desc: "Chapter-to-chapter sharing" },
  { key: "backup",       label: "Backup",         icon: "hard-drive",  desc: "Recovery strategies" },
  { key: "guide",        label: "Setup Guide",    icon: "compass",     desc: "Full reference for all options" },
];

export function NodeSettings() {
  const [tab, setTab] = useState<SettingsTab>("status");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl font-bold">Node Settings</h1>
        <HelpTip tip="This page shows how your TRACE node is configured. Every setting can be changed. The Setup Guide tab is the full reference for all deployment options." />
      </div>

      <HandoffBanner />

      <div className="flex gap-6" style={{ minHeight: 500 }}>
        {/* Sidebar nav */}
        <div className="flex-shrink-0 hidden md:block" style={{ width: 180 }}>
          <div className="sticky top-0 space-y-0.5">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2.5"
                style={{
                  background: tab === t.key ? "var(--accent-soft)" : "transparent",
                  color: tab === t.key ? "var(--accent)" : "var(--text-sec)",
                  fontWeight: tab === t.key ? 600 : 400,
                }}>
                <Icon name={t.icon} size={15} />
                <span className="flex-1">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile tab bar */}
        <div className="md:hidden w-full mb-4">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors flex-shrink-0"
                style={{
                  background: tab === t.key ? "var(--accent-soft)" : "var(--surface)",
                  color: tab === t.key ? "var(--accent)" : "var(--text-sec)",
                  border: `1px solid ${tab === t.key ? "var(--accent)" : "var(--border)"}`,
                  fontWeight: tab === t.key ? 600 : 400,
                }}>
                <Icon name={t.icon} size={13} />{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === "status" && <StatusTab />}
          {tab === "reporters" && <ReporterTab />}
          {tab === "security" && <SecurityTab />}
          {tab === "intelligence" && <IntelligenceTab />}
          {tab === "peers" && <PeersTab />}
          {tab === "backup" && <BackupTab />}
          {tab === "guide" && <GuideTab />}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 text-center" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-[10px]" style={mutedText}>
          Every setting on this page can be changed at any time without starting over.
          Full configuration reference: Setup Guide tab or docs/NODE_CONFIG_MENU.md
        </p>
      </div>
    </div>
  );
}
