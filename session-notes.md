# Session Notes

Date: 2026-07-02

## Goal

Familiarize Codex with the Formula Racing Camp website workspace, add basic project documentation, and connect the local workspace to the GitHub repository at `nithilanvivek/formularacingcamp.com`.

## Repository Snapshot

Current site files:

- `index.html`
- `styles.css`
- `app.js`
- `puzzles.html`
- `puzzles.css`
- `puzzles.js`
- `formularacingcamp.html`
- `README.md`
- `session-notes.md`

The workspace was not initialized as a git repository at the start of the session. It has now been initialized on `main` and connected to `https://github.com/nithilanvivek/formularacingcamp.com.git`.

## Code Observations

- The original `formularacingcamp.html` file came from Canva AI Code and was saved as an escaped HTML document inside a Cocoa HTML Writer wrapper.
- The intended website has been extracted into a deployable `index.html`.
- Styles have been moved into `styles.css`.
- Behavior has been moved into `app.js`.
- The Canva AI Code puzzles export has been converted into `puzzles.html`, `puzzles.css`, and `puzzles.js`.
- The home page puzzles CTA now points to `/puzzles`.
- Styling now lives in `styles.css`, with many original inline style attributes and Tailwind utility classes still preserved from the Canva export.
- JavaScript handles:
  - Mobile navigation toggle.
  - Contact form validation and `mailto:` launch.
  - Lucide icon initialization.
- The sticky subscription bar has been removed.
- Several buttons are placeholders or informational only because the book is still in progress.

## Content Map

The intended site includes:

- Announcement banner.
- Header navigation.
- Hero section with book cover, subtitle, description, and CTAs.
- About section.
- Table of Contents section.
- What's Inside section.
- Did You Know section.
- Character profiles.
- About the Authors section.
- Final CTA section.
- Contact form.
- Footer.
- Puzzles page with crossword, Wordle-style game, and quiz sections.

## Technical Recommendation

Single-file static HTML was acceptable for the Canva prototype, but the project is now better positioned as separate `index.html`, `styles.css`, and `app.js` files.

Reason: this page already has enough CSS, JavaScript, metadata, external assets, and content sections that separate files will make changes safer and easier to review. It will also make GitHub diffs cleaner when editing copy, layout, or behavior.

Recommended next structure:

```text
index.html
styles.css
app.js
assets/
README.md
session-notes.md
```

The first three files now exist. `assets/` remains a future option if hosted images are moved into the repository.

The puzzles page follows the same split-file approach with page-specific `puzzles.css` and `puzzles.js`.

## Suggested Next Steps

1. Validate the page in a browser at mobile and desktop sizes.
2. Confirm whether GitHub Pages will serve the site from the root branch.
3. Confirm Buy and Preview destinations when the book is ready.
4. Decide whether to keep third-party image hosting or move images into the repository.
5. Choose a real contact workflow if form persistence is needed.

## Open Questions

- Should the website continue to rely on hosted `i.ibb.co` images, or should important images live in this repository?
- What should the Buy and Preview buttons link to when the book is ready?
- Should the contact form use a real service such as Formspree, Google Forms, or a small backend?
- The production domain is `www.formularacingcamp.com`, with `formularacingcamp.com` redirecting to it.

## End Session Summary

Wrapped on 2026-07-02.

Completed during this session:

- Split the original Canva AI Code homepage into `index.html`, `styles.css`, and `app.js`.
- Added Vercel static deployment config with clean URLs and ignored reference-only files.
- Connected and pushed the workspace to `nithilanvivek/formularacingcamp.com`.
- Confirmed production domain setup with `www.formularacingcamp.com` as the canonical domain and apex redirecting to it.
- Converted the Canva puzzles export into `puzzles.html`, `puzzles.css`, and `puzzles.js`.
- Linked the home page puzzles CTA to `/puzzles`.
- Updated homepage title, hero copy, authors copy, and header navigation.
- Removed the subscribe bar from the homepage.
- Fixed crossword answer checking and Wordle-style submitted-row color feedback.
- Created and updated a personal Codex `$endsession` skill outside this repository for future wrap-up workflows, including stopping local preview servers.

Validation performed:

- `node --check app.js`
- `node --check puzzles.js`
- Browser checks during development for the homepage and puzzles page.

Latest pushed site commit before final documentation wrap-up:

```text
45c068e Fix Wordle tile feedback colors
```

Recommended next steps:

- Replace placeholder buy, preview, and social links when final destinations exist.
- Move important hosted images into an `assets/` directory if long-term reliability matters.
- Add a real form backend if contact submissions should be stored or sent without opening an email client.
- Consider a local Tailwind build only if the site grows beyond simple static pages.

## Follow-Up Wrap-Up

Date: 2026-07-02

Completed:

- Updated the homepage hero card to use the new hosted Formula Racing Camp cover page image.
- Kept the existing hero cover styling and fallback card behavior.

Validation performed:

- `node --check app.js`
- `node --check puzzles.js`
- No local preview servers were found on common ports `3000`, `4173`, `5173`, `8000`, `8080`, or `8787`.

## Cover Image Follow-Up

Date: 2026-07-02

Completed:

- Replaced the homepage hero cover image with the PNG hosted at `https://i.ibb.co/tT83ksp0/Formula-Racing-Camp-coverpage.png`.
- Updated the cover source link to `https://ibb.co/Rkz7Z0TX`.
- Re-ran JS syntax checks and found no local preview servers on common ports.

## Book Announcement Session

Date: 2026-07-04

Completed:

