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

test('FIRE trend reports yearly investment gain on dynamic principal before savings', () => {
    const result = FireProjection.calculateFireTrend({
        currentAge: 30,
        lifeExpectancy: 33,
        currentAssets: 1000,
        annualSavings: 100,
        monthlyExpense: 0,
        medicalMonthlyExpense: 0,
        medicalReserve: 0,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0.1
    });

    // 30 岁：本金 1000，当年理财收益 100；年末 1000*1.1+100=1200
    // 31 岁：本金 1200，当年理财收益 120；年末 1200*1.1+100=1420
    // 32 岁：本金 1420，当年理财收益 142
    assert.deepEqual(
        result.trendData.map((item) => ({
            age: item.age,
            assets: item.assets,
            yearlyInvestmentGain: item.yearlyInvestmentGain
        })),
        [
            { age: 30, assets: 1000, yearlyInvestmentGain: 100 },
            { age: 31, assets: 1200, yearlyInvestmentGain: 120 },
            { age: 32, assets: 1420, yearlyInvestmentGain: 142 }
        ]
    );
});

test('retirement year investment gain uses remaining assets after spending', () => {
    // 年初 1000，年净支出 200，退休首年医疗备用金 100 → 剩余 700，收益 70
    assert.equal(FireProjection.calculateRetirementYearInvestmentGain({
        startingAssets: 1000,
        age: 40,
        retireAge: 40,
        currentAge: 40,
        monthlyExpense: 200 / 12,
        medicalMonthlyExpense: 0,
        medicalReserve: 100,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0.1
    }), 70);

    // 非退休首年不再扣医疗备用金：1000 - 200 = 800，收益 80
    assert.equal(FireProjection.calculateRetirementYearInvestmentGain({
        startingAssets: 1000,
        age: 41,
        retireAge: 40,
        currentAge: 40,
        monthlyExpense: 200 / 12,
        medicalMonthlyExpense: 0,
        medicalReserve: 100,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0.1
    }), 80);
});

test('retirement year end balance is remaining assets after spend and return', () => {
    // 年初 1000 - 支出 200 - 医疗备用金 100 = 700，再 ×1.1 → 年末 770
    assert.equal(Math.round(FireProjection.calculateRetirementYearEndBalance({
        startingAssets: 1000,
        age: 40,
        retireAge: 40,
        currentAge: 40,
        monthlyExpense: 200 / 12,
        medicalMonthlyExpense: 0,
        medicalReserve: 100,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0.1
    }) * 100) / 100, 770);
});

test('retirement year breakdown keeps gain and end balance on the same principal', () => {
    const breakdown = FireProjection.calculateRetirementYearBreakdown({
        startingAssets: 3000000,
        age: 46,
        retireAge: 46,
        currentAge: 30,
        monthlyExpense: 7000,
        medicalMonthlyExpense: 300,
        medicalReserve: 500000,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0.02,
        pensionGrowthRate: 0,
        investmentReturn: 0.02
    });

    assert.equal(
        Math.round(breakdown.endBalance),
        Math.round(breakdown.remainingAfterSpend + breakdown.yearlyInvestmentGain)
    );
    assert.ok(breakdown.endBalance > 1000000, '年末剩余应与百万级本金同量级，而非数千元');
    assert.ok(
        breakdown.yearlyInvestmentGain < breakdown.remainingAfterSpend,
        '理财收益应小于计息本金'
    );
});

