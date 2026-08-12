const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FinanceCalculations = require('../utils/finance-calculations.js');

test('quoted annual loan rate uses nominal monthly rate and standard equal payment', () => {
    assert.equal(FinanceCalculations.nominalMonthlyRate(4.9), 0.049 / 12);
    assert.ok(Math.abs(FinanceCalculations.equalPayment(1000000, 4.9, 360) - 5307.27) < 0.01);
});

test('zero-rate equal payment divides principal evenly', () => {
    assert.equal(FinanceCalculations.nominalMonthlyRate(0), 0);
    assert.equal(FinanceCalculations.equalPayment(120000, 0, 120), 1000);
});

test('period aggregation rejects a view finer than the source data', () => {
    assert.equal(FinanceCalculations.canAggregatePeriods(1, 'quarter'), false);
    assert.throws(
        () => FinanceCalculations.groupPeriods([{ period: 1 }], 1, 'quarter'),
        /无法按该粒度汇总/
    );
});

test('period aggregation groups only complete source-period buckets', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ period: index + 1 }));
    const quarters = FinanceCalculations.groupPeriods(rows, 12, 'quarter');

    assert.equal(quarters.length, 4);
    assert.deepEqual(quarters[0].map(row => row.period), [1, 2, 3]);
});

test('target plan rejects fractional or sub-period duration', () => {
    assert.equal(FinanceCalculations.calculateTargetPlan({
        target: 10000,
        annualPercent: 3,
        duration: 0.5,
        periodsPerYear: 12
    }).valid, false);
    assert.equal(FinanceCalculations.calculateTargetPlan({
        target: 10000,
        annualPercent: 3,
        duration: 1.5,
        periodsPerYear: 12
    }).valid, false);
});

test('target plan returns finite values for a valid zero-rate plan', () => {
    const result = FinanceCalculations.calculateTargetPlan({
        target: 12000,
        annualPercent: 0,
        duration: 12,
        periodsPerYear: 12
    });

    assert.equal(result.valid, true);
    assert.equal(result.periodRequired, 1000);
    assert.equal(result.periodData.at(-1).endAmount, 12000);
    assert.ok(result.periodData.every(row => Object.values(row).every(Number.isFinite)));
});

test('recurring investment requires a positive integral source-period count', () => {
    assert.equal(FinanceCalculations.validateRecurringInvestment({
        amount: 1000,
        annualPercent: 3,
        years: 0.1,
        periodsPerYear: 12
    }).valid, false);
    assert.equal(FinanceCalculations.validateRecurringInvestment({
        amount: 1000,
        annualPercent: -200,
        years: 1,
        periodsPerYear: 12
    }).valid, false);
    assert.equal(FinanceCalculations.validateRecurringInvestment({
        amount: 1000,
        annualPercent: Infinity,
        years: 1,
        periodsPerYear: 12
    }).valid, false);
});

test('recurring investment converts annual return to an effective monthly rate', () => {
    const result = FinanceCalculations.validateRecurringInvestment({
        amount: 1000,
        annualPercent: 12,
        years: 1,
        periodsPerYear: 12
    });

    assert.equal(result.valid, true);
    assert.ok(Math.abs(result.periodRate - (Math.pow(1.12, 1 / 12) - 1)) < 1e-12);
});

test('loan years must be a positive integer before conversion to months', () => {
    assert.equal(FinanceCalculations.loanYearsToMonths(30), 360);
    assert.throws(() => FinanceCalculations.loanYearsToMonths(1.9), /正整数/);
    assert.throws(() => FinanceCalculations.loanYearsToMonths(0), /正整数/);
    assert.throws(() => FinanceCalculations.loanYearsToMonths(Infinity), /正整数/);
});

test('capital runway depletes after exact months with zero return', () => {
    const result = FinanceCalculations.calculateCapitalRunway({
        principal: 12000,
        annualPercent: 0,
        monthlySpend: 1000
    });

    assert.equal(result.valid, true);
    assert.equal(result.sustainable, false);
    assert.equal(result.months, 12);
    assert.equal(result.totalWithdrawn, 12000);
    assert.equal(result.yearDetails.length, 1);
    assert.equal(result.yearDetails[0].endBalance, 0);
});

