const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PensionCalculatorCore = require('../pages/pension-calculator/calculator-core.js');

function createData(overrides = {}) {
    return {
        currentAge: 40,
        avgSalary: 100,
        paidYears: 20,
        accountBalance: 1000,
        salaryBase: 100,
        pastAvgIndex: 1,
        futureAvgIndex: null,
        baseChangeMode: 'follow_salary',
        paymentPlan: 'continuous',
        stopAge: 41,
        salaryGrowth: 0.1,
        socAvgGrowth: 0,
        interestRate: 0,
        ...overrides
    };
}

function retirementInfo(currentAge, retireAge, retireYear = 2045) {
    return {
        retireAge,
        yearsToRetire: retireAge - currentAge,
        retireYear
    };
}

function createPageContext(valueOverrides = {}) {
    const values = {
        'current-age': '30',
        'retire-age': '63',
        'avg-salary': '8000',
        'paid-years': '5',
        'account-balance': '20000',
        'salary-base': '8000',
        'past-avg-index': '1',
        'avg-index': '',
        'stop-age': '50',
        'salary-growth': '3',
        'soc-avg-growth': '3',
        'interest-rate': '3',
        ...valueOverrides
    };
    const createElement = (value = '') => ({
        value,
        listeners: {},
        classList: {
            toggle() {},
            add() {},
            remove() {}
        },
        addEventListener(name, handler) {
            this.listeners[name] = handler;
        }
    });
    const elements = Object.fromEntries(
        Object.entries(values).map(([id, value]) => [id, createElement(value)])
    );
    elements['calculate-btn'] = createElement();
    elements['reset-btn'] = createElement();
    elements['stop-age-group'] = createElement();
    elements['stop-age-hint'] = {
        hidden: true,
        textContent: '',
        innerHTML: '',
        classList: {
            add() {},
            remove() {},
            toggle() {}
        }
    };
    elements['calculation-details'] = {
        innerHTML: '',
        querySelector(selector) {
            if (selector === 'details') {
                return { addEventListener() {} };
            }
            if (selector === 'summary span') {
                return { textContent: '▶' };
            }
            return null;
        }
    };
    const radioGroups = {
        'input[name="payment-plan"]': [createElement('continuous'), createElement('stop_early')],
        'input[name="gender"]': [createElement('male'), createElement('female_worker')],
        'input[name="base-change-mode"]': [createElement('follow_salary'), createElement('fixed')]
    };
    const documentListeners = {};
    const notifications = [];
    const warnings = [];
    const document = {
        addEventListener(name, handler) {
            documentListeners[name] = handler;
        },
        getElementById(id) {
            return elements[id] || null;
        },
        querySelectorAll(selector) {
            return radioGroups[selector] || [];
        }
    };
    const testConsole = Object.create(console);
    testConsole.warn = (...args) => warnings.push(args);
    const context = { console: testConsole, document, Number, Date, setTimeout, clearTimeout };
    context.window = context;
    context.CommonUtils = {
        getElementValue(id, type, defaultValue) {
            const raw = elements[id].value.trim();
            if (raw === '') return defaultValue;
            return type === 'int' ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
        },
        getRadioValue(name, defaultValue) {
            if (name === 'payment-plan') return 'continuous';
            if (name === 'base-change-mode') return 'follow_salary';
            if (name === 'gender') return 'male';
            return defaultValue;
        },
        formatMoney(value) {
            return Number(value).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },
        showNotification(message) {
            notifications.push(message);
        }
    };
    context.PensionCalculatorCore = PensionCalculatorCore;
    context.PensionCalculatorStorage = {
        DEFAULT_VALUES: {
            currentAge: 30,
            retireAge: 63,
            avgSalary: 8000,
            paidYears: 5,
            accountBalance: 20000,
            salaryBase: 8000,
            pastAvgIndex: 1,
            baseChangeMode: 'follow_salary',
            stopAge: 50,
            salaryGrowth: 3,
            socAvgGrowth: 3,
            interestRate: 3
        },
        restoreFormData() {},
        saveFormData() {},
        clearFormData() {}
    };
    vm.createContext(context);
    const source = fs.readFileSync(
        path.join(__dirname, '../pages/pension-calculator/calculator.js'),
        'utf8'
    );
    vm.runInContext(source, context);
    return { context, notifications, warnings, documentListeners, elements };
}

