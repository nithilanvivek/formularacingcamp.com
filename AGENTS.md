# Project instructions

## Browser tests

- Run all browser-based tests, smoke checks, screenshots, and automated browser demos headlessly so no browser windows or Chromium/Chrome icons appear in the macOS Dock.
- Use the dedicated Chromium headless shell. A headless flag on the full macOS Chrome/Chromium app is insufficient to prevent Dock icons. Install the shell with `npm run browsers:install` after `npm ci` or a Playwright update.
- For Playwright, use `chromium.launch({ headless: true })` with no `channel` or `executablePath`; for Puppeteer use `headless: 'shell'`. Direct CLI or Selenium launches must use the standalone `chrome-headless-shell` executable. Never fall back to a desktop browser app if the shell is missing.
- Do not use `--headed`, `headless: false`, interactive test UI/debug modes, or environment overrides that launch a visible browser. Use headless screenshots, traces, and logs to investigate failures.
- Do not modify installed Chromium/Chrome application bundles or macOS system settings to hide browser windows or Dock icons.
- `npm test` runs Node's built-in test runner and does not launch a browser. Reuse `security-demo/browser-session.js` for browser checks and always close sessions in `finally`. The demo must retain its confirmation, fixed inputs, sequential attempts, and stop/cleanup behavior; it can send a real email and should not be started as a routine verification step.
