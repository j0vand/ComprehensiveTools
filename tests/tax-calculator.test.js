const test = require('node:test');
const assert = require('node:assert/strict');

const TaxCalculator = require('../pages/tax/taxCalculator.js');

function createConfig(overrides = {}) {
    return {
        baseSalary: 10000,
        specialDeduction: 0,
        socialBase: 5000,
        fundBase: 5000,
        fundRate: 0,
        medicalPersonalRate: 0,
        medicalCompanyRate: 0,
        otherSocialPersonalRate: 8.4,
        bonusTaxMonth: '',
        bonuses: {},
        isJobChange: false,
        jobChangeMonth: '',
        ...overrides
    };
}

test('other social personal rate can be set to zero', () => {
    const january = TaxCalculator.calculate(createConfig({ otherSocialPersonalRate: 0 }))[0];

    assert.equal(january.otherSocialPersonal, 0);
    assert.equal(january.insurance, 0);
});

test('custom other social rate drives insurance and its personal detail split', () => {
    const january = TaxCalculator.calculate(createConfig({ otherSocialPersonalRate: 10 }))[0];

    assert.equal(january.otherSocialPersonal, 500);
    assert.equal(january.insurance, 500);
});

test('new company other social rate applies from the job-change month', () => {
    const results = TaxCalculator.calculate(createConfig({
        isJobChange: true,
        jobChangeMonth: 2,
        newSocialBase: 6000,
        newOtherSocialPersonalRate: 5
    }));

    assert.equal(results[0].otherSocialPersonal, 420);
    assert.equal(results[1].otherSocialPersonal, 300);
    assert.equal(results[1].insurance, 300);
});

test('new company zero fund rate and zero deduction override previous values', () => {
    const results = TaxCalculator.calculate(createConfig({
        specialDeduction: 1500,
        fundRate: 5,
        isJobChange: true,
        jobChangeMonth: 2,
        newFundRate: 0,
        newSpecialDeduction: 0
    }));

    assert.equal(results[0].fundPersonal, 250);
    assert.equal(results[1].fundPersonal, 0);
    assert.equal(results[1].taxableIncome, 4580);
});

test('40000 annual bonus uses the official lookup formula without segmented result', () => {
    const result = TaxCalculator.calculateBonusTax(40000);

    assert.equal(result.tax, 3790);
    assert.equal(result.actual, 36210);
    assert.equal(result.avgAmount, 40000 / 12);
    assert.equal(Object.hasOwn(result, 'segments'), false);
});

test('sanitizeRestoredState keeps defaults for missing fields and drops invalid values', () => {
    assert.ok(TaxCalculator.app && typeof TaxCalculator.app.sanitizeRestoredState === 'function');

    const sanitized = TaxCalculator.app.sanitizeRestoredState({
        baseSalary: 12000,
        specialDeduction: -1,
        socialBase: 'oops',
        fundRate: 5,
        bonusTaxMonth: '13',
        jobChangeMonth: '2',
        bonuses: { 1: 1000, 2: 'bad', 3: -5 }
    });

    assert.equal(sanitized.baseSalary, 12000);
    assert.equal(Object.hasOwn(sanitized, 'specialDeduction'), false);
    assert.equal(Object.hasOwn(sanitized, 'socialBase'), false);
    assert.equal(sanitized.fundRate, 5);
    assert.equal(Object.hasOwn(sanitized, 'bonusTaxMonth'), false);
    assert.equal(sanitized.jobChangeMonth, '2');
    assert.equal(sanitized.bonuses[1], 1000);
    assert.equal(Object.hasOwn(sanitized.bonuses, 2), false);
    assert.equal(Object.hasOwn(sanitized.bonuses, 3), false);
});

test('年终奖跨档临界点会给出建议金额', () => {
    const advice = TaxCalculator.getBonusCliffAdvice(36001);

    assert.ok(advice, '36001 元应判定落在临界区');
    assert.equal(advice.threshold, 36000);
    assert.equal(advice.rate, 0.1);
    assert.ok(Math.abs(advice.lost - 2309.1) < 0.01, `少拿金额应为 2309.1，实际 ${advice.lost}`);
    assert.equal(advice.breakEven, 38566.67);

    const text = TaxCalculator.describeBonusCliff(36001);
    assert.match(text, /临界区/);
    assert.match(text, /建议发放 36,000 元或 38,566\.67 元以上/);
});

test('临界点本身与非法奖金金额不产生提示', () => {
    for (const bonus of [0, -5, 3000, 36000, 144000, 'abc', null, undefined, Infinity]) {
        assert.equal(
            TaxCalculator.getBonusCliffAdvice(bonus),
            null,
            `${String(bonus)} 不应触发临界提示`
        );
    }
    assert.equal(TaxCalculator.describeBonusCliff(36000), null);
});

