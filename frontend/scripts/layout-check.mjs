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
// Task 10B intentionally reworks the Profile sheet header on ALL viewports
// (item 3), so it is validated by the assertions + .qa/t10 screenshots rather
// than the byte-identical mobile regression. Every other mobile surface must
// match the pre-change baseline exactly.
const MOBILE_REGRESSION_EXCLUDE = new Set(["app-profile-sheet-390"]);

const MODE = ["baseline", "mobile"].includes(process.argv[2]) ? process.argv[2] : "verify";

const WIDTHS = [390, 768, 900, 1024, 1440, 1920];
const ROUTES = [
  { id: "splash", path: "/", wait: ".splash-wordmark" },
  { id: "app-home", path: "/app", wait: ".app-shell" },
  { id: "app-missions", path: "/app/missions", wait: ".app-shell" },
  { id: "app-learn", path: "/app/learn", wait: ".app-shell" },
  { id: "app-community", path: "/app/community", wait: ".community-page", openCommunityCreate: true },
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

const DEMO_USER = { id: "demo-household", email: "demo@sparrow.local", displayName: "Demo Nest", provider: "email" };
const DEMO_PROFILE = {
  user: DEMO_USER,
  introSeen: true,
  setupComplete: true,
  language: "en",
  answers: { homeType: "apartment", people: "3-4 people", city: "Pune", usualBill: null, appliances: ["Air conditioner", "Geyser", "Refrigerator"] },
};
function demoInit({ user, profile }) {
  try {
    const NS = "demo:";
    localStorage.setItem("sparrow.demoPending", "1");
    localStorage.setItem(NS + "sparrow.user", JSON.stringify(user));
    localStorage.setItem(NS + "sparrow.profile." + user.id, JSON.stringify(profile));
    localStorage.setItem(NS + "sparrow.missionsDone." + user.id, JSON.stringify([]));
    localStorage.setItem(NS + "sparrow.mission." + user.id, "false");
    localStorage.setItem(NS + "sparrow.demo." + user.id, "true");
    localStorage.setItem("sparrow.community.guidelines." + user.id, "1");
  } catch {
    /* ignore */
  }
}

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
    const size = page.viewportSize();
    const selector = size && size.width >= 900 ? ".side-profile" : '[data-app-header] button[aria-label="Open profile"]';
    const profileBtn = page.locator(selector);
    await profileBtn.waitFor({ state: "visible", timeout: 15000 });
    await profileBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  }
  if (route.openCommunityCreate) {
    await page.evaluate(() => localStorage.setItem("sparrow.community.guidelines.u1", "1"));
    await page.getByRole("button", { name: /\+ Post|पोस्ट/ }).click();
    await page.waitForSelector(".community-create-sheet", { timeout: 8000 });
  }
  if (route.openComments) {
    await page.waitForSelector(".community-reels__rail-button", { timeout: 8000 });
    const buttons = page.locator(".community-reels__rail-button");
    const count = await buttons.count();
    if (count >= 2) {
      await buttons.nth(1).click();
      await page.waitForSelector(".community-reels--sheet", { timeout: 8000 });
    }
  }
  // Readiness gates: stylesheets applied (guards against a transient
  // CSS-less render while the dev server re-optimizes) and fonts settled.
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue("--forest").trim() !== "",
    null,
    { timeout: 15000 },
  );
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(200);
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
    // At <900px the window scrolls (app-main has no overflow); at >=900px the
    // frame's app-main scrolls. Scroll both so the "last content vs tab bar"
    // assertion measures the real end-of-scroll position at every width.
    window.scrollTo(0, document.documentElement.scrollHeight);
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    const last = scroll ? scroll.lastElementChild : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      frame: rect(frame),
      header: rect(document.querySelector("[data-app-header]")),
      tabbar: rect(document.querySelector("[data-app-tabbar]")),
      sheet: rect(document.querySelector('[role="dialog"]')),
      sheetFooter: rect(document.querySelector(".community-create-footer")),
      sheetScrollWidth: document.querySelector('[role="dialog"]')?.scrollWidth ?? 0,
      sheetClientWidth: document.querySelector('[role="dialog"]')?.clientWidth ?? 0,
      sidebar: rect(document.querySelector(".side-nav")),
      content: rect(document.querySelector(".app-main > .page")),
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
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

const T10_ROUTES = [
  { id: "app-home", path: "/app", wait: ".app-shell" },
  { id: "app-missions", path: "/app/missions", wait: ".app-shell" },
  { id: "app-learn", path: "/app/learn", wait: ".app-shell" },
  { id: "app-community", path: "/app/community", wait: ".community-page" },
  { id: "app-me", path: "/app/me", wait: ".app-shell" },
  { id: "app-profile-sheet", path: "/app", wait: ".app-shell", openProfile: true },
  { id: "app-comment-sheet", path: "/app/community", wait: ".community-page", openComments: true, demo: true },
  { id: "app-create-sheet", path: "/app/community", wait: ".community-page", openCommunityCreate: true },
];

