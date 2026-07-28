const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const source = fs.readFileSync(
    path.resolve(__dirname, '../pages/meal/mealViewer.js'),
    'utf8'
);

function fixedDateClass(iso) {
    const NativeDate = Date;
    const timestamp = new NativeDate(iso).getTime();

    return class FixedDate extends NativeDate {
        constructor(...args) {
            super(...(args.length === 0 ? [timestamp] : args));
        }

        static now() {
            return timestamp;
        }
    };
}

function fakeNode(tagName = '') {
    let ownText = '';
    return {
        tagName,
        className: '',
        style: {},
        children: [],
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        replaceChildren(...children) {
            this.children = children;
            ownText = '';
        },
        addEventListener() {},
        set textContent(value) {
            ownText = String(value ?? '');
            this.children = [];
        },
        get textContent() {
            return ownText + this.children.map(child => child.textContent || '').join('');
        }
    };
}

function mealHarness(now, options = {}) {
    let stored = structuredClone(options.stored || []);
    const toasts = [];
    const timeouts = [];
    const intervals = [];
    const elements = {
        mealInput: { value: options.input || '' },
        quickMealNumbers: { value: options.quickInput || '' },
        weekDetectHint: fakeNode('div'),
        mealHistory: fakeNode('div'),
        todayMeals: fakeNode('div'),
        'save-meal-btn': fakeNode('button'),
        'clear-meal-btn': fakeNode('button')
    };
    const document = {
        hidden: false,
        addEventListener() {},
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() {
            return { value: options.owner || 'mine' };
        },
        createElement(tagName) {
            return fakeNode(tagName);
        },
        createTextNode(text) {
            const node = fakeNode('#text');
            node.textContent = text;
            return node;
        }
    };
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Date: fixedDateClass(now),
        document,
        localStorage: {
            getItem() {
                return JSON.stringify(stored);
            },
            setItem(key, value) {
                if (options.failSave) throw new Error('quota');
                stored = JSON.parse(value);
            },
            removeItem() {
                stored = [];
            }
        },
        setInterval(callback, delay) {
            intervals.push({ callback, delay });
            return intervals.length;
        },
        clearInterval() {},
        setTimeout(callback, delay) {
            timeouts.push({ callback, delay });
            return timeouts.length;
        },
        clearTimeout() {}
    };
    sandbox.window = sandbox;
    sandbox.StorageKeys = { MEAL_VIEWER_DATA: 'meal-test' };
    sandbox.CommonUtils = {
        getLocalStorageItem() {
            return structuredClone(stored);
        },
        setLocalStorageItem(key, value) {
            if (options.failSave) return false;
            stored = structuredClone(value);
            return true;
        },
        removeLocalStorageItem() {
            stored = [];
            return true;
        }
    };
    sandbox.DialogService = {
        showToast(message, type) {
            toasts.push({ message, type });
        },
        confirmAction() {
            return Promise.resolve(true);
        }
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(`${source}\n;globalThis.MealTest = {\n        detectWeekFromHeader, standardizeDate, parseDateString, processMealData,\n        removeExpiredArrangements, renderArrangements, displayMeals, displayTodayMeals, startRefreshTimer, readArrangements\n    };`, context, { filename: 'mealViewer.js' });

    return {
        api: sandbox.MealTest,
        elements,
        toasts,
        timeouts,
        intervals,
        getStored() {
            return structuredClone(stored);
        }
    };
}

test('meal date ranges resolve the end date into the next year', () => {
    const { api } = mealHarness('2026-12-29T10:00:00');
    const range = api.detectWeekFromHeader('12月30日-1月3日用餐收集');

    assert.equal(range.startDate.getFullYear(), 2026);
    assert.equal(range.startDate.getMonth(), 11);
    assert.equal(range.startDate.getDate(), 30);
    assert.equal(range.endDate.getFullYear(), 2027);
    assert.equal(range.endDate.getMonth(), 0);
    assert.equal(range.endDate.getDate(), 3);
});

test('explicit month-day input is anchored to its header and is not shifted by seven days', () => {
    const { api } = mealHarness('2026-07-22T10:00:00');
    const range = api.detectWeekFromHeader('7月27日-7月31日用餐收集');
    const standardized = api.standardizeDate('7月27日', range);
    const parsed = api.parseDateString(standardized);

    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 6);
    assert.equal(parsed.getDate(), 27);
});

test('repeated meal imports replace the same meal slot instead of stacking duplicates', () => {
    const input = [
        '7月27日-7月31日用餐收集',
        '【7月27日】',
        '晚餐1：番茄牛腩'
    ].join('\n');
    const harness = mealHarness('2026-07-22T10:00:00', { input });

    harness.api.processMealData();
    harness.elements.mealInput.value = input;
    harness.api.processMealData();

    assert.equal(harness.getStored().length, 1);
});

test('meal entries expire exactly at 13:00 and 19:20', () => {
    const lunchHarness = mealHarness('2026-07-22T13:00:00');
    assert.equal(lunchHarness.api.removeExpiredArrangements([
        { date: '2026年7月22日-周三', mealTime: '午餐' }
    ]).length, 0);

    const dinnerHarness = mealHarness('2026-07-22T19:20:00');
    assert.equal(dinnerHarness.api.removeExpiredArrangements([
        { date: '2026年7月22日-周三', mealTime: '晚餐' }
    ]).length, 0);
});

test('meal refresh timer aligns to the next minute boundary', () => {
    const { api, timeouts } = mealHarness('2026-07-22T12:59:30');

    api.startRefreshTimer();

    assert.equal(timeouts.length, 1);
    assert.equal(timeouts[0].delay, 30000);
});

