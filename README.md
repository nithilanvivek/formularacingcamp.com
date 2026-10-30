# Formula Racing Camp Website

Static website workspace for the **Formula Racing Camp** book, an educational racing book for kids that blends Formula 1 with science, engineering, history, geography, mathematics, puzzles, and character-driven learning.

## Current Project State

The website has been converted from the original Canva AI Code exports into a standard static structure:

- `index.html` - page markup and content.
- `styles.css` - extracted site styles.
- `app.js` - mobile menu, contact form, and icon initialization.
- `assets/tab-title.js` - shared visibility handler that shows “🏎️ Race Back!” in background tabs and restores each page's original title on return.
- `puzzles.html` - Formula Racing Camp puzzles page, available at `/puzzles`.
- `puzzles.css` - extracted puzzles page styles.
- `puzzles.js` - crossword, Wordle-style game, and quiz behavior.
- `preview.html` - progressive WebP book preview with an optimized PDF fallback, available at `/preview`.
- `404.html` - custom error page with a built-in F1-themed collection game.
- `assets/` - local optimized images, including the book cover and character bio WebP files.
- `vercel.json` - static hosting rules, clean URLs, canonical redirect, and headers.
- `llms.txt` - concise AI-readable site guide following the llms.txt proposal.
- `llms-full.txt` - expanded book facts, chapter groups, characters, FAQs, and citation guidance.
- `robots.txt` - explicit search and AI crawler access policy.
- `sitemap.xml` - canonical discovery list for public pages and AI-readable guides.
- `privacy.html` and `terms.html` - clean-URL trust and legal pages.
- `legal.css` - shared styling for the legal pages.
- `.vercelignore` - excludes reference-only files from deployment.
- `formularacingcamp.html` - original Canva/Cocoa export kept as a reference source.

The current deployable entry point is `index.html`, with the puzzles page available through `/puzzles`. The retired launch-week game has been removed; `/game` and `/game.html` return 404. The leaderboard, submission endpoints, and current leaderboard data file have also been removed.

## Latest Session State

As of 2026-09-11:

- Production domain is `https://www.formularacingcamp.com`.
- `https://formularacingcamp.com` redirects to the `www` domain.
- The homepage title is "Formula Racing Camp Book for Kids | F1 STEM Learning". Public pages show “🏎️ Race Back!” while their tab is hidden, then restore their original titles when visible.
- The subscribe bar has been removed.
- Header navigation includes a "Get in Touch" link.
- Authors copy says the group is made up of middle school students from Bengaluru, Karnataka, India.
- The puzzles page is wired at `/puzzles`.
- The retired Launch Grand Prix page has been removed; its leaderboard, data file, and submission endpoints have also been removed.
- The Wordle-style puzzle now colors submitted row tiles as well as keyboard letters.
- Homepage bitmap images are served from local optimized assets.
- Homepage statistics cite official Formula 1 sources, and the authors section documents the student editorial approach.
- Open Graph locale/site metadata and `BreadcrumbList` structured data support answer-engine discovery.
- Privacy and Terms pages describe the contact form, Launch Grand Prix, leaderboard, third-party services, purchases, and fair-play rules.
- Vercel sends CSP, referrer, permissions, frame-protection, and MIME-sniffing security headers.
- Responsive image variants reduce downloads for large character artwork.
- The book preview uses 13 lazy-loaded WebP pages instead of immediately embedding the original 17.4 MB PDF.
- The fallback preview PDF is web-linearized and reduced to about 1.6 MB.
- The optimized preview is deployed to production at `https://www.formularacingcamp.com/preview`.
- The custom 404 page includes a responsive F1-car collection game with keyboard, touch-button, and swipe steering, themed pickups, local best-score storage, and collision-specific race-over messages.

## Site Content

The exported page includes:

