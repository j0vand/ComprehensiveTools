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
