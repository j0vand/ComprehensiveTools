# Phase 2 Interaction Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace first-batch `alert()` / `confirm()` usage with a shared toast and confirm dialog utility while keeping tool behavior intact.

**Architecture:** Add `utils/dialog.js` as a browser global with testable factory injection. Reuse `.tool-toast-*` and `.tool-dialog-*` styles from `css/components.css`. Migrate out from page-local notification wrappers toward `window.DialogService`.

**Tech Stack:** Static HTML, CSS, ES6 JavaScript, CommonJS-compatible test factory, Node built-in `node:test`.

---

## File Map

- Create `utils/dialog.js`: `showToast`, `confirmAction`, `showError`, `createDialogService`.
- Create `tests/dialog.test.js`: fake DOM/env tests for toast and confirm behavior.
- Modify `pages/travel-checklist/travelChecklist.html`: load `utils/dialog.js` before page script.
- Modify `pages/travel-checklist/travel-checklist.js`: replace `alert()` fallback and `confirm()` calls with `DialogService`.
- Modify `pages/meal/mealViewer.html`: load `utils/dialog.js` before page script.
- Modify `pages/meal/mealViewer.js`: replace page-local toast fallback and clear confirm with `DialogService`.

## Task 1: Dialog Utility Tests First

**Files:**
- Create `tests/dialog.test.js`

- [ ] **Step 1: Create failing tests**

Create `tests/dialog.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

function createFakeDocument() {
    const body = {
        children: [],
        appendChild(node) {
            this.children.push(node);
            node.parentNode = this;
        },
        removeChild(node) {
            this.children = this.children.filter((child) => child !== node);
            node.parentNode = null;
        }
    };

    function createElement(tagName) {
        const node = {
            tagName,
            children: [],
            dataset: {},
            className: '',
            textContent: '',
            parentNode: null,
            attributes: {},
            listeners: {},
            classList: {
                values: [],
                add(...names) {
                    this.values.push(...names);
                    node.className = this.values.join(' ');
                }
            },
            setAttribute(name, value) {
                this.attributes[name] = value;
            },
            appendChild(child) {
                this.children.push(child);
                child.parentNode = this;
            },
            remove() {
                if (this.parentNode) {
                    this.parentNode.removeChild(this);
                }
            },
            addEventListener(name, handler) {
                this.listeners[name] = handler;
            },
            focus() {
                this.focused = true;
            }
        };
        return node;
    }

    return { body, createElement };
}

test('showToast renders a typed toast and removes it after duration', () => {
    const document = createFakeDocument();
    const timers = [];
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({
        document,
        setTimeout(callback) {
            timers.push(callback);
            return timers.length;
        }
    });

    service.showToast('保存成功', 'success', { duration: 10 });

    assert.equal(document.body.children.length, 1);
    const region = document.body.children[0];
    assert.equal(region.className, 'tool-toast-region');
    assert.equal(region.children[0].textContent, '保存成功');
    assert.equal(region.children[0].dataset.type, 'success');

    timers[0]();
    assert.equal(region.children.length, 0);
});

test('confirmAction resolves true when confirm button is clicked', async () => {
    const document = createFakeDocument();
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });

    const promise = service.confirmAction('确定删除？');
    const backdrop = document.body.children[0];
    const dialog = backdrop.children[0];
    const actions = dialog.children[1];
    const confirmButton = actions.children[1];

    confirmButton.listeners.click();

    assert.equal(await promise, true);
    assert.equal(document.body.children.length, 0);
});

test('confirmAction falls back to native confirm without document', async () => {
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({
        confirm(message) {
            assert.equal(message, '继续？');
            return false;
        }
    });

    assert.equal(await service.confirmAction('继续？'), false);
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
node --test tests/dialog.test.js
```

Expected: FAIL with `Cannot find module '../utils/dialog.js'`.

## Task 2: Implement Dialog Utility

**Files:**
- Create `utils/dialog.js`
- Test `tests/dialog.test.js`

- [ ] **Step 1: Implement `utils/dialog.js`**

Create `utils/dialog.js` with:

- `createDialogService(env)`
- `showToast(message, type, options)`
- `confirmAction(message, options)`
- `showError(errorOrMessage)`
- Browser global `window.DialogService`
- CommonJS export for tests

The implementation must:

- Use `.tool-toast-region`, `.tool-toast`, `.tool-dialog-backdrop`, `.tool-dialog`, `.tool-dialog-actions`, `.tool-button`, `.tool-button-primary`, `.tool-button-secondary`.
- Return `Promise<boolean>` from `confirmAction`.
- Fall back to `env.confirm` or `window.confirm` if `document.body` is unavailable.
- Fall back to `env.alert` or `window.alert` for toast if DOM is unavailable.

