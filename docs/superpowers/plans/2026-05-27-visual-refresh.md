# Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade ComprehensiveTools to a unified bright, practical, colorful visual system without changing existing tool behavior or storage formats.

**Architecture:** Add reusable design tokens and shared component baselines in `css/base.css`, then map existing page-level variables to that system. Keep DOM and JavaScript stable, using scoped CSS overrides for page families that currently define their own visual language.

**Tech Stack:** Static HTML, CSS, ES6 JavaScript, Node built-in test runner, Python static HTTP server.

---

## File Map

- Modify `css/base.css`: shared tokens, page backgrounds, cards, buttons, forms, focus states, return link.
- Modify `index.html`: homepage color tokens and tool card accent system.
- Modify `pages/pension-calculator/style.css`: shared calculator visual baseline used by pension, mortgage, tax, and retirement pages.
- Modify `pages/retirement-calculator/style.css`: FIRE page-specific result and metric styling.
- Modify `pages/tax/taxCalculator.html`: local variable mapping for tax page header, cards, controls, and result blocks.
- Modify `pages/mortgage/mortgageCalculator.html`: local variable mapping for mortgage selectors, fixed action, result cards, and tables.
- Modify `pages/finance/financeCalculator.html`: local style refresh for finance calculator.
- Modify `pages/travel-checklist/style.css`: checklist theme refresh.
- Modify `pages/inventory/css/main.css`, `pages/inventory/css/cards.css`, `pages/inventory/css/modal.css`, `pages/inventory/css/responsive.css`: inventory theme refresh while preserving layout.
- Modify `pages/rehab-trainer/css/main.css`, `pages/rehab-trainer/css/cards.css`, `pages/rehab-trainer/css/modal.css`: rehab theme refresh.
- Modify `pages/meal/mealViewer.html`: local style refresh and replace inline return link styling with shared class where safe.

## Task 1: Baseline Audit

**Files:**
- Read: `css/base.css`
- Read: `index.html`
- Read: `pages/pension-calculator/style.css`
- Read: `pages/inventory/css/main.css`
- Read: `pages/rehab-trainer/css/main.css`
- Read: `pages/travel-checklist/style.css`

- [ ] **Step 1: Confirm current file state**

Run:

```bash
git status --short
```

Expected: only the implementation plan may be uncommitted before code work starts.

- [ ] **Step 2: Locate hard grayscale and sharp UI tokens**

Run:

```bash
rg -n "#0f172a|#111827|#000000|#f3f4f6|#f8fafc|border-radius: 0|box-shadow: none|纯黑|深灰|硬边框" css index.html pages
```

Expected: matches in the target CSS and HTML files listed in the file map.

- [ ] **Step 3: Record the main variable families to update**

Use the command output to confirm these families exist before editing:

```text
base: --font-heading, --font-body, --radius-*, --space-*
calculator: --primary-color, --secondary-bg, --card-bg, --text-main, --border-color, --radius
inventory: --primary-color, --background-color, --card-color, --divider-color, --border-radius
travel: --tc-bg, --tc-primary, --tc-bg-card, --tc-border
rehab: --bg-color, --card-bg, --accent-neon, --border-color
```

- [ ] **Step 4: Commit is not required**

No code changed in this task.

## Task 2: Shared Design Tokens

**Files:**
- Modify: `css/base.css`

- [ ] **Step 1: Add global visual tokens**

In `css/base.css`, extend `:root` with these tokens after the existing spacing variables:

```css
    /* 统一视觉系统 */
    --app-bg: #f6fbf8;
    --app-bg-soft: #eef8f6;
    --surface: #ffffff;
    --surface-tint: #f8fcfb;
    --surface-strong: #eef8f6;
    --text-strong: #16302b;
    --text-muted: #667c76;
    --border-soft: #dbe9e5;
    --brand-primary: #0f9f8f;
    --brand-primary-hover: #0b8176;
    --brand-primary-soft: #dff7f2;
    --brand-blue: #3b82f6;
    --brand-green: #16a34a;
    --brand-orange: #f59e0b;
    --brand-rose: #e85d75;
    --brand-violet: #8b5cf6;
    --shadow-soft: 0 10px 30px rgba(24, 78, 68, 0.08);
    --shadow-lift: 0 18px 45px rgba(24, 78, 68, 0.14);
    --focus-ring: 0 0 0 3px rgba(15, 159, 143, 0.18);
```

