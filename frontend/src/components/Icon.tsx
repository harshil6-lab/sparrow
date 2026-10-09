import type { ReactNode } from "react";

/**
 * Icon set reused verbatim from the Figma Make export.
 * Stroke-based; `currentColor` so it inherits text colour and meets contrast.
 */
export const ICON_NAMES = [
  "home","bolt","book","sun","user","arrow","check","leaf","bill","share","clock","bulb",
  "close","language","people1","people2","people4","people5","apartment","row","city",
  "pune","mumbai","ahmedabad","bengaluru","chennai","kolkata","coin1","coin2","coin3","coin4",
  "ac","geyser","washer","fridge","pump","induction","settings","trash","wifi","logout",
  "bell","edit","camera","pin","hill","coastal","desert","plains",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5M9 20v-6h6v6" /></>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2M20 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    leaf: <><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z" /><path d="M4 21c3-6 7-9 12-12" /></>,
    bill: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" /><path d="M9 7h6M9 11h6M9 15h3" /></>,
    share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    bulb: <><path d="M9 18h6M10 22h4" /><path d="M8 15a7 7 0 1 1 8 0c-1 .7-1 1.5-1 3H9c0-1.5 0-2.3-1-3Z" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    language: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    people1: <><circle cx="12" cy="7" r="3" /><path d="M7 20v-4a5 5 0 0 1 10 0v4" /></>,
    people2: <><circle cx="8" cy="8" r="2.5" /><circle cx="16" cy="8" r="2.5" /><path d="M3 20v-4a5 5 0 0 1 10 0v4M11 20v-4a5 5 0 0 1 10 0v4" /></>,
    people4: <><circle cx="7" cy="7" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="12" cy="12" r="2" /><path d="M3 19c0-3 2-5 4-5M21 19c0-3-2-5-4-5M7 21c0-4 2-6 5-6s5 2 5 6" /></>,
    people5: <><circle cx="5" cy="7" r="1.7" /><circle cx="10" cy="5" r="1.7" /><circle cx="15" cy="5" r="1.7" /><circle cx="20" cy="7" r="1.7" /><circle cx="12.5" cy="11" r="2" /><path d="M2 19c0-3 1-6 4-6M23 19c0-3-1-6-4-6M6 18c0-4 2-7 5-7M19 18c0-4-2-7-5-7M8 22c0-5 2-8 4.5-8S17 17 17 22" /></>,
    apartment: <><path d="M5 22V3h14v19M9 7h2M15 7h1M9 11h2M15 11h1M9 15h2M15 15h1M10 22v-3h4v3" /></>,
    row: <><path d="M2 11 7 6l5 5M12 11l5-5 5 5M4 10v10h16V10M7 20v-5M17 20v-5" /></>,
    city: <><path d="M4 21V9h6v12M10 21V3h10v18M7 12h1M7 16h1M14 7h2M14 11h2M14 15h2" /></>,
    pune: <><path d="M3 21h18M6 21V9h12v12M9 9V5h6v4M8 13h2M14 13h2M8 17h2M14 17h2" /></>,
    mumbai: <><path d="M3 21h18M6 21V8h4v13M14 21V4h4v17M12 8h2M12 12h2M8 4l2 4H6l2-4Z" /></>,
    ahmedabad: <><path d="M3 21h18M5 21v-8l7-8 7 8v8M9 21v-6h6v6M7 12h10" /></>,
    bengaluru: <><path d="M3 21h18M7 21V8h10v13M9 8l3-5 3 5M10 12h4M10 16h4" /></>,
    chennai: <><path d="M3 21h18M6 21v-9l6-7 6 7v9M9 21v-6h6v6M4 10h16" /></>,
    kolkata: <><path d="M3 21h18M5 21V9h14v12M8 9V5h8v4M8 14h8M10 21v-4h4v4" /></>,
    coin1: <><circle cx="12" cy="15" r="5" /><path d="M10 15h4M12 12v6" /></>,
    coin2: <><circle cx="9" cy="16" r="4" /><circle cx="15" cy="12" r="5" /><path d="M13 12h4" /></>,
    coin3: <><circle cx="7" cy="17" r="3" /><circle cx="12" cy="13" r="4" /><circle cx="17" cy="8" r="5" /></>,
    coin4: <><path d="M5 20h14M6 16h12M7 12h10M8 8h8M9 4h6" /></>,
    ac: <><path d="M4 5h16v7H4zM7 9h10M8 16c1-2 3-2 4 0s3 2 4 0M8 20c1-2 3-2 4 0s3 2 4 0" /></>,
    geyser: <><rect x="6" y="3" width="12" height="18" rx="5" /><path d="M12 8c-2 3-2 5 0 6 2-1 2-3 0-6ZM9 21v2M15 21v2" /></>,
    washer: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="5" /><path d="M7 7h1M11 7h5" /></>,
    fridge: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M6 10h12M9 6v2M9 13v3" /></>,
    pump: <><path d="M4 20h16M7 20V9h9v11M9 9V5h5v4M16 12h4v4M20 14h2" /></>,
    induction: <><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M7 3h10" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.6h-4L10.4 6A7 7 0 0 0 9 7L6.5 6 4.5 9.5 6.6 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.5 2.4-1A7 7 0 0 0 10 18l.4 2.6h4L15 18a7 7 0 0 0 1.5-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z" /></>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
    wifi: <><path d="M3 9a14 14 0 0 1 18 0M6 13a9 9 0 0 1 12 0M9.5 17a4 4 0 0 1 5 0" /><circle cx="12" cy="20" r="1" fill="currentColor" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H8" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 22h4" /></>,
    edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20ZM13 7.5l3.5 3.5" /></>,
    camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4V7Z" /><circle cx="12" cy="13" r="4" /></>,
    pin: <><path d="M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13Z" /><circle cx="12" cy="9" r="2" /></>,
    hill: <><path d="m2 20 7-12 4 7 3-5 6 10H2Z" /></>,
    coastal: <><path d="M3 14c3-2 5 2 8 0s5 2 10 0M3 19c3-2 5 2 8 0s5 2 10 0M12 3v9M8 7l4-4 4 4" /></>,
    desert: <><circle cx="18" cy="5" r="3" /><path d="M2 20c5-7 9-7 14 0M9 20c4-5 7-5 13 0" /></>,
    plains: <><path d="M3 18h18M5 14h14M7 10h10M12 10V3M9 6h6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
