# Phase 3 Large File Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the highest-risk large browser scripts into smaller responsibility modules without changing URLs, storage keys, or user-visible behavior.

**Architecture:** Keep the static no-build browser model. Each new module is an IIFE that attaches one namespaced global to `window`, and page HTML loads dependency modules before the page entry module. The first implementation slice targets `pages/travel-checklist/` because its current file has clear state, rendering, import/export, and event-binding boundaries.

**Tech Stack:** Plain HTML, CSS, ES6 JavaScript, browser globals, Node built-in `node:test`.

---

## File Map

- Create `pages/travel-checklist/travel-state.js`: constants, state, templates, storage load/save, list/type/item mutation APIs.
- Create `pages/travel-checklist/travel-render.js`: list switcher, type options, pending/done rendering, modal type rendering, template select rendering.
- Create `pages/travel-checklist/travel-import-export.js`: current/all export and import file normalization.
- Create `pages/travel-checklist/travel-events.js`: DOM event binding, inline editing state, modal open/close workflow.
- Modify `pages/travel-checklist/travel-checklist.js`: small bootstrap that wires modules together.
- Modify `pages/travel-checklist/travelChecklist.html`: load new module files before `travel-checklist.js`.
- Later tasks will apply the same pattern to `pages/inventory/js/modals.js`, `pages/inventory/js/ui.js`, `pages/rehab-trainer/js/main.js`, and `pages/tax/taxCalculator.html` after the travel split is verified.

## Module Contracts

`window.TravelChecklistState` must expose:

```js
{
    DATA_VERSION,
    STORAGE_KEY,
    TEMPLATES,
    state,
    getDefaultTypes,
    generateId,
    buildInitialItems,
    loadData,
    saveData,
    getCurrentList,
    nextOrder,
    switchList,
    createList,
    duplicateList,
    renameList,
    deleteList,
    getListTypes,
    getTypeName,
    addType,
    renameType,
    deleteType,
    addItem,
    deleteItem,
    updateItemText,
    updateItemTextSilent,
    toggleItem,
    resetChecked
}
```

`window.TravelChecklistRender` must expose:

```js
{
    renderListSwitcher,
    renderTypeOptions,
    renderPendingDone,
    renderModalTypes,
    fillTemplateSelect,
    renderList
}
```

`window.TravelChecklistImportExport` must expose:

```js
{
    exportData,
    importData
}
```

`window.TravelChecklistEvents` must expose:

```js
{
    bindEvents
}
```

## Task 1: Split Travel Checklist State

**Files:**
- Create: `pages/travel-checklist/travel-state.js`
- Modify: `pages/travel-checklist/travelChecklist.html`
- Modify: `pages/travel-checklist/travel-checklist.js`

- [ ] **Step 1: Move state and mutation code**

Move constants and state/mutation functions from `travel-checklist.js` into `travel-state.js`. Keep the existing `CommonUtils` storage path for this page until a separate storage migration task explicitly loads `StorageService`.

- [ ] **Step 2: Attach the state API**

End `travel-state.js` with:

```js
window.TravelChecklistState = {
    DATA_VERSION: DATA_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    TEMPLATES: TEMPLATES,
    state: state,
    getDefaultTypes: getDefaultTypes,
    generateId: generateId,
    buildInitialItems: buildInitialItems,
    loadData: loadData,
    saveData: saveData,
    getCurrentList: getCurrentList,
    nextOrder: nextOrder,
    switchList: switchList,
    createList: createList,
    duplicateList: duplicateList,
    renameList: renameList,
    deleteList: deleteList,
    getListTypes: getListTypes,
    getTypeName: getTypeName,
    addType: addType,
    renameType: renameType,
    deleteType: deleteType,
    addItem: addItem,
    deleteItem: deleteItem,
    updateItemText: updateItemText,
    updateItemTextSilent: updateItemTextSilent,
    toggleItem: toggleItem,
    resetChecked: resetChecked
};
```

- [ ] **Step 3: Load before bootstrap**

In `travelChecklist.html`, load `travel-state.js` after `dialog.js` and before `travel-checklist.js`.

- [ ] **Step 4: Verify syntax and tests**

Run:

```bash
node --test
git diff --check -- pages/travel-checklist/travel-state.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
```

Expected: tests pass and diff check has no output.

- [ ] **Step 5: Commit**

```bash
git add pages/travel-checklist/travel-state.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
git commit -m "refactor: 拆分出行清单状态模块"
```

## Task 2: Split Travel Checklist Rendering

**Files:**
- Create: `pages/travel-checklist/travel-render.js`
- Modify: `pages/travel-checklist/travelChecklist.html`
- Modify: `pages/travel-checklist/travel-checklist.js`

- [ ] **Step 1: Move render functions**

