import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = "C:/Users/DAKSHA MALI PATIL/OneDrive/Desktop/medha/outputs/Scentinel_Dashboard_Screenshots";
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error.message });
  }
}

async function noHorizontalOverflow(label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (overflow) throw new Error(`${label}: horizontal overflow detected`);
}

async function gotoApp() {
  await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
}

await check("Open operations overview", async () => {
  await gotoApp();
  await page.screenshot({ path: path.join(outDir, "01-operations-overview.png"), fullPage: true });
  await noHorizontalOverflow("desktop overview");
});

async function runScenario(id, screenshotName, expectedTexts) {
  await page.getByRole("button", { name: /Simulation Lab/ }).click();
  await page.getByRole("button", { name: new RegExp(id) }).click();
  await page.getByRole("button", { name: /Run to end/ }).click();
  for (const text of expectedTexts) {
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: 5000 });
  }
  await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: true });
  await noHorizontalOverflow(`${id} desktop`);
}

await check("T02 sealed mortuary treatment passes", async () => {
  await runScenario("T02", "02-t02-safe-sealed-treatment.png", ["SAFE", "two safe samples"]);
});

await check("T05 ozone leak enters fail-safe", async () => {
  await runScenario("T05", "03-t05-ozone-leak-failsafe.png", ["O3 leak trip", "FAULT"]);
});

await check("T10 occupied dirty utility never uses ozone", async () => {
  await runScenario("T10", "04-t10-occupied-carbon-no-ozone.png", ["carbon path only", "no ozone command"]);
});

await check("T14 AeroTrace identifies upstream source", async () => {
  await runScenario("T14", "05-t14-aerotrace-source.png", ["Top source Z03", "82%"]);
});

await check("Mobile layout has no horizontal overflow", async () => {
  await page.setViewportSize({ width: 390, height: 900 });
  await gotoApp();
  await page.screenshot({ path: path.join(outDir, "06-mobile-overview.png"), fullPage: true });
  await noHorizontalOverflow("mobile overview");
});

await browser.close();
await fs.writeFile(path.join(outDir, "browser-qa-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
