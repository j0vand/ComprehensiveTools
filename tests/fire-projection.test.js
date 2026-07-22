const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FireProjection = require('../utils/fire-projection.js');

test('stop-saving series spends down immediately when extra saving years is zero', () => {
    const trendData = [
        { age: 30, assets: 100 },
        { age: 31, assets: 200 },
        { age: 32, assets: 300 },
        { age: 33, assets: 400 },
        { age: 34, assets: 500 }
    ];

    const series = FireProjection.calculateStopSavingAssetSeries({
        trendData,
        firstFireAge: 32,
        extraSavingYearsAfterFire: 0,
        currentAge: 30,
        monthlyExpense: 10,
        medicalMonthlyExpense: 0,
        medicalReserve: 0,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0
    });

    assert.deepEqual(series, [100, 200, 300, 180, 60]);
});

test('stop-saving series keeps accumulation during extra saving years after FIRE', () => {
    const trendData = [
        { age: 30, assets: 100 },
        { age: 31, assets: 200 },
        { age: 32, assets: 300 },
        { age: 33, assets: 400 },
        { age: 34, assets: 500 },
        { age: 35, assets: 600 }
    ];

    const series = FireProjection.calculateStopSavingAssetSeries({
        trendData,
        firstFireAge: 32,
        extraSavingYearsAfterFire: 2,
        currentAge: 30,
        monthlyExpense: 10,
        medicalMonthlyExpense: 0,
        medicalReserve: 0,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0
    });

    assert.deepEqual(series, [100, 200, 300, 400, 500, 380]);
});

test('required spending capital includes medical reserve in FIRE baseline', () => {
    const required = FireProjection.calculateRequiredSpendingCapitalAtAge({
        retireAge: 60,
        lifeExpectancy: 62,
        currentAge: 60,
        monthlyExpense: 100,
        medicalMonthlyExpense: 0,
        medicalReserve: 100000,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0
    });

    // 两年净支出 2400 + 医疗备用金 100000
    assert.equal(required, 102400);
});

test('stop-saving series deducts medical reserve once after retirement starts', () => {
    const trendData = [
        { age: 30, assets: 1000 },
        { age: 31, assets: 1300 },
        { age: 32, assets: 1600 }
    ];

    const series = FireProjection.calculateStopSavingAssetSeries({
        trendData,
        firstFireAge: 31,
        extraSavingYearsAfterFire: 0,
        currentAge: 30,
        monthlyExpense: 0,
        medicalMonthlyExpense: 0,
        medicalReserve: 100,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0
    });

    assert.deepEqual(series, [1000, 1300, 1200]);
});

test('stop-saving series falls back to accumulation when FIRE is unavailable', () => {
    const trendData = [
        { age: 30, assets: 100 },
        { age: 31, assets: 200 }
    ];

    const series = FireProjection.calculateStopSavingAssetSeries({
        trendData,
        firstFireAge: -1,
        extraSavingYearsAfterFire: 0,
        currentAge: 30,
        monthlyExpense: 10,
        medicalMonthlyExpense: 0,
        medicalReserve: 0,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0
    });

    assert.deepEqual(series, [100, 200]);
});

test('actual retirement age includes extra saving years after FIRE', () => {
    assert.equal(FireProjection.calculateActualRetireAge({
        firstFireAge: 42,
        extraSavingYearsAfterFire: 3,
        lifeExpectancy: 85
    }), 45);
});

test('actual retirement age rejects a plan that reaches life expectancy', () => {
    assert.equal(FireProjection.calculateActualRetireAge({
        firstFireAge: 82,
        extraSavingYearsAfterFire: 3,
        lifeExpectancy: 85
    }), null);
});

test('actual retirement age is unavailable when FIRE is not reached', () => {
    assert.equal(FireProjection.calculateActualRetireAge({
        firstFireAge: -1,
        extraSavingYearsAfterFire: 0,
        lifeExpectancy: 85
    }), null);
});

test('retirement page renders unavailable state instead of a fallback retirement scenario', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../pages/retirement-calculator/calculator.js'),
        'utf8'
    );

    assert.match(source, /actualRetireAgeEl\.textContent = '—'/);
    assert.match(source, /depletionDescEl\.textContent = '退休场景不可用'/);
    assert.match(source, /medicalReserveInflatedEl\.textContent = '—'/);
    assert.match(source, /safetyLevelEl\.textContent = '不可用'/);
    assert.match(source, /暂无可用退休场景/);
    assert.match(source, /暂无退休后现金流场景/);
    // 继续储蓄超寿命时只提示，不阻断最早 FIRE 结论展示。
    assert.match(source, /请缩短继续储蓄年数[\s\S]*renderResults\(/);
    assert.doesNotMatch(
        source,
        /请缩短继续储蓄年数[\s\S]{0,200}?return;\s*[\s\S]{0,80}?renderResults\(/
    );
});

test('FIRE trend never treats life expectancy as a retirement candidate', () => {
    const result = FireProjection.calculateFireTrend({
        currentAge: 84,
        lifeExpectancy: 85,
        currentAssets: 0,
        annualSavings: 0,
        monthlyExpense: 10000,
        medicalMonthlyExpense: 0,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0
    });

    assert.deepEqual(result.trendData.map(item => item.age), [84]);
    assert.equal(result.firstFireAge, -1);
});