test('capital runway is sustainable when spend stays within monthly interest', () => {
    const result = FinanceCalculations.calculateCapitalRunway({
        principal: 120000,
        annualPercent: 12,
        monthlySpend: 1000
    });

    // 月利率 1%，月初利息 1200 >= 支出 1000
    assert.equal(result.valid, true);
    assert.equal(result.sustainable, true);
    assert.equal(result.months, null);
});

test('capital runway rejects non-positive monthly spend', () => {
    assert.equal(FinanceCalculations.calculateCapitalRunway({
        principal: 10000,
        annualPercent: 3,
        monthlySpend: 0
    }).valid, false);
});

test('capital runway shortens when monthly spend grows with inflation', () => {
    const noInflation = FinanceCalculations.calculateCapitalRunway({
        principal: 400000,
        annualPercent: 2,
        monthlySpend: 900,
        inflationPercent: 0
    });
    const withInflation = FinanceCalculations.calculateCapitalRunway({
        principal: 400000,
        annualPercent: 2,
        monthlySpend: 900,
        inflationPercent: 2
    });

    assert.equal(noInflation.valid, true);
    assert.equal(withInflation.valid, true);
    assert.equal(noInflation.sustainable, false);
    assert.equal(withInflation.sustainable, false);
    assert.ok(withInflation.months < noInflation.months);
    assert.ok(withInflation.months >= 440 && withInflation.months <= 460);
});

test('capital runway treats blank inflation as zero', () => {
    const blank = FinanceCalculations.calculateCapitalRunway({
        principal: 12000,
        annualPercent: 0,
        monthlySpend: 1000,
        inflationPercent: ''
    });
    assert.equal(blank.months, 12);
});

test('runway adjustment with inflation scales by cumulative price factor', () => {
    // 人为用高通胀把 10 年后因子拉到约 2：1000→约2000，改 800 且勾选通胀 → 名义约 1600
    const monthlyInflation = 0.02 / 12;
    const factor10y = Math.pow(1 + monthlyInflation, 120);
    assert.ok(Math.abs(factor10y - 1.22039) < 0.01); // 2% 十年约 1.22；下面用自定义推演验证换算式

    // 直接验证：无收益、无全局通胀、仅用 applyInflation 时因子=1，调整后支出=填写值
    const flat = FinanceCalculations.calculateCapitalRunway({
        principal: 20000,
        annualPercent: 0,
        monthlySpend: 1000,
        inflationPercent: 0,
        adjustments: [{ afterYears: 1, monthlySpend: 500, applyInflation: true }]
    });
    // 前 12 月各花 1000，其后每月 500，共 1000*12 + 500*16 = 20000 → 28 个月
    assert.equal(flat.months, 28);

    // 有通胀时：第 10 年末因子 F，勾选调整 800 → 当月名义支出应为 800*F
    let spend = 1000;
    let factor = 1;
    const inf = 0.05 / 12;
    for (let m = 1; m <= 120; m += 1) {
        spend *= (1 + inf);
        factor *= (1 + inf);
    }
    const expectedNominal = 800 * factor;
    assert.ok(Math.abs(expectedNominal - 800 * Math.pow(1 + inf, 120)) < 1e-9);

    const withAdj = FinanceCalculations.calculateCapitalRunway({
        principal: 1e9,
        annualPercent: 0,
        monthlySpend: 1000,
        inflationPercent: 5,
        adjustments: [{ afterYears: 10, monthlySpend: 800, applyInflation: true }]
    });
    const year11 = withAdj.yearDetails.find(row => row.year === 11);
    assert.ok(year11);
    // 第 11 年第 1 月按 800*F 起算，第 12 个月名义支出 = 800*F*(1+inf)^11
    const expectedYear11End = expectedNominal * Math.pow(1 + inf, 11);
    assert.ok(Math.abs(year11.monthlySpend - expectedYear11End) / expectedYear11End < 1e-9);
});

