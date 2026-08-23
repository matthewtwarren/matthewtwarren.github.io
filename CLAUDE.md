# CLAUDE.md

Personal website of Matt Warren, built with Hugo (extended) and the Terminal theme, deployed to GitHub Pages.

## Layout

```
config/_default/   Site config, split by concern (config, languages, menus, markup, params)
content/           Markdown content: _index.md (home), posts/, projects/, research/
layouts/           Local overrides of theme templates and custom shortcodes
assets/            Images and CSS processed by Hugo Pipes
static/            Favicons, webmanifest, style.css (copied verbatim to site root)
themes/terminal/   Active theme, a git submodule pinned at v4.2.3
themes/congo/      Previous theme, submodule left uninitialised
.github/workflows/ gh-pages.yml builds and deploys on push to main
public/            Build output, gitignored
```

Content pages are page bundles: `content/<section>/<slug>/index.md` alongside its own
`cover.jpg` / `thumb.jpg`. Section landing pages are `_index.md`.

## Commands

```
hugo server -D     Local preview at :1313, including drafts
hugo --minify      Production build into public/
```

Deployment is automatic: pushing to `main` triggers the workflow, which builds with
submodules and publishes `public/` to the `gh-pages` branch. Do not commit `public/`.

## Conventions

Front matter is YAML, keys in this order where present: `title`, `description`, `summary`,
`date`, `draft`, then display flags (`showDate`, `showReadingTime`, `showTableOfContents`).
Dates are `YYYY-MM-DD`. Projects hosted elsewhere use `externalUrl` instead of body content.

Prose is British English. Post bodies open with the `{{< lead >}}` shortcode carrying the
same text as `summary`.

Config files are TOML, two-space indent, commented with `# -- Section --` headers. Templates
and CSS use two-space indent. Keep CSS in `static/style.css`, grouped by component, using the
`--background` / `--foreground` / `--accent` custom properties defined at the top.

Shortcodes live in `layouts/shortcodes/`: `lead`, `alert`, `katex`, `youtube_caption`.

## Notes

- Theme overrides shadow theme files by path. Copy the file from `themes/terminal/layouts/`
  before editing rather than modifying the submodule.
- `themes/terminal` reports dirty (`yarn.lock`, `postcss.config.js`) from theme tooling. Leave
  it alone; do not commit submodule content changes.
- Some Congo leftovers remain and are inert under Terminal: `assets/css/custom.css`,
  `assets/css/schemes*`, `layouts/partials/home/custom.html`, `layouts/shortcodes/swatches.html`,
  and `cascade` display flags in the section `_index.md` files.
- The footer menu links to an `about` page that does not exist in `content/`.
- `baseURL` is commented out in `config.toml`; GitHub Pages serves the site at the repo root.