test('asset depletion age returns first age where assets cannot cover yearly need', () => {
    const params = {
        actualRetireAge: 40,
        currentAge: 40,
        monthlyExpense: 10,
        medicalMonthlyExpense: 0,
        medicalReserve: 0,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0
    };

    // 每年净支出 120；40 岁资产 100 不足以覆盖
    assert.equal(FireProjection.calculateAssetDepletionAge(
        [{ age: 40 }, { age: 41 }, { age: 42 }],
        [100, 50, 0],
        params
    ), 40);

    assert.equal(FireProjection.calculateAssetDepletionAge(
        [{ age: 40 }, { age: 41 }, { age: 42 }],
        [200, 50, 0],
        params
    ), 41);
});

test('yearly cashflow separates gross spending, pension and net outflow', () => {
    const beforePension = FireProjection.calculateYearlyCashflow({
        currentAge: 60,
        monthlyExpense: 100,
        medicalMonthlyExpense: 0,
        expectedPension: 30,
        pensionAge: 61,
        inflationRate: 0,
        pensionGrowthRate: 0
    }, 60);

    assert.equal(beforePension.yearlyGrossSpending, 1200);
    assert.equal(beforePension.yearlyPension, 0);
    assert.equal(beforePension.yearlyNetOutflow, 1200);

    const afterPension = FireProjection.calculateYearlyCashflow({
        currentAge: 60,
        monthlyExpense: 100,
        medicalMonthlyExpense: 0,
        expectedPension: 30,
        pensionAge: 61,
        inflationRate: 0,
        pensionGrowthRate: 0
    }, 61);

    assert.equal(afterPension.yearlyGrossSpending, 1200);
    assert.equal(afterPension.yearlyPension, 360);
    assert.equal(afterPension.yearlyNetOutflow, 840);
});

test('yearly cashflow grows with inflation', () => {
    const cashflow = FireProjection.calculateYearlyCashflow({
        currentAge: 40,
        monthlyExpense: 100,
        medicalMonthlyExpense: 10,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0.1,
        pensionGrowthRate: 0
    }, 42);

    assert.equal(Math.round(cashflow.yearlyGrossSpending * 10) / 10, 1597.2);
});

test('safety metrics grade margin ratio', () => {
    assert.deepEqual(FireProjection.calculateSafetyMetrics({
        assets: 130,
        required: 100
    }), {
        buffer: 30,
        ratio: 1.3,
        level: '较稳'
    });

    assert.equal(FireProjection.calculateSafetyMetrics({ assets: 80, required: 100 }).level, '不足');
    assert.equal(FireProjection.calculateSafetyMetrics({ assets: 110, required: 100 }).level, '勉强');
    assert.equal(FireProjection.calculateSafetyMetrics({ assets: 160, required: 100 }).level, '充足');
});

test('FIRE input validation rejects invalid required numbers and declared field bounds', () => {
    const validInputs = {
        currentAge: 30,
        lifeExpectancy: 85,
        currentAssets: 500000,
        annualSavings: 100000,
        monthlyExpense: 8000,
        medicalMonthlyExpense: 1200,
        medicalReserve: 500000,
        targetRetireAge: null,
        extraSavingYearsAfterFire: 0,
        expectedPension: 4000,
        pensionAge: 63,
        inflationRate: 0.03,
        investmentReturn: 0.05,
        pensionGrowthRate: 0
    };

    const invalidCases = [
        ['当前年龄为空', { currentAge: NaN }],
        ['当前年龄为小数', { currentAge: 30.5 }],
        ['当前资产为负数', { currentAssets: -1 }],
        ['每年可存金额为负数', { annualSavings: -1 }],
        ['月生活费为负数', { monthlyExpense: -1 }],
        ['医疗支出为负数', { medicalMonthlyExpense: -1 }],
        ['医疗备用金为负数', { medicalReserve: -1 }],
        ['继续储蓄年数为小数', { extraSavingYearsAfterFire: 1.5 }],
        ['预计退休金为负数', { expectedPension: -1 }],
        ['投资收益率超过页面上限', { investmentReturn: 0.151 }],
        ['通胀率为负数', { inflationRate: -0.001 }],
        ['退休金增长率非有限数', { pensionGrowthRate: Infinity }]
    ];

    invalidCases.forEach(([label, overrides]) => {
        const result = FireProjection.validateInputs({ ...validInputs, ...overrides });
        assert.equal(result.valid, false, label);
        assert.equal(typeof result.error, 'string', label);
        assert.ok(result.error.length > 0, label);
    });
});

test('FIRE input validation warns when real return is negative', () => {
    const result = FireProjection.validateInputs({
        currentAge: 30,
        lifeExpectancy: 85,
        currentAssets: 500000,
        annualSavings: 100000,
        monthlyExpense: 8000,
        medicalMonthlyExpense: 1200,
        medicalReserve: 500000,
        targetRetireAge: 30,
        extraSavingYearsAfterFire: 0,
        expectedPension: 4000,
        pensionAge: 63,
        inflationRate: 0.03,
        investmentReturn: 0.015,
        pensionGrowthRate: 0
    });

    assert.equal(result.valid, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /实际收益率为负/);
});
