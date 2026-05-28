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

test('stop-saving series reserves medical fund at the first post-stop year', () => {
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
