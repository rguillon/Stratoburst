# Stratoburst
Python based web shoot them up

Play it: https://rguillon.github.io/Stratoburst/

Every push to `main` runs the quality gate (`make lint test build`) and, when green, deploys `dist/` to the
`gh-pages` branch. Pull requests from this repository get a preview under `pr-preview/pr-<N>/`.

Developer commands live in the `Makefile`; run `make` to list them. Useful ones for deployment checks:

- `make live-url` prints the GitHub Pages URL derived from the `origin` remote.
- `make wait-deploy` waits until the Deploy run for the current commit succeeded and the page is live.
- `make e2e-live` runs the Playwright smoke spec against the live site.