- Added a full-screen publishing announcement that appears one second after the page loads.
- Blurs and darkens the page behind the announcement while it is visible.
- Improved announcement contrast with adaptive light/dark background palettes, discrete flashing colors, and outline shadows.
- Set the announcement to auto-dismiss after `3.75s`, while keeping the close button available for early dismissal.
- Removed the old orange top announcement banner from the homepage.
- Added a version query to the homepage `app.js` script reference so browsers pick up the announcement timer update promptly.

Validation performed:

- `git diff --check`
- Browser verification on the local static site for announcement visibility, dismissal behavior, contrast, and removal of the old top banner.

Latest pushed site commit before session wrap-up:

```text
3b58bc0 Tune announcement timing and remove top banner
```

Recommended next steps:

- Confirm production deployment updates from `origin/main`.
- Replace placeholder buy and preview actions when final destinations are ready.
- Consider moving critical hosted images into the repository if long-term availability matters.

## Announcement Animation Wrap-Up

Date: 2026-07-04

Completed:

- Added an animated F1-style car scene to the publishing announcement overlay.
- Updated the car to a generic black-and-gold livery with a more realistic F1 silhouette, exposed wheels, front/rear wings, cockpit/halo, and suspension lines.
- Kept the book cover as the top layer on the car and used a local optimized cover image at `assets/site/book-cover.webp`.
- Extended the overlay to `4.5s` so the car can wait at the bookstore before dismissal.
- Changed announcement scheduling from `window.load` to `DOMContentLoaded` so it appears after the page structure is visible instead of waiting for all images.
- Updated the homepage hero copy to `Perfect for ages 9+`.

Validation performed:

- `node --check app.js`
- `node --check puzzles.js`
- `git diff --check`
- Browser checks for desktop/mobile announcement layout, car layering, livery colors, and DOM-ready script loading.

Latest pushed site commit before session wrap-up:

```text
9cabea6 Show announcement after DOM ready
```

Recommended next steps:

- Confirm the production deployment has picked up `origin/main`.
- Revisit buy and preview destinations when the book publishing flow is ready.
- Consider moving the main homepage logo and hero cover to local `assets/` later to reduce reliance on third-party image hosting.

## Contact Form and Image Performance Wrap-Up

Date: 2026-07-04

Completed:

- Replaced the homepage contact form `mailto:` flow with a Formspree AJAX submission to `https://formspree.io/f/mzdlylbl`, keeping users on the page with inline success/error states.
- Verified the Formspree endpoint accepted a real test submission before deployment.
- Converted all homepage bitmap images to local optimized WebP assets under `assets/site/` and `assets/characters/`.
- Removed the remaining active `i.ibb.co` homepage image dependencies and the old unused cover PNG.
- Confirmed real-world image loading felt nearly instant after cache clear on MacBook and under half a second on Chrome for Google Pixel 4a.

Validation performed:

- `node --check app.js`
- Verified all homepage image references resolve to existing local assets.
- Fetched production with cache-busting URLs and confirmed no remote homepage image `src` references remain.
- Verified deployed optimized image assets return `200`.

Latest pushed site commits before session wrap-up:

```text
12afbf6 Use optimized cover in announcement
f651e4a Optimize remaining homepage images
4add4f2 Optimize character bio images
50a3707 Use Formspree for contact form
```

Recommended next steps:

- Revisit buy and preview destinations when the book publishing flow is ready.
- Consider replacing remaining CDN dependencies for Tailwind, Lucide, and fonts if fully offline/self-hosted loading becomes important.

## Launch Grand Prix Wrap-Up

Date: 2026-07-05

Completed:

- Added a first-week publishing game, Launch Grand Prix, served from `game.html` and intended for `https://www.formularacingcamp.com/game`.
- Built three levels: Start Lights reaction timing, Pit Lane Dash canvas collection game, and Strategy Code decision puzzle.
- Added username entry before the game starts.
- Added tab-hidden/window-blur tracking so entries can be flagged as clean, warning, review, or invalid.
- Added launch-week prize copy: 1st place signed copy, 2nd place one-time 50% Amazon promo code, 3rd place one-time 25% Amazon promo code, and 5% for other valid entrants.
- Added `api/launch-game-submit.js` for Vercel submissions, with server-side dry-run handling for test entries.
- Linked the game from the homepage and puzzles page.

Validation performed:

- `node --check launch-game.js`
- `node --check api/launch-game-submit.js`
- `node --check app.js`
- `node --check puzzles.js`
- `git diff --check`
- Local browser smoke test for page load, level unlock flow, canvas rendering, and dry-run entry handling.

Deployment notes:

- Vercel clean URLs should serve `game.html` at `/game`.
- Real durable entry collection requires setting `LAUNCH_GAME_WEBHOOK_URL` in Vercel.
- Test entries are not saved or forwarded by the front end or API endpoint.

Recommended next steps:

- Configure the launch game webhook or database destination before accepting real entries.
- Confirm winner review criteria and final email copy for Amazon promo code delivery.
- After deployment, verify `https://www.formularacingcamp.com/game` loads and the API route returns as expected.

## Launch Game Graphics and Difficulty Pass

Date: 2026-07-05

Completed:

- Reworked the Launch Grand Prix opening screen into a large visual race-track hero and removed the separate rules shortcut button.
- Added the visible launch-week rules below the hero, including tab/window disqualification, one browser attempt, completion requirements, winner review, and one-time Amazon promo code handling.
- Updated player-facing disqualification wording to say the attempt ended because a new tab was opened.
- Made Pit Lane Dash faster, shortened it to 20 seconds, and kept the scripted item set fair with equal books, helmets, tyres, and oil slicks for every player.
- Expanded Strategy Code from 4 to 8 race-decision questions.

Validation performed:

- `node --check launch-game.js`
- `node --check api/launch-game-submit.js`
- `git diff --check`
- Local browser smoke test for the new hero, rules list, removed rules shortcut button, 20-second dash copy, and 8 Strategy Code cards.

## Launch Animation and Author Cleanup

Date: 2026-07-05

Completed:

- Added a launch transition so clicking Launch Game sends racing cars across the screen before Level 1 is revealed.
- Hid the score strip, level tabs, and level panels until the launch sequence completes.
- Removed the requested character bio and visible homepage mentions from the deployed homepage.
- Checked the deployed homepage files for removed-name references and 7-author wording.

## Test Leaderboard Routing

Date: 2026-07-05

Completed:

- Added saved test leaderboard usernames: `test_nihira`, `test_nithilan`, `test_jaskirat`, `test_tejas`, `test_nandana`, and `test_shaurya`.
- Kept `test_nalihtin` as the hidden no-save dry run username.
- Added `LAUNCH_GAME_TEST_WEBHOOK_URL` support so test leaderboard entries can be forwarded separately from production entries.

## End Session Wrap-Up

Date: 2026-07-05

Current state:

- Latest pushed commit before wrap-up: `4dd4f24 Route saved test leaderboard entries separately`.
- Branch: `main`, tracking `origin/main`.
- Production domain: `https://www.formularacingcamp.com`, with the launch game at `/game`.
- Testing is planned for tomorrow with the saved `test_*` leaderboard usernames.

Recommended next steps:

- Choose the storage/email path for the scheduled leaderboard email before broad testing.
- Configure `LAUNCH_GAME_TEST_WEBHOOK_URL` for separated test entries.
- Configure `LAUNCH_GAME_WEBHOOK_URL` before accepting real production entries.
- Confirm the exact leaderboard email time, recipients, and code fulfillment copy.

## Six-Screen Game Flow

Date: 2026-07-06

Completed:

- Reworked Launch Grand Prix into six separate screens: Launch Game, Rules, Level 1, Level 2, Level 3, and Conclusion/email submission.
- Removed the level-tab jump navigation and the long scroll-page flow.
- Removed the Strategy Code mechanic so players cannot copy a shared final code.
- Replaced Level 3 with harder strategy decision cards and a Save Strategy button.
- Verified the full local no-save flow from Launch Game through conclusion email submission.

## Launch Game Production Polish

Date: 2026-07-06

Completed:

- Updated Nandana's main homepage bio image while keeping the peacock image unchanged.
- Changed homepage game CTAs to `Launch Discount Game`.
- Added car-zip transitions for player-clicked screen changes between launch, rules, levels, results, and conclusion.
- Added explicit `Next Level` and `Results` buttons so screens do not advance automatically.
- Added a high-visibility run-ended flash for tab/window disqualification.
- Redirected disqualified runs back to the homepage after the warning flash.
- Moved the level score strip into reserved layout space so it cannot cover level controls.
- Made the launch hero responsive to both viewport width and height for 13-inch and 16-inch laptop screens.
- Increased launch hero text contrast so the title, description, and username prompt remain readable on the track background.

Validation performed:

- `node --check launch-game.js`
- `git diff --check`
- Local viewport checks at `1280x800` and `1536x960` for launch-screen fit.

## Player Receipt Emails

Date: 2026-07-06

Completed:

- Added Resend receipt emails for valid, non-dry-run Launch Grand Prix submissions.
- Kept existing webhook forwarding unchanged and skipped player receipts for invalid/disqualified runs.
- Returned `emailStatus` from the launch-game API so email failures do not erase a valid submitted run.
- Updated the player confirmation message when a receipt is sent or when the receipt fails but the run is recorded.
- Marked saved test leaderboard receipt emails with test-leaderboard subject/body wording.
- Extended the tab/window disqualification flash to 3 seconds before redirecting to the homepage.

Validation performed:

- `node --check api/launch-game-submit.js`
- `node --check launch-game.js`
- `git diff --check`
- Mocked API tests for dry-run skip, clean receipt send, test-leaderboard wording, invalid receipt skip, and Resend failure fallback.

## Book Preview Link

Date: 2026-07-06

Completed:

- Added the book preview PDF to local site assets.
- Linked both homepage `Preview Pages` controls to the PDF with `target="_blank"` and `rel="noopener noreferrer"`.

## End Session Wrap-Up

Date: 2026-07-06

Current state:

- Latest pushed commit before wrap-up: `96be8d0 Link book preview PDF`.
- Branch: `main`, tracking `origin/main`.
- Production domain: `https://www.formularacingcamp.com`, with the launch game at `/game`.
- Tomorrow's testing plan is to use saved leaderboard usernames such as `test_nithilan`, `test_jaskirat`, and the other configured `test_*` usernames.

Recommended next steps:

- Configure `RESEND_API_KEY` in Vercel before expecting player receipt emails to send.
- Configure `LAUNCH_GAME_TEST_WEBHOOK_URL` and `LAUNCH_GAME_WEBHOOK_URL` before judging leaderboard results.
- Run production smoke tests for the launch game, preview PDF, tab/window disqualification, and receipt-email status after Vercel redeploys.

## Stricter Anti-Cheat Detection

Date: 2026-07-07

Completed:

- Added active focus polling during live runs to catch missed Chrome/incognito window switches.
- Blocked context-menu use during live runs to catch browser tools such as Google Lens.
- Updated rules and disqualification wording to mention tabs, windows, incognito, and browser tools.

## GitHub Leaderboard Storage

Date: 2026-07-08

Completed:

- Added `data/launch-game-leaderboard.json` as the public-safe leaderboard store.
- Added server-side GitHub Contents API saving from `/api/launch-game-submit`.
- Saved only public-safe fields: username, score, level scores, review status, bucket, test-leaderboard flag, and timestamps.
- Kept emails, notes, user agent, anti-cheat events, and private payload details out of the public JSON file.
- Added a one-time retry for GitHub write conflicts when submissions arrive close together.

Required Vercel setup:

- Add `LAUNCH_GAME_GITHUB_TOKEN` or `GITHUB_TOKEN` with permission to write repository contents.
- Optional overrides: `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, and `LAUNCH_GAME_LEADERBOARD_PATH`.

## Launch Game Testing And Email Wrap-Up

Date: 2026-07-08

Completed:

- Verified Resend domain sending through `mail.formularacingcamp.com` and set production sender to `Formula Racing Camp <game@mail.formularacingcamp.com>`.
- Added `LAUNCH_GAME_REPLY_TO` so game receipt replies go to `authors@formularacingcamp.com`.
- Replaced the homepage Formspree contact flow with `/api/contact-submit`, using Resend and setting Reply-To to the visitor's submitted email.
- Updated Launch Grand Prix test handling so any username beginning with `test_` is saved to the test leaderboard, while `test_nalihtin` remains the no-save dry run.
- Added `/game-leaderboard` with separate main and test views, a first-screen `See Leaderboard` link, post-submit leaderboard links, and visible Main/Test switches.
- Confirmed saved test entries for `test_nithilan` and `Test__Jaskirat`; the main leaderboard is still empty.
- Fixed the hero `See Leaderboard` button text rendering by removing inherited text shadow from action buttons.

Validation performed:

- `node --check app.js`
- `node --check api/contact-submit.js`
- `node --check api/launch-game-submit.js`
- `node --check api/launch-game-leaderboard.js`
- `node --check launch-game.js`
- `node --check game-leaderboard.js`
- Live smoke checks for `/api/launch-game-leaderboard?bucket=test` and `/api/launch-game-leaderboard?bucket=main`.

Current state:

- Branch: `main`, tracking `origin/main`.
- Production domain: `https://www.formularacingcamp.com`.
- Launch game: `https://www.formularacingcamp.com/game`.
- Leaderboard page: `https://www.formularacingcamp.com/game-leaderboard`.
- Vercel production env vars in use include `RESEND_API_KEY`, `LAUNCH_GAME_GITHUB_TOKEN`, `LAUNCH_GAME_EMAIL_FROM`, and `LAUNCH_GAME_REPLY_TO`.

Recommended next steps:

- Continue production testing with `test_` usernames for test leaderboard runs and regular usernames for main leaderboard runs.
- Check Resend delivery logs if a participant reports not receiving a game receipt.
- Before launch, decide how and when to send final leaderboard placements and Amazon promo codes after review.

## Launch Day Endday Wrap-Up

Date: 2026-07-19

Completed today:

- Updated the homepage launch animation to say `First Month of Release` and show an F1 delivery car carrying the book from a bookstore to a house.
- Moved the `25%` label above the animated F1 car so the discount is readable.
- Updated launch game campaign copy for Notion Press coupons:
  - `FORMULA40` for hardcover.
  - `FORMULA25` for paperback.
  - Top valid winners receive free books rather than discounts.
- Cleared the public leaderboard after the `meena` test entry and confirmed `data/launch-game-leaderboard.json` currently has an empty `entries` array.
- Removed the public Test Leaderboard view and kept the leaderboard API production-only.
- Added free-book winner cutoff logic to `/api/launch-game-leaderboard`: top 3 with ties at the cutoff. Removed entries do not count because only the current leaderboard JSON is used.
- Created approval cards for August 15, 2026 at 11:59 AM IST winner-email automation and a follow-up reply monitor.
- Pushed code to store submitted player emails in the leaderboard JSON for later prize fulfillment, block direct website access to the raw JSON file, and force player receipt Reply-To to `authors@formularacingcamp.com`.

Important current caveat:

- Commit `c562d0d` (`Store leaderboard emails privately`) is pushed to GitHub but was **not deployed to production**. The deploy was blocked because storing full participant emails in a GitHub-backed leaderboard file is private data export risk. Production currently does not have this email-storage behavior unless that deployment is explicitly approved or a safer private storage path is implemented.
- Because the live leaderboard JSON remains public-sensitive, future winner email automation needs a durable private source for winner email addresses before August 15. Safer options include a private webhook/database, private spreadsheet, or mailbox-based lookup rather than raw public repo JSON.

Validation performed:

- `node --check api/launch-game-submit.js`
- `node --check api/launch-game-leaderboard.js`
- `node --check api/not-found.js`
- `node --check launch-game.js`
- `node --check game-leaderboard.js`
- `node --check app.js`
- `node -e "JSON.parse(require('fs').readFileSync('data/launch-game-leaderboard.json','utf8'))"`
- `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`
- `git diff --check`

Preview servers:

- No local preview servers were found on common ports `3000`, `4173`, `5173`, `8000`, `8080`, or `8787`.

Current repository state:

- Branch: `main`, tracking `origin/main`.
- Latest pushed code commit before this wrap note: `c562d0d Store leaderboard emails privately`.
- Production domain: `https://www.formularacingcamp.com`.
- Launch game: `https://www.formularacingcamp.com/game`.
- Public leaderboard: `https://www.formularacingcamp.com/game-leaderboard`.

Resume points:

- Decide whether to deploy `c562d0d` despite the email-in-GitHub risk or replace it with safer private storage for participant emails.
- If using safer private storage, adjust `/api/launch-game-submit` so full emails go only to the private destination while the GitHub leaderboard remains public-safe.
- Confirm August 15 automation approval cards are accepted in Codex.
- Confirm how Codex will access replies to `authors@formularacingcamp.com` for mailing-address extraction, or plan to review those replies manually.

## Continuation Handoff

Date: 2026-07-21

Continuation prompt for the next Codex session:

```text
This is the continuation of Add game prize discounts.
```

Current production state:

- The latest pushed branch is `main`.
- Vercel production should be treated as separate from GitHub push: after future pushes, confirm the production deployment picked up the pushed commit; if it did not, run `vercel deploy --prod`.
- The email-storage change from `c562d0d` has been deployed to production after explicit approval. Future valid launch-game submissions store the participant email in `data/launch-game-leaderboard.json`.
- The public leaderboard API and UI still do not expose stored email addresses.
- Direct website access to `data/launch-game-leaderboard.json` is blocked by `vercel.json`.
- Player receipt emails are sent through Resend and use `authors@formularacingcamp.com` as Reply-To.
- The main leaderboard was cleaned after the `meena` test entry; removed entries do not count for August 15 winner logic because the current leaderboard JSON is the source of truth.

Recommended next steps:

- In the new session, verify the first real/test post-deployment submission writes `email` into the GitHub-backed leaderboard file.
- Continue using `test_` usernames only for tests; `test_nalihtin` remains the no-save dry run.
- Before any production change, remember the agreed workflow: push to GitHub, confirm Vercel production, deploy manually if needed, then verify live behavior.

## Updated Launch Grand Prix Prizes

Date: 2026-07-21

- First place receives a free book; the winner email must ask for a complete delivery address and delivery phone number.
- Second place receives separate one-time Notion Press codes for 50% off paperback and 59% off hardcover, and may buy both editions.
- Third place receives separate one-time Notion Press codes for 40% off paperback and 49% off hardcover, and may buy both editions.
- Each edition code can be used only once. Do not attach the source CSV files to winner emails, and do not commit the unique codes to the public repository.
- Placements are ordered by score, then earliest valid submission for tied scores, giving exactly one first, second, and third place.
- An August 15, 2026 at 11:59 AM IST prize-email automation approval card was created with the updated podium emails and the FORMULA25/FORMULA40 non-winner email. It still needs user approval in Codex before it becomes active.

## GEO, Trust, and Privacy Wrap-Up

Date: 2026-07-25

Completed:

- Added and expanded `llms.txt`, `llms-full.txt`, crawler rules, visible FAQs, citation-friendly summaries, and Schema.org data for AI and answer-engine discovery.
- Added official Formula 1 citations for homepage speed, g-force, pit-stop, and 2026 calendar statistics.
- Added Open Graph site/locale metadata, `BreadcrumbList`, structured citations, and a student-author research and editorial-method section.
- Added `privacy.html`, `terms.html`, shared legal-page styling, sitemap entries, and homepage footer links.
- Added Vercel CSP, referrer, permissions, frame-protection, MIME-sniffing, and responsive-image cache headers.
- Added responsive image variants for the book cover and large character artwork, plus preconnect and deferred-script improvements.
- Removed email fields from the current GitHub leaderboard file and from all future GitHub leaderboard serialization.
- Replaced full game-submission logging with a restricted non-email summary. Email remains available for immediate receipt delivery and an explicitly configured private administrative webhook.

Validation performed:

- JavaScript syntax checks for the homepage and API files.
- JSON parsing for `vercel.json`, the leaderboard file, and all homepage/legal-page JSON-LD blocks.
- XML validation for `sitemap.xml`.
- Local asset-reference and `git diff --check` validation.
- Browser checks for homepage layout, metadata, structured data, responsive-image markup, Privacy, Terms, and console errors.
- Confirmed the current leaderboard file contains zero email fields.

Current state:

- Branch: `main`, tracking `origin/main`.
- Latest pushed code commit before this wrap-up: `0e474c1 Stop storing emails in public leaderboard data`.
- Production domain: `https://www.formularacingcamp.com`.
- Repository and remote matched before this notes-only wrap-up.
- No preview servers were found on ports `3000`, `4173`, `5173`, `8000`, `8080`, or `8787`.

Important follow-ups:

- Older public Git commits still contain the previously committed participant email. Purging it requires an explicitly approved history rewrite and coordinated force-push.
- Confirm Vercel production has deployed the latest `main` commits and verify the response security headers on the live domain.
- Replace the Tailwind browser CDN with a compiled local stylesheet if stricter CSP without `'unsafe-eval'` is desired.

## Analytics and Homepage Navigation Wrap-Up

Date: 2026-07-30

Completed:

- Added the deferred Vercel Web Analytics script to all eight public HTML entry points and verified the production script endpoint returns `200`.
- Reworked the homepage hero so the cover starts at the top, the glowing action buttons precede the book details, and official publication metadata appears in a quieter full-width row.
- Renamed the visible FAQ heading to `FAQs Section` and added in-site navigation links to the footer.
- Replaced the desktop section navigation with an all-screen hamburger drawer. The fixed header now exposes Preview, Puzzles, Discount Game, and Purchase actions at desktop, tablet, and mobile sizes.
- Corrected the hamburger close icon, added accessible menu state and Escape-key handling, and offset section anchors so headings remain visible below the fixed header.
- Kept the site on the framework-free analytics integration. The unused local `@vercel/analytics` package files are excluded through `.gitignore` and `.vercelignore`.

Validation performed:

- JavaScript syntax checks, JSON parsing for `vercel.json`, and `git diff --check`.
- Desktop, tablet, and mobile browser checks for header layout, hamburger behavior, fixed positioning, anchor offsets, footer navigation, button placement, and horizontal overflow.
- Verified the live production HTML and CSS contain the final header, FAQ, analytics, and responsive-navigation changes.