test('清空必填金额后不会回退默认值并由页面校验拒绝', () => {
    const { context, notifications } = createPageContext({ 'avg-salary': '' });
    const inputs = vm.runInContext('getInputs()', context);

    assert.equal(Number.isNaN(inputs.avgSalary), true);
    assert.equal(vm.runInContext('validateInputs(getInputs())', context), false);
    assert.match(notifications.at(-1), /平均工资/);
});

test('存储恢复异常不会阻断页面按钮和输入监听初始化', () => {
    const { context, warnings, documentListeners, elements } = createPageContext();
    context.PensionCalculatorStorage.restoreFormData = () => {
        throw new Error('broken storage');
    };

    assert.doesNotThrow(() => documentListeners.DOMContentLoaded());
    assert.equal(typeof elements['calculate-btn'].listeners.click, 'function');
    assert.equal(typeof elements['reset-btn'].listeners.click, 'function');
    assert.equal(typeof elements['avg-salary'].listeners.input, 'function');
    assert.equal(warnings.length, 1);
});

test('页面和输入控件拒绝超出0.6至3的未来缴费指数', () => {
    const { context, notifications } = createPageContext({ 'avg-index': '10' });
    const html = fs.readFileSync(
        path.join(__dirname, '../pages/pension-calculator/pensionCalculator.html'),
        'utf8'
    );

    assert.equal(vm.runInContext('validateInputs(getInputs())', context), false);
    assert.match(notifications.at(-1), /0\.6至3/);
    assert.match(html, /id="avg-index"[^>]*min="0\.6"[^>]*max="3"/);
});

test('核心拒绝越界未来缴费指数并接受上下边界', () => {
    const info = retirementInfo(40, 42);

    assert.throws(
        () => PensionCalculatorCore.calculatePension(createData({ futureAvgIndex: 0.59 }), info),
        /0\.6至3/
    );
    assert.throws(
        () => PensionCalculatorCore.calculatePension(createData({ futureAvgIndex: 3.01 }), info),
        /0\.6至3/
    );
    assert.doesNotThrow(
        () => PensionCalculatorCore.calculatePension(createData({ futureAvgIndex: 0.6 }), info)
    );
    assert.doesNotThrow(
        () => PensionCalculatorCore.calculatePension(createData({ futureAvgIndex: 3 }), info)
    );
});

test('跟随工资的缴费基数首年不预增长', () => {
    const result = PensionCalculatorCore.calculatePension(
        createData(),
        retirementInfo(40, 42)
    );

    assert.equal(result.yearDetails[0].yearBase, 100);
    assert.ok(Math.abs(result.yearDetails[1].yearBase - 110) < 1e-9);
});

test('缴费基数同时受社平工资60%下限和300%上限约束', () => {
    const low = PensionCalculatorCore.calculatePension(
        createData({ salaryBase: 50, salaryGrowth: 0 }),
        retirementInfo(40, 41)
    ).yearDetails[0];
    const high = PensionCalculatorCore.calculatePension(
        createData({ salaryBase: 400, salaryGrowth: 0 }),
        retirementInfo(40, 41)
    ).yearDetails[0];

    assert.equal(low.minBase, 60);
    assert.equal(low.maxBase, 300);
    assert.equal(low.yearBase, 60);
    assert.equal(low.isRaisedByMinBase, true);
    assert.equal(low.isLoweredByMaxBase, false);
    assert.equal(high.yearBase, 300);
    assert.equal(high.isRaisedByMinBase, false);
    assert.equal(high.isLoweredByMaxBase, true);
});

