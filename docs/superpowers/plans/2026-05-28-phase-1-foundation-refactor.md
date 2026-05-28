# Phase 1 Foundation Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish shared CSS components, shared tool layout styles, and a tested storage service without changing existing page URLs or localStorage keys.

**Architecture:** Keep `css/base.css` focused on tokens/reset/global primitives. Add `css/components.css` for reusable UI components and `css/tool-layout.css` for common tool-page structure, then migrate a small first batch of pages to load and use them. Add `utils/storage-service.js` as a browser global plus CommonJS export for tests, and migrate low-risk pages incrementally.

**Tech Stack:** Static HTML, CSS, ES6 JavaScript, CommonJS-compatible utility exports for Node tests, Node built-in `node:test`, Python static HTTP server.

---

## File Map

- Create `css/components.css`: reusable buttons, cards, form controls, toast/dialog shell, empty states, utility classes.
- Create `css/tool-layout.css`: reusable tool page container/header/content layout classes.
- Create `utils/storage-service.js`: safe JSON localStorage wrapper exposed as `window.StorageService` and `module.exports`.
- Create `tests/storage-service.test.js`: unit tests for storage parsing, read/write/remove, and quota detection.
- Modify `index.html`: load shared CSS.
- Modify `pages/meal/mealViewer.html`: load shared CSS, use shared return/layout classes for static visible markup.
- Modify `pages/travel-checklist/travelChecklist.html`: load shared CSS.
- Modify `pages/finance/financeCalculator.html`: load shared CSS and use shared return link class.
- Modify `pages/mortgage/mortgageCalculator.html`: load shared CSS and use shared return link class.
- Modify `pages/pension-calculator/calculator-storage.js`: migrate JSON read/write/remove to `StorageService`.
- Modify `pages/retirement-calculator/calculator-storage.js`: migrate JSON read/write/remove to `StorageService`.
- Modify affected HTML script order: load `utils/storage-service.js` before page scripts that use it.

## Task 1: Storage Service Tests First

**Files:**
- Create: `tests/storage-service.test.js`
- Read: `utils/common.js`
- Read: `utils/storage-keys.js`

- [ ] **Step 1: Write failing storage service tests**

Create `tests/storage-service.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
        clear() {
            data.clear();
        }
    };
}

test('safeParseJson returns parsed JSON for valid input', () => {
    const { safeParseJson } = require('../utils/storage-service.js');
    assert.deepEqual(safeParseJson('{"name":"工具"}', {}), { name: '工具' });
});

test('safeParseJson returns fallback for invalid input', () => {
    const { safeParseJson } = require('../utils/storage-service.js');
    assert.deepEqual(safeParseJson('{bad json', { ok: false }), { ok: false });
});

test('getJson reads JSON and falls back for missing or broken values', () => {
    const storage = createMemoryStorage();
    const service = require('../utils/storage-service.js').createStorageService(storage);

    assert.deepEqual(service.getJson('missing', []), []);

    storage.setItem('broken', '{bad');
    assert.deepEqual(service.getJson('broken', { fallback: true }), { fallback: true });

    storage.setItem('valid', '{"count":2}');
    assert.deepEqual(service.getJson('valid', null), { count: 2 });
});

test('setJson and remove return structured results', () => {
    const storage = createMemoryStorage();
    const service = require('../utils/storage-service.js').createStorageService(storage);

    assert.deepEqual(service.setJson('sample', { saved: true }), { ok: true });
    assert.equal(storage.getItem('sample'), '{"saved":true}');

    assert.deepEqual(service.remove('sample'), { ok: true });
    assert.equal(storage.getItem('sample'), null);
});

test('setJson reports quota exceeded errors', () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const storage = {
        getItem() { return null; },
        setItem() { throw quotaError; },
        removeItem() {}
    };
    const service = require('../utils/storage-service.js').createStorageService(storage);

    const result = service.setJson('sample', { too: 'large' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'quota-exceeded');
    assert.equal(service.isQuotaExceeded(quotaError), true);
});
```

- [ ] **Step 2: Verify tests fail before implementation**

Run:

```bash
node --test tests/storage-service.test.js
```

Expected: FAIL with `Cannot find module '../utils/storage-service.js'`.

- [ ] **Step 3: Commit is not required**

Do not commit failing tests alone.

## Task 2: Implement Storage Service

**Files:**
- Create: `utils/storage-service.js`
- Test: `tests/storage-service.test.js`

- [ ] **Step 1: Implement `utils/storage-service.js`**

Create `utils/storage-service.js`:

