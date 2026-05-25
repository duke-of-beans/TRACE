/**
 * TRACE PWA — Icon Component (Preact)
 * Wraps shared SVG path data into Preact components.
 */
import { getIconSvg } from "../../../shared/design/icons.js";

type IconProps = {
  name: string;
  size?: number;
  class?: string;
  label?: string;
};

export function Icon({ name, size = 24, class: className = "", label }: IconProps) {
  const svg = getIconSvg(name, size);
  if (!svg) return null;

  return (
    <span
      class={className}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
