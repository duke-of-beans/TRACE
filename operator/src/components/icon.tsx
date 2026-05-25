/**
 * TRACE Operator — Icon Component (React)
 * Wraps shared SVG path data into React components.
 */
import { getIconSvg } from "../../../shared/design/icons.js";

type IconProps = {
  name: string;
  size?: number;
  className?: string;
  ariaLabel?: string;
};

export function Icon({ name, size = 24, className = "", ariaLabel }: IconProps) {
  const svg = getIconSvg(name, size);
  if (!svg) return null;

  return (
    <span
      className={className}
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : "true"}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
