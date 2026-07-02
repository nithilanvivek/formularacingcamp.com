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
