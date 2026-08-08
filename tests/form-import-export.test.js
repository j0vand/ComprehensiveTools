const test = require('node:test');
const assert = require('node:assert/strict');

const FormImportExport = require('../utils/form-import-export.js');

function control(props) {
    return {
        tagName: props.tagName || 'INPUT',
        type: props.type || 'text',
        id: props.id || '',
        name: props.name || '',
        value: props.value || '',
        checked: Boolean(props.checked),
        disabled: Boolean(props.disabled),
        dispatches: [],
        dispatchEvent(event) {
            this.dispatches.push(event.type);
        }
    };
}

function root(controls) {
    return {
        insertAdjacentElement() {},
        querySelectorAll(selector) {
            if (selector === 'input, select, textarea') return controls;
            return [];
        }
    };
}

test('collectFormData captures text, select, checkbox, and selected radio values', () => {
    const controls = [
        control({ id: 'salary', value: '12000' }),
        control({ id: 'city', tagName: 'SELECT', value: 'chengdu' }),
        control({ id: 'includeBonus', type: 'checkbox', checked: true }),
        control({ name: 'gender', type: 'radio', value: 'male', checked: true }),
        control({ name: 'gender', type: 'radio', value: 'female', checked: false })
    ];

    const data = FormImportExport.collectFormData(root(controls));

    assert.deepEqual(data.fields, {
        salary: '12000',
        city: 'chengdu',
        includeBonus: true,
        gender: 'male'
    });
});

test('applyFormData restores values and dispatches input/change events', () => {
    const salary = control({ id: 'salary', value: '' });
    const checkedRadio = control({ name: 'gender', type: 'radio', value: 'male', checked: true });
    const targetRadio = control({ name: 'gender', type: 'radio', value: 'female', checked: false });
    const controls = [salary, checkedRadio, targetRadio];

    const result = FormImportExport.applyFormData(root(controls), {
        fields: {
            salary: '18000',
            gender: 'female'
        }
    });

    assert.equal(result.appliedCount, 2);
    assert.equal(salary.value, '18000');
    assert.equal(checkedRadio.checked, false);
    assert.equal(targetRadio.checked, true);
    assert.deepEqual(salary.dispatches, ['input', 'change']);
    assert.deepEqual(targetRadio.dispatches, ['input', 'change']);
});

test('applyFormData parses explicit checkbox booleans without truthy coercion', () => {
    const falseCheckbox = control({ id: 'includeBonus', type: 'checkbox', checked: true });
    const invalidCheckbox = control({ id: 'subscribe', type: 'checkbox', checked: false });

    const result = FormImportExport.applyFormData(root([falseCheckbox, invalidCheckbox]), {
        fields: {
            includeBonus: 'false',
            subscribe: 'yes'
        }
    });

    assert.equal(falseCheckbox.checked, false);
    assert.deepEqual(falseCheckbox.dispatches, ['input', 'change']);
    assert.equal(invalidCheckbox.checked, false);
    assert.deepEqual(invalidCheckbox.dispatches, []);
    assert.equal(result.appliedCount, 1);
});

test('init 需要 storageKey，并渲染本地方案按钮而非文件导入导出', () => {
    const notifications = [];
    const formRoot = root([]);
    const toolbarShell = {
        classList: { add() {} },
        setAttribute() {},
        querySelector(selector) {
            if (selector === '[data-role="current-preset"]') {
                return { textContent: '', title: '' };
            }
            if (selector.startsWith('[data-action=')) {
                return { addEventListener() {} };
            }
            return null;
        }
    };
    const documentStub = {
        body: formRoot,
        head: { appendChild() {} },
        title: '测试页',
        getElementById() {
            return null;
        },
        querySelector(selector) {
            if (selector === '.test-root') return formRoot;
            return null;
        },
        querySelectorAll() {
            return [];
        },
        createElement(tagName) {
            if (tagName === 'div') return toolbarShell;
            if (tagName === 'style') return { id: '', textContent: '' };
            return {};
        }
    };

    const originalDocument = global.document;
    const originalWindow = global.window;
    global.document = documentStub;
    global.window = {
        StorageService: {
            getJson() { return null; },
            setJson() { return { ok: true }; }
        },
        CommonUtils: {
            showNotification(message, type) {
                notifications.push({ message, type });
            }
        }
    };

    try {
        const result = FormImportExport.init({
            storageKey: 'demo-key',
            rootSelector: '.test-root',
            pageName: '测试'
        });
        assert.ok(result.toolbar);
        assert.equal(typeof result.refreshLabel, 'function');
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }
});
