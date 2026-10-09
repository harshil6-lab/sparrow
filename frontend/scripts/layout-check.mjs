/**
 * Layout verification for Sparrow (Playwright, system Chrome).
 *
 * Usage:
 *   node scripts/layout-check.mjs baseline   # capture 390px mobile baselines
 *   node scripts/layout-check.mjs verify     # assertions + after screenshots + regression
 *
 * Runs against a dev server (default http://localhost:5173). Uses reducedMotion
 * emulation for deterministic rendering. No browser download: channel "chrome".
 */
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const here = dirname(fileURLToPath(import.meta.url));
const QA = resolve(here, "../.qa");
const MODE = process.argv[2] === "baseline" ? "baseline" : "verify";

const WIDTHS = [390, 768, 1024, 1440, 1920];
const ROUTES = [
  { id: "splash", path: "/", wait: ".splash-wordmark" },
  { id: "app-home", path: "/app", wait: ".app-shell" },
  { id: "app-missions", path: "/app/missions", wait: ".app-shell" },
  { id: "app-learn", path: "/app/learn", wait: ".app-shell" },
  { id: "app-solar", path: "/app/solar", wait: ".app-shell" },
  { id: "app-me", path: "/app/me", wait: ".app-shell" },
  { id: "app-profile-sheet", path: "/app", wait: ".app-shell", openProfile: true },
];

const USER = { id: "u1", email: "ananya@example.com", displayName: "Ananya Rao", provider: "email" };
const PROFILE = {
  user: USER,
  introSeen: true,
  setupComplete: true,
  language: "en",
  answers: {
    homeType: "apartment",
    people: "3–4 people",
    city: "Pune",
    usualBill: "₹1,000–2,500",
    appliances: ["Air conditioner"],
  },
};

function hash(buf) {
  return createHash("sha256").update(buf).digest("hex").slice(0, 12);
}

async function newContext(browser, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ user, profile }) => {
      try {
        localStorage.setItem("sparrow.user", JSON.stringify(user));
        localStorage.setItem("sparrow.profile." + user.id, JSON.stringify(profile));
        localStorage.setItem("sparrow-language", "en");
      } catch {
        /* ignore */
      }
    },
    { user: USER, profile: PROFILE },
  );
  return context;
}

async function gotoRoute(page, route) {
  await page.goto(BASE + route.path, { waitUntil: "networkidle" });
  await page.waitForSelector(route.wait, { timeout: 15000 });
  if (route.openProfile) {
    await page.getByRole("button", { name: "Open profile" }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  }
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(150);
}

const within = (child, parent, tol = 1) =>
  child.left >= parent.left - tol &&
  child.right <= parent.right + tol &&
  child.top >= parent.top - tol &&
  child.bottom <= parent.bottom + tol;

async function measure(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const frame = document.querySelector("[data-app-frame]");
    const scroll = document.querySelector("[data-app-scroll]");
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    const last = scroll ? scroll.lastElementChild : null;
    return {
      innerWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      frame: rect(frame),
      header: rect(document.querySelector("[data-app-header]")),
      tabbar: rect(document.querySelector("[data-app-tabbar]")),
      sheet: rect(document.querySelector('[role="dialog"]')),
      lastContent: rect(last),
    };
  });
}