test('各档年终奖临界点都能给出建议金额', () => {
    const cases = [
        [144001, 144000, 160500],
        [300001, 300000, 318333.34],
        [420001, 420000, 447500],
        [660001, 660000, 706538.47],
        [960001, 960000, 1120000]
    ];

    for (const [bonus, threshold, breakEven] of cases) {
        const advice = TaxCalculator.getBonusCliffAdvice(bonus);
        assert.ok(advice, `${bonus} 应触发临界提示`);
        assert.equal(advice.threshold, threshold);
        assert.equal(advice.breakEven, breakEven);
    }
});

test('实际到手为负时给出提示', () => {
    const config = createConfig({
        baseSalary: 3000,
        socialBase: 30000,
        fundBase: 3000,
        fundRate: 5,
        medicalPersonalRate: 2
    });
    const monthly = TaxCalculator.calculate(config);
    const warnings = TaxCalculator.findWarnings(config, monthly);

    assert.equal(monthly[0].actual, -270, '基数高于月薪时首月到手应为负');
    const negative = warnings.find(item => item.code === 'negative-actual');
    assert.ok(negative, '应提示实际到手为负');
    assert.match(negative.message, /负数/);
    assert.match(negative.message, /-3,240/);
});

test('社保或公积金基数明显高于月薪时给出提示，留空不提示', () => {
    const high = createConfig({ baseSalary: 10000, socialBase: 40000, fundBase: '' });
    const highWarnings = TaxCalculator.findWarnings(high, TaxCalculator.calculate(high));
    assert.ok(highWarnings.some(item => item.code === 'base-above-salary'));

    const normal = createConfig({ baseSalary: 10000, socialBase: 12000, fundBase: '' });
    const normalWarnings = TaxCalculator.findWarnings(normal, TaxCalculator.calculate(normal));
    assert.equal(
        normalWarnings.some(item => item.code === 'base-above-salary'),
        false,
        '未超过 3 倍或留空时不应提示'
    );
});

test('公积金比例留空时回落到默认值而不是报错', () => {
    const blank = TaxCalculator.calculate(createConfig({ baseSalary: 10000, fundBase: 10000, fundRate: '' }));
    const explicit = TaxCalculator.calculate(createConfig({
        baseSalary: 10000,
        fundBase: 10000,
        fundRate: TaxCalculator.DEFAULT_FUND_RATE
    }));

    assert.equal(blank[0].fundPersonal, 500);
    assert.equal(blank[0].fundPersonal, explicit[0].fundPersonal);
});

function warningHarness() {
    const container = { innerHTML: '', style: {} };
    const originalDocument = global.document;
    global.document = {
        getElementById(id) {
            return id === 'taxWarnings' ? container : null;
        }
    };
    return {
        container,
        restore() {
            global.document = originalDocument;
        }
    };
}

test('个税提示区在无风险时隐藏，在存在风险输入时渲染提示', () => {
    const harness = warningHarness();
    try {
        const normal = createConfig({ baseSalary: 10000, socialBase: 10000, fundBase: '' });
        TaxCalculator.app.renderWarnings(normal, TaxCalculator.calculate(normal));
        assert.equal(harness.container.style.display, 'none');
        assert.equal(harness.container.innerHTML, '');

        const risky = createConfig({
            baseSalary: 3000,
            socialBase: 30000,
            fundBase: 3000,
            fundRate: 5,
            medicalPersonalRate: 2
        });
        TaxCalculator.app.renderWarnings(risky, TaxCalculator.calculate(risky));

        assert.equal(harness.container.style.display, 'grid');
        assert.match(harness.container.innerHTML, /tax-warning-item/);
        assert.match(harness.container.innerHTML, /实际到手」为负数/);
        assert.match(harness.container.innerHTML, /社保基数 30,000 元明显高于/);
    } finally {
        harness.restore();
    }
});

test('年终奖落在临界区时提示区会渲染建议金额', () => {
    const harness = warningHarness();
    try {
        const config = createConfig({
            baseSalary: 20000,
            socialBase: 20000,
            bonusTaxMonth: 12,
            bonuses: { 12: 36001 }
        });
        TaxCalculator.app.renderWarnings(config, TaxCalculator.calculate(config));

        assert.equal(harness.container.style.display, 'grid');
        assert.match(harness.container.innerHTML, /临界区/);
        assert.match(harness.container.innerHTML, /38,566\.67/);
        assert.match(harness.container.innerHTML, /建议发放/);
    } finally {
        harness.restore();
    }
});

test('个税页面声明了提示容器并把它接到计算流程上', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const html = fs.readFileSync(path.resolve(__dirname, '../pages/tax/taxCalculator.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../pages/tax/taxCalculator.js'), 'utf8');

    assert.match(html, /id="taxWarnings"/, '页面必须有提示容器');
    assert.match(js, /this\.renderWarnings\(config, monthlyResults\)/, '计算完成后必须渲染提示');
});
