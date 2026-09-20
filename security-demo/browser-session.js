const { chromium } = require('playwright');

async function launchHeadlessSession() {
  // No channel or executablePath: Playwright selects its dedicated headless shell.
  // Never fall back to an installed macOS browser app, even in headless mode.
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    let closing;
    return {
      cdp,
      close: () => (closing ||= browser.close())
    };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

module.exports = { launchHeadlessSession };
