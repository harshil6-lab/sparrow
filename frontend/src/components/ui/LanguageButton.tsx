import { Icon } from "../Icon";

/** Language pill. Appears ONLY on the splash screen (and later in Profile). */
export function LanguageButton({
  native,
  onClick,
  light = false,
}: {
  native: string;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button
      type="button"
      className={`language-button ${light ? "light" : ""}`.trim()}
      onClick={onClick}
    >
      <Icon name="language" size={18} /> {native}
    </button>
  );
}