- A ticker/banner noting that buying is not yet active.
- Navigation for About, Chapters, What's Inside, Characters, and Authors.
- Hero section with book cover, title, subtitle, description, progressive book-preview link, and CTAs.
- Local puzzles page linked from the hero CTA.
- About section explaining the learning focus.
- Table of contents with chapter/category cards.
- "What's Inside" section covering F1 history, cars, drivers, circuits, activities, and statistics.
- "Did You Know?" fact section.
- Character profile section.
- Authors section for the student author group.
- Turnstile-protected contact form that submits through `/api/contact-submit` and sends mail with Reply-To set to the visitor's submitted email.

## Dependencies

The page depends on remote/CDN resources:

- Tailwind CSS CDN.
- Google Fonts: Fredoka and Poppins.
- Lucide icons CDN.

Because the CSS, fonts, and icons are loaded externally, the page needs internet access for the full visual experience.

## Local Development

No build step is required. You can preview it with a simple local server:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Local nithi.land contact security demo

The repository includes a localhost-only browser demonstration for the live `https://nithi.land/contact/` form. Each confirmed run launches Playwright's dedicated Chromium headless shell, rather than the installed macOS Chrome application. A headless flag on the full desktop browser did not prevent Dock icons in this environment; the standalone shell avoids launching that application. It fills the fixed Name, Email, Subject, and Message test values while leaving the honeypot empty, waits for Turnstile, and tries Send once. If Turnstile requests its checkbox, the bot clicks that checkbox once and records whether Cloudflare accepts the click; it does not read verification tokens or attempt further challenge-solving. After the attempt finishes, the control panel allows another sequential test. Starting each demo attempt can deliver one real email. Install the pinned development dependencies and matching headless shell before starting the demo. The former `FRC_BROWSER_PATH` override and desktop-browser fallbacks are no longer used. A missing shell produces an installation error instead of launching a desktop browser.

```sh
npm ci
npm run browsers:install
node security-demo/server.js
```

Then open `http://127.0.0.1:4173` to follow the live telemetry. The server binds only to loopback, accepts no custom target or message, requires a confirmation for every run, and prevents concurrent attempts. The Stop Attempt control cancels the active run immediately, ends its headless browser session, and leaves the dashboard ready for another attempt. `security-demo/` is excluded from Vercel deployments. Every completed, failed, or stopped attempt closes its browser session.

Run `npm run test:browser` for an offline shell smoke check that exercises navigation, input, clicks, screenshots, and cleanup without opening the live form or sending email. On macOS it also checks that the shell is not registered as a regular Dock application. `npm test` remains the browser-free Node test suite. Re-run `npm run browsers:install` after updating Playwright.

## File Structure

The project now uses:

```text
index.html
styles.css
app.js
preview.html
puzzles.html
puzzles.css
puzzles.js
api/
assets/
vercel.json
.vercelignore
README.md
session-notes.md
```

Homepage images are served from local optimized WebP files in `assets/site/` and `assets/characters/` to keep the page fast.

The preview reader serves its pages from `assets/site/preview-pages/`. Only the first page is requested eagerly; later pages lazy-load as the reader scrolls. `assets/site/formula-racing-camp-book-preview.pdf` remains available as a compact PDF alternative.

The full book download is available at `https://formularacingcamp.com/assets/latestpdf` (redirecting to the canonical `www` host). Vercel rewrites this stable URL to `assets/latestpdf.pdf` and sends an attachment header so it downloads as `Formula-Racing-Camp-5.5x8.5.pdf`. Replace that asset to update the download; the URL revalidates cached copies.

The sample chapters download is available at `https://www.formularacingcamp.com/assets/sample`. Vercel rewrites this URL to `assets/sample.pdf` and sends an attachment header so it downloads as `Formula Racing Camp Sample Chapters.pdf`. Replace that asset to update the sample; the URL revalidates cached copies.

## AI and Answer Engine Discovery

The site exposes a concise `/llms.txt` guide and an expanded `/llms-full.txt` reference. The home page also contains visible answer-focused FAQs with matching Schema.org `FAQPage` data, while the preview, puzzles, and game pages include page-specific JSON-LD.

`robots.txt` explicitly allows OpenAI, Anthropic, Perplexity, Google Extended, and general crawlers. The wildcard rule also permits other standards-compliant crawlers. Change the individual rules if the project later needs a different policy for search retrieval versus model training.

