# Repository Guidelines

## Project Structure & Module Organization
This repository hosts a **GitHub Pages personal website** composed primarily of static HTML and Markdown resources.

- Root directory: main website pages such as `index.html`, `leetcode.html`, `systemdesign.html`, and other topic pages.
- Documentation sources: Markdown files like `openclaw-tutorial.md`, `grok_system_design_interview_zh.md`, and `NANOCHAT_DOCUMENTATION.md`.
- Generated/reading pages: HTML versions such as `openclaw-tutorial.html` and `PI_MONO_EXPLAINED.html`.
- Assets and experiments: standalone HTML demos and design notes (e.g., `designpatterns.html`, `NewsFeed.html`).
- Worker script: `rss-proxy-worker.js` for RSS proxy functionality.

Keep new content in the repository root unless a clear grouping emerges (e.g., `docs/`, `assets/`). Avoid deep directory nesting.

## Build, Test, and Development Commands
The site is static and does not require a build system.

- Run locally:
  - `python3 -m http.server 8000`
  - Open `http://localhost:8000`
- Quick preview of a specific page:
  - `open index.html` (macOS) or open in any browser.
- Optional formatting:
  - `prettier --write "*.html"`

Changes pushed to the `main` branch are automatically served via GitHub Pages.

## Coding Style & Naming Conventions
- **Indentation:** 2 spaces for HTML, CSS, and JavaScript.
- **File names:** lowercase with hyphens when possible (`news-aggregator.html`).
- **HTML pages:** descriptive topic names (`systemdesign.html`, `leetcode.html`).
- **Markdown:** use clear headings and keep sections short for readability.
- **JavaScript:** keep scripts small and self‑contained; avoid unnecessary dependencies.

Prefer semantic HTML (`<section>`, `<article>`, `<nav>`) and readable inline documentation when logic is non‑trivial.

## Testing Guidelines
There is no automated test suite.

Before submitting changes:
- Open the modified page locally.
- Check console errors in the browser.
- Verify navigation links and layout render correctly.
- Confirm external resources (images, scripts, RSS endpoints) load successfully.

For JavaScript updates (e.g., `rss-proxy-worker.js`), verify expected responses using browser dev tools or `curl`.

## Commit & Pull Request Guidelines
Follow clear, concise commit messages.

Examples:
- `add system design notes page`
- `update openclaw tutorial formatting`
- `fix rss proxy worker headers`

Pull requests should include:
- A short description of the change
- Screenshots for visual updates (if applicable)
- Links to any related resources or notes

Keep PRs focused on a single logical change to simplify review.

## Content Guidelines
- Prefer **Markdown for long-form notes** and convert to HTML only when needed for presentation.
- Keep pages lightweight and readable.
- Avoid large external frameworks unless necessary.

The repository prioritizes clarity, fast loading, and easy browsing of technical notes.

