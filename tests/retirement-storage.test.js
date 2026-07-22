const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FormImportExport = require('../utils/form-import-export.js');

function numberControl(id, value) {
    return {
        tagName: 'INPUT',
        type: 'number',
        id,
        name: '',
        value: String(value),
        required: true,
        min: '',
        max: '',
        validity: { stepMismatch: false },
        dispatches: [],
        dispatchEvent(event) {
            this.dispatches.push(event.type);
        }
    };
}

function radioControl(value, checked) {
    return {
        tagName: 'INPUT',
        type: 'radio',
        id: '',
        name: 'gender',
        value,
        checked: Boolean(checked),
        required: true,
        dispatches: [],
        dispatchEvent(event) {
            this.dispatches.push(event.type);
        }
    };
}

function createForm(controls) {
    return {
        querySelectorAll(selector) {
            return selector === 'input, select, textarea' ? controls : [];
        }
    };
}

function loadStorageModule({ document, StorageService, console: consoleStub }) {
    const context = {
        console: consoleStub || console,
        document,
        StorageService,
        StorageKeys: { RETIREMENT_CALCULATOR: 'retirement-test' },
        FormImportExport,
        DialogService: {
            showToast() {}
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(
        fs.readFileSync(
            path.join(__dirname, '../pages/retirement-calculator/calculator-storage.js'),
            'utf8'
        ),
        context
    );
    return context;
}

test('FIRE 表单恢复会忽略无效性别，且不阻断初始化', () => {
    const age = numberControl('current-age', 30);
    const life = numberControl('life-expectancy', 85);
    const male = radioControl('male', true);
    const female = radioControl('female', false);
    const form = createForm([age, life, male, female]);
    const warnings = [];

    const context = loadStorageModule({
        document: {
            getElementById(id) {
                return id === 'fire-form' ? form : null;
            }
        },
        StorageService: {
            getJson() {
                return {
                    version: 1,
                    fields: {
                        gender: '"]',
                        'current-age': '42',
                        'life-expectancy': '90'
                    }
                };
            }
        },
        console: {
            warn(...args) {
                warnings.push(args.join(' '));
            }
        }
    });

    assert.doesNotThrow(() => context.retirementCalculatorStorage.restoreFormData());
    assert.equal(age.value, '30');
    assert.equal(life.value, '85');
    assert.deepEqual([male.checked, female.checked], [true, false]);
    assert.ok(warnings.some(text => text.includes('忽略无效的 FIRE 表单存储')));
});

test('FIRE 表单保存保留原始展示值，并写入当前版本格式', () => {
    const controls = [
        numberControl('current-age', '30.5'),
        numberControl('life-expectancy', ''),
        numberControl('target-retire-age', '55.5'),
        numberControl('extra-saving-years-after-fire', '1.5'),
        radioControl('male', true),
        radioControl('female', false)
    ];
    // 年龄/寿命必填；目标年龄与继续储蓄用于验证小数不被提前清洗。
    controls[1].required = true;
    controls[2].required = false;
    controls[3].required = true;

    const form = createForm(controls);
    let saved;

    const context = loadStorageModule({
        document: {
            getElementById(id) {
                return id === 'fire-form' ? form : null;
            }
        },
        StorageService: {
            setJson(key, value) {
                assert.equal(key, 'retirement-test');
                saved = value;
                return { ok: true };
            }
        }
    });

    assert.equal(context.retirementCalculatorStorage.saveFormData(), true);
    assert.equal(saved.version, 1);
    assert.equal(saved.fields['current-age'], '30.5');
    assert.equal(saved.fields['life-expectancy'], '');
    assert.equal(saved.fields['target-retire-age'], '55.5');
    assert.equal(saved.fields['extra-saving-years-after-fire'], '1.5');
    assert.equal(saved.fields.gender, 'male');
});

test('FIRE 表单恢复忽略旧格式快照', () => {
    const age = numberControl('current-age', 30);
    const form = createForm([age]);
    let applyCalled = false;

    const context = loadStorageModule({
        document: {
            getElementById(id) {
                return id === 'fire-form' ? form : null;
            }
        },
        StorageService: {
            getJson() {
                return {
                    currentAge: 42,
                    lifeExpectancy: 90
                };
            }
        }
    });
    context.FormImportExport = {
        applyFormData() {
            applyCalled = true;
        }
    };

    context.retirementCalculatorStorage.restoreFormData();
    assert.equal(applyCalled, false);
    assert.equal(age.value, '30');
});
