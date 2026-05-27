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
