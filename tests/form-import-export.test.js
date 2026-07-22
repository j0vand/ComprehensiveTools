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

function importHarness(controls, file, text) {
    const notifications = [];
    const fileInput = {
        files: [file],
        value: 'selected.json',
        listeners: {},
        addEventListener(name, listener) {
            this.listeners[name] = listener;
        },
        click() {}
    };
    const importButton = {
        listeners: {},
        addEventListener(name, listener) {
            this.listeners[name] = listener;
        }
    };
    const exportButton = {
        listeners: {},
        addEventListener(name, listener) {
            this.listeners[name] = listener;
        }
    };
    const toolbar = {
        classList: { add() {} },
        setAttribute() {},
        querySelector(selector) {
            if (selector === '.form-transfer-file') return fileInput;
            if (selector === '[data-action="import"]') return importButton;
            if (selector === '[data-action="export"]') return exportButton;
            return null;
        }
    };
    const formRoot = root(controls);
    const document = {
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
            return tagName === 'div' ? toolbar : {};
        }
    };
    let readerCount = 0;

    class FakeFileReader {
        constructor() {
            readerCount += 1;
            this.result = '';
        }

        readAsText() {
            this.result = text;
            this.onload();
        }
    }

    return {
        document,
        fileInput,
        notifications,
        FakeFileReader,
        getReaderCount() {
            return readerCount;
        }
    };
}

function withImportGlobals(harness, callback) {
    const originalDocument = global.document;
    const originalWindow = global.window;
    const originalFileReader = global.FileReader;

    global.document = harness.document;
    global.window = {
        CommonUtils: {
            showNotification(message, type) {
                harness.notifications.push({ message, type });
            }
        },
        prompt() {
            return null;
        },
        alert() {}
    };
    global.FileReader = harness.FakeFileReader;

    try {
        return callback();
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
        global.FileReader = originalFileReader;
    }
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

test('sanitizeFilename keeps useful Chinese text and removes unsafe characters', () => {
    assert.equal(FormImportExport.sanitizeFilename('养老/成都:方案*01'), '养老_成都_方案_01');
    assert.equal(FormImportExport.sanitizeFilename('   '), 'calculator-form');
});

test('createExportPayload includes metadata and active button state', () => {
    const data = FormImportExport.createExportPayload({
        pageId: 'pension',
        pageName: '养老计算',
        root: root([control({ id: 'age', value: '35' })]),
        activeState: { currentTab: 'advanced' }
    });

    assert.equal(data.schema, 'comprehensive-tools.form.v1');
    assert.equal(data.pageId, 'pension');
    assert.equal(data.pageName, '养老计算');
    assert.equal(data.fields.age, '35');
    assert.deepEqual(data.activeState, { currentTab: 'advanced' });
});

test('parseImportedText requires plain root and fields objects', () => {
    ['null', '[]', '"text"'].forEach(text => {
        assert.throws(() => FormImportExport.parseImportedText(text), /配置对象/);
    });

    ['{}', '{"fields":null}', '{"fields":[]}', '{"fields":"bad"}'].forEach(text => {
        assert.throws(() => FormImportExport.parseImportedText(text), /表单数据/);
    });

    assert.deepEqual(FormImportExport.parseImportedText('{"fields":{"age":"35"}}').fields, { age: '35' });
});

test('init rejects imports exported by a different page', () => {
    const salary = control({ id: 'salary', value: '1000' });
    const harness = importHarness(
        [salary],
        { size: 128 },
        JSON.stringify({ pageId: 'pension-calculator', fields: { salary: '9000' } })
    );

    withImportGlobals(harness, () => {
        FormImportExport.init({ pageId: 'tax-calculator', rootSelector: '.test-root' });
        harness.fileInput.listeners.change();
    });

    assert.equal(salary.value, '1000');
    assert.equal(harness.notifications.length, 1);
    assert.equal(harness.notifications[0].type, 'error');
    assert.match(harness.notifications[0].message, /当前页面/);
});

test('init rejects files over 2 MiB before creating a reader', () => {
    const harness = importHarness([], { size: 2 * 1024 * 1024 + 1 }, '');

    withImportGlobals(harness, () => {
        FormImportExport.init({ pageId: 'tax-calculator', rootSelector: '.test-root' });
        harness.fileInput.listeners.change();
    });

    assert.equal(harness.getReaderCount(), 0);
    assert.equal(harness.fileInput.value, '');
    assert.equal(harness.notifications.length, 1);
    assert.equal(harness.notifications[0].type, 'error');
    assert.match(harness.notifications[0].message, /2 MiB/);
});

test('export asks for a filename through DialogService instead of native prompt', async () => {
    const harness = importHarness([], { size: 0 }, '');
    const originalDocument = global.document;
    const originalWindow = global.window;
    let dialogCalls = 0;
    let nativeCalls = 0;

    global.document = harness.document;
    global.window = {
        CommonUtils: { showNotification() {} },
        DialogService: {
            promptAction(message, options) {
                dialogCalls += 1;
                assert.equal(message, '请输入导出文件名');
                assert.match(options.defaultValue, /^calculator-form-/);
                return Promise.resolve(null);
            }
        },
        prompt() {
            nativeCalls += 1;
            return null;
        },
        alert() {}
    };

    try {
        FormImportExport.init({ rootSelector: '.test-root' });
        await harness.document.createElement('div').querySelector('[data-action="export"]').listeners.click();
    } finally {
        global.document = originalDocument;
        global.window = originalWindow;
    }

    assert.equal(dialogCalls, 1);
    assert.equal(nativeCalls, 0);
});
