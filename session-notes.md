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