test('提前停缴后账户继续复利到退休且只增加实际缴费年限', () => {
    const result = PensionCalculatorCore.calculatePension(
        createData({
            currentAge: 58,
            paidYears: 20,
            accountBalance: 1000,
            salaryBase: 100,
            paymentPlan: 'stop_early',
            stopAge: 59,
            salaryGrowth: 0,
            interestRate: 0.1
        }),
        retirementInfo(58, 62)
    );

    assert.equal(result.yearDetails.length, 5);
    assert.ok(Math.abs(result.totalAccountBalance - 1591.876) < 1e-9);
    assert.equal(result.totalYears, 21);
    assert.equal(result.yearDetails[1].isContributionYear, false);
    assert.equal(result.yearDetails[4].accumulatedBalance, result.totalAccountBalance);
});

test('年度行按年初状态展示累计年限和如现在停止待遇', () => {
    const result = PensionCalculatorCore.calculatePension(
        createData({ paidYears: 7 }),
        retirementInfo(40, 42)
    );

    assert.equal(result.yearDetails[0].accumulatedYears, 7);
    assert.equal(result.yearDetails[1].accumulatedYears, 8);
    assert.equal(result.yearDetails[2].accumulatedYears, 9);
});

test('最低缴费年限按退休年份逐步提高并封顶20年', () => {
    assert.equal(PensionCalculatorCore.getMinimumContributionYears(2029), 15);
    assert.equal(PensionCalculatorCore.getMinimumContributionYears(2030), 15.5);
    assert.equal(PensionCalculatorCore.getMinimumContributionYears(2031), 16);
    assert.equal(PensionCalculatorCore.getMinimumContributionYears(2039), 20);
    assert.equal(PensionCalculatorCore.getMinimumContributionYears(2045), 20);
});

test('最低停缴年龄按已缴费与退休门槛动态估算', () => {
    const estimate = PensionCalculatorCore.getMinimumStopContributionAge({
        currentAge: 40,
        retireAge: 63,
        paidYears: 7,
        retireYear: 2048
    });
    // 2048 年门槛 20 年；已缴 7 年，还需 13 年 → 至少缴至 53 岁
    assert.equal(estimate.valid, true);
    assert.equal(estimate.minimumContributionYears, 20);
    assert.equal(estimate.yearsNeeded, 13);
    assert.equal(estimate.minStopAge, 53);
    assert.equal(estimate.achievable, true);

    const alreadyMet = PensionCalculatorCore.getMinimumStopContributionAge({
        currentAge: 45,
        retireAge: 60,
        paidYears: 20,
        retireYear: 2040
    });
    assert.equal(alreadyMet.alreadyMet, true);
    assert.equal(alreadyMet.minStopAge, 45);

    const halfYear = PensionCalculatorCore.getMinimumStopContributionAge({
        currentAge: 40,
        retireAge: 55,
        paidYears: 7,
        retireYear: 2030
    });
    // 门槛 15.5，已缴 7，还需 9 年 → 49 岁；退休 55 岁可达成
    assert.equal(halfYear.yearsNeeded, 9);
    assert.equal(halfYear.minStopAge, 49);
});

test('2030年退休时15年不具资格而15.5年具备资格', () => {
    const ineligible = PensionCalculatorCore.calculatePension(
        createData({ paidYears: 14, salaryGrowth: 0 }),
        retirementInfo(40, 41, 2030)
    );
    const eligible = PensionCalculatorCore.calculatePension(
        createData({ paidYears: 14.5, salaryGrowth: 0 }),
        retirementInfo(40, 41, 2030)
    );

    assert.equal(ineligible.totalYears, 15);
    assert.equal(ineligible.minimumContributionYears, 15.5);
    assert.equal(ineligible.eligible, false);
    assert.equal(ineligible.eligibilityGap, 0.5);
    assert.equal(ineligible.totalPension, null);
    assert.equal(eligible.totalYears, 15.5);
    assert.equal(eligible.eligible, true);
    assert.equal(eligible.eligibilityGap, 0);
    assert.equal(typeof eligible.totalPension, 'number');
});

