/**
 * Run B proof-loop walk (Playwright, system Chrome, 390px).
 *
 * Path: new-user Home -> add bill 200 -> baseline saved -> add bill 170 ->
 * verification result (verified, 15%) -> Home thriving -> share card.
 * Screenshots land in frontend/.qa/b1/.
 *
 * Usage: node scripts/proof-loop.mjs   (against a running dev server)
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../.qa/b1");

const USER = { id: "u_proof", email: "ananya@example.com", displayName: "Ananya Rao", provider: "email" };
const PROFILE = {
  user: USER,
  introSeen: true,
  setupComplete: true,
  language: "en",
  answers: { homeType: "apartment", people: "3-4 people", city: "Pune", usualBill: "1000-2500", appliances: ["Air conditioner"] },
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    ({ user, profile }) => {
      localStorage.setItem("sparrow.user", JSON.stringify(user));
      localStorage.setItem("sparrow.profile." + user.id, JSON.stringify(profile));
      localStorage.setItem("sparrow-language", "en");
    },
    { user: USER, profile: PROFILE },
  );
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: resolve(OUT, name), animations: "disabled" });

  await page.goto(BASE + "/app", { waitUntil: "networkidle" });
  await page.waitForSelector(".home-page", { timeout: 15000 });
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue("--forest").trim() !== "",
    null,
    { timeout: 15000 },
  );
  await page.getByText("Waiting for your first verified bill").first().waitFor();
  await shot("01-home-new-user.png");

  // First bill -> baseline
  await page.getByRole("button", { name: /Waiting for your first verified bill/ }).click();
  await page.waitForSelector(".bill-sheet");
  await page.locator('.bill-sheet input[inputmode="decimal"]').fill("200");
  await page.getByRole("button", { name: /Verify my usage/ }).click();
  await page.getByRole("dialog").getByText("Your first bill is your baseline.").waitFor({ timeout: 8000 });
  await shot("02-baseline-saved.png");

  // Close, add second bill -> verification result
  await page.getByRole("button", { name: "Close bill entry" }).click();
  await page.waitForSelector(".bill-sheet", { state: "detached" });
  await page.getByRole("button", { name: /Waiting for your first verified bill/ }).click();
  await page.waitForSelector(".bill-sheet");
  await page.locator('.bill-sheet input[inputmode="decimal"]').fill("170");
  await page.getByRole("button", { name: /Verify my usage/ }).click();
  await page.getByRole("dialog").getByText("You saved 30 kWh, verified.").waitFor({ timeout: 8000 });
  await shot("03-verification-result.png");

  // Back to a thriving Nest
  await page.getByRole("button", { name: "See my updated Nest" }).click();
  await page.waitForSelector(".bill-sheet", { state: "detached" });
  await page.getByText(/Thriving/).first().waitFor({ timeout: 8000 });
  await shot("04-home-thriving.png");

  // View result -> share card
  await page.getByRole("button", { name: /View result/ }).click();
  await page.waitForSelector(".bill-sheet");
  await page.getByRole("button", { name: /Share my impact/ }).click();
  await page.waitForSelector(".share-card", { timeout: 8000 });
  await shot("05-share-card.png");

  await context.close();
  await browser.close();
  console.log("Proof loop complete. Screenshots in frontend/.qa/b1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});