- [ ] **Step 2: Verify dialog tests pass**

Run:

```bash
node --test tests/dialog.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 3: Verify all tests pass**

Run:

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add utils/dialog.js tests/dialog.test.js
git commit -m "feat: 增加统一交互提示服务"
```

## Task 3: Migrate Travel Checklist Interactions

**Files:**
- Modify `pages/travel-checklist/travelChecklist.html`
- Modify `pages/travel-checklist/travel-checklist.js`

- [ ] **Step 1: Load dialog service**

In `pages/travel-checklist/travelChecklist.html`, load before `travel-checklist.js`:

```html
    <script src="../../utils/dialog.js"></script>
```

- [ ] **Step 2: Replace message wrapper**

In `pages/travel-checklist/travel-checklist.js`, update `showMessage(message, type)` to:

```js
function showMessage(message, type) {
    window.DialogService.showToast(message, type, {
        duration: type === 'error' ? 5000 : 3000
    });
}
```

- [ ] **Step 3: Replace confirm calls**

Replace each `confirm(message)` call with `window.DialogService.confirmAction(message).then(function(confirmed) { ... })`, moving the original mutation code into the `confirmed` branch.

Required call sites:

- Delete list
- Delete item
- Clear checked items
- Delete type
- Import mode selection

For import mode, preserve behavior:

```js
window.DialogService.confirmAction('是否覆盖当前清单？\n点击「确定」覆盖当前清单，点击「取消」则导入为新清单。')
    .then(function(confirmed) {
        importData(file, confirmed ? 'overwrite' : 'new');
        importFile.value = '';
    });
```

- [ ] **Step 4: Verify no native alert/confirm remains in travel checklist**

Run:

```bash
rg -n "alert\\(|confirm\\(" pages/travel-checklist/travel-checklist.js
```

Expected: no output.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
node --test
git diff --check -- pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
```

Expected: tests pass and diff check clean.

Commit:

```bash
git add pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
git commit -m "refactor: 出行清单接入统一交互提示"
```

## Task 4: Migrate Meal Viewer Interactions

**Files:**
- Modify `pages/meal/mealViewer.html`
- Modify `pages/meal/mealViewer.js`

- [ ] **Step 1: Load dialog service**

In `pages/meal/mealViewer.html`, load before `mealViewer.js`:

```html
    <script src="../../utils/dialog.js"></script>
```

- [ ] **Step 2: Replace page-local toast wrapper**

Update `showToast(message, type)` in `pages/meal/mealViewer.js`:

```js
function showToast(message, type = 'info') {
    window.DialogService.showToast(message, type, { duration: 3000 });
}
```

- [ ] **Step 3: Replace clear-data confirm**

Change `clearData()` so it calls:

```js
window.DialogService.confirmAction('确定要清除所有安排吗？此操作不可恢复！')
    .then(function(confirmed) {
        if (!confirmed) return;
        window.StorageService.remove(MEAL_STORAGE_KEY);
        displayMeals();
        displayTodayMeals();
        showToast('已清除所有安排', 'success');
    });
```

- [ ] **Step 4: Verify no native alert/confirm remains in meal viewer**

Run:

```bash
rg -n "alert\\(|confirm\\(" pages/meal/mealViewer.js
```

Expected: no output.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
node --test
git diff --check -- pages/meal/mealViewer.html pages/meal/mealViewer.js
```

Expected: tests pass and diff check clean.

Commit:

```bash
git add pages/meal/mealViewer.html pages/meal/mealViewer.js
git commit -m "refactor: 点餐页面接入统一交互提示"
```

## Task 5: Phase 2 Verification

**Files:**
- Verify phase 2 files.

- [ ] **Step 1: Run automated tests**

Run:

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 2: Run diff whitespace check**

Run:

```bash
git diff --check HEAD~4..HEAD
```

Expected: no output.

- [ ] **Step 3: Check remaining first-batch native dialogs**

Run:

```bash
rg -n "alert\\(|confirm\\(" pages/travel-checklist/travel-checklist.js pages/meal/mealViewer.js
```

Expected: no output.

- [ ] **Step 4: Manual smoke test**

Open through a static server:

```text
pages/travel-checklist/travelChecklist.html
pages/meal/mealViewer.html
```

Expected:

- Success/error messages render as shared toasts.
- Delete/clear/import confirmations use shared dialog.
- Canceling confirm does not mutate data.
- Confirming dangerous actions preserves previous behavior.