Current state:

- Branch: `main`, tracking `origin/main`.
- Latest pushed commit before this wrap-up: `d9200f7 Ignore unused analytics package files`.
- Latest manual Vercel production deployment: `99976f0 Polish fixed header interactions`, aliased to `https://www.formularacingcamp.com`.
- The two later ignore-only commits do not alter the public site output.

Next steps:

- Confirm Web Analytics begins reporting after eligible human visits; automated or headless verification visits are intentionally excluded.
- Keep the direct script while the site remains static. If custom button events are later required, evaluate Vercel Pro and an intentional `@vercel/analytics` bundling setup.
- Consider replacing the Tailwind browser CDN with a compiled local stylesheet if stricter CSP without `'unsafe-eval'` is desired.

## Cover, Error Page, and Private Analytics Pause

Date: 2026-07-31

Completed today:

- Enlarged the homepage book cover without changing the accompanying text layout.
- Added the racing-themed custom 404 page, responsive light/dark mode support, remembered theme selection, and homepage navigation.
- Replaced the site, favicon, social-preview, and app-icon artwork with transparent-background Formula Racing Camp assets, including WebP variants where supported.
- Added the private `/analytics` dashboard with password and API authentication, 7/30/90-day filters, traffic totals, daily chart, pages, referrers, devices, browsers, and tracked outbound actions.
- Confirmed the Vercel team is on Hobby. Removed all custom-event calls and custom-event API queries because Hobby does not support them.
- Added browser-recorded transition pages for `/go/book/`, `/go/puzzles/`, and `/go/youtube/`; each has a visible Continue link, automatic continuation, and the standard Vercel Web Analytics script.
- Limited the dashboard API to the official visits aggregate, official dimensions, and limits of at most 100. Production never displays sample data; localhost sample data is explicitly labeled.
- Added automated analytics/authentication/route/noindex tests and updated the privacy disclosure.

Validation performed:

- `npm test`: 8 tests passed.
- `npx vercel build`: passed.
- `git diff --check`: passed before the day-end notes update.
- Desktop and mobile local browser QA passed for the dashboard, transitions, and all date filters.
- Production checks confirmed `/analytics` returns `200` with private/no-store and `X-Robots-Tag`, the unauthenticated API returns `401`, and all three transition pages return `200`.
- The exact Web Analytics queries succeeded through the authenticated Vercel CLI for `day`, `requestPath`, `referrerHostname`, `deviceType`, `browserName`, and the three action-route filters.

Production and credential state:

- Latest production deployment completed and was aliased to `https://www.formularacingcamp.com`.
- `ANALYTICS_DASHBOARD_PASSWORD`, `VERCEL_ANALYTICS_TOKEN`, `VERCEL_ANALYTICS_PROJECT_ID`, and `VERCEL_ANALYTICS_TEAM_ID` remain server-side Vercel Production variables; no values are committed.
- The final token is scoped specifically to the `Nithilan Vivek` team and the `formularacingcamp-com` project. The temporary unused full-account token was permanently deleted.
- Earlier authenticated dashboard checks still returned Vercel `Not authorized` before the correctly project-scoped token was deployed. The final deployment completed after the user chose to pause, so its authenticated data response has not yet been verified.

Current state:

- Branch: `main`, tracking `origin/main`.
- Local preview on port `4174` was stopped.
- Work is paused for today and should resume with production verification tomorrow.

Exact resume point:

1. Open `https://www.formularacingcamp.com/analytics`, sign in, and confirm the status changes to real production data or `Waiting for more visitor data` without a 502 error.
2. If it still fails, inspect the latest `/api/analytics-data` function log. The previously observed upstream message was `Not authorized`; do not recreate custom events or add production sample data.
3. Confirm `/go/book/`, `/go/puzzles/`, and `/go/youtube/` begin appearing after eligible human page views; Vercel detail panels may lag totals by a few days.

## Header Purchase Flip Wrap-Up

Date: 2026-08-04

Completed:

- Replaced the header Purchase anchor with a compact Buy Book flip control matching the homepage retailer interaction.
- Added direct Amazon print, Amazon Kindle, Flipkart, and Notion Press options to the flipped header panel.
- Made the other header actions temporarily hide while the retailer panel is open, then return on outside click or Escape.
- Kept the header retailer panel on one compact row at mobile sizes and prevented horizontal overflow.
- Generalized the purchase interaction so the header and homepage controls share open, close, accessibility, and analytics behavior.

Validation performed:

- `npm test`: 15 tests passed.
- `node --check app.js` and `git diff --check` passed.
- Local browser checks passed at desktop and phone widths for flipping, responsive sizing, action hiding/restoration, outside-click closing, and horizontal overflow.

Current state:

- Branch: `main`, tracking `origin/main`.
- Latest pushed code commit before this wrap-up: `51f1ea8 Add retailer flip to header purchase button`.
- Remote: `https://github.com/nithilanvivek/formularacingcamp.com.git`.
- Production domain: `https://www.formularacingcamp.com`.
- The temporary local preview server on port `4173` was stopped.

Next step:

- Confirm the production deployment has picked up `51f1ea8` and spot-check the header retailer flip on the live desktop and mobile site.

## Preview Reader Analytics Wrap-Up

Date: 2026-08-04

Completed:

- Added a dedicated Preview readers card to the private analytics dashboard.
- The metric uses Vercel Web Analytics visitors for `/preview` within the selected 7, 30, or 90-day range.
- Labeled the card as visitors who opened the preview so it does not imply that analytics can verify every PDF page was read.
- Added cache-busted dashboard assets and automated coverage for the dashboard card, sample payload, production query filter, and returned preview totals.