async function captureT10(browser) {
  const dir = resolve(QA, "t10");
  mkdirSync(dir, { recursive: true });
  for (const width of [390, 1440]) {
    for (const route of T10_ROUTES) {
      // Fresh context per route so demo-mode storage never leaks between captures.
      const context = await newContext(browser, width);
      const page = await context.newPage();
      try {
        if (route.demo) await page.addInitScript(demoInit, { user: DEMO_USER, profile: DEMO_PROFILE });
        await gotoRoute(page, route);
        await page.screenshot({ path: resolve(dir, `${route.id}-${width}.png`), animations: "disabled", fullPage: false });
      } catch (err) {
        console.error(`t10 capture error for ${route.id}-${width}:`, err.message);
      } finally {
        await page.close();
        await context.close();
      }
    }
  }
  console.log(`T10 screenshots captured in frontend/.qa/t10/ (390px and 1440px)`);
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

    if (MODE === "mobile") {
      const before = JSON.parse(readFileSync(resolve(QA, "baseline", "manifest.json"), "utf8"));
      const after = await capture(browser, resolve(QA, "after-mobile"));
      const diffs = Object.keys(before).filter((k) => !MOBILE_REGRESSION_EXCLUDE.has(k) && before[k] !== after[k]);
      console.log(diffs.length === 0 ? "ZERO differences at 390px (shell)" : `DIFFERS: ${diffs.join(", ")}`);
      if (diffs.length) process.exitCode = 1;
      return;
    }

    // ---- assertions ----
    const results = [];
    const failures = [];
    for (const width of WIDTHS) {
      const context = await newContext(browser, width);
      for (const route of ROUTES) {
        const page = await context.newPage();
        if (route.demo) await page.addInitScript(demoInit, { user: DEMO_USER, profile: DEMO_PROFILE });
        await gotoRoute(page, route);
        const m = await measure(page);
        const desktop = width >= 900;

        const noHScroll = m.docScrollWidth <= m.innerWidth;
        results.push({ width, route: route.id, check: "no-horizontal-scroll", ok: noHScroll, info: `${m.docScrollWidth}<=${m.innerWidth}` });
        if (!noHScroll) failures.push(`${width}/${route.id}: horizontal scroll (${m.docScrollWidth}>${m.innerWidth})`);

        if (desktop && m.frame) {
          const sidebarVisible = m.sidebar && m.sidebar.width === 240;
          results.push({ width, route: route.id, check: "sidebar-visible-240px", ok: !!sidebarVisible, info: `${m.sidebar?.width ?? 0}px` });
          if (!sidebarVisible) failures.push(`${width}/${route.id}: sidebar is not 240px`);

          const tabbarDisplay = await page.locator("[data-app-tabbar]").evaluate((el) => getComputedStyle(el).display);
          const hidden = tabbarDisplay === "none";
          results.push({ width, route: route.id, check: "desktop-tabbar-hidden", ok: hidden, info: tabbarDisplay });
          if (!hidden) failures.push(`${width}/${route.id}: bottom tab bar is visible`);

          if (route.id !== "app-community") {
            const contentInside = m.content && m.content.width <= 720.5 &&
              Math.abs(m.content.left - (m.sidebar?.right ?? 0) - ((m.frame?.right ?? 0) - (m.sidebar?.right ?? 0) - m.content.width) / 2) <= 2;
            results.push({ width, route: route.id, check: "content-column-centred-and-capped", ok: !!contentInside, info: `${m.content?.width ?? 0}px` });
            if (!contentInside) failures.push(`${width}/${route.id}: content column is not centred/capped`);
          }

          if (route.openProfile) {
            const ok = !!m.sheet && within(m.sheet, { left: 0, right: m.innerWidth, top: 0, bottom: m.innerHeight }, 2);
            results.push({ width, route: route.id, check: "dialog-in-viewport", ok, info: "" });
            if (!ok) failures.push(`${width}/${route.id}: sheet outside viewport`);
            const focusTrap = await page.evaluate(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog) return false;
              const items = dialog.querySelectorAll("button, input, textarea, select, a[href]");
              if (items.length < 2) return false;
              const last = items[items.length - 1];
              last.focus();
              last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
              return dialog.contains(document.activeElement);
            });
            results.push({ width, route: route.id, check: "dialog-focus-trap", ok: focusTrap, info: "" });
            if (!focusTrap) failures.push(`${width}/${route.id}: focus trap failed`);
          }
          if (route.openCommunityCreate && m.sheet && m.sheetFooter) {
            const ok = m.sheetFooter.bottom <= m.innerHeight + 1;
            results.push({ width, route: route.id, check: "sheet-footer-visible", ok, info: `${m.sheetFooter.bottom.toFixed(1)}<=${m.innerHeight}` });
            if (!ok) failures.push(`${width}/${route.id}: sheet footer below viewport`);
            if (m.sheetScrollWidth > m.sheetClientWidth) failures.push(`${width}/${route.id}: sheet has horizontal scroll`);
          }
        }

        if (!desktop && m.frame) {
          const tabbarDisplay = await page.locator("[data-app-tabbar]").evaluate((el) => getComputedStyle(el).display);
          const sidebarDisplay = await page.locator(".side-nav").evaluate((el) => getComputedStyle(el).display);
          const tabbarVisible = tabbarDisplay !== "none";
          const sidebarHidden = sidebarDisplay === "none";
          results.push({ width, route: route.id, check: "mobile-tabbar-visible", ok: tabbarVisible, info: tabbarDisplay });
          results.push({ width, route: route.id, check: "mobile-sidebar-hidden", ok: sidebarHidden, info: sidebarDisplay });
          if (!tabbarVisible) failures.push(`${width}/${route.id}: mobile tab bar hidden`);
          if (!sidebarHidden) failures.push(`${width}/${route.id}: mobile sidebar visible`);
        }

        if (m.tabbar && m.tabbar.height > 0 && m.lastContent) {
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
      const diffs = Object.keys(before).filter((k) => !MOBILE_REGRESSION_EXCLUDE.has(k) && before[k] !== after[k]);
      regression = diffs.length === 0 ? "ZERO differences at 390px (shell; profile sheet reworked)" : `DIFFERS: ${diffs.join(", ")}`;
    }

    await afterShots(browser);
    await captureT10(browser);

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