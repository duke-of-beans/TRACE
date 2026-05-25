/**
 * TRACE Design System — SVG Icon Set
 *
 * 24x24 viewBox. 1.5px stroke. currentColor.
 * Clean, geometric, monochrome. No emoji anywhere.
 *
 * Usage (React/Preact):
 *   <Icon name="camera" size={20} />
 *   <Icon name="shield" className="text-accent" />
 */

const PATHS: Record<string, string> = {
  // --- Actions ---
  camera: `<circle cx="12" cy="13" r="3"/><path d="M5 7h2l1.5-2h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/>`,
  send: `<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  x: `<path d="M18 6 6 18M6 6l12 12"/>`,
  trash: `<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>`,
  edit: `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>`,

  // --- Navigation ---
  "chevron-right": `<path d="m9 18 6-6-6-6"/>`,
  "chevron-down": `<path d="m6 9 6 6 6-6"/>`,
  "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`,

  // --- Status ---
  "alert-triangle": `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  "check-circle": `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  info: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,

  // --- Objects ---
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  unlock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  car: `<path d="M7 17h10M5 9l2-4h10l2 4"/><rect x="3" y="9" width="18" height="8" rx="2"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>`,
  "map-pin": `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  sliders: `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>`,
  eye: `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,

  // --- Data ---
  zap: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/>`,
  grid: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  radio: `<path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><circle cx="12" cy="12" r="2"/>`,
  skull: `<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v1h8v-1"/><path d="M12 20v1"/><path d="M12.5 2C8.36 2 5 5.36 5 9.5c0 2.54 1.27 4.78 3.2 6.13a2 2 0 0 1 .8 1.6V18h6v-.77a2 2 0 0 1 .8-1.6C17.73 14.28 19 12.04 19 9.5 19 5.36 15.64 2 12.5 2z"/>`,

  // --- Directional (for compass/direction picker) ---
  "arrow-n":  `<path d="M12 19V5m0 0-5 5m5-5 5 5"/>`,
  "arrow-ne": `<path d="M6 18 18 6M18 6h-8m8 0v8"/>`,
  "arrow-e":  `<path d="M5 12h14m0 0-5-5m5 5-5 5"/>`,
  "arrow-se": `<path d="M6 6l12 12M18 18h-8m8 0v-8"/>`,
  "arrow-s":  `<path d="M12 5v14m0 0 5-5m-5 5-5-5"/>`,
  "arrow-sw": `<path d="M18 6 6 18M6 18h8m-8 0v-8"/>`,
  "arrow-w":  `<path d="M19 12H5m0 0 5 5m-5-5 5-5"/>`,
  "arrow-nw": `<path d="M18 18 6 6M6 6h8M6 6v8"/>`,
  compass: `<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88"/>`,
};

export type IconName = keyof typeof PATHS;

export function getIconSvg(name: string, size = 24): string {
  const paths = PATHS[name];
  if (!paths) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

/**
 * React/Preact icon component.
 * Works with both frameworks via JSX compatibility.
 */
export function Icon({ name, size = 24, className = "", ariaLabel }: {
  name: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const paths = PATHS[name];
  if (!paths) return null;

  return {
    type: "svg",
    props: {
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      role: ariaLabel ? "img" : "presentation",
      "aria-label": ariaLabel,
      "aria-hidden": ariaLabel ? undefined : "true",
      dangerouslySetInnerHTML: { __html: paths },
    },
  } as any;
}
