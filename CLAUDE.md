# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComprehensiveTools is a static, browser-only collection of utility pages. The root `index.html` is the public landing page, and most tools live as standalone HTML pages under `pages/<tool>/` with plain JavaScript and CSS loaded by `<script>`/`<link>` tags.

The repository also contains uni-app scaffold files (`App.vue`, `main.js`, `pages.json`), but the documented and deployed app is the static web app served from `index.html`.

## Common Commands

There is no `package.json` and no build step in the current repository.

Run locally with any static HTTP server from the repository root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html
```

Alternative local servers documented in `README.md`:

```bash
npx http-server -p 8000
php -S localhost:8000
```

Run all tests:

```bash
node --test
```

Run the current single test file:

```bash
node --test tests/form-import-export.test.js
```

Deployment is handled by `.github/workflows/deploy.yml`, which uploads the repository contents directly to GitHub Pages on pushes to `main`.

## Architecture Notes

- `index.html` links to each tool page and uses shared styling from `css/base.css`.
- Shared browser utilities are exposed as globals:
  - `utils/storage-keys.js` defines `window.StorageKeys` for localStorage key names.
  - `utils/common.js` defines `window.CommonUtils` helpers for DOM values, formatting, notifications, and localStorage JSON access.
  - `utils/form-import-export.js` uses a UMD-style wrapper so it works both as `window.FormImportExport` in the browser and as `require('../utils/form-import-export.js')` in Node tests.
- Tool pages generally persist state to `localStorage`. Prefer using `StorageKeys` and `CommonUtils` where a page already loads them, while preserving existing fallback behavior if the page has it.
- Several calculator tools are split into one HTML file plus adjacent JavaScript modules. For example, pension and retirement calculators separate storage logic from calculation/rendering scripts.
- More complex tools have their own sub-architecture:
  - `pages/inventory/` splits CSS and JavaScript into modules for data, UI, modals, charts, export, and initialization. It relies on CDN libraries including Chart.js, pinyin-pro, and xlsx.
  - `pages/rehab-trainer/` splits storage, audio, timer, wake-lock, and main app logic. It uses Bootstrap from CDN and browser Web Speech API for voice prompts.
- Script order matters because most modules attach globals rather than using ES modules. When adding shared dependencies to a page, load `storage-keys.js` and `common.js` before page-specific scripts that reference them.

## External Assets and Browser APIs

The app is static and depends on browser APIs and CDN scripts rather than a bundler:

- localStorage for persistence
- Chart.js for charts in inventory and retirement planning
- Web Speech API in the rehab trainer
- Bootstrap in the rehab trainer
- pinyin-pro and xlsx in inventory management

Use an HTTP server instead of `file://` when manually testing, because README notes mobile browsers can restrict some functionality under `file://`.

## Documentation Caveats

`README.md` is useful for the product overview and local serving instructions, but parts of its project tree are stale: it references `CONTRIBUTING.md`, which is not present in the current repository. There are no Cursor rules or Copilot instructions in the repository at the time this file was created.