- [ ] **Step 2: Add shared primitives**

Append these shared rules near the bottom of `css/base.css`:

```css
body {
    color: var(--text-strong);
    background:
        radial-gradient(circle at top left, rgba(15, 159, 143, 0.10), transparent 34rem),
        linear-gradient(135deg, var(--app-bg) 0%, #fdfaf4 100%);
}

.app-surface,
.card,
.panel,
.input-card,
.result-card {
    background: var(--surface);
    border: 1px solid var(--border-soft);
    box-shadow: var(--shadow-soft);
}

.back-to-home {
    color: var(--brand-primary);
    background: rgba(15, 159, 143, 0.10);
    border: 1px solid rgba(15, 159, 143, 0.18);
}

.back-to-home:hover {
    color: var(--brand-primary-hover);
    background: rgba(15, 159, 143, 0.16);
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}

@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
    }
}
```

- [ ] **Step 3: Verify no syntax error in CSS patch**

Run:

```bash
node --test
```

Expected: existing tests pass. If there are no tests, Node reports zero or existing test count without CSS-related failures.

- [ ] **Step 4: Commit**

```bash
git add css/base.css
git commit -m "style: 建立全站视觉系统变量"
```

## Task 3: Homepage Refresh

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace homepage theme variables**

In the inline `:root` block of `index.html`, replace the gray theme values with:

```css
            --bg-gradient: linear-gradient(135deg, #f6fbf8 0%, #eef7ff 48%, #fff8ec 100%);
            --card-bg: rgba(255, 255, 255, 0.82);
            --card-border: rgba(221, 235, 231, 0.95);
            --text-main: #16302b;
            --text-sub: #657b75;
            --shadow-glass: 0 12px 34px rgba(24, 78, 68, 0.08);
            --shadow-glass-hover: 0 20px 52px rgba(24, 78, 68, 0.14);
            --gap-grid: 20px;
```

- [ ] **Step 2: Update decorative background colors**

Change `body::before` to `background: rgba(15, 159, 143, 0.18);` and `body::after` to `background: rgba(245, 158, 11, 0.16);`.

- [ ] **Step 3: Add card accent variables**

Add per-card accents after the existing `.tool-card:nth-child(...)` animation delay rules:

```css
        .tool-card:nth-child(1)  { --tool-accent: #16a34a; --tool-accent-soft: #dcfce7; }
        .tool-card:nth-child(2)  { --tool-accent: #0f9f8f; --tool-accent-soft: #dff7f2; }
        .tool-card:nth-child(3)  { --tool-accent: #3b82f6; --tool-accent-soft: #dbeafe; }
        .tool-card:nth-child(4)  { --tool-accent: #f59e0b; --tool-accent-soft: #fef3c7; }
        .tool-card:nth-child(5)  { --tool-accent: #8b5cf6; --tool-accent-soft: #ede9fe; }
        .tool-card:nth-child(6)  { --tool-accent: #e85d75; --tool-accent-soft: #ffe4ea; }
        .tool-card:nth-child(7)  { --tool-accent: #14b8a6; --tool-accent-soft: #ccfbf1; }
        .tool-card:nth-child(8)  { --tool-accent: #0ea5e9; --tool-accent-soft: #e0f2fe; }
        .tool-card:nth-child(9)  { --tool-accent: #f97316; --tool-accent-soft: #ffedd5; }
```

- [ ] **Step 4: Add color treatment to cards and icons**

Update `.tool-card` and `.tool-icon`:

