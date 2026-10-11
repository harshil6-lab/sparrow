import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:").replaceAll("/", "\\");
const frontend = `${root}frontend`;
const { chromium } = createRequire(new URL("../frontend/package.json", import.meta.url))("playwright-core");
const chromeCandidates = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
].filter(Boolean);
const executablePath = chromeCandidates.find(existsSync);
if (!executablePath) throw new Error("System Chrome was not found.");
const allowPath = `${root}\\scripts\\button-audit.allow.json`;
const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, "utf8")) : {};
const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: frontend,
  env: { ...process.env, VITE_USE_MOCK: "true" },
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);
const server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4174"], {
  cwd: frontend,
  stdio: "ignore",
  shell: true,
});
const stop = () => server.kill();
process.on("exit", stop);
const routes = ["/app", "/app/missions", "/app/learn", "/app/community", "/app/me"];
const failures = [];
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      if ((await fetch("http://127.0.0.1:4174/")).ok) break;
    } catch {}
    await delay(200);
  }
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const route of routes) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:4174/welcome");
      await page.getByRole("button", { name: "Try with sample data" }).click();
      await page.goto(`http://127.0.0.1:4174${route}`);
      await page.locator("header").getByRole("button", { name: "Open profile" }).click();
      const count = await page.locator("button, a, [role=button]").count();
      for (let index = 0; index < count; index += 1) {
        const control = page.locator("button, a, [role=button]").nth(index);
        if (!(await control.isVisible().catch(() => false))) continue;
        const name = (await control.getAttribute("aria-label")) || (await control.innerText()).trim();
        const key = `${route}:${name}`;
        if (!name) failures.push(`${key}: empty accessible name`);
        if (await control.isDisabled().catch(() => false)) {
          if (!allow[key]) failures.push(`${key}: disabled control has no allowlist reason`);
          continue;
        }
        const before = await page.evaluate(() => ({ url: location.href, html: document.body.innerHTML, storage: JSON.stringify(localStorage), aria: [...document.querySelectorAll("[aria-expanded],[aria-pressed],[aria-current]")].map((el) => el.outerHTML) }));
        await control.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(50);
        const after = await page.evaluate(() => ({ url: location.href, html: document.body.innerHTML, storage: JSON.stringify(localStorage), aria: [...document.querySelectorAll("[aria-expanded],[aria-pressed],[aria-current]")].map((el) => el.outerHTML) }));
        if (before.url === after.url && before.html === after.html && before.storage === after.storage && before.aria === after.aria && !allow[key]) {
          failures.push(`${key}: no-op`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error);
  throw error;
} finally {
  stop();
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Button audit passed.");