test('汇总严格取退休行的账户余额和养老金字段', () => {
    const result = PensionCalculatorCore.calculatePension(
        createData({ interestRate: 0.05, socAvgGrowth: 0.03 }),
        retirementInfo(40, 43)
    );
    const retirementRow = result.yearDetails.at(-1);

    assert.equal(result.totalAccountBalance, retirementRow.accumulatedBalance);
    assert.equal(result.basicPension, retirementRow.basicPensionIfStop);
    assert.equal(result.personalPension, retirementRow.personalPensionIfStop);
    assert.equal(result.totalPension, retirementRow.pensionIfStop);
    assert.equal(result.balanceFutureValue, 1000 * Math.pow(1.05, 3));
    assert.equal(
        result.futureContributionTotal,
        result.totalAccountBalance - result.balanceFutureValue
    );
});

test('不满足领取资格时养老金字段为null但账户余额仍保留', () => {
    const result = PensionCalculatorCore.calculatePension(
        createData({ paidYears: 0 }),
        retirementInfo(40, 41, 2045)
    );
    const retirementRow = result.yearDetails.at(-1);

    assert.equal(result.eligible, false);
    assert.equal(result.basicPension, null);
    assert.equal(result.personalPension, null);
    assert.equal(result.totalPension, null);
    assert.equal(retirementRow.basicPensionIfStop, null);
    assert.equal(retirementRow.personalPensionIfStop, null);
    assert.equal(retirementRow.pensionIfStop, null);
    assert.ok(result.totalAccountBalance > 0);
});

test('手填未来指数逐年使用，留空时使用已钳制基数对应指数', () => {
    const manual = PensionCalculatorCore.calculatePension(
        createData({ paidYears: 10, futureAvgIndex: 2 }),
        retirementInfo(40, 42)
    );
    const automatic = PensionCalculatorCore.calculatePension(
        createData({ paidYears: 0, salaryBase: 400, salaryGrowth: 0 }),
        retirementInfo(40, 41)
    );

    assert.equal(manual.weightedAvgIndex, (10 + 2 + 2) / 12);
    assert.equal(automatic.weightedAvgIndex, 3);
});

test('展开明细会展示公式各位置的原始输入代入', () => {
    const { context, elements } = createPageContext();
    const inputs = {
        currentAge: 40,
        avgSalary: 8000,
        paidYears: 10,
        accountBalance: 20000,
        salaryBase: 8000,
        pastAvgIndex: 1,
        futureAvgIndex: null,
        baseChangeMode: 'follow_salary',
        paymentPlan: 'continuous',
        stopAge: 50,
        salaryGrowth: 0.03,
        socAvgGrowth: 0.03,
        interestRate: 0.03
    };
    const info = retirementInfo(40, 43, 2029);
    const result = PensionCalculatorCore.calculatePension(inputs, info);
    context.__result = result;
    context.__info = info;
    context.__inputs = inputs;

    vm.runInContext('renderCalculationDetails(__result, __info, __inputs)', context);

    const html = elements['calculation-details'].innerHTML;
    assert.match(html, /detail-param-table/);
    assert.match(html, /detail-equation-list/);
    assert.match(html, /当前社平工资/);
    assert.match(html, /8,000\.00 × \(1 \+ 3%\)\^3/);
    assert.match(html, /20,000\.00 × \(1 \+ 3%\)\^3/);
    assert.match(html, /÷ 223/);
    assert.match(html, /公式/);
    assert.match(html, /参数/);
    assert.match(html, /算式/);
    assert.doesNotMatch(html, /detail-formula-sub/);
});