Validation performed:

- `npm test`: 16 tests passed.
- JavaScript syntax checks passed for the analytics API, access page, and dashboard client.
- `git diff --check` passed.
- No preview servers were found on ports `3000`, `4173`, `5173`, `8000`, `8080`, or `8787`.

Current state:

- Branch: `main`, tracking `origin/main`.
- Latest analytics implementation commit: `0a01206 Add preview readers to analytics`.
- Remote: `https://github.com/nithilanvivek/formularacingcamp.com.git`.
- Production domain: `https://www.formularacingcamp.com`.

Next step:

- Confirm production deploys `0a01206`, then sign in at `https://www.formularacingcamp.com/analytics` and verify Preview readers returns the live `/preview` visitor count for each date range.

## Progressive Preview Performance Wrap-Up

Date: 2026-08-06

Completed:

- Replaced the immediate 17.4 MB embedded preview PDF with a 13-page WebP reader.
- Configured the first page for eager loading and the remaining pages for native lazy loading, with intrinsic dimensions and deferred off-screen rendering.
- Reduced the complete WebP page set to about 1.32 MB and the optional web-linearized PDF to about 1.54 MB.
- Added immutable caching for the preview-page WebP assets and week-long shared caching for the PDF fallback.
- Pushed code commit `62bf872 Render book preview as optimized page images` to `main`.
- Deployed Vercel production deployment `dpl_294KqGxSn37yerGceFZtcpTMqnaY`, aliased to `https://www.formularacingcamp.com`.

Validation performed:

- `npm test`: 16 tests passed.
- `qpdf` syntax and linearization checks passed for the optimized PDF.
- Confirmed all 13 WebP references exist, use the expected dimensions, and configure lazy loading after the first page.
- Local desktop and mobile browser checks passed with no horizontal overflow or console errors.
- Verified the production preview returns `200`, the first WebP is served as `image/webp` with immutable caching, and the PDF is served as `application/pdf` with the configured cache policy.

Current state:

- Branch: `main`, tracking `origin/main`.
- Production preview: `https://www.formularacingcamp.com/preview`.
- Production deployment state: `READY`.

Next steps:

- Monitor the private Preview readers analytics card after eligible human visits.
- Consider replacing the homepage Tailwind browser CDN with compiled local CSS if further first-load improvements are needed.

## 404 Pit Lane Game Wrap-Up

Date: 2026-08-21

Completed:

- Added a glowing `Play 404 Game` action between the Go back and Back to home controls on the custom error page.
- Built the Slipstream Collector canvas game with an F1 car, a growing trail, themed tyre, helmet, trophy, fuel, and chequered-flag pickups, scoring, replay, pausing, and locally remembered best scores.
- Added keyboard, touch-button, and swipe steering, including dominant-axis gesture detection and short-tap rejection.
- Added responsive modal layout, reduced-motion handling, background focus isolation, focus restoration, and mobile-friendly controls.
- Improved the tyre and helmet artwork for clearer small-scale recognition.
- Made race-over copy distinguish barrier collisions from crashes into the player's own slipstream.

Validation performed:

- Parsed every inline script in `404.html` with Node.js.
- `npm test`: 16 tests passed.
- `vercel build`: completed successfully.
- `git diff --check`: passed.
- Desktop and 390-by-844 mobile browser checks passed for layout, opening and closing, start, steering, pause and resume, collision, replay, focus handling, and console errors.

Current state:

- Branch: `main`, tracking `origin/main`.
- Remote: `https://github.com/nithilanvivek/formularacingcamp.com.git`.
- Production target: `https://www.formularacingcamp.com` through the linked Vercel project `formularacingcamp-com`.
- No project preview servers were found on common ports during wrap-up.

Next step:

- Monitor production 404-game behavior on real touch devices after deployment.

## Contact Protection and Security Testing Wrap-Up

Date: 2026-09-06

Completed:

- Replaced the homepage contact form's basic protection with Cloudflare Turnstile Managed, including explicit client rendering and mandatory server-side token, action, and hostname verification.
- Added a fail-closed rolling rate limit of five successful contact messages per 24 hours. Limits apply independently to HMAC-protected public-IP and normalized-email identifiers stored in the existing Upstash Redis/Vercel KV database; failed Resend deliveries are rolled back.
- Added clear client feedback for expired or failed verification, unavailable anti-abuse storage, and rate-limited submissions.
- Updated the privacy policy and README with the anti-abuse data handling, 24-hour retention, configuration, and failure behavior.
- Deployed the contact protection to Vercel production deployment `dpl_75W8VGTrW3sRSWCzz8bGiP3yH5ka`, aliased to `https://www.formularacingcamp.com`.
- Added a localhost-only visible-browser security demo under `security-demo/`, excluded it from Vercel deployments, and added repeated sequential runs plus an immediate Stop Attempt control.
- Retargeted the local demo to `https://nithi.land/contact/`. The fixed test leaves its honeypot empty, performs one automated Turnstile checkbox click, records the decision, and never reads verification tokens.
- Confirmed in a live controlled test that nithi.land Turnstile rejected the automated checkbox click, kept Send disabled, and sent no email.

Validation performed:

- `npm test`: 32 tests passed.
- JavaScript syntax checks passed for the homepage, contact API, Redis rate limiter, and localhost security-demo scripts.
- `git diff --check` passed during implementation.
- Verified the production Formula Racing Camp JavaScript and privacy notice contained the deployed rate-limit behavior.
- Verified the required production `TURNSTILE_*`, `KV_REST_API_*`, and `RESEND_API_KEY` variable names are present without exposing their values.

