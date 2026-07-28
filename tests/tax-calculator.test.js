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
