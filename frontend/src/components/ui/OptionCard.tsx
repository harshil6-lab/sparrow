import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { SparrowMascot } from "../SparrowMascot";

/** Speech bubble that tailors onto the mascot. Purely presentational. */
export function SpeechBubble({
  children,
  variant = "art",
}: {
  children: ReactNode;
  variant?: "art" | "inline";
}) {
  return <div className={variant === "inline" ? "speech" : "art-speech"}>{children}</div>;
}

export interface OptionCardProps {
  label: ReactNode;
  icon?: IconName;
  selected?: boolean;
  /** Optional mascot pose drawn inside the leading circle instead of an icon. */
  mascot?: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Selectable card used by every Setup step and the language picker rows.
 * Maps onto the design's `.option-grid button` styling.
 */
export function OptionCard({ label, icon, selected = false, mascot = false, onClick, className = "" }: OptionCardProps) {
  return (
    <button
      type="button"
      className={`${selected ? "selected" : ""} ${className}`.trim()}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>{mascot ? <SparrowMascot size={26} pose="hop" /> : icon ? <Icon name={icon} /> : null}</span>
      <strong>{label}</strong>
      {selected ? <Icon name="check" size={17} /> : null}
    </button>
  );
}
