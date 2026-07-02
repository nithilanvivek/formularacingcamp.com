# Formula Racing Camp Website

Static website workspace for the **Formula Racing Camp** book, an educational racing book for kids that blends Formula 1 with science, engineering, history, geography, mathematics, puzzles, and character-driven learning.

## Current Project State

The website has been converted from the original Canva AI Code export into a standard static structure:

- `index.html` - page markup and content.
- `styles.css` - extracted site styles.
- `app.js` - mobile menu, contact form, subscription UI, and icon initialization.
- `formularacingcamp.html` - original Canva/Cocoa export kept as a reference source.

The current deployable entry point is `index.html`.

## Site Content

The exported page includes:

- A ticker/banner noting that buying and previewing are not yet active.
- Navigation for About, Chapters, What's Inside, Characters, and Authors.
- Hero section with book cover, title, subtitle, description, and CTAs.
- About section explaining the learning focus.
- Table of contents with chapter/category cards.
- "What's Inside" section covering F1 history, cars, drivers, circuits, activities, and statistics.
- "Did You Know?" fact section.
- Character profile section.
- Authors section for Ekya Book Writers.
- Contact form that opens an email client.
- Sticky subscription bar that currently stores emails only in local JavaScript memory.

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
```

An `assets/` directory is recommended later for local images, but it has not been created yet because the current page still references hosted images.

## Deployment Notes

For GitHub Pages or most static hosts, the main entry file should be named `index.html` at the repository root. After cleanup, the deployment target can remain fully static unless the subscription/contact features need a backend or form service.

## Near-Term Tasks

1. Confirm all CTA destinations: buy link, preview pages, puzzles, YouTube, and contact email.
2. Decide how subscriptions should be stored, since the current implementation does not persist them.
3. Download or organize key image assets if the site should not depend on third-party image hosting.
4. Consider replacing the Tailwind CDN with a build step if the project grows.
