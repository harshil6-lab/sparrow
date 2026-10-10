/**
 * Contrast audit for Sparrow.
 * Resolves design tokens from src/styles/tokens.css, then checks every
 * text/background pair the app actually renders against WCAG AA.
 *   - normal text  needs >= 4.5:1
 *   - large text   needs >= 3:1   (>=24px, or >=18.66px bold)
 * Exits non-zero when any pair fails.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(here, "../src/styles/tokens.css"), "utf8");

const tokens = {};
for (const match of tokensCss.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokens[match[1]] = match[2];
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function token(nameOrHex) {
  if (nameOrHex.startsWith("#")) return nameOrHex;
  const value = tokens[nameOrHex];
  if (!value) throw new Error(`Unknown token: --${nameOrHex}`);
  return value;
}

const pairs = [
  { label: "body text on paper", fg: "dark", bg: "bg" },
  { label: "body text on white", fg: "dark", bg: "white" },
  { label: "muted copy on paper", fg: "muted", bg: "bg" },
  { label: "muted copy on white", fg: "muted", bg: "white" },
  { label: "forest eyebrow on paper", fg: "forest", bg: "bg" },
  { label: "forest heading on white", fg: "forest", bg: "white" },
  { label: "forest on soft chip", fg: "forest", bg: "soft" },
  { label: "forest on sample chip", fg: "forest", bg: "#e3eddf" },
  { label: "white on forest button", fg: "white", bg: "forest" },
  { label: "soft on forest (impact span)", fg: "soft", bg: "forest" },
  { label: "white on dark scene label", fg: "white", bg: "dark" },
  { label: "sun number on forest (large)", fg: "sun", bg: "forest", large: true },
  { label: "dark text on sun button", fg: "dark", bg: "sun" },
  { label: "white initials on forest avatar", fg: "white", bg: "forest" },
  { label: "error text on error tint", fg: "error", bg: "#fff0eb" },
  { label: "white on forest (splash bg)", fg: "white", bg: "forest" },
  { label: "fresh on dark (how section)", fg: "fresh", bg: "dark" },
];

let failures = 0;
const rows = pairs.map((pair) => {
  const fg = token(pair.fg);
  const bg = token(pair.bg);
  const r = ratio(fg, bg);
  const required = pair.large ? 3 : 4.5;
  const ok = r >= required;
  if (!ok) failures++;
  return { ...pair, fg, bg, r: r.toFixed(2), required, ok };
});

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("PAIR", 40), pad("FG", 9), pad("BG", 9), pad("RATIO", 7), pad("MIN", 5), "RESULT");
console.log("-".repeat(88));
for (const row of rows) {
  console.log(pad(row.label, 40), pad(row.fg, 9), pad(row.bg, 9), pad(row.r, 7), pad(row.required, 5), row.ok ? "PASS" : "FAIL");
}
console.log("-".repeat(88));
console.log(`${rows.length - failures}/${rows.length} pairs pass WCAG AA.`);
if (failures > 0) {
  console.error(`\n${failures} contrast failure(s):`);
  for (const row of rows.filter((r) => !r.ok)) console.error(` - ${row.label}: ${row.r}:1 < ${row.required}:1`);
  process.exit(1);
}

