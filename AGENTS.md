# Project instructions

## Browser tests

- Run all browser-based tests, smoke checks, screenshots, and automated browser demos headlessly so no browser windows or Chromium/Chrome icons appear in the macOS Dock.
- Set headless mode explicitly: use `headless: true` for Playwright/Puppeteer launches and `--headless=new` for Chromium-family CLI launches or Selenium browser options. Keep any future browser test configuration headless by default.
- Do not use `--headed`, `headless: false`, interactive test UI/debug modes, or environment overrides that launch a visible browser. Use headless screenshots, traces, and logs to investigate failures.
- Do not modify installed Chromium/Chrome application bundles or macOS system settings to hide browser windows or Dock icons.
- `npm test` runs Node's built-in test runner and does not launch a browser. The browser launcher in `security-demo/server.js` must remain headless. Preserve its confirmation, fixed inputs, sequential attempts, and stop/cleanup behavior; it can send a real email and should not be started as a routine verification step.