test('stop-saving series next balance matches retirement year end balance', () => {
    const params = {
        currentAge: 30,
        lifeExpectancy: 90,
        currentAssets: 1000000,
        annualSavings: 200000,
        monthlyExpense: 5000,
        medicalMonthlyExpense: 200,
        medicalReserve: 500000,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0.02,
        pensionGrowthRate: 0,
        investmentReturn: 0.02,
        extraSavingYearsAfterFire: 0
    };
    const { trendData, firstFireAge } = FireProjection.calculateFireTrend(params);
    assert.ok(firstFireAge > 0);
    const series = FireProjection.calculateStopSavingAssetSeries({
        ...params,
        trendData,
        firstFireAge,
        extraSavingYearsAfterFire: 0
    });
    const idx = trendData.findIndex((item) => item.age === firstFireAge);
    const endBalance = FireProjection.calculateRetirementYearEndBalance({
        ...params,
        startingAssets: series[idx],
        age: firstFireAge,
        retireAge: firstFireAge
    });
    assert.equal(Math.round(series[idx + 1]), Math.round(endBalance));
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

test('pension compounds yearly from the start-claim amount by pensionGrowthRate', () => {
    const base = {
        currentAge: 60,
        monthlyExpense: 0,
        medicalMonthlyExpense: 0,
        expectedPension: 1000,
        pensionAge: 63,
        inflationRate: 0,
        pensionGrowthRate: 0.03
    };

    // 起领年仍为 1000；次年为 1030；再次年为 1000*1.03^2
    assert.equal(FireProjection.calculateYearlyCashflow(base, 63).monthlyPension, 1000);
    assert.equal(FireProjection.calculateYearlyCashflow(base, 64).monthlyPension, 1030);
    assert.equal(
        Math.round(FireProjection.calculateYearlyCashflow(base, 65).monthlyPension * 100) / 100,
        1060.9
    );
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

const RETIREMENT_PAGE_PATH = path.resolve(
    __dirname,
    '../pages/retirement-calculator/retirementCalculator.html'
);

/** 读取页面某个输入框的属性，用于把表单默认值与步进约束纳入回归测试。 */
function readInputAttributes(html, id) {
    const match = html.match(new RegExp('<input[^>]*\\bid="' + id + '"[^>]*>'));
    assert.ok(match, '页面未找到输入框 ' + id);
    const attributes = {};
    match[0].replace(/([a-zA-Z0-9-]+)="([^"]*)"/g, (whole, name, value) => {
        attributes[name] = value;
        return whole;
    });
    return attributes;
}

/** 模拟 HTML 数字输入框的 stepMismatch：value 必须是 step 的整数倍。 */
function matchesStep(value, step) {
    if (step === 'any') return true;
    const stepValue = step === undefined ? 1 : Number(step);
    const quotient = value / stepValue;
    return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

test('retirement form step attributes accept realistic amounts', () => {
    const html = fs.readFileSync(RETIREMENT_PAGE_PATH, 'utf8');
    const stepOf = (id) => readInputAttributes(html, id).step;

    // 养老金 3271 元/月并非 100 的整数倍，旧的 step="100" 会让测算直接弹原生错误
    assert.equal(stepOf('expected-pension'), '1');
    assert.ok(matchesStep(3271, stepOf('expected-pension')), '养老金 3271 元必须能通过表单校验');
    assert.ok(!matchesStep(3271, '100'), '旧的 step="100" 确实会拦截 3271 元');

    assert.equal(stepOf('medical-monthly-expense'), '1');
    assert.ok(matchesStep(1367, stepOf('medical-monthly-expense')), '月医疗支出 1367 元必须能通过表单校验');
    assert.ok(!matchesStep(1367, '100'), '旧的 step="100" 确实会拦截 1367 元');

    // 万元金额允许任意小数（如 50.25 万元 = 502,500 元）
    ['current-assets', 'annual-savings', 'medical-reserve'].forEach(id => {
        assert.equal(stepOf(id), 'any', id + ' 应放宽为 step="any"');
        assert.ok(matchesStep(50.25, stepOf(id)), id + ' 必须接受 50.25 万元');
    });
    assert.ok(!matchesStep(50.25, '0.1'), '旧的 step="0.1" 确实会拦截 50.25 万元');

    // 需要整数或年数粒度的字段保持严格步进，与 validateInputs 的整数要求一致
    assert.equal(stepOf('current-age'), undefined);
    assert.ok(!matchesStep(30.5, stepOf('current-age')));
    assert.equal(stepOf('extra-saving-years-after-fire'), '1');
    assert.ok(!matchesStep(1.5, stepOf('extra-saving-years-after-fire')));

    // 百分比字段保留 0.1 粒度，默认值仍是 0.1 的整数倍
    ['inflation-rate', 'investment-return', 'pension-growth-rate'].forEach(id => {
        assert.equal(stepOf(id), '0.1', id + ' 保持 0.1% 步进');
        assert.ok(matchesStep(Number(readInputAttributes(html, id).value), stepOf(id)), id + ' 默认值需与步进自洽');
    });
});

test('retirement form default values no longer contradict each other', () => {
    const html = fs.readFileSync(RETIREMENT_PAGE_PATH, 'utf8');
    const valueOf = (id) => Number(readInputAttributes(html, id).value);

    const params = {
        currentAge: valueOf('current-age'),
        lifeExpectancy: valueOf('life-expectancy'),
        currentAssets: valueOf('current-assets') * 10000,
        annualSavings: valueOf('annual-savings') * 10000,
        monthlyExpense: valueOf('monthly-expense'),
        medicalMonthlyExpense: valueOf('medical-monthly-expense'),
        medicalReserve: valueOf('medical-reserve') * 10000,
        targetRetireAge: null,
        extraSavingYearsAfterFire: valueOf('extra-saving-years-after-fire'),
        expectedPension: valueOf('expected-pension'),
        pensionAge: valueOf('pension-age'),
        inflationRate: valueOf('inflation-rate') / 100,
        investmentReturn: valueOf('investment-return') / 100,
        pensionGrowthRate: valueOf('pension-growth-rate') / 100
    };

    assert.ok(
        params.investmentReturn > params.inflationRate,
        '默认投资收益率必须高于默认通胀率，否则首次打开即警告「实际收益率为负」'
    );

    const validation = FireProjection.validateInputs(params);
    assert.equal(validation.valid, true, validation.error);
    assert.deepEqual(validation.warnings, [], '全默认输入不应产生任何警告');
});

test('FIRE boundary equality counts as retirement', () => {
    // 医疗备用金即所需资金（通胀 0、无净支出），资产与所需资金数学上恰好相等
    const result = FireProjection.calculateFireTrend({
        currentAge: 30,
        lifeExpectancy: 32,
        currentAssets: 5000,
        annualSavings: 0,
        monthlyExpense: 0,
        medicalMonthlyExpense: 0,
        medicalReserve: 5000,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0.1
    });

    assert.equal(result.trendData[0].assets, result.trendData[0].required);
    assert.equal(result.trendData[0].isFire, true);
    assert.equal(result.firstFireAge, 30);
});

test('FIRE boundary tolerance absorbs floating point noise', () => {
    // 所需资金仅比资产高 1e-9（浮点噪声量级），显示口径下两列四舍五入后相等
    const result = FireProjection.calculateFireTrend({
        currentAge: 30,
        lifeExpectancy: 32,
        currentAssets: 5000,
        annualSavings: 0,
        monthlyExpense: 0,
        medicalMonthlyExpense: 0,
        medicalReserve: 5000.000000001,
        expectedPension: 0,
        pensionAge: 65,
        inflationRate: 0,
        pensionGrowthRate: 0,
        investmentReturn: 0.1
    });

    const boundary = result.trendData[0];
    assert.ok(boundary.required > boundary.assets, '构造场景中所需资金应略高于资产');
    assert.ok(boundary.required - boundary.assets < 1e-6, '差距应落在容差内');
    assert.equal(
        Math.round(boundary.assets).toLocaleString(),
        Math.round(boundary.required).toLocaleString(),
        '两列显示值应相同，这是状态列必须判为可退休的前提'
    );
    assert.equal(boundary.isFire, true);
    assert.equal(result.firstFireAge, 30);
});

test('retirement trend table exposes the asset-to-required gap', () => {
    const html = fs.readFileSync(RETIREMENT_PAGE_PATH, 'utf8');
    const script = fs.readFileSync(
        path.resolve(__dirname, '../pages/retirement-calculator/calculator.js'),
        'utf8'
    );

    assert.match(html, /<th>差额（资产−所需）<\/th>/);
    assert.match(html, /<strong>差额<\/strong> = 届时资产余额 − 退休所需资金/);
    assert.match(script, /formatSignedGap\(data\.assets - data\.required\)/);
    assert.match(script, /function formatSignedGap/);
});