```js
(function (global) {
    'use strict';

    function safeParseJson(raw, fallback) {
        if (raw === null || raw === undefined || raw === '') {
            return fallback;
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            if (global.console && typeof global.console.warn === 'function') {
                global.console.warn('Failed to parse stored JSON:', error);
            }
            return fallback;
        }
    }

    function isQuotaExceeded(error) {
        return Boolean(error && (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22 ||
            error.code === 1014
        ));
    }

    function createStorageService(storage) {
        function getJson(key, fallback) {
            try {
                return safeParseJson(storage.getItem(key), fallback);
            } catch (error) {
                if (global.console && typeof global.console.warn === 'function') {
                    global.console.warn(`Failed to read storage key ${key}:`, error);
                }
                return fallback;
            }
        }

        function setJson(key, value) {
            try {
                storage.setItem(key, JSON.stringify(value));
                return { ok: true };
            } catch (error) {
                if (global.console && typeof global.console.warn === 'function') {
                    global.console.warn(`Failed to write storage key ${key}:`, error);
                }
                return {
                    ok: false,
                    reason: isQuotaExceeded(error) ? 'quota-exceeded' : 'write-failed',
                    error
                };
            }
        }

        function remove(key) {
            try {
                storage.removeItem(key);
                return { ok: true };
            } catch (error) {
                if (global.console && typeof global.console.warn === 'function') {
                    global.console.warn(`Failed to remove storage key ${key}:`, error);
                }
                return { ok: false, reason: 'remove-failed', error };
            }
        }

        return {
            getJson,
            setJson,
            remove,
            safeParseJson,
            isQuotaExceeded
        };
    }

    const defaultStorage = global.localStorage || {
        getItem() { return null; },
        setItem() {},
        removeItem() {}
    };

    const api = {
        createStorageService,
        safeParseJson,
        isQuotaExceeded,
        ...createStorageService(defaultStorage)
    };

    global.StorageService = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: Verify storage tests pass**

Run:

```bash
node --test tests/storage-service.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 3: Verify full tests pass**

Run:

```bash
node --test
```

Expected: all existing tests plus storage-service tests pass.

- [ ] **Step 4: Commit**

```bash
git add utils/storage-service.js tests/storage-service.test.js
git commit -m "feat: 增加统一存储服务"
```

## Task 3: Shared CSS Components

**Files:**
- Create: `css/components.css`
- Create: `css/tool-layout.css`
- Modify: `index.html`
- Modify: `pages/meal/mealViewer.html`
- Modify: `pages/travel-checklist/travelChecklist.html`
- Modify: `pages/finance/financeCalculator.html`
- Modify: `pages/mortgage/mortgageCalculator.html`

- [ ] **Step 1: Create `css/components.css`**

Create `css/components.css`:

```css
/* Shared UI components for static tool pages. */

.tool-card-surface {
    background: var(--surface, #ffffff);
    border: 1px solid var(--border-soft, #dbe9e5);
    border-radius: var(--radius-md, 12px);
    box-shadow: var(--shadow-soft, 0 10px 30px rgba(24, 78, 68, 0.08));
}

.tool-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm, 8px);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--transition-fast, 0.2s ease), border-color var(--transition-fast, 0.2s ease), color var(--transition-fast, 0.2s ease), transform var(--transition-fast, 0.2s ease);
}

.tool-button:active {
    transform: translateY(1px);
}

.tool-button-primary {
    color: #ffffff;
    background: var(--brand-primary, #0f9f8f);
}

.tool-button-primary:hover {
    background: var(--brand-primary-hover, #0b8176);
}

.tool-button-secondary {
    color: var(--text-strong, #16302b);
    background: var(--surface, #ffffff);
    border-color: var(--border-soft, #dbe9e5);
}

.tool-button-secondary:hover {
    color: var(--brand-primary, #0f9f8f);
    border-color: rgba(15, 159, 143, 0.35);
    background: var(--brand-primary-soft, #dff7f2);
}

.tool-field {
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    color: var(--text-strong, #16302b);
    background: var(--surface, #ffffff);
    border: 1px solid var(--border-soft, #dbe9e5);
    border-radius: var(--radius-sm, 8px);
    font: inherit;
}

.tool-field:focus {
    border-color: var(--brand-primary, #0f9f8f);
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 3px rgba(15, 159, 143, 0.18));
}

.tool-empty-state {
    padding: 28px 18px;
    color: var(--text-muted, #667c76);
    text-align: center;
    background: rgba(255, 255, 255, 0.72);
    border: 1px dashed var(--border-soft, #dbe9e5);
    border-radius: var(--radius-md, 12px);
}

.tool-toast-region {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 10000;
    display: grid;
    gap: 10px;
    max-width: min(360px, calc(100vw - 32px));
}

.tool-toast {
    padding: 12px 14px;
    color: var(--text-strong, #16302b);
    background: var(--surface, #ffffff);
    border: 1px solid var(--border-soft, #dbe9e5);
    border-left: 4px solid var(--brand-primary, #0f9f8f);
    border-radius: var(--radius-sm, 8px);
    box-shadow: var(--shadow-lift, 0 18px 45px rgba(24, 78, 68, 0.14));
}

.tool-toast[data-type="success"] {
    border-left-color: var(--brand-green, #16a34a);
}

.tool-toast[data-type="warning"] {
    border-left-color: var(--brand-orange, #f59e0b);
}

.tool-toast[data-type="error"] {
    border-left-color: var(--brand-rose, #e85d75);
}

.tool-dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(22, 48, 43, 0.38);
}

.tool-dialog {
    width: min(420px, 100%);
    padding: 20px;
    color: var(--text-strong, #16302b);
    background: var(--surface, #ffffff);
    border: 1px solid var(--border-soft, #dbe9e5);
    border-radius: var(--radius-md, 12px);
    box-shadow: var(--shadow-lift, 0 18px 45px rgba(24, 78, 68, 0.14));
}

.tool-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;
}
```

