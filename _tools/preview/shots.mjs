import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const OUT = process.env.SHOTS || 'shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:4000';
const POST = '/ai/2026/09/23/the-end-of-the-monolithic-llm.html';
const only = process.argv.slice(2);

const jobs = [
  ['home-light', '/', 'light', 1440, 900, false],
  ['home-dark', '/', 'dark', 1440, 900, false],
  ['home-list-light', '/', 'light', 1440, 900, 'writing'],
  ['post-light', POST, 'light', 1440, 1800, true],
  ['post-end-light', POST, 'light', 1440, 1400, 'end'],
  ['post-dark', POST, 'dark', 1440, 1800, true],
  ['mobile-home', '/', 'light', 390, 844, false],
  ['mobile-post', POST, 'dark', 390, 844, true],
  ['about-light', '/about/', 'light', 1440, 1300, true],
  ['404-light', '/404.html', 'light', 1440, 900, false],
].filter((j) => !only.length || only.includes(j[0]));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
});

for (const [name, url, scheme, w, h, mode] of jobs) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.goto(BASE + url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, Number(process.env.WAIT || 2500)));
  if (mode === 'writing') await page.evaluate(() => document.getElementById('writing').scrollIntoView());
  if (mode === 'end') await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 400));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: mode === true });
  console.log(name, '| overflow-x:', overflow, errors.length ? '| errors: ' + errors.join(' ; ') : '');
  await page.close();
}
await browser.close();