## Deployment Notes

For GitHub Pages or most static hosts, the main entry file should be named `index.html` at the repository root. The contact form requires its Vercel Functions and will not submit on a static-only host without an equivalent backend.

## Vercel Deployment

This repository is ready to import into Vercel as a static site.

Recommended Vercel settings:

- Framework Preset: Other
- Build Command: leave blank
- Output Directory: leave blank
- Install Command: leave blank

The `vercel.json` file enables clean URLs, canonical redirects, caching, and site-wide security headers. The `.vercelignore` file keeps reference-only files out of the deployed public output.

`/upi` serves the Camp Pay UPI QR Studio from `upi.html`. It generates payment QR codes locally in the browser, with optional INR amounts, notes, camp branding, PNG/SVG downloads, and a copyable UPI link. Its scripts and styles live in `assets/upi/`; the QR library retains its MIT license notice. Payment details are not sent to a server. Test the generated code with your UPI app and confirm the recipient before sharing.

Run `node --test tests/upi-browser.js` after installing the matching headless shell to check the studio under the production security headers, including input validation, clipboard copying, downloads, and mobile layout. The test starts and closes its own local server. Set `UPI_LIVE_BASE_URL=https://www.formularacingcamp.com` to run the same check against production; it generates only test QR codes and makes no payments. `UPI_QA_DIR` optionally selects the output folder for screenshots and downloaded QR images.

`/sales` serves Camp Sales, a sales recorder styled to match Camp Pay. The first screen shows total sales, total profit, an equal one-sixth profit share per author, and batch-wise profit. A batch records its total book-order cost and gets an automatic batch number. Each batch sale or online stall sale records one Paperback or Hardcover book, its selling price, an optional payment name, and an automatic server timestamp displayed in India time. Record Editor replaces Cancel order: select a batch or sale using the existing filters and edit its cost or sale channel, batch, format, price, and payment name as applicable. A trash icon deletes sales after confirmation; batches have no delete control, and the API rejects batch deletion. Edits retain record IDs, numbers, and original timestamps, and record an updated time. Previously cancelled sales remain excluded from totals unless deleted. Total profit is active sale revenue minus all batch costs; online stall sales currently have no separate cost deduction. Author shares are display estimates rounded to the nearest paise.

The Vercel API at `/api/sales-data` stores records in the existing Upstash Redis database under `frc:sales:v1:ledger`, using `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` or their `KV_REST_API_*` equivalents. Atomic compare-and-save operations preserve concurrent updates; per-record versions reject stale edits and deletions. Request receipts prevent duplicate edits/deletions on retries; deletion tombstones contain only opaque sale IDs, preventing an old create retry from restoring a deleted sale. Order numbers are not reused after deletion. The recorder never falls back to browser storage or temporary Vercel files. Refresh loads the shared server records. Export Excel downloads an `.xlsx` snapshot with Summary, Batch profits, Batches, and Sales sheets, sortable India-time dates, numeric INR amounts, formulas with cached results, frozen headers, and filters. Export always includes all remaining records, including legacy cancellations, regardless of the on-page filters; deleted sales are absent.

As requested, the sales recorder has no login: anyone with its URL can complete a single page-level bot check and then read records, including payment names, and submit changes. The page check reuses the existing `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` with the `sales` action; the server verifies the action and hostname, then issues an eight-hour signed, HttpOnly, Secure, SameSite cookie. The API requires that session for both reads and writes. Refreshing, exporting, editing, saving, and deleting do not repeat the check. An expired session returns to the page gate while preserving the unfinished form. Both `/sales` and `/upi` have HTML and HTTP `noindex` directives and remain absent from the sitemap. Crawlers are allowed to fetch these routes so they can read those directives.

Record filters combine sales/batches, online stall/batch sale channel, Paperback/Hardcover, an optional recorded-date checkbox and date field in India time, and batch number when batches are selected. Record Editor has the same filters and can edit both batches and sales, including legacy cancelled records. Filtering does not change the overview totals.

