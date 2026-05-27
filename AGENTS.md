# Repository Guidelines

## Project Structure & Module Organization

ComprehensiveTools is a static, browser-only utility collection. The public entry point is `index.html`, with global styles in `css/base.css` and shared helpers in `utils/`.

Most features live under `pages/<tool>/` as standalone HTML, JavaScript, and CSS files. Examples include `pages/tax/`, `pages/mortgage/`, `pages/inventory/`, `pages/rehab-trainer/`, and `pages/travel-checklist/`. More complex tools split code by concern, such as `pages/inventory/js/data.js`, `ui.js`, `charts.js`, and `export.js`.

Uni-app scaffold files (`App.vue`, `main.js`, `pages.json`, `manifest.json`, `uni.scss`) remain in the repo, but the documented deployed app is the static web app. Static assets belong in `static/`.

## Build, Test, and Development Commands

There is no package manifest and no build step. Serve the repository root with any static HTTP server:

```bash
python3 -m http.server 8000
npx http-server -p 8000
php -S localhost:8000
```

Then open `http://localhost:8000/index.html`.

Run the Node-based utility tests with:

```bash
node --test
```

GitHub Pages deployment is handled by `.github/workflows/deploy.yml` on pushes to `main`; it uploads the repository contents directly.

## Coding Style & Naming Conventions

Use plain HTML, CSS, and ES6 JavaScript unless the existing page already uses another pattern. Match local formatting: 4-space indentation in JavaScript, descriptive camelCase function names, and kebab-case directories or CSS filenames.

Shared browser utilities are exposed as globals, such as `window.StorageKeys` and `window.CommonUtils`. Script order matters; load shared helpers before page-specific scripts that use them. Prefer centralized storage keys in `utils/storage-keys.js` over hard-coded `localStorage` strings.

## Testing Guidelines

Node tests live in `tests/` and use the built-in `node:test` runner. Name files `<feature>.test.js`, especially for shared utilities that can be tested outside a browser.

For page-level changes, also manually verify the affected tool through the local HTTP server, including persistence, import/export, mobile layout, and browser console errors where relevant.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes, often with Chinese summaries, for example `feat: 新增出行清单工具`, `fix: 全项目bug修复与优化`, and `docs: 更新项目说明与 Claude 指引`.

Pull requests should include a short description, affected pages, manual test steps, linked issues when available, and screenshots or screen recordings for visible UI changes.
