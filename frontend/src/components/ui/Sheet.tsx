import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSheetPortalTarget } from "./sheetPortal";
import { Icon } from "../Icon";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  /** Extra class appended to the sheet panel (e.g. "language-sheet"). */
  sheetClassName?: string;
  /** Renders the close (×) button in the top-right when provided. */
  closeLabel?: string;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet with a focus trap and Esc-to-close.
 * Composes the design's `.overlay` / `.sheet` classes (which already anchor to
 * the bottom edge at <=600px and centre on larger screens).
 */
export function Sheet({ open, onClose, label, sheetClassName = "sheet", closeLabel, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const portalTarget = useSheetPortalTarget();
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const content = (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={sheetClassName}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {closeLabel ? (
          <button type="button" className="close" aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );

  // Inside the app frame (>=900px) the sheet is portaled into the frame element
  // so it is positioned relative to the frame, never the viewport.
  return portalTarget ? createPortal(content, portalTarget) : content;
}

