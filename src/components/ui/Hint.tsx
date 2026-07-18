import { Info } from "lucide-react";

/**
 * Small info affordance: an icon with a plain-language explanation on hover
 * (native title, so it is never clipped by a panel's overflow). aria-label
 * exposes the same text to assistive tech.
 */
export function Hint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      role="img"
      className="inline-flex shrink-0 cursor-help text-ink-faint transition-colors hover:text-ink"
    >
      <Info size={12} />
    </span>
  );
}
