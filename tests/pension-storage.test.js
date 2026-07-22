const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('restoreFormData ignores malformed radio values and continues restoring fields', () => {
    const elements = {
        'current-age': { value: '30' },
        'retire-age': { value: '63' },
        'salary-growth': { value: '3' }
    };
    const radioGroups = {
        'input[name="gender"]': [
            { value: 'male', checked: true },
            { value: 'female_worker', checked: false }
        ],
        'input[name="base-change-mode"]': [
            { value: 'follow_salary', checked: false },
            { value: 'fixed', checked: true }
        ],
        'input[name="payment-plan"]': [
            { value: 'continuous', checked: true },
            { value: 'stop_early', checked: false }
        ]
    };
    const document = {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() {
            throw new SyntaxError('Invalid selector');
        },
        querySelectorAll(selector) {
            return radioGroups[selector] || [];
        }
    };
    const context = { console, document };
    context.window = context;
    context.StorageService = {
        getJson() {
            return context.savedFormData;
        },
        setJson() {
            return { ok: true };
        },
        remove() {
            return { ok: true };
        }
    };

    vm.createContext(context);
    context.savedFormData = vm.runInContext(`({
        gender: '\"]',
        baseChangeMode: '\"]',
        paymentPlan: '\"]',
        currentAge: 42,
        retireAge: 64,
        salaryGrowth: 4
    })`, context);
    const source = fs.readFileSync(path.join(__dirname, '../pages/pension-calculator/calculator-storage.js'), 'utf8');
    vm.runInContext(source, context);

    assert.doesNotThrow(() => context.PensionCalculatorStorage.restoreFormData());
    assert.equal(elements['current-age'].value, 42);
    assert.equal(elements['retire-age'].value, 64);
    assert.equal(elements['salary-growth'].value, 4);
    assert.deepEqual(radioGroups['input[name="gender"]'].map(radio => radio.checked), [true, false]);
    assert.deepEqual(radioGroups['input[name="base-change-mode"]'].map(radio => radio.checked), [false, true]);
    assert.deepEqual(radioGroups['input[name="payment-plan"]'].map(radio => radio.checked), [true, false]);
});

test('restoreFormData ignores dangerous object fields and restores later primitives', () => {
    function input(initialValue) {
        let value = initialValue;
        return Object.defineProperty({}, 'value', {
            get() {
                return value;
            },
            set(nextValue) {
                value = String(nextValue);
            }
        });
    }

    const elements = {
        'current-age': input('30'),
        'retire-age': input('63'),
        'salary-growth': input('3')
    };
    const document = {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelectorAll() {
            return [];
        }
    };
    const context = { console, document };
    context.window = context;
    context.StorageService = {
        getJson() {
            return context.savedFormData;
        }
    };

    vm.createContext(context);
    context.savedFormData = vm.runInContext(`({
        currentAge: 42,
        retireAge: { toString: null, valueOf: null },
        salaryGrowth: 4
    })`, context);
    const source = fs.readFileSync(path.join(__dirname, '../pages/pension-calculator/calculator-storage.js'), 'utf8');
    vm.runInContext(source, context);

    assert.doesNotThrow(() => context.PensionCalculatorStorage.restoreFormData());
    assert.equal(elements['current-age'].value, '42');
    assert.equal(elements['retire-age'].value, '63');
    assert.equal(elements['salary-growth'].value, '4');
});

test('saveFormData persists the explicit retirement age', () => {
    const values = {
        'current-age': '30',
        'retire-age': '64',
        'avg-salary': '8000',
        'paid-years': '5',
        'account-balance': '20000',
        'salary-base': '8000',
        'past-avg-index': '1',
        'avg-index': '',
        'stop-age': '50',
        'salary-growth': '3',
        'soc-avg-growth': '3',
        'interest-rate': '3'
    };
    const document = {
        getElementById(id) {
            return Object.hasOwn(values, id) ? { value: values[id] } : null;
        },
        querySelector(selector) {
            if (selector.includes('gender')) return { value: 'male' };
            if (selector.includes('base-change-mode')) return { value: 'follow_salary' };
            if (selector.includes('payment-plan')) return { value: 'continuous' };
            return null;
        }
    };
    let saved;
    const context = { console, document };
    context.window = context;
    context.CommonUtils = {
        getRadioValue(name, defaultValue) {
            if (name === 'gender') return 'male';
            if (name === 'base-change-mode') return 'follow_salary';
            if (name === 'payment-plan') return 'continuous';
            return defaultValue;
        }
    };
    context.StorageService = {
        setJson(key, value) {
            saved = value;
            return { ok: true };
        }
    };

    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, '../pages/pension-calculator/calculator-storage.js'), 'utf8');
    vm.runInContext(source, context);
    context.PensionCalculatorStorage.saveFormData();

    assert.equal(saved.retireAge, 64);
});

test('saveFormData preserves blank required numeric fields instead of defaults', () => {
    const values = {
        'current-age': '',
        'retire-age': '',
        'avg-salary': '',
        'paid-years': '',
        'account-balance': '',
        'salary-base': '',
        'past-avg-index': '',
        'avg-index': '',
        'stop-age': '',
        'salary-growth': '',
        'soc-avg-growth': '',
        'interest-rate': ''
    };
    const document = {
        getElementById(id) {
            return Object.hasOwn(values, id) ? { value: values[id] } : null;
        },
        querySelector(selector) {
            if (selector.includes('gender')) return { value: 'male' };
            if (selector.includes('base-change-mode')) return { value: 'follow_salary' };
            if (selector.includes('payment-plan')) return { value: 'continuous' };
            return null;
        }
    };
    let saved;
    const context = { console, document };
    context.window = context;
    context.CommonUtils = {
        getRadioValue(name, defaultValue) {
            if (name === 'gender') return 'male';
            if (name === 'base-change-mode') return 'follow_salary';
            if (name === 'payment-plan') return 'continuous';
            return defaultValue;
        }
    };
    context.StorageService = {
        setJson(key, value) {
            saved = value;
            return { ok: true };
        }
    };

    vm.createContext(context);
    const source = fs.readFileSync(path.join(__dirname, '../pages/pension-calculator/calculator-storage.js'), 'utf8');
    vm.runInContext(source, context);
    context.PensionCalculatorStorage.saveFormData();

    for (const field of [
        'currentAge', 'retireAge', 'avgSalary', 'paidYears', 'accountBalance',
        'salaryBase', 'pastAvgIndex', 'futureAvgIndex', 'stopAge',
        'salaryGrowth', 'socAvgGrowth', 'interestRate'
    ]) {
        assert.equal(saved[field], null, field);
    }
});
