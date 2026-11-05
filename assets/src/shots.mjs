// Renders README screenshots from the running panel with every secret redacted.
import { chromium } from '/tmp/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';

const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1187/chrome-linux/chrome';
const OUT = '/home/user/nightline-railway/assets/screens';
mkdirSync(OUT, { recursive: true });

const REDACT_JS = () => {
  const style = document.createElement('style');
  style.textContent = `.redact{filter:blur(6px) !important;user-select:none !important}
    .redact .qrbox{filter:none !important}`;
  document.head.append(style);

  const SECRET = /([0-9a-f]{16,})|(vless:\/\/|trojan:\/\/|ss:\/\/|vmess:\/\/|hysteria2:\/\/|tg:\/\/|t\.me\/proxy|t\.me\/socks|nl-[a-z0-9]{5,})/i;
  const SKIP = ['SCRIPT', 'STYLE', 'HTML'];

  document.querySelectorAll('*').forEach((el) => {
    if (SKIP.includes(el.tagName) || el.classList.contains('redact')) return;
    if (el.closest('.redact')) return;
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join(' ')
      .trim();
    if (own && SECRET.test(own)) el.classList.add('redact');
  });
  // QR codes encode the same secrets
  document.querySelectorAll('.qrbox, canvas.qr, .qr svg').forEach((el) => el.classList.add('redact'));
  // mask every field value (credentials, keys, tokens)
  document.querySelectorAll('input').forEach((el) => { if (el.type === 'text' || el.type === '') el.type = 'password'; });
  // never leak an account name in a screenshot
  document.querySelectorAll('.user-name, .acct-name').forEach((el) => el.classList.add('redact'));
};

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1120 }, deviceScaleFactor: 1.6 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.fill('#auth-user', 'admin');
await page.fill('#auth-pass', 'supersecret1');
await page.click('#auth-submit');
await page.waitForTimeout(2200);

const shots = [
  ['dashboard', null],
  ['inbounds', 'inbounds'],
  ['telegram', 'telegram'],
  ['users', 'users'],
  ['cores', 'cores'],
];

for (const [name, tab] of shots) {
  if (tab) {
    await page.click(`.tab-btn[data-arg="${tab}"]`);
    await page.waitForTimeout(900);
  }
  await page.evaluate(REDACT_JS);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const left = await page.evaluate(() => document.querySelectorAll('.redact').length);
  console.log(name, 'redacted nodes:', left);
}

await browser.close();
