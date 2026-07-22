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
    assert.match(html, /id="creditPeriods"[^>]*min="1"[^>]*step="1"/);
    assert.match(js, /getElementValue\('compoundYears', 'float'/);
    assert.match(js, /getElementValue\('loanYears', 'float'/);
    assert.match(js, /getElementValue\('creditPeriods', 'float'/);
    assert.match(js, /Number\.isInteger\(periods\)/);
    assert.doesNotMatch(js, /getElementValue\('(loanYears|creditPeriods)', 'int'/);

    ['commercialYears', 'fundYears', 'combinedYears'].forEach(id => {
        assert.match(mortgageHtml, new RegExp(`id="${id}"[^>]*min="1"[^>]*step="1"`));
        assert.match(mortgageJs, new RegExp(`getElementValue\\('${id}', 'float'`));
        assert.doesNotMatch(mortgageJs, new RegExp(`getElementValue\\('${id}', 'int'`));
    });
    assert.match(js, /FinanceCalculations\.loanYearsToMonths/);
    assert.match(mortgageJs, /FinanceCalculations\.loanYearsToMonths/);
});
