const test = require('node:test');
const assert = require('node:assert/strict');

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

test('required capital series stops after the actual retirement age', () => {
    const trendData = [
        { age: 30, required: 500 },
        { age: 31, required: 400 },
        { age: 32, required: 300 },
        { age: 33, required: 200 }
    ];

    const series = FireProjection.calculateRequiredCapitalSeries({
        trendData,
        firstFireAge: 31,
        extraSavingYearsAfterFire: 1
    });

    assert.deepEqual(series, [500, 400, 300, null]);
});

test('required capital series remains complete when FIRE is unavailable', () => {
    const trendData = [
        { age: 30, required: 500 },
        { age: 31, required: 400 }
    ];

    const series = FireProjection.calculateRequiredCapitalSeries({
        trendData,
        firstFireAge: -1,
        extraSavingYearsAfterFire: 0
    });

    assert.deepEqual(series, [500, 400]);
});

test('annual spending series starts at actual retirement age and grows with inflation', () => {
    const trendData = [
        { age: 40 },
        { age: 41 },
        { age: 42 },
        { age: 43 }
    ];

    const series = FireProjection.calculateAnnualSpendingSeries({
        trendData,
        firstFireAge: 41,
        extraSavingYearsAfterFire: 1,
        currentAge: 40,
        monthlyExpense: 100,
        medicalMonthlyExpense: 10,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0.1,
        pensionGrowthRate: 0
    });

    assert.deepEqual(series.map(value => value === null ? null : Math.round(value * 10) / 10), [null, null, 1597.2, 1756.9]);
});

test('annual spending series does not deduct pension after pension age', () => {
    const trendData = [
        { age: 60 },
        { age: 61 },
        { age: 62 }
    ];

    const series = FireProjection.calculateAnnualSpendingSeries({
        trendData,
        firstFireAge: 60,
        extraSavingYearsAfterFire: 0,
        currentAge: 60,
        monthlyExpense: 100,
        medicalMonthlyExpense: 0,
        expectedPension: 30,
        pensionAge: 61,
        inflationRate: 0,
        pensionGrowthRate: 0
    });

    assert.deepEqual(series, [1200, 1200, 1200]);
});

test('required spending capital excludes medical reserve from FIRE baseline', () => {
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

    assert.equal(required, 2400);
});

test('thousand-yuan input values are converted to yuan for calculation', () => {
    assert.equal(FireProjection.thousandYuanToYuan(500), 500000);
    assert.equal(FireProjection.thousandYuanToYuan('100'), 100000);
    assert.equal(FireProjection.thousandYuanToYuan(''), 0);
});

test('stop-saving series does not deduct medical reserve as a one-time spending cliff', () => {
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

    assert.deepEqual(series, [1000, 1300, 1300]);
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
        fallbackAge: 63
    }), 45);
});

test('asset depletion age returns first age with non-positive balance', () => {
    assert.equal(FireProjection.calculateAssetDepletionAge([
        { age: 40 },
        { age: 41 },
        { age: 42 },
        { age: 43 }
    ], [100, 30, 0, -20]), 42);
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