```css
        .tool-card {
            position: relative;
            overflow: hidden;
        }

        .tool-card::before {
            content: '';
            position: absolute;
            inset: 0 0 auto 0;
            height: 4px;
            background: var(--tool-accent, var(--brand-primary));
        }

        .tool-icon {
            color: var(--tool-accent, var(--brand-primary));
            background: var(--tool-accent-soft, var(--brand-primary-soft));
            border-color: rgba(255, 255, 255, 0.8);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.65), 0 8px 18px rgba(24, 78, 68, 0.08);
        }
```

- [ ] **Step 5: Manually inspect homepage**

Run:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/index.html`. Expected: homepage has a bright layered background, colored tool cards, and no layout shift on hover.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "style: 优化首页工具卡片视觉"
```

## Task 4: Calculator Baseline

**Files:**
- Modify: `pages/pension-calculator/style.css`
- Modify: `pages/retirement-calculator/style.css`

- [ ] **Step 1: Replace calculator root palette**

In `pages/pension-calculator/style.css`, replace the current `:root` palette values with:

```css
:root {
    --primary-color: #0f9f8f;
    --primary-hover: #0b8176;
    --accent-color: #f59e0b;
    --secondary-bg: #f4fbf9;
    --card-bg: #ffffff;
    --text-main: #16302b;
    --text-sub: #667c76;
    --border-color: #dbe9e5;
    --success-color: #16a34a;
    --warning-color: #f59e0b;
    --danger-color: #e85d75;
    --shadow-sm: 0 4px 12px rgba(24, 78, 68, 0.06);
    --shadow-md: 0 12px 30px rgba(24, 78, 68, 0.10);
    --radius: 14px;
}
```

- [ ] **Step 2: Update calculator page shell**

Adjust `body`, `header`, `.panel`, `.panel-header`, inputs, and buttons in `pages/pension-calculator/style.css` so they match:

```css
body {
    background:
        radial-gradient(circle at top left, rgba(15, 159, 143, 0.12), transparent 30rem),
        linear-gradient(135deg, #f6fbf8 0%, #fff8ec 100%);
}

header {
    background: linear-gradient(135deg, rgba(15, 159, 143, 0.14), rgba(59, 130, 246, 0.10));
    border: 1px solid rgba(219, 233, 229, 0.9);
    border-radius: 18px;
    padding: 22px;
}

.panel {
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
}

.panel-header {
    border-bottom: 1px solid var(--border-color);
    background: linear-gradient(90deg, rgba(15, 159, 143, 0.12), rgba(245, 158, 11, 0.08));
}

input[type="number"],
select {
    border-radius: 10px;
    background-color: #fbfefd;
}

input[type="number"]:focus,
select:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(15, 159, 143, 0.16);
}

.btn {
    border-radius: 10px;
    text-transform: none;
    letter-spacing: 0;
}
```

- [ ] **Step 3: Refresh FIRE page result styles**

In `pages/retirement-calculator/style.css`, update these existing rules:

```css
.result-panel {
    background: rgba(255, 255, 255, 0.92);
    border-radius: 16px;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
}

.data-card {
    background: linear-gradient(180deg, #ffffff, #f4fbf9);
    border: 1px solid var(--border-color);
    border-radius: 14px;
}

.success-card {
    background: linear-gradient(135deg, #0f9f8f, #16a34a);
}

.warning-card {
    background: linear-gradient(135deg, #f59e0b, #e85d75);
}
```

- [ ] **Step 4: Verify shared calculator pages load**

With the static server running, open:

```text
http://localhost:8000/pages/pension-calculator/pensionCalculator.html
http://localhost:8000/pages/retirement-calculator/retirementCalculator.html
http://localhost:8000/pages/mortgage/mortgageCalculator.html
```

Expected: pages share the same bright calculator style and form controls remain usable.

- [ ] **Step 5: Commit**

```bash
git add pages/pension-calculator/style.css pages/retirement-calculator/style.css
git commit -m "style: 统一计算器基础视觉"
```

## Task 5: Calculator Page Overrides

**Files:**
- Modify: `pages/tax/taxCalculator.html`
- Modify: `pages/mortgage/mortgageCalculator.html`
- Modify: `pages/finance/financeCalculator.html`

- [ ] **Step 1: Refresh tax page variables**

