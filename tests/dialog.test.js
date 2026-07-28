const test = require('node:test');
const assert = require('node:assert/strict');

function createFakeDocument() {
    const document = {
        activeElement: null
    };
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
            removeChild(child) {
                this.children = this.children.filter((item) => item !== child);
                child.parentNode = null;
            },
            remove() {
                if (this.parentNode) {
                    this.parentNode.removeChild(this);
                }
            },
            addEventListener(name, handler) {
                this.listeners[name] = handler;
            },
            removeEventListener(name, handler) {
                if (this.listeners[name] === handler) {
                    delete this.listeners[name];
                }
            },
            focus() {
                this.focused = true;
                this.focusCount = (this.focusCount || 0) + 1;
                document.activeElement = this;
            }
        };
        return node;
    }

    document.body = body;
    document.createElement = createElement;
    return document;
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
    assert.equal(region.children[0].attributes.role, 'status');
    assert.equal(region.children[0].attributes['aria-live'], 'polite');

    timers[0]();
    assert.equal(region.children.length, 0);
});

test('showToast announces errors assertively', () => {
    const document = createFakeDocument();
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document, setTimeout() {} });

    service.showToast('保存失败', 'error');

    const toast = document.body.children[0].children[0];
    assert.equal(toast.attributes.role, 'alert');
    assert.equal(toast.attributes['aria-live'], 'assertive');
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

    assert.equal(dialog.attributes['aria-label'], '确定删除？');
    confirmButton.listeners.click();

    assert.equal(await promise, true);
    assert.equal(document.body.children.length, 0);
});

test('confirmAction traps Tab focus in both directions', async () => {
    const document = createFakeDocument();
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });

    const promise = service.confirmAction('继续？');
    const dialog = document.body.children[0].children[0];
    const actions = dialog.children[1];
    const cancelButton = actions.children[0];
    const confirmButton = actions.children[1];
    let prevented = 0;

    assert.equal(typeof dialog.listeners.keydown, 'function');
    dialog.listeners.keydown({
        key: 'Tab',
        shiftKey: false,
        target: confirmButton,
        preventDefault() {
            prevented += 1;
        }
    });
    assert.equal(document.activeElement, cancelButton);

    dialog.listeners.keydown({
        key: 'Tab',
        shiftKey: true,
        target: cancelButton,
        preventDefault() {
            prevented += 1;
        }
    });
    assert.equal(document.activeElement, confirmButton);
    assert.equal(prevented, 2);

    cancelButton.listeners.click();
    assert.equal(await promise, false);
});

test('confirmAction cancels on Escape, restores focus, and cleans listeners once', async () => {
    const document = createFakeDocument();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });
    const promise = service.confirmAction('继续？');
    const backdrop = document.body.children[1];
    const dialog = backdrop.children[0];
    const actions = dialog.children[1];
    const confirmButton = actions.children[1];
    const confirmClick = confirmButton.listeners.click;
    let prevented = false;

    assert.equal(typeof dialog.listeners.keydown, 'function');
    dialog.listeners.keydown({
        key: 'Escape',
        preventDefault() {
            prevented = true;
        }
    });

    assert.equal(await promise, false);
    assert.equal(prevented, true);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.children.length, 1);
    assert.equal(dialog.listeners.keydown, undefined);
    assert.equal(confirmButton.listeners.click, undefined);

    confirmClick();
    assert.equal(trigger.focusCount, 2);
});

test('confirmAction preserves a custom null Escape value', async () => {
    const document = createFakeDocument();
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });
    const promise = service.confirmAction('请选择导入方式', { escapeValue: null });
    const dialog = document.body.children[0].children[0];

    dialog.listeners.keydown({
        key: 'Escape',
        preventDefault() {}
    });

    assert.equal(await promise, null);
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

test('promptAction focuses the input and resolves its edited value on Enter', async () => {
    const document = createFakeDocument();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });
    const promise = service.promptAction('请输入文件名', { defaultValue: '默认方案' });
    const backdrop = document.body.children[1];
    const dialog = backdrop.children[0];
    const input = dialog.children[1];
    let prevented = false;

    assert.equal(input.value, '默认方案');
    assert.equal(document.activeElement, input);
    input.value = '成都方案';
    dialog.listeners.keydown({
        key: 'Enter',
        target: input,
        preventDefault() {
            prevented = true;
        }
    });

    assert.equal(await promise, '成都方案');
    assert.equal(prevented, true);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.children.length, 1);
});

test('promptAction cancels on Escape and falls back to native prompt without a document', async () => {
    const document = createFakeDocument();
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });
    const promise = service.promptAction('请输入文件名', { defaultValue: '默认方案' });
    const dialog = document.body.children[0].children[0];

    dialog.listeners.keydown({ key: 'Escape', preventDefault() {} });
    assert.equal(await promise, null);

    const fallback = createDialogService({
        prompt(message, defaultValue) {
            assert.equal(message, '请输入文件名');
            assert.equal(defaultValue, '默认方案');
            return '浏览器输入';
        }
    });
    assert.equal(
        await fallback.promptAction('请输入文件名', { defaultValue: '默认方案' }),
        '浏览器输入'
    );
});

test('opening a second modal dismisses the previous one without stacking backdrops', async () => {
    const document = createFakeDocument();
    const { createDialogService } = require('../utils/dialog.js');
    const service = createDialogService({ document });

    const first = service.confirmAction('第一次确认');
    assert.equal(document.body.children.length, 1);

    const second = service.confirmAction('第二次确认');
    assert.equal(document.body.children.length, 1);
    assert.equal(await first, false);

    const dialog = document.body.children[0].children[0];
    assert.equal(dialog.attributes['aria-label'], '第二次确认');
    dialog.children[1].children[1].listeners.click();
    assert.equal(await second, true);
    assert.equal(document.body.children.length, 0);
});