test('meal save failure preserves input and reports an error', () => {
    const input = [
        '7月27日-7月31日用餐收集',
        '【7月27日】',
        '晚餐1：番茄牛腩'
    ].join('\n');
    const harness = mealHarness('2026-07-22T10:00:00', {
        input,
        quickInput: '8, 9',
        failSave: true
    });

    harness.api.processMealData();

    assert.equal(harness.elements.mealInput.value, input);
    assert.equal(harness.elements.quickMealNumbers.value, '8, 9');
    assert.deepEqual(harness.getStored(), []);
    assert.equal(harness.toasts.at(-1).type, 'error');
    assert.match(harness.toasts.at(-1).message, /保存失败/);
});

test('invalid calendar days are rejected without clearing meal input', () => {
    const input = [
        '2月28日-3月1日用餐收集',
        '【2月31日】',
        '晚餐1：不存在的日期'
    ].join('\n');
    const harness = mealHarness('2026-02-20T10:00:00', { input });

    harness.api.processMealData();

    assert.deepEqual(harness.getStored(), []);
    assert.equal(harness.elements.mealInput.value, input);
    assert.equal(harness.toasts.at(-1).type, 'error');
    assert.match(harness.toasts.at(-1).message, /有效|日期/);
});

test('meal import reports the number of genuinely new slots after deduplication', () => {
    const input = [
        '7月27日-7月31日用餐收集',
        '【7月27日】',
        '晚餐1：已有餐点',
        '【7月28日】',
        '晚餐2：新增餐点'
    ].join('\n');
    const harness = mealHarness('2026-07-22T10:00:00', {
        input,
        stored: [{
            date: '2026年7月27日-周一', mealTime: '晚餐', number: '1',
            content: '已有餐点', owner: 'mine'
        }]
    });

    harness.api.processMealData();

    assert.equal(harness.getStored().length, 2);
    assert.equal(harness.toasts.at(-1).type, 'success');
    assert.match(harness.toasts.at(-1).message, /新增 1 条/);
});

test('duplicate slots inside one meal import count once and keep the final content', () => {
    const input = [
        '7月27日-7月31日用餐收集',
        '【7月27日】',
        '晚餐1：旧内容',
        '【7月27日】',
        '晚餐2：最终内容'
    ].join('\n');
    const harness = mealHarness('2026-07-22T10:00:00', { input });

    harness.api.processMealData();

    assert.equal(harness.getStored().length, 1);
    assert.equal(harness.getStored()[0].number, '2');
    assert.equal(harness.getStored()[0].content, '最终内容');
    assert.equal(harness.toasts.at(-1).message, '成功新增 1 条安排');
});

test('meal import with no new or changed slots preserves input and reports an error', () => {
    const input = [
        '7月27日-7月31日用餐收集',
        '【7月27日】',
        '晚餐1：已有餐点'
    ].join('\n');
    const existing = [{
        date: '2026年7月27日-周一', mealTime: '晚餐', number: '1',
        content: '已有餐点', owner: 'mine'
    }];
    const harness = mealHarness('2026-07-22T10:00:00', { input, stored: existing });

    harness.api.processMealData();

    assert.deepEqual(harness.getStored(), existing);
    assert.equal(harness.elements.mealInput.value, input);
    assert.equal(harness.toasts.at(-1).type, 'error');
    assert.match(harness.toasts.at(-1).message, /没有|新增|重复/);
});

test('meal grouping treats __proto__ and malicious persisted text as literal content', () => {
    const harness = mealHarness('2026-07-22T10:00:00');
    const malicious = '<img src=x onerror=globalThis.pwned=true>';

    assert.doesNotThrow(() => harness.api.renderArrangements([{
        date: '__proto__',
        mealTime: '晚餐',
        number: '\"><svg onload=globalThis.pwned=true>',
        content: malicious,
        owner: 'mine'
    }]));
    assert.match(harness.elements.mealHistory.textContent, /__proto__/);
    assert.equal(harness.elements.mealHistory.textContent.includes(malicious), true);
});

test('meal display ignores unparsable dates instead of throwing', () => {
    const harness = mealHarness('2026-07-22T10:00:00', {
        stored: [
            {
                date: 'not-a-date',
                mealTime: '晚餐',
                number: '1',
                content: '坏数据',
                owner: 'mine'
            },
            {
                date: '2026年7月23日-周四',
                mealTime: '晚餐',
                number: '2',
                content: '有效安排',
                owner: 'mine'
            }
        ]
    });

    assert.doesNotThrow(() => harness.api.displayMeals());
    assert.doesNotThrow(() => harness.api.displayTodayMeals());
    assert.equal(harness.api.readArrangements().length, 1);
    assert.match(harness.elements.mealHistory.textContent, /有效安排/);
    assert.equal(harness.elements.mealHistory.textContent.includes('坏数据'), false);
});

if (!process.env.MEAL_TIMEZONE_CHILD) {
    test('meal business-day behavior passes in UTC and an American timezone', () => {
        for (const timezone of ['UTC', 'America/Los_Angeles']) {
            const childEnv = { ...process.env, TZ: timezone, MEAL_TIMEZONE_CHILD: '1' };
            delete childEnv.NODE_TEST_CONTEXT;
            const result = spawnSync(process.execPath, ['--test', __filename], {
                encoding: 'utf8',
                env: childEnv
            });
            assert.equal(result.status, 0, `${timezone}\n${result.stdout}\n${result.stderr}`);
            assert.match(result.stdout, /pass 12/);
        }
    });
}