In `pages/tax/taxCalculator.html`, update the inline `:root` values:

```css
            --primary: #0f9f8f;
            --primary-dark: #0b8176;
            --primary-light: #dff7f2;
            --danger: #e85d75;
            --warning: #f59e0b;
            --text-main: #16302b;
            --text-sub: #667c76;
            --bg-body: #f6fbf8;
            --bg-card: #ffffff;
            --border: #dbe9e5;
            --radius: 16px;
            --radius-sm: 10px;
            --shadow-sm: 0 4px 12px rgba(24, 78, 68, 0.06);
            --shadow: 0 12px 30px rgba(24, 78, 68, 0.10);
            --shadow-lg: 0 20px 45px rgba(24, 78, 68, 0.14);
```

- [ ] **Step 2: Refresh mortgage action and result styles**

In `pages/mortgage/mortgageCalculator.html`, change `.calculate-button` border radius to `14px 14px 0 0`, change fixed button background to `linear-gradient(135deg, var(--primary-color), var(--primary-hover))`, and change `.result-item` background to `linear-gradient(180deg, #ffffff, #f4fbf9)`.

- [ ] **Step 3: Refresh finance root and card styles**

In `pages/finance/financeCalculator.html`, replace the inline `:root` with:

```css
            --primary-color: #0f9f8f;
            --hover-color: #0b8176;
            --background-color: #f6fbf8;
            --border-color: #dbe9e5;
            --text-color: #16302b;
            --text-muted: #667c76;
            --card-shadow: 0 12px 30px rgba(24, 78, 68, 0.10);
```

Then change `.card` and `.result-card` background to `rgba(255, 255, 255, 0.92)` and add `border: 1px solid var(--border-color);`.

- [ ] **Step 4: Verify calculator interactions**

Open:

```text
http://localhost:8000/pages/tax/taxCalculator.html
http://localhost:8000/pages/mortgage/mortgageCalculator.html
http://localhost:8000/pages/finance/financeCalculator.html
```

Expected: inputs focus with colored rings, primary buttons are colored, results remain readable, and fixed mortgage button does not cover essential inputs before scrolling.

- [ ] **Step 5: Commit**

```bash
git add pages/tax/taxCalculator.html pages/mortgage/mortgageCalculator.html pages/finance/financeCalculator.html
git commit -m "style: 优化计算器页面局部视觉"
```

## Task 6: Checklist And Meal Pages

**Files:**
- Modify: `pages/travel-checklist/style.css`
- Modify: `pages/meal/mealViewer.html`

- [ ] **Step 1: Refresh travel checklist tokens**

In `pages/travel-checklist/style.css`, update `:root` tokens:

```css
    --tc-bg: #f6fbf8;
    --tc-bg-card: rgba(255, 255, 255, 0.94);
    --tc-text: #16302b;
    --tc-text-muted: #667c76;
    --tc-primary: #0f9f8f;
    --tc-primary-hover: #0b8176;
    --tc-accent-done: #16a34a;
    --tc-border: #dbe9e5;
    --tc-shadow: 0 10px 28px rgba(24, 78, 68, 0.08);
    --tc-shadow-hover: 0 16px 38px rgba(24, 78, 68, 0.12);
    --tc-radius: 16px;
    --tc-radius-sm: 10px;
```

- [ ] **Step 2: Refresh checklist body and item surfaces**

Add to `pages/travel-checklist/style.css`:

```css
body {
    background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.10), transparent 28rem),
        linear-gradient(135deg, var(--tc-bg) 0%, #fff8ec 100%);
}

.checklist-item,
.list-toolbar,
.progress-row,
.add-row {
    background: var(--tc-bg-card);
    border-color: var(--tc-border);
    box-shadow: var(--tc-shadow);
}
```

Only keep selectors that exist in the file; if `.checklist-item` has a different local name, use that existing item selector.

- [ ] **Step 3: Refresh meal page variables**

In `pages/meal/mealViewer.html`, update the inline `:root`:

```css
            --primary-color: #0f9f8f;
            --primary-hover: #0b8176;
            --background-color: #f6fbf8;
            --card-background: rgba(255, 255, 255, 0.94);
            --text-color: #16302b;
            --text-muted: #667c76;
            --border-color: #dbe9e5;
            --radius-large: 16px;
            --radius-sm: 10px;
            --shadow-soft: 0 10px 28px rgba(24, 78, 68, 0.08);
```

- [ ] **Step 4: Replace meal return link inline styling**

Change the return link in `pages/meal/mealViewer.html` to:

```html
            <a href="../../index.html" class="back-to-home">
                ← 返回主页
            </a>
```

- [ ] **Step 5: Verify checklist and meal pages**

Open:

```text
http://localhost:8000/pages/travel-checklist/travelChecklist.html
http://localhost:8000/pages/meal/mealViewer.html
```

Expected: both pages use the same bright background and colored controls; adding checklist items and typing meal text still works.

- [ ] **Step 6: Commit**

```bash
git add pages/travel-checklist/style.css pages/meal/mealViewer.html
git commit -m "style: 优化清单与点餐页面视觉"
```

## Task 7: Inventory Refresh

**Files:**
- Modify: `pages/inventory/css/main.css`
- Modify: `pages/inventory/css/cards.css`
- Modify: `pages/inventory/css/modal.css`
- Modify: `pages/inventory/css/responsive.css`

- [ ] **Step 1: Replace inventory root palette**

In `pages/inventory/css/main.css`, replace root color and shape tokens with:

```css
    --primary-color: #0f9f8f;
    --primary-light: #34d3c2;
    --primary-dark: #0b8176;
    --secondary-color: #3b82f6;
    --secondary-light: #93c5fd;
    --secondary-dark: #1d4ed8;
    --text-on-primary: #ffffff;
    --text-on-secondary: #ffffff;
    --text-primary: #16302b;
    --text-secondary: #667c76;
    --divider-color: #dbe9e5;
    --background-color: #f6fbf8;
    --card-color: rgba(255, 255, 255, 0.94);
    --hover-color: #eef8f6;
    --success-color: #16a34a;
    --warning-color: #f59e0b;
    --error-color: #e85d75;
    --info-color: #3b82f6;
    --shadow-light: 0 6px 18px rgba(24, 78, 68, 0.07);
    --shadow-medium: 0 12px 30px rgba(24, 78, 68, 0.10);
    --shadow-heavy: 0 20px 45px rgba(24, 78, 68, 0.14);
    --border-radius: 12px;
```

- [ ] **Step 2: Update inventory shell**

In `pages/inventory/css/main.css`, update `html, body` background to:

```css
    background:
        radial-gradient(circle at top left, rgba(15, 159, 143, 0.10), transparent 32rem),
        linear-gradient(135deg, var(--background-color) 0%, #eef7ff 100%);
```

Update `.app-header` to:

```css
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
```

Remove uppercase-heavy styling from headings by setting `text-transform: none;` and `letter-spacing: 0;`.

- [ ] **Step 3: Refresh cards and modals**

In `pages/inventory/css/cards.css` and `pages/inventory/css/modal.css`, replace hard borders and no-shadow card/modal surfaces with:

```css
    background: var(--card-color);
    border: 1px solid var(--divider-color);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-light);
```

Apply this only to existing card and modal container selectors.

- [ ] **Step 4: Verify inventory workflows**

Open:

```text
http://localhost:8000/pages/inventory/inventoryManager.html
```

Expected: app header is colorful, item cards and modals are bright with soft depth, search/filter controls are usable, and mobile layout remains intact.

- [ ] **Step 5: Commit**

```bash
git add pages/inventory/css/main.css pages/inventory/css/cards.css pages/inventory/css/modal.css pages/inventory/css/responsive.css
git commit -m "style: 优化库存管理视觉"
```

## Task 8: Rehab Trainer Refresh

**Files:**
- Modify: `pages/rehab-trainer/css/main.css`
- Modify: `pages/rehab-trainer/css/cards.css`
- Modify: `pages/rehab-trainer/css/modal.css`