- [ ] **Step 2: Create `css/tool-layout.css`**

Create `css/tool-layout.css`:

```css
/* Shared page layout helpers for standalone tools. */

.tool-page {
    min-height: 100vh;
    color: var(--text-strong, #16302b);
    background-color: var(--app-bg, #f6fbf8);
}

.tool-page-shell {
    width: min(960px, calc(100% - 32px));
    margin: 0 auto;
    padding: 20px 0 40px;
}

.tool-page-header {
    margin-bottom: 22px;
    padding: 20px;
    background: linear-gradient(135deg, rgba(15, 159, 143, 0.12), rgba(59, 130, 246, 0.08));
    border: 1px solid var(--border-soft, #dbe9e5);
    border-radius: var(--radius-lg, 16px);
}

.tool-page-title {
    margin: 0 0 6px;
    color: var(--text-strong, #16302b);
}

.tool-page-subtitle {
    margin: 0;
    color: var(--text-muted, #667c76);
}

.tool-section-stack {
    display: grid;
    gap: 16px;
}

.tool-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

@media (max-width: 640px) {
    .tool-page-shell {
        width: min(100% - 24px, 960px);
        padding-top: 14px;
    }

    .tool-page-header {
        padding: 16px;
    }

    .tool-form-grid {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 3: Load shared CSS in first-batch pages**

Add these links after `css/base.css` where paths are relative:

For `index.html`:

```html
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/tool-layout.css">
```

For pages under `pages/<tool>/`:

```html
<link rel="stylesheet" href="../../css/components.css">
<link rel="stylesheet" href="../../css/tool-layout.css">
```

Apply to:

- `pages/meal/mealViewer.html`
- `pages/travel-checklist/travelChecklist.html`
- `pages/finance/financeCalculator.html`
- `pages/mortgage/mortgageCalculator.html`

- [ ] **Step 4: Run tests and CSS check**

Run:

```bash
node --test
git diff --check -- css/components.css css/tool-layout.css index.html pages/meal/mealViewer.html pages/travel-checklist/travelChecklist.html pages/finance/financeCalculator.html pages/mortgage/mortgageCalculator.html
```

Expected: tests pass and diff check has no output.

- [ ] **Step 5: Commit**

```bash
git add css/components.css css/tool-layout.css index.html pages/meal/mealViewer.html pages/travel-checklist/travelChecklist.html pages/finance/financeCalculator.html pages/mortgage/mortgageCalculator.html
git commit -m "style: 增加共享组件与工具页布局样式"
```

## Task 4: Low-Risk Storage Migration

**Files:**
- Modify: `pages/pension-calculator/pensionCalculator.html`
- Modify: `pages/pension-calculator/calculator-storage.js`
- Modify: `pages/retirement-calculator/retirementCalculator.html`
- Modify: `pages/retirement-calculator/calculator-storage.js`
- Test: `tests/storage-service.test.js`

- [ ] **Step 1: Load storage service before calculator storage scripts**

In `pages/pension-calculator/pensionCalculator.html`, add before `calculator-storage.js`:

```html
    <script src="../../utils/storage-service.js"></script>