Move `renderListSwitcher`, `renderTypeOptions`, `renderPendingDone`, `renderModalTypes`, `fillTemplateSelect`, and `renderList` into `travel-render.js`.

- [ ] **Step 2: Read state through module contract**

At the top of `travel-render.js`, bind dependencies:

```js
var store = window.TravelChecklistState;
var getCurrentList = store.getCurrentList;
var getListTypes = store.getListTypes;
var getTypeName = store.getTypeName;
var TEMPLATES = store.TEMPLATES;
```

- [ ] **Step 3: Attach render API**

End `travel-render.js` with:

```js
window.TravelChecklistRender = {
    renderListSwitcher: renderListSwitcher,
    renderTypeOptions: renderTypeOptions,
    renderPendingDone: renderPendingDone,
    renderModalTypes: renderModalTypes,
    fillTemplateSelect: fillTemplateSelect,
    renderList: renderList
};
```

- [ ] **Step 4: Load before bootstrap**

In `travelChecklist.html`, load `travel-render.js` after `travel-state.js` and before `travel-checklist.js`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
node --test
git diff --check -- pages/travel-checklist/travel-render.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
```

Then commit:

```bash
git add pages/travel-checklist/travel-render.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
git commit -m "refactor: 拆分出行清单渲染模块"
```

## Task 3: Split Travel Checklist Import/Export

**Files:**
- Create: `pages/travel-checklist/travel-import-export.js`
- Modify: `pages/travel-checklist/travelChecklist.html`
- Modify: `pages/travel-checklist/travel-checklist.js`

- [ ] **Step 1: Move import/export code**

Move `exportData` and `importData` into `travel-import-export.js`.

- [ ] **Step 2: Bind dependencies**

Use the existing state and render modules:

```js
var store = window.TravelChecklistState;
var render = window.TravelChecklistRender;
```

Replace local calls with `store.getCurrentList()`, `store.getListTypes(list)`, `store.generateId()`, `store.saveData()`, `render.renderList()`, and `window.DialogService.showToast(...)`.

- [ ] **Step 3: Attach import/export API**

End `travel-import-export.js` with:

```js
window.TravelChecklistImportExport = {
    exportData: exportData,
    importData: importData
};
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --test
git diff --check -- pages/travel-checklist/travel-import-export.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
```

Then commit:

```bash
git add pages/travel-checklist/travel-import-export.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
git commit -m "refactor: 拆分出行清单导入导出模块"
```

## Task 4: Split Travel Checklist Events and Bootstrap

**Files:**
- Create: `pages/travel-checklist/travel-events.js`
- Modify: `pages/travel-checklist/travelChecklist.html`
- Modify: `pages/travel-checklist/travel-checklist.js`

- [ ] **Step 1: Move event binding code**

Move `bindEvents`, `startEdit`, `commitEdit`, `cancelEdit`, and `editingItemId` into `travel-events.js`.

- [ ] **Step 2: Bind module dependencies**

Use:

```js
var store = window.TravelChecklistState;
var render = window.TravelChecklistRender;
var transfer = window.TravelChecklistImportExport;
```

- [ ] **Step 3: Keep bootstrap minimal**

Replace `travel-checklist.js` with:

```js
/**
 * 出行清单 - 启动入口
 */
(function() {
    'use strict';

    function init() {
        window.TravelChecklistState.loadData();
        window.TravelChecklistRender.fillTemplateSelect();
        window.TravelChecklistRender.renderList();
        window.TravelChecklistEvents.bindEvents();

        var newItemInput = document.getElementById('new-item-input');
        if (newItemInput) newItemInput.focus();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
```

- [ ] **Step 4: Verify final travel split**

Run:

```bash
node --test
git diff --check -- pages/travel-checklist
wc -l pages/travel-checklist/*.js
rg -n "alert\\(|confirm\\(" pages/travel-checklist/*.js
```

Expected: tests pass, diff check has no output, no `alert/confirm` output, and `travel-checklist.js` is a small bootstrap.

- [ ] **Step 5: Commit**

```bash
git add pages/travel-checklist/travel-events.js pages/travel-checklist/travelChecklist.html pages/travel-checklist/travel-checklist.js
git commit -m "refactor: 拆分出行清单事件入口"
```

## Task 5: Inventory and Rehab Split Planning Checkpoint

**Files:**
- Modify: this plan file if explorer findings require sharper file boundaries.

- [ ] **Step 1: Review read-only explorer findings**

Use the inventory and rehab explorer outputs to pick the next disjoint write set.

- [ ] **Step 2: Apply the same module pattern**

For each chosen file, only move one responsibility group per commit and keep all old public globals available until the entry file is reduced.

- [ ] **Step 3: Verify each slice**

Run:

```bash
node --test
git diff --check
```

Manual smoke targets:

```text
pages/inventory/inventory.html
pages/rehab-trainer/rehabTrainer.html
```
