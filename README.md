# Formula Racing Camp Website

Static website workspace for the **Formula Racing Camp** book, an educational racing book for kids that blends Formula 1 with science, engineering, history, geography, mathematics, puzzles, and character-driven learning.

## Current Project State

The website has been converted from the original Canva AI Code exports into a standard static structure:

- `index.html` - page markup and content.
- `styles.css` - extracted site styles.
- `app.js` - mobile menu, contact form, and icon initialization.
- `puzzles.html` - Formula Racing Camp puzzles page, available at `/puzzles`.
- `puzzles.css` - extracted puzzles page styles.
- `puzzles.js` - crossword, Wordle-style game, and quiz behavior.
- `preview.html` - progressive WebP book preview with an optimized PDF fallback, available at `/preview`.
- `game.html` - Launch Grand Prix game page, available at `/game`.
- `404.html` - custom error page with a built-in F1-themed collection game.
- `launch-game.css` - Launch Grand Prix styles.
- `launch-game.js` - Launch Grand Prix browser game logic and test-mode handling.
- `api/launch-game-submit.js` - Vercel Function endpoint for launch game submissions and review flags.
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

The current deployable entry point is `index.html`, with the puzzles page available through `/puzzles`. The retired launch-week game remains available only by its direct `/game` URL and is excluded from public navigation and search indexing.

## Latest Session State

As of 2026-08-21:

- Production domain is `https://www.formularacingcamp.com`.
- `https://formularacingcamp.com` redirects to the `www` domain.
- Home page title and hero copy now use "Formula Racing Camp: Learning In The Fast Lane".
- The subscribe bar has been removed.
- Header navigation includes a "Get in Touch" link.
- Authors copy says the group is made up of middle school students from Bengaluru, Karnataka, India.
- The puzzles page is wired at `/puzzles`.
- The retired Launch Grand Prix remains available at the unlisted `/game` route with `noindex, nofollow` directives.
- Launch Grand Prix now uses a six-screen flow, explicit one-attempt rules, player-clicked screen transitions with car-zip animation, a faster fixed Pit Lane Dash item script, and an expanded strategy decision level without a shareable final code.
- The launch game has a high-visibility tab/window/browser-tool disqualification flash and a viewport-responsive launch hero for laptop screen sizes.
- Disqualified game runs return to the homepage, and the score strip is placed in reserved layout space so it does not cover controls.
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
- Contact form that submits through `/api/contact-submit` and sends mail with Reply-To set to the visitor's submitted email.

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
game.html
launch-game.css
launch-game.js
api/
assets/
vercel.json
.vercelignore
README.md
session-notes.md
```

Homepage images are served from local optimized WebP files in `assets/site/` and `assets/characters/` to keep the page fast.

The preview reader serves its pages from `assets/site/preview-pages/`. Only the first page is requested eagerly; later pages lazy-load as the reader scrolls. `assets/site/formula-racing-camp-book-preview.pdf` remains available as a compact PDF alternative.

## AI and Answer Engine Discovery

The site exposes a concise `/llms.txt` guide and an expanded `/llms-full.txt` reference. The home page also contains visible answer-focused FAQs with matching Schema.org `FAQPage` data, while the preview, puzzles, and game pages include page-specific JSON-LD.

`robots.txt` explicitly allows OpenAI, Anthropic, Perplexity, Google Extended, and general crawlers. The wildcard rule also permits other standards-compliant crawlers. Change the individual rules if the project later needs a different policy for search retrieval versus model training.

## Deployment Notes

For GitHub Pages or most static hosts, the main entry file should be named `index.html` at the repository root. The contact form uses Formspree, so visitors can submit messages from the page without a custom backend.

## Vercel Deployment

This repository is ready to import into Vercel as a static site.

Recommended Vercel settings:

- Framework Preset: Other
- Build Command: leave blank
- Output Directory: leave blank
- Install Command: leave blank

The `vercel.json` file enables clean URLs, canonical redirects, caching, and site-wide security headers. The `.vercelignore` file keeps reference-only files out of the deployed public output.

Vercel Web Analytics is loaded directly from `/_vercel/insights/script.js` on every public HTML page. This static site does not require the `@vercel/analytics` npm package or a JavaScript build step. The unused local package files are excluded by both `.gitignore` and `.vercelignore`; if the project later adopts the package API, remove those exclusions and add an intentional bundling workflow.

With clean URLs enabled, `puzzles.html` is served at:

```text
https://www.formularacingcamp.com/puzzles
```

With clean URLs enabled, `game.html` is served at:

```text
https://www.formularacingcamp.com/game
```

Launch game submissions post to `/api/launch-game-submit`. To forward real entries to a durable destination, configure `LAUNCH_GAME_WEBHOOK_URL` in Vercel. Usernames beginning with `test_` remain separated internally from production entries, but the public leaderboard exposes only the main launch leaderboard.

The launch-game API can also save a leaderboard entry to `data/launch-game-leaderboard.json` through the GitHub Contents API. This file stores username, score, level scores, review status, bucket, and timestamps, but not email addresses. Because the repository is public, these stored leaderboard fields are public even though the raw JSON file is excluded from Vercel deployments by `.vercelignore`; the `vercel.json` not-found rewrite is retained as defense in depth. Submitted email addresses are used for receipts and may be sent to the configured private administrative webhook, but are not written into new GitHub leaderboard entries. Configure these Vercel environment variables to enable it:

- `LAUNCH_GAME_GITHUB_TOKEN` or `GITHUB_TOKEN`
- `GITHUB_OWNER`, default fallback: `nithilanvivek`
- `GITHUB_REPO`, default fallback: `formularacingcamp.com`
- `GITHUB_BRANCH`, default fallback: `main`
- `LAUNCH_GAME_LEADERBOARD_PATH`, default fallback: `data/launch-game-leaderboard.json`

Podium placements are calculated from the current leaderboard file only, so removed test entries do not count. Entries are ordered by score, then earliest valid submission for tied scores. First place receives a free book and must reply with a delivery address. Second place receives separate one-time Notion Press codes for 50% off paperback and 59% off hardcover. Third place receives separate one-time codes for 40% off paperback and 49% off hardcover. Second- and third-place winners may buy both editions, but each edition code works only once. Keep the unique winner codes outside public repository files.

Player receipt emails are sent through Resend after valid, non-dry-run submissions. Configure these Vercel environment variables before relying on receipts:

- `RESEND_API_KEY`
- `LAUNCH_GAME_EMAIL_FROM`, default fallback: `Formula Racing Camp <game@formularacingcamp.com>`
- `LAUNCH_GAME_ADMIN_EMAIL`, optional comma-separated BCC recipients

Player receipt emails always use `authors@formularacingcamp.com` as Reply-To.

The homepage contact form also uses Resend through `/api/contact-submit`. It sends messages to `CONTACT_TO`, falling back to `LAUNCH_GAME_REPLY_TO` and then `authors@formularacingcamp.com`, with `reply_to` set to the visitor's email.

## Near-Term Tasks

1. Confirm remaining CTA destinations: buy link, puzzles, YouTube, and contact email.
2. Configure the GitHub leaderboard token before broad launch-game testing.
3. Configure the launch game submission webhook before judging real winners.
4. Configure Resend receipt-email environment variables before broad launch-game testing.
5. After August 15, ask the first-place winner for a delivery address and send the unique second- and third-place codes in the email body without attaching the source CSV files.
6. Verify the launch-week game on production Chrome/Safari after deployment.
7. Consider replacing the Tailwind CDN with a build step if the project grows.