Current state:

- Branch: `main`, tracking `origin/main`.
- Latest feature commit before this wrap-up: `8e5000a Retarget contact security demo to nithi.land`.
- Production domain: `https://www.formularacingcamp.com`.
- The security demo is local tooling only and is not part of the production deployment.

Next steps:

- Monitor real contact traffic and Redis usage; adjust the five-per-24-hours limit only if legitimate shared-network users are affected.
- Treat Turnstile as one anti-abuse layer rather than proof of humanity; retain server verification and rate limiting.
- If nithi.land later receives unwanted contact spam, add an independent server-side rate limit in that site's own repository.

## Background Tab Title Wrap-Up

Date: 2026-09-07

- Added `assets/tab-title.js` to all 11 public HTML entry points, including transition pages and the custom 404 page. Hidden tabs show “🏎️ Race Back!”; visible tabs restore their original page title. Background loading is handled immediately.
- Validation: all 32 existing tests passed; JavaScript syntax and whitespace checks passed. A runtime simulation verified initial foreground/background loading, repeated switches, and title restoration.
- Feature commit `61bd99f` is pushed to `origin/main`. Vercel production deployment `dpl_Vp3tog7LbJzzUsqrjonRN6CXnqFr` reached `READY` and is aliased to `https://www.formularacingcamp.com`.
- Live checks confirmed the script reference on the homepage and nine other routes; the deployed script exactly matches the validated local file.
- No local preview servers were started or found during wrap-up. README and session notes are excluded from deployment, so the documentation wrap-up needs no redeployment.
- No outstanding follow-up for this change.

## Launch Game Page Removal

Date: 2026-09-11

- Removed `game.html` and its browser script `launch-game.js`; `/game` and `/game.html` now resolve to the site's 404 response. Removed the old game redirect/header and leaderboard links to the removed page.
- Retained the historical leaderboard, shared stylesheet, existing APIs, and stored results. The separate 404-page mini-game is unaffected.
- Updated the retirement checks and README for the removed route. All 32 tests and `git diff --check` passed.
- Feature commit `a589dce` is pushed to `origin/main`. Vercel production deployment `dpl_BoFW7CVpqCzifRCy5tt6mP2VSEzC` reached `READY`, aliased to `https://www.formularacingcamp.com`.
- Verified live: `/game`, `/game.html`, `/game/`, and `/launch-game.js` return 404; `/`, `/puzzles`, and `/game-leaderboard` return 200. The leaderboard no longer links to `/game`.
- No local preview servers were started or found during wrap-up. No outstanding follow-up for this removal; the documentation-only wrap-up needs no redeployment.

## Headless Browser Testing

Date: 2026-09-20

- Inspected the test entry points: `npm test` uses Node's built-in runner without launching a browser; `security-demo/server.js` is the only browser launcher in the repository.
- Set the security demo to `--headless=new`, removed `--new-window`, and updated its UI, logs, and README. Existing confirmation, fixed inputs, sequential attempts, and cleanup remain in place.
- Added `AGENTS.md` requiring headless browser tests and automated checks in future sessions. Installed browser bundles and macOS settings were not changed.
- Validation: all 32 tests passed; `node --check` passed for both changed JavaScript files; `git diff --check` passed. The live demo was not run because it can send a real email.
- Branch: `main`, tracking `origin/main` at `https://github.com/nithilanvivek/formularacingcamp.com.git`; these changes are being committed and pushed as the session wrap-up.
- No local preview servers were started for this session or found on common preview ports. The security demo is excluded from Vercel deployment; no production deployment was performed or verified this session.
- Next step: retain headless mode for future browser checks and use screenshots, traces, or logs for debugging.

### Follow-up: dedicated headless shell

- The full macOS Chrome app could still leave Dock icons when launched headlessly. Replaced the desktop-browser search and `--headless=new` launch with Playwright's dedicated Chromium headless shell, with no desktop-browser fallback or executable override.
- Added a pinned Playwright development dependency, tracked npm manifests, `npm run browsers:install`, and an offline `npm run test:browser` check. Updated README and AGENTS.md to require the dedicated shell.
- Browser sessions now close after success, failure, or Stop. A stopped launch is cleaned up before another attempt is accepted; the fixed contact flow and confirmation remain intact.
- Validation: 35 Node tests passed, including cancellation/failure/completion cleanup checks; the offline browser smoke test passed for navigation, typing, clicking, screenshots, and close. Syntax and whitespace checks passed. No live contact submission was performed.
- Verified standalone shell processes for both this project and `nithi.land` with macOS NSWorkspace: activation policy 1 (accessory), with no new regular Chrome Dock application. The other project's ongoing task updated its Playwright configuration and AGENTS.md concurrently; those edits were preserved and inspected.
- Ran `nithi.land`'s existing homepage tests: 12 passed, two failed because Microsoft Store badges expose buttons while the tests expect links. Confirmed the external badge script loaded successfully and its shadow DOM contains `role="button"`; those unrelated assertions were left unchanged.
- Installed both projects' matching shells. The older `nithi.land` Playwright installer stalled under Node 24; retrying the official installer with temporary Node 22 completed successfully. Installed browser application bundles and macOS settings were not changed.
- Session wrap-up: committing and pushing these changes on `main` to `origin/main`. The browser checks closed their sessions and temporary servers; no project preview listeners remained. No production deployment was performed or verified.
- Follow-up: update the unrelated Microsoft Store badge selectors in `nithi.land` when maintaining that suite; keep using the dedicated shell for all browser checks.