- [ ] **Step 1: Replace rehab root palette**

In `pages/rehab-trainer/css/main.css`, update the root colors:

```css
    --bg-color: #f6fbf8;
    --card-bg: rgba(255, 255, 255, 0.94);
    --text-main: #16302b;
    --text-sub: #667c76;
    --accent-neon: #16a34a;
    --accent-neon-dim: rgba(22, 163, 74, 0.16);
    --border-color: #dbe9e5;
    --primary-hover: #15803d;
    --primary-dark: #0b8176;
    --danger-color: #e85d75;
    --danger: #e85d75;
    --warning-color: #f59e0b;
    --warning: #f59e0b;
    --shadow-card: 0 10px 28px rgba(24, 78, 68, 0.08);
    --shadow-card-hover: 0 16px 38px rgba(24, 78, 68, 0.12);
```

- [ ] **Step 2: Add bright page background**

In `pages/rehab-trainer/css/main.css`, change `body` to:

```css
body {
    background:
        radial-gradient(circle at top left, rgba(22, 163, 74, 0.12), transparent 30rem),
        linear-gradient(135deg, var(--bg-color) 0%, #eef7ff 100%);
    color: var(--text-main);
    padding-bottom: 80px;
    min-height: 100vh;
}
```

- [ ] **Step 3: Keep training view high contrast but softer**

In `pages/rehab-trainer/css/main.css`, set `#trainingView` and `.training-main` backgrounds to `#12332d`, `.training-header` to `#174239`, and keep timer text using `var(--accent-neon)`.

- [ ] **Step 4: Refresh rehab cards and modals**

In `pages/rehab-trainer/css/cards.css` and `pages/rehab-trainer/css/modal.css`, update existing card/modal containers to use `var(--card-bg)`, `var(--border-color)`, `var(--shadow-card)`, and existing `var(--radius)`.

- [ ] **Step 5: Verify rehab main and training views**

Open:

```text
http://localhost:8000/pages/rehab-trainer/rehabTrainer.html
```

Expected: main page is bright health themed; starting a training session still shows a readable high-contrast timer screen.

- [ ] **Step 6: Commit**

```bash
git add pages/rehab-trainer/css/main.css pages/rehab-trainer/css/cards.css pages/rehab-trainer/css/modal.css
git commit -m "style: 优化康复训练页面视觉"
```

## Task 9: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run automated tests**

Run:

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 2: Start static server**

Run:

```bash
python3 -m http.server 8000
```

Expected: server starts at `http://0.0.0.0:8000/` or reports the port is already in use. If port `8000` is busy, run `python3 -m http.server 8001`.

- [ ] **Step 3: Manual desktop smoke test**

Open these URLs:

```text
http://localhost:8000/index.html
http://localhost:8000/pages/tax/taxCalculator.html
http://localhost:8000/pages/mortgage/mortgageCalculator.html
http://localhost:8000/pages/finance/financeCalculator.html
http://localhost:8000/pages/pension-calculator/pensionCalculator.html
http://localhost:8000/pages/retirement-calculator/retirementCalculator.html
http://localhost:8000/pages/inventory/inventoryManager.html
http://localhost:8000/pages/rehab-trainer/rehabTrainer.html
http://localhost:8000/pages/travel-checklist/travelChecklist.html
http://localhost:8000/pages/meal/mealViewer.html
```

Expected: no browser console errors, no broken navigation, no overlapping visible controls.

- [ ] **Step 4: Manual mobile smoke test**

Use browser responsive mode at `390px` width and check:

```text
index.html
pages/tax/taxCalculator.html
pages/inventory/inventoryManager.html
pages/rehab-trainer/rehabTrainer.html
pages/travel-checklist/travelChecklist.html
```

Expected: cards fit the viewport, buttons have readable labels, fixed bottom actions do not hide critical controls, and text does not overflow.

- [ ] **Step 5: Review final diff**

Run:

```bash
git diff --stat HEAD~8..HEAD
git status --short
```

Expected: status is clean after commits; diff stat shows only CSS, HTML, and docs changes.