```

In `pages/retirement-calculator/retirementCalculator.html`, add before `calculator-storage.js`:

```html
    <script src="../../utils/storage-service.js"></script>
```

- [ ] **Step 2: Migrate pension calculator storage reads and writes**

In `pages/pension-calculator/calculator-storage.js`, update `saveFormData()` so it prefers `window.StorageService` before `window.CommonUtils`:

```js
if (window.StorageService && window.StorageService.setJson) {
    const result = window.StorageService.setJson(STORAGE_KEY, formData);
    if (!result.ok) {
        console.warn('无法保存数据到 localStorage:', result.error);
    }
} else if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
    window.CommonUtils.setLocalStorageItem(STORAGE_KEY, formData);
} else {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {
        console.warn('无法保存数据到 localStorage:', e);
    }
}
```

Update `restoreFormData()` so it prefers `window.StorageService` before `window.CommonUtils`:

```js
let formData;
if (window.StorageService && window.StorageService.getJson) {
    formData = window.StorageService.getJson(STORAGE_KEY, null);
    if (!formData) return;
} else if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
    formData = window.CommonUtils.getLocalStorageItem(STORAGE_KEY, null);
    if (!formData) return;
} else {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;
        formData = JSON.parse(savedData);
    } catch (e) {
        console.warn('无法从 localStorage 恢复数据:', e);
        return;
    }
}
```

Update `clearFormData()` so it prefers `window.StorageService.remove(STORAGE_KEY)` and falls back to the existing `CommonUtils` and native `localStorage` branches.

- [ ] **Step 3: Migrate retirement calculator storage reads and writes**

Apply the same replacement pattern in `pages/retirement-calculator/calculator-storage.js`.

- [ ] **Step 4: Verify old behavior remains covered**

Run:

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add pages/pension-calculator/pensionCalculator.html pages/pension-calculator/calculator-storage.js pages/retirement-calculator/retirementCalculator.html pages/retirement-calculator/calculator-storage.js
git commit -m "refactor: 养老金与退休规划接入统一存储服务"
```

## Task 5: First-Batch Visible Markup Cleanup

**Files:**
- Modify: `pages/meal/mealViewer.html`
- Modify: `pages/finance/financeCalculator.html`
- Modify: `pages/mortgage/mortgageCalculator.html`
- Modify: `pages/travel-checklist/travelChecklist.html`

- [ ] **Step 1: Replace return link wrappers**

In the first-batch pages, replace inline return link wrappers with shared classes:

```html
<div class="tool-page-nav">
    <a href="../../index.html" class="back-to-home">← 返回主页</a>
</div>
```

Keep existing `href` values correct.

- [ ] **Step 2: Add minimal tool page shell classes**

For each first-batch page, add `tool-page` to `<body>` only when it does not conflict with existing body classes:

```html
<body class="tool-page">
```

For the top-level content container, keep existing class and add `tool-page-shell`:

```html
<div class="container tool-page-shell">
```

If the page uses a narrow container with existing layout assumptions, preserve the existing class and only add `tool-page-shell`.

- [ ] **Step 3: Verify pages still load**

Run:

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add pages/meal/mealViewer.html pages/finance/financeCalculator.html pages/mortgage/mortgageCalculator.html pages/travel-checklist/travelChecklist.html
git commit -m "style: 首批页面接入共享布局类"
```

## Task 6: Phase 1 Verification

**Files:**
- Verify all phase 1 files.

- [ ] **Step 1: Run automated tests**

Run:

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 2: Run diff whitespace check**

Run:

```bash
git diff --check HEAD~5..HEAD
```

Expected: no output.

- [ ] **Step 3: Start static server**

Run:

```bash
python3 -m http.server 8000
```

Expected: static server starts. If port 8000 is already in use, use:

```bash
python3 -m http.server 8001
```

- [ ] **Step 4: Manual smoke test**

Open:

```text
http://localhost:8000/index.html
http://localhost:8000/pages/meal/mealViewer.html
http://localhost:8000/pages/travel-checklist/travelChecklist.html
http://localhost:8000/pages/finance/financeCalculator.html
http://localhost:8000/pages/mortgage/mortgageCalculator.html
http://localhost:8000/pages/pension-calculator/pensionCalculator.html
http://localhost:8000/pages/retirement-calculator/retirementCalculator.html
```

Expected:

- Pages render without console errors.
- Return links work.
- Pension and retirement calculators restore and save form data.
- Shared CSS does not visibly break page layout.

- [ ] **Step 5: Commit verification notes if needed**

No commit is required unless verification finds and fixes a problem.
