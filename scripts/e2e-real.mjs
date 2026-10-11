import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
  cwd: frontend,
  env: { ...process.env, VITE_USE_MOCK: "false", VITE_COGNITO_USER_POOL_ID: "us-east-1_dummy", VITE_COGNITO_CLIENT_ID: "dummyclient" },
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) {
  console.error("Build failed", build.status, build.error ?? "");
  process.exit(build.status ?? 1);
}

const server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4173"], {
  cwd: frontend,
  env: process.env,
  stdio: "ignore",
  shell: true,
});
const stop = () => server.kill();
process.on("exit", stop);
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4173/");
      if (response.ok) break;
    } catch {}
    await delay(200);
  }

  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const run = async (fromRoot) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const requests = [];
      page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
      await page.goto(`http://127.0.0.1:4173/${fromRoot ? "" : "welcome"}`);
      if (fromRoot) await page.getByRole("button", { name: "Enter Sparrow" }).click();
      await page.getByRole("button", { name: "Try with sample data" }).click();
      await page.getByRole("status").getByText("Demo with sample data").waitFor();
      if (!page.url().endsWith("/app")) throw new Error(`Demo landed at ${page.url()}`);
      const forbidden = requests.filter(({ url }) => /cognito|amazonaws|\/api(?:\/|$)/i.test(url));
      if (forbidden.length) throw new Error(`Demo made network requests: ${JSON.stringify(forbidden)}`);
      await page.reload();
      await page.getByRole("status").getByText("Demo with sample data").waitFor();
      await context.close();
      return requests;
    };

    const rootRequests = await run(true);
    const welcomeRequests = await run(false);
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto("http://127.0.0.1:4173/app");
    await freshPage.waitForURL("**/login", { timeout: 5000 });
    const freshRoute = freshPage.url();
    await fresh.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/welcome");
    await page.getByRole("button", { name: "Try with sample data" }).click();
    await page.getByRole("button", { name: "Create my Nest" }).click();
    if (!page.url().endsWith("/login") || !(await page.getByText(/create|account/i).count())) {
      throw new Error("Create my Nest did not open sign-up.");
    }
    const demoKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("demo:")));
    if (demoKeys.length || await page.evaluate(() => sessionStorage.getItem("sparrow.demo"))) {
      throw new Error("Demo storage survived Create my Nest.");
    }
    await context.close();
    console.log(JSON.stringify({ rootRequests, welcomeRequests, freshRoute, status: "passed" }, null, 2));
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error);
  throw error;
} finally {
  stop();
}
