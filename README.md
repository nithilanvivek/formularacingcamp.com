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
- `game.html` - Launch Grand Prix game page, available at `/game`.
- `launch-game.css` - Launch Grand Prix styles.
- `launch-game.js` - Launch Grand Prix browser game logic and test-mode handling.
- `api/launch-game-submit.js` - Vercel Function endpoint for launch game submissions and review flags.
- `assets/` - local optimized images, including the book cover and character bio WebP files.
- `vercel.json` - static hosting rules, clean URLs, canonical redirect, and headers.
- `.vercelignore` - excludes reference-only files from deployment.
- `formularacingcamp.html` - original Canva/Cocoa export kept as a reference source.

The current deployable entry point is `index.html`, with the puzzles page available through `/puzzles` and the launch-week game available through `/game`.

## Latest Session State

As of 2026-07-05:

- Production domain is `https://www.formularacingcamp.com`.
- `https://formularacingcamp.com` redirects to the `www` domain.
- Home page title and hero copy now use "Formula Racing Camp: Learning In The Fast Lane".
- The subscribe bar has been removed.
- Header navigation includes a "Get in Touch" link.
- Authors copy says the group is made up of middle school students from Bengaluru, Karnataka, India.
- The puzzles page is wired at `/puzzles`.
- The Launch Grand Prix game is wired at `/game`.
- The Wordle-style puzzle now colors submitted row tiles as well as keyboard letters.
- Homepage bitmap images are served from local optimized assets.

## Site Content

The exported page includes:

- A ticker/banner noting that buying and previewing are not yet active.
- Navigation for About, Chapters, What's Inside, Characters, and Authors.
- Hero section with book cover, title, subtitle, description, and CTAs.
- Local puzzles page linked from the hero CTA.
- Launch Grand Prix CTA for the first-week publishing game.
- About section explaining the learning focus.
- Table of contents with chapter/category cards.
- "What's Inside" section covering F1 history, cars, drivers, circuits, activities, and statistics.
- "Did You Know?" fact section.
- Character profile section.
- Authors section for the student author group.
- Contact form that submits messages through Formspree without opening an email client.

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

## Deployment Notes

For GitHub Pages or most static hosts, the main entry file should be named `index.html` at the repository root. The contact form uses Formspree, so visitors can submit messages from the page without a custom backend.

## Vercel Deployment

This repository is ready to import into Vercel as a static site.

Recommended Vercel settings:

- Framework Preset: Other
- Build Command: leave blank
- Output Directory: leave blank
- Install Command: leave blank

The `vercel.json` file enables clean URLs and a basic security header. The `.vercelignore` file keeps reference-only files out of the deployed public output.

With clean URLs enabled, `puzzles.html` is served at:

```text
https://www.formularacingcamp.com/puzzles
```

With clean URLs enabled, `game.html` is served at:

```text
https://www.formularacingcamp.com/game
```

Launch game submissions post to `/api/launch-game-submit`. To forward real entries to a durable destination, configure `LAUNCH_GAME_WEBHOOK_URL` in Vercel.

## Near-Term Tasks

1. Confirm all CTA destinations: buy link, preview pages, puzzles, YouTube, and contact email.
2. Configure the launch game submission webhook before judging real winners.
3. Confirm Amazon promo code fulfillment copy and winner email workflow.
4. Consider replacing the Tailwind CDN with a build step if the project grows.