async function capture(browser, dir) {
  mkdirSync(dir, { recursive: true });
  const manifest = {};
  for (const width of [390]) {
    const context = await newContext(browser, width);
    for (const route of ROUTES) {
      const page = await context.newPage();
      await gotoRoute(page, route);
      const buf = await page.screenshot({ path: resolve(dir, `${route.id}-${width}.png`), animations: "disabled" });
      manifest[`${route.id}-${width}`] = hash(buf);
      await page.close();
    }
    await context.close();
  }
  writeFileSync(resolve(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function afterShots(browser) {
  const dir = resolve(QA, "after");
  mkdirSync(dir, { recursive: true });
  const context = await newContext(browser, 1440);
  for (const route of ROUTES.filter((r) => ["splash", "app-home", "app-profile-sheet"].includes(r.id))) {
    const page = await context.newPage();
    await gotoRoute(page, route);
    await page.screenshot({ path: resolve(dir, `${route.id}-1440.png`), animations: "disabled", fullPage: false });
    await page.close();
  }
  await context.close();
}

async function main() {
  mkdirSync(QA, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    if (MODE === "baseline") {
      const manifest = await capture(browser, resolve(QA, "baseline"));
      console.log(`Baseline captured: ${Object.keys(manifest).length} screenshots in .qa/baseline`);
      return;
    }

    // ---- assertions ----
    const results = [];
    const failures = [];
    for (const width of WIDTHS) {
      const context = await newContext(browser, width);
      for (const route of ROUTES) {
        const page = await context.newPage();
        await gotoRoute(page, route);
        const m = await measure(page);
        const desktop = width >= 900;

        const noHScroll = m.docScrollWidth <= m.innerWidth;
        results.push({ width, route: route.id, check: "no-horizontal-scroll", ok: noHScroll, info: `${m.docScrollWidth}<=${m.innerWidth}` });
        if (!noHScroll) failures.push(`${width}/${route.id}: horizontal scroll (${m.docScrollWidth}>${m.innerWidth})`);

        if (desktop && m.frame) {
          const centred = Math.abs(m.frame.left - (m.innerWidth - m.frame.right)) <= 1;
          results.push({ width, route: route.id, check: "frame-centred", ok: centred, info: `L${m.frame.left.toFixed(1)} R${(m.innerWidth - m.frame.right).toFixed(1)}` });
          if (!centred) failures.push(`${width}/${route.id}: frame not centred`);

          const w480 = Math.abs(m.frame.width - 480) <= 1;
          results.push({ width, route: route.id, check: "frame-480px", ok: w480, info: `${m.frame.width.toFixed(1)}px` });
          if (!w480) failures.push(`${width}/${route.id}: frame width ${m.frame.width.toFixed(1)}`);

          if (m.tabbar) {
            const ok = within(m.tabbar, m.frame);
            results.push({ width, route: route.id, check: "tabbar-in-frame", ok, info: "" });
            if (!ok) failures.push(`${width}/${route.id}: tab bar outside frame`);
          } else {
            results.push({ width, route: route.id, check: "tabbar-in-frame", ok: false, info: "tab bar missing" });
            failures.push(`${width}/${route.id}: tab bar missing`);
          }

          if (m.header) {
            const ok = within(m.header, m.frame);
            results.push({ width, route: route.id, check: "header-in-frame", ok, info: "" });
            if (!ok) failures.push(`${width}/${route.id}: header outside frame`);
          }

          if (route.openProfile) {
            const ok = !!m.sheet && within(m.sheet, m.frame, 2);
            results.push({ width, route: route.id, check: "sheet-in-frame", ok, info: "" });
            if (!ok) failures.push(`${width}/${route.id}: sheet outside frame`);
          }
        }

        if (m.tabbar && m.lastContent) {
          const ok = m.lastContent.bottom <= m.tabbar.top + 1;
          results.push({ width, route: route.id, check: "content-above-tabbar", ok, info: `content ${m.lastContent.bottom.toFixed(1)} <= tabbar ${m.tabbar.top.toFixed(1)}` });
          if (!ok) failures.push(`${width}/${route.id}: content covered by tab bar (${m.lastContent.bottom.toFixed(1)}>${m.tabbar.top.toFixed(1)})`);
        }

        await page.close();
      }
      await context.close();
    }

    // ---- mobile regression ----
    const baselinePath = resolve(QA, "baseline", "manifest.json");
    let regression = "no baseline found";
    if (existsSync(baselinePath)) {
      const before = JSON.parse(readFileSync(baselinePath, "utf8"));
      const afterDir = resolve(QA, "after-mobile");
      const after = await capture(browser, afterDir);
      const diffs = Object.keys(before).filter((k) => before[k] !== after[k]);
      regression = diffs.length === 0 ? "ZERO differences at 390px" : `DIFFERS: ${diffs.join(", ")}`;
    }

    await afterShots(browser);

    // ---- report ----
    const byCheck = {};
    for (const r of results) {
      byCheck[r.check] ??= { pass: 0, fail: 0 };
      byCheck[r.check][r.ok ? "pass" : "fail"]++;
    }
    console.log("\nLAYOUT CHECK (reducedMotion, system Chrome)");
    for (const [check, v] of Object.entries(byCheck)) {
      console.log(`  ${v.fail === 0 ? "PASS" : "FAIL"}  ${check}  (${v.pass} pass / ${v.fail} fail)`);
    }
    console.log(`\nMobile regression @390px: ${regression}`);
    console.log(`After screenshots: .qa/after (1440)`);
    if (failures.length) {
      console.log(`\n${failures.length} failure(s):`);
      for (const f of failures.slice(0, 40)) console.log("  - " + f);
      process.exitCode = 1;
    } else {
      console.log("\nAll assertions passed.");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
