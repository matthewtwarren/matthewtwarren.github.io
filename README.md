# matthewtwarren.github.io

Source for my personal website: posts, projects and research.

Built with [Hugo](https://gohugo.io) (extended) and the
[Terminal](https://github.com/panr/hugo-theme-terminal) theme.

## Structure

```
config/_default/   Site configuration
content/           Posts, projects and research, as Markdown page bundles
layouts/           Template overrides and shortcodes
assets/            Images and CSS processed by Hugo
static/            Favicons and custom stylesheet
themes/            Theme submodules
```

## Running locally

```
git clone --recurse-submodules https://github.com/matthewtwarren/matthewtwarren.github.io.git
cd matthewtwarren.github.io
hugo server -D
```

The site is served at http://localhost:1313.

## Deployment

Pushing to `main` runs the GitHub Actions workflow in `.github/workflows/gh-pages.yml`, which
builds the site and publishes it to the `gh-pages` branch.

## Licence

Site content © Matt Warren. Theme licensed under MIT by its author.
