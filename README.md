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
- `vercel.json` - static hosting rules, clean URLs, canonical redirect, and headers.
- `.vercelignore` - excludes reference-only files from deployment.
- `formularacingcamp.html` - original Canva/Cocoa export kept as a reference source.

The current deployable entry point is `index.html`, with the puzzles page available through the clean URL `/puzzles`.

## Latest Session State

As of 2026-07-02:

- Production domain is `https://www.formularacingcamp.com`.
- `https://formularacingcamp.com` redirects to the `www` domain.
- Home page title and hero copy now use "Formula Racing Camp: Learning In The Fast Lane".
- The subscribe bar has been removed.
- Header navigation includes a "Get in Touch" link.
- Authors copy says the group is made up of middle school students from Bengaluru, Karnataka, India.
- The puzzles page is wired at `/puzzles`.
- The Wordle-style puzzle now colors submitted row tiles as well as keyboard letters.

## Site Content

The exported page includes:

- A ticker/banner noting that buying and previewing are not yet active.
- Navigation for About, Chapters, What's Inside, Characters, and Authors.
- Hero section with book cover, title, subtitle, description, and CTAs.
- Local puzzles page linked from the hero CTA.
- About section explaining the learning focus.
- Table of contents with chapter/category cards.
- "What's Inside" section covering F1 history, cars, drivers, circuits, activities, and statistics.
- "Did You Know?" fact section.
- Character profile section.
- Authors section for the student author group.
- Contact form that opens an email client.

## Dependencies

The page depends on remote/CDN resources:

- Tailwind CSS CDN.
- Google Fonts: Fredoka and Poppins.
- Lucide icons CDN.
- Images hosted on `i.ibb.co`.

Because these are loaded externally, the page needs internet access for the full visual experience.

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
vercel.json
.vercelignore
README.md
session-notes.md
```

An `assets/` directory is recommended later for local images, but it has not been created yet because the current page still references hosted images.

## Deployment Notes

For GitHub Pages or most static hosts, the main entry file should be named `index.html` at the repository root. After cleanup, the deployment target can remain fully static unless the contact feature needs a backend or form service.

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

## Near-Term Tasks

1. Confirm all CTA destinations: buy link, preview pages, puzzles, YouTube, and contact email.
2. Download or organize key image assets if the site should not depend on third-party image hosting.
3. Consider replacing the Tailwind CDN with a build step if the project grows.