test('runway adjustment without inflation uses absolute nominal amount', () => {
    const result = FinanceCalculations.calculateCapitalRunway({
        principal: 1e9,
        annualPercent: 0,
        monthlySpend: 1000,
        inflationPercent: 5,
        adjustments: [{ afterYears: 10, monthlySpend: 800, applyInflation: false }]
    });
    const year11 = result.yearDetails.find(row => row.year === 11);
    const inf = 0.05 / 12;
    const expected = 800 * Math.pow(1 + inf, 11);
    assert.ok(Math.abs(year11.monthlySpend - expected) / expected < 1e-9);
});

test('runway adjustments default applyInflation to true', () => {
    const normalized = FinanceCalculations.normalizeRunwayAdjustments([
        { afterYears: 5, monthlySpend: 600 }
    ]);
    assert.equal(normalized.valid, true);
    assert.equal(normalized.adjustments[0].applyInflation, true);
    assert.equal(normalized.adjustments[0].startMonth, 61);
});

test('finance and mortgage pages load the shared loan implementation', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const financeHtml = fs.readFileSync(path.join(projectRoot, 'pages/finance/financeCalculator.html'), 'utf8');
    const mortgageHtml = fs.readFileSync(path.join(projectRoot, 'pages/mortgage/mortgageCalculator.html'), 'utf8');
    const financeJs = fs.readFileSync(path.join(projectRoot, 'pages/finance/financeCalculator.js'), 'utf8');
    const mortgageJs = fs.readFileSync(path.join(projectRoot, 'pages/mortgage/mortgageCalculator.js'), 'utf8');

    assert.match(financeHtml, /utils\/finance-calculations\.js/);
    assert.match(mortgageHtml, /utils\/finance-calculations\.js/);
    assert.match(financeJs, /FinanceCalculations\.equalPayment/);
    assert.match(mortgageJs, /FinanceCalculations\.equalPayment/);
});

test('integer-only finance and mortgage inputs preserve fractions until explicit validation', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const html = fs.readFileSync(
        path.join(projectRoot, 'pages/finance/financeCalculator.html'),
        'utf8'
    );
    const js = fs.readFileSync(
        path.join(projectRoot, 'pages/finance/financeCalculator.js'),
        'utf8'
    );
    const mortgageHtml = fs.readFileSync(
        path.join(projectRoot, 'pages/mortgage/mortgageCalculator.html'),
        'utf8'
    );
    const mortgageJs = fs.readFileSync(
        path.join(projectRoot, 'pages/mortgage/mortgageCalculator.js'),
        'utf8'
    );

    assert.match(html, /id="compoundYears"[^>]*min="1"[^>]*step="1"/);
    assert.match(html, /id="targetDuration"[^>]*min="1"[^>]*step="1"/);
    assert.match(html, /id="loanYears"[^>]*min="1"[^>]*step="1"/);
    assert.match(html, /id="runwayPrincipal"/);
    assert.match(html, /id="runwayMonthlySpend"/);
    assert.match(html, /id="runwayInflation"/);
    assert.match(html, /id="runway-adjustment-list"/);
    assert.match(html, /id="add-runway-adjustment-btn"/);
    assert.match(html, /data-calc-type="runway"/);
    assert.match(js, /collectRunwayAdjustments|addRunwayAdjustment/);
    assert.doesNotMatch(html, /creditCard|信用卡免息/);
    assert.match(js, /getElementValue\('compoundYears', 'float'/);
    assert.match(js, /getElementValue\('loanYears', 'float'/);
    assert.match(js, /calculateCapitalRunway/);
    assert.doesNotMatch(js, /calculateCreditCard|creditAmount/);
    assert.doesNotMatch(js, /getElementValue\('loanYears', 'int'/);

    ['commercialYears', 'fundYears', 'combinedYears'].forEach(id => {
        assert.match(mortgageHtml, new RegExp(`id="${id}"[^>]*min="1"[^>]*step="1"`));
        assert.match(mortgageJs, new RegExp(`getElementValue\\('${id}', 'float'`));
        assert.doesNotMatch(mortgageJs, new RegExp(`getElementValue\\('${id}', 'int'`));
    });
    assert.match(js, /FinanceCalculations\.loanYearsToMonths/);
    assert.match(mortgageJs, /FinanceCalculations\.loanYearsToMonths/);
});