Run `npm test` for the sales model/API checks and `node --test tests/sales-browser.js` for record creation and editing, sale-only deletion, profit calculations, payment names, persistence across reloads, failure recovery, the single verification session, combined filters, Excel download, and desktop/mobile layout. The browser test uses isolated in-memory fixtures and a stub Turnstile widget, and writes no production records. It reuses the dedicated headless-shell session helper and closes its browser and local server in `finally`.

Vercel Web Analytics is loaded directly from `/_vercel/insights/script.js` on every public HTML page. This static site does not require the `@vercel/analytics` npm package or a JavaScript build step. The unused local package files are excluded by both `.gitignore` and `.vercelignore`; if the project later adopts the package API, remove those exclusions and add an intentional bundling workflow.

With clean URLs enabled, `puzzles.html` is served at:

```text
https://www.formularacingcamp.com/puzzles
```

The retired `/game` and `/game.html` routes return 404.

### Tracked short links

The header and hero buy buttons use `/amazon` (print), `/kindle`, `/flipkart`,
and `/np` (Notion Press). YouTube channel buttons use `/youtube`, which targets
`https://youtube.com/@FormulaRacingCamp`. Vercel rewrites these links to
one shared function with an allowlist of fixed destinations. It records a daily
Redis counter before returning a non-cached 302 redirect. Shared links and
website clicks use the same counters.

`/analytics` shows the five short-link totals for the selected date range.
They count GET requests, including repeat requests and bots, rather than unique
people or purchases; HEAD checks do not count. Counting starts with this
deployment of each link. The old retailer-selection and YouTube-open counters
and `/go/book` and `/go/youtube` page statistics are excluded from the dashboard.
Older transition links still continue through the corresponding short link.
A counter outage or a 1.5-second timeout does not block the redirect.

The launch-week game, leaderboard, and submission APIs are retired. Game-specific Redis duplicate-submission keys and daily submission counters are removed; shared sales, contact protection, and other analytics data are retained. Historical Git commits are not rewritten.

The homepage contact form also uses Resend through `/api/contact-submit`. It sends messages to `CONTACT_TO`, falling back to `LAUNCH_GAME_REPLY_TO` and then `authors@formularacingcamp.com`, with `reply_to` set to the visitor's email.

The contact form is protected by a Cloudflare Turnstile Managed widget. Create a Turnstile widget restricted to `www.formularacingcamp.com`, then configure both values in every Vercel environment that should accept contact submissions:

- `TURNSTILE_SITE_KEY` - public widget site key returned by `/api/contact-config`
- `TURNSTILE_SECRET_KEY` - server-only secret used by `/api/contact-submit`

The API fails closed when Turnstile or rate-limit storage is unavailable, validates every token with Cloudflare before sending email, and checks the verified hostname and `contact` action. Turnstile tokens are single-use, so the browser resets the widget after every submission attempt.

Successful contact messages are limited to five per rolling 24 hours by both public IP address and normalized email address. The limiter stores only HMAC-protected identifiers in the existing Upstash Redis/Vercel KV database, so deleting browser history or cookies does not reset it. Configure the existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` variables (or the legacy `KV_REST_API_URL` and `KV_REST_API_TOKEN` aliases). `CONTACT_RATE_LIMIT_SECRET` is optional; when omitted, the server-only Turnstile secret is used to protect the identifiers. Failed Resend deliveries are removed from the count.

## Near-Term Tasks

1. Confirm remaining CTA destinations: buy link, puzzles, YouTube, and contact email.
2. Consider replacing the Tailwind CDN with a build step if the project grows.

## Unlisted public analytics

`/analytics` and `/api/analytics-data` are accessible without a password. Vercel
and Redis credentials remain server-side. Responses publish only fixed public
page paths and selected aggregate metrics, with unknown paths and upstream
metadata excluded. The page, direct HTML handler, and JSON API retain `noindex`
and `no-store`; none are in the sitemap. Crawlers may fetch them to read noindex.
