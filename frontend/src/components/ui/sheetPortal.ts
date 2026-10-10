import { createContext, useContext } from "react";

/**
 * Optional portal host for Sheet. When a screen provides an element (the app
 * frame), sheets render inside it and are positioned relative to it instead of
 * the viewport. Screens that provide nothing keep the original inline behaviour.
 */
export const SheetPortalContext = createContext<HTMLElement | null>(null);

export function useSheetPortalTarget(): HTMLElement | null {
  return useContext(SheetPortalContext);
}
