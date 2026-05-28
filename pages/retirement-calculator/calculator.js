let trendChartInstance = null;
let cashflowChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.restoreFormData) {
        window.retirementCalculatorStorage.restoreFormData();
    } else if (typeof restoreFormData === 'function') {
        restoreFormData();
    }

    document.getElementById('calculate-btn').addEventListener('click', calculateFIRE);
    document.getElementById('reset-btn').addEventListener('click', resetForm);
    bindScenarioControls();
    bindChartTabs();

    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const ageInput = document.getElementById('pension-age');
            ageInput.value = e.target.value === 'male' ? 63 : 58;
            saveFormDataDebounced();
        });
    });

    bindAutoSave();
});

let saveFormDataDebounced = debounce(() => {
    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.saveFormData) {
        window.retirementCalculatorStorage.saveFormData();
    }
}, 400);

function debounce(fn, ms) {
    let timer = null;
    return function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, arguments), ms);
    };
}

function bindAutoSave() {
    const inputIds = [
        'current-age', 'life-expectancy', 'current-assets', 'annual-savings',
        'monthly-expense', 'medical-monthly-expense', 'medical-reserve',
        'target-retire-age', 'extra-saving-years-after-fire', 'expected-pension', 'pension-age',
        'inflation-rate', 'investment-return', 'pension-growth-rate'
    ];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveFormDataDebounced);
        if (el) el.addEventListener('change', saveFormDataDebounced);
    });
}

function bindScenarioControls() {
    const extraInput = document.getElementById('extra-saving-years-after-fire');
    const buttons = document.querySelectorAll('.scenario-button');
    if (!extraInput || !buttons.length) return;

    function syncButtons() {
        const currentValue = extraInput.value || '0';
        buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.extraSavingYears === currentValue);
        });
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            extraInput.value = button.dataset.extraSavingYears || '0';
            syncButtons();
            saveFormDataDebounced();
        });
    });
    extraInput.addEventListener('input', syncButtons);
    syncButtons();
}

function bindChartTabs() {
    const tabs = document.querySelectorAll('.chart-tab');
    if (!tabs.length) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.chartView;
            tabs.forEach(item => item.classList.toggle('active', item === tab));
            document.getElementById('chart-panel-assets')?.classList.toggle('hidden', view !== 'assets');
            document.getElementById('chart-panel-cashflow')?.classList.toggle('hidden', view !== 'cashflow');
            if (trendChartInstance) trendChartInstance.resize();
            if (cashflowChartInstance) cashflowChartInstance.resize();
        });
    });
}

/** 按通胀率对基准值做复利增长 */
function applyInflation(baseValue, fromAge, toAge, rate) {
    return baseValue * Math.pow(1 + rate, Math.max(0, toAge - fromAge));
}

/** 年金终值系数：等额年末存入 n 年，按 rate 复利增长的终值倍数 */
function annuityFutureFactor(rate, years) {
    if (years <= 0) return 0;
    if (rate === 0) return years;
    return (Math.pow(1 + rate, years) - 1) / rate;
}

function collectFormInputs() {
    const currentAge = parseInt(document.getElementById('current-age').value) || 30;
    const lifeExpectancy = parseInt(document.getElementById('life-expectancy').value) || 85;
    const currentAssets = window.FireProjection.thousandYuanToYuan(document.getElementById('current-assets').value);
    const annualSavings = window.FireProjection.thousandYuanToYuan(document.getElementById('annual-savings').value);
    const monthlyExpense = parseFloat(document.getElementById('monthly-expense').value) || 0;
    const medicalMonthlyExpense = parseFloat(document.getElementById('medical-monthly-expense').value) || 0;
    const medicalReserve = window.FireProjection.thousandYuanToYuan(document.getElementById('medical-reserve').value);
    const targetRetireAgeInput = document.getElementById('target-retire-age').value.trim();
    const targetRetireAge = targetRetireAgeInput === '' ? null : parseInt(targetRetireAgeInput);
    const extraSavingYearsAfterFire = parseInt(document.getElementById('extra-saving-years-after-fire').value) || 0;
    const expectedPension = parseFloat(document.getElementById('expected-pension').value) || 0;
    const pensionAge = parseInt(document.getElementById('pension-age').value) || 63;
    const inflationRate = (parseFloat(document.getElementById('inflation-rate').value) || 0) / 100;
    const investmentReturn = (parseFloat(document.getElementById('investment-return').value) || 0) / 100;
    const pensionGrowthRate = (parseFloat(document.getElementById('pension-growth-rate').value) || 0) / 100;

    return {
        currentAge, lifeExpectancy, currentAssets, annualSavings,
        monthlyExpense, medicalMonthlyExpense, medicalReserve,
        targetRetireAge, extraSavingYearsAfterFire, expectedPension, pensionAge,
        inflationRate, investmentReturn, pensionGrowthRate
    };
}

function validateInputs(params) {
    const { currentAge, lifeExpectancy, targetRetireAge, investmentReturn, inflationRate } = params;
    const warnings = [];

    if (currentAge >= lifeExpectancy) {
        return { valid: false, error: '当前年龄不能大于或等于预期寿命' };
    }

    if (targetRetireAge !== null) {
        if (targetRetireAge <= currentAge) {
            warnings.push('目标退休年龄（' + targetRetireAge + '）应大于当前年龄（' + currentAge + '）');
        }
        if (targetRetireAge >= lifeExpectancy) {
            warnings.push('目标退休年龄（' + targetRetireAge + '）应小于预期寿命（' + lifeExpectancy + '）');
        }
    }

    const realReturn = (1 + investmentReturn) / (1 + inflationRate) - 1;
    if (realReturn < 0) {
        warnings.push(
            '投资收益率（' + (investmentReturn * 100).toFixed(1) + '%）低于通胀率（' +
            (inflationRate * 100).toFixed(1) + '%），实际收益率为负，资产会被通胀侵蚀'
        );
    }

    return { valid: true, warnings };
}

function calculateFIRE() {
    const params = collectFormInputs();
    const validation = validateInputs(params);

    if (!validation.valid) {
        alert(validation.error);
        return;
    }
    if (validation.warnings && validation.warnings.length > 0) {
        const proceed = confirm('提示：\n• ' + validation.warnings.join('\n• ') + '\n\n是否继续测算？');
        if (!proceed) return;
    }

    const { currentAge, lifeExpectancy, currentAssets, annualSavings,
        monthlyExpense, medicalMonthlyExpense, medicalReserve,
        expectedPension, pensionAge, inflationRate, investmentReturn,
        pensionGrowthRate } = params;

    const trendData = [];
    let firstFireAge = -1;
    let firstFireAssets = 0;

    // O(n) 增量计算资产余额，避免每次从头算
    let assetsAtRetire = currentAssets;
    for (let retireAge = currentAge; retireAge <= lifeExpectancy; retireAge++) {
        const requiredCapital = calculateRequiredSpendingCapitalAtAge({
            retireAge, lifeExpectancy, currentAge,
            monthlyExpense, medicalMonthlyExpense, expectedPension,
            pensionAge, inflationRate, pensionGrowthRate,
            investmentReturn
        });

        trendData.push({
            age: retireAge,
            assets: assetsAtRetire,
            required: requiredCapital,
            isFire: assetsAtRetire >= requiredCapital
        });

        if (assetsAtRetire >= requiredCapital && firstFireAge === -1) {
            firstFireAge = retireAge;
            firstFireAssets = assetsAtRetire;
        }

        // 增量推进：本年资产产生收益 + 年末存入
        assetsAtRetire = assetsAtRetire * (1 + investmentReturn) + annualSavings;
    }

    renderResults({
        trendData, firstFireAge, firstFireAssets, ...params
    });
}

function renderResults(ctx) {
    const {
        trendData, firstFireAge, firstFireAssets,
        currentAge, pensionAge, lifeExpectancy,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        inflationRate, pensionGrowthRate, medicalReserve,
        targetRetireAge, annualSavings, currentAssets, investmentReturn
    } = ctx;

    const resultSection = document.getElementById('result-section');
    const resultSuccess = document.getElementById('result-success');
    const resultFail = document.getElementById('result-fail');
    const tbody = document.getElementById('trend-table-body');
    const postRetirementTitle = document.getElementById('post-retirement-title');
    const postRetirementBody = document.getElementById('post-retirement-body');
    const medicalReserveInflatedEl = document.getElementById('res-medical-reserve-inflated');
    const medicalAgeEl = document.getElementById('res-medical-age');
    const targetAnnualSavingsEl = document.getElementById('res-target-annual-savings');
    const targetDescEl = document.getElementById('res-target-desc');
    const targetReverseCard = document.getElementById('target-reverse-card');
    const fireAssetsRealEl = document.getElementById('res-fire-assets-real');
    const actualRetireAgeEl = document.getElementById('res-actual-retire-age');
    const depletionAgeEl = document.getElementById('res-depletion-age');
    const depletionDescEl = document.getElementById('res-depletion-desc');
    const gapAmountEl = document.getElementById('res-gap-amount');
    const gapAmountRealEl = document.getElementById('res-gap-amount-real');
    const safetyLevelEl = document.getElementById('res-safety-level');
    const safetyBufferEl = document.getElementById('res-safety-buffer');
    const safetyRatioEl = document.getElementById('res-safety-ratio');
    const realReturnRateEl = document.getElementById('res-real-return-rate');

    resultSection.classList.remove('hidden');

    if (firstFireAge !== -1) {
        resultSuccess.classList.remove('hidden');
        resultFail.classList.add('hidden');

        document.getElementById('res-fire-age').textContent = firstFireAge;
        document.getElementById('res-fire-assets').textContent = Math.round(firstFireAssets).toLocaleString();
        document.getElementById('res-years-to-fire').textContent = firstFireAge - currentAge;
        const fireYears = Math.max(0, firstFireAge - currentAge);
        const fireAssetsReal = firstFireAssets / Math.pow(1 + inflationRate, fireYears);
        fireAssetsRealEl.textContent = Math.round(fireAssetsReal).toLocaleString();
    } else {
        resultSuccess.classList.add('hidden');
        resultFail.classList.remove('hidden');

        document.getElementById('res-years-to-fire').textContent = '—';
        fireAssetsRealEl.textContent = '—';
    }

    document.getElementById('res-pension-age-display').textContent = pensionAge;

    // 构建要显示的关键年龄集合
    tbody.innerHTML = '';

    const displayAges = new Set();
    displayAges.add(currentAge + 1);
    if (firstFireAge !== -1) displayAges.add(firstFireAge);
    displayAges.add(pensionAge);

    for (let age = currentAge; age <= trendData[trendData.length - 1].age; age++) {
        if (age % 5 === 0) {
            displayAges.add(age);
        }
    }

    const sortedAges = Array.from(displayAges).sort((a, b) => a - b);

    sortedAges.forEach(age => {
        const data = trendData.find(d => d.age === age);
        if (!data) return;

        const tr = document.createElement('tr');

        // 收集该年龄命中的所有标签，解决优先级覆盖问题
        const tags = [];
        const isFirePoint = age === firstFireAge;
        const isPensionAge = age === pensionAge;

        if (isFirePoint) {
            tags.push('<span class="status-ok">⭐ 最早 FIRE 点</span>');
            tr.style.fontWeight = 'bold';
            tr.style.backgroundColor = '#f1f8e9';
        } else if (data.isFire) {
            tags.push('<span class="status-ok">可退休 (FIRE)</span>');
            tr.style.backgroundColor = '#f1f8e9';
        } else {
            tags.push('<span class="status-wait">需继续攒钱</span>');
        }

        if (isPensionAge) {
            tags.push('<span class="status-wait">退休金开始领取</span>');
            if (!isFirePoint) tr.classList.add('highlight-pension-age');
        }

        tr.innerHTML =
            '<td>' + data.age + ' 岁</td>' +
            '<td>¥ ' + Math.round(data.assets).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(data.required).toLocaleString() + '</td>' +
            '<td>' + tags.join(' / ') + '</td>';
        tbody.appendChild(tr);
    });

    const actualRetireAge = window.FireProjection.calculateActualRetireAge({
        firstFireAge,
        extraSavingYearsAfterFire: ctx.extraSavingYearsAfterFire,
        fallbackAge: pensionAge
    });
    actualRetireAgeEl.textContent = actualRetireAge;

    const currentScenarioAssets = buildAssetSeries(trendData, firstFireAge, ctx, ctx.extraSavingYearsAfterFire);
    const depletionAge = window.FireProjection.calculateAssetDepletionAge(trendData, currentScenarioAssets);
    depletionAgeEl.textContent = depletionAge === null ? '未耗尽' : depletionAge + ' 岁';
    depletionDescEl.textContent = depletionAge === null || depletionAge >= lifeExpectancy ? '覆盖到预期寿命' : '早于预期寿命耗尽';

    renderTrendChart(trendData, firstFireAge, pensionAge, ctx);
    renderCashflowChart(trendData, firstFireAge, ctx);
    renderScenarioTable(trendData, firstFireAge, ctx);

    renderPostRetirementMonthlyTable({
        firstFireAge, pensionAge, lifeExpectancy, currentAge,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        inflationRate, pensionGrowthRate
    });

    const assumeRetireAge = actualRetireAge;
    const inflatedMedicalReserve = applyInflation(medicalReserve, currentAge, assumeRetireAge, inflationRate);
    medicalReserveInflatedEl.textContent = Math.round(inflatedMedicalReserve).toLocaleString();
    medicalAgeEl.textContent = assumeRetireAge;

    const assumeData = trendData.find((item) => item.age === assumeRetireAge);
    const gapAmount = assumeData ? Math.max(0, assumeData.required - assumeData.assets) : 0;
    const gapAmountReal = gapAmount / Math.pow(1 + inflationRate, Math.max(0, assumeRetireAge - currentAge));
    gapAmountEl.textContent = Math.round(gapAmount).toLocaleString();
    gapAmountRealEl.textContent = Math.round(gapAmountReal).toLocaleString();
    const safetyMetrics = window.FireProjection.calculateSafetyMetrics({
        assets: assumeData ? assumeData.assets : 0,
        required: assumeData ? assumeData.required : 0
    });
    safetyLevelEl.textContent = safetyMetrics.level;
    safetyLevelEl.className = getRiskClass(safetyMetrics.level);
    safetyBufferEl.textContent = Math.round(safetyMetrics.buffer).toLocaleString();
    safetyRatioEl.textContent = Number.isFinite(safetyMetrics.ratio) ? safetyMetrics.ratio.toFixed(2) : '∞';
    const realReturnRate = ((1 + investmentReturn) / (1 + inflationRate) - 1) * 100;
    realReturnRateEl.textContent = realReturnRate.toFixed(2);

    const reverseResult = calculateReverseTargetAnnualSavings({
        targetRetireAge, currentAge, currentAssets, investmentReturn,
        lifeExpectancy, monthlyExpense, medicalMonthlyExpense,
        expectedPension, pensionAge, inflationRate,
        pensionGrowthRate
    });
    targetAnnualSavingsEl.textContent = reverseResult.requiredAnnualSavings === null
        ? '—'
        : Math.round(reverseResult.requiredAnnualSavings).toLocaleString();
    targetDescEl.textContent = reverseResult.desc;
    if (reverseResult.requiredAnnualSavings === null) {
        targetReverseCard.classList.add('disabled-card');
    } else {
        targetReverseCard.classList.remove('disabled-card');
    }

    resultSection.scrollIntoView({ behavior: 'smooth' });
}

function renderPostRetirementMonthlyTable(ctx) {
    const {
        firstFireAge, pensionAge, lifeExpectancy, currentAge,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        inflationRate, pensionGrowthRate
    } = ctx;

    const postRetirementTitle = document.getElementById('post-retirement-title');
    const postRetirementBody = document.getElementById('post-retirement-body');
    postRetirementBody.innerHTML = '';

    const assumeRetireAge = firstFireAge !== -1 ? firstFireAge : pensionAge;
    postRetirementTitle.textContent = firstFireAge !== -1
        ? '退休后月度开销明细（按最早 FIRE 年龄 ' + assumeRetireAge + ' 岁测算）'
        : '退休后月度开销明细（按参考退休年龄 ' + assumeRetireAge + ' 岁测算）';

    for (let age = assumeRetireAge; age < lifeExpectancy; age += 1) {
        const yearsFromNow = age - currentAge;
        const curMonthlyExpense = applyInflation(monthlyExpense, 0, yearsFromNow, inflationRate);
        const curMonthlyMedical = applyInflation(medicalMonthlyExpense, currentAge, age, inflationRate);
        const curMonthlyPension = age >= pensionAge
            ? expectedPension * Math.pow(1 + pensionGrowthRate, age - pensionAge)
            : 0;
        const curMonthlyNet = Math.max(0, curMonthlyExpense + curMonthlyMedical - curMonthlyPension);
        const curMonthlyNetReal = curMonthlyNet / Math.pow(1 + inflationRate, yearsFromNow);

        const row = document.createElement('tr');
        row.innerHTML =
            '<td>' + age + ' 岁</td>' +
            '<td>¥ ' + Math.round(curMonthlyExpense).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(curMonthlyMedical).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(curMonthlyPension).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(curMonthlyNet).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(curMonthlyNetReal).toLocaleString() + '</td>';
        postRetirementBody.appendChild(row);
    }
}

function buildAssetSeries(trendData, firstFireAge, ctx, extraSavingYearsAfterFire) {
    return window.FireProjection.calculateStopSavingAssetSeries({
        trendData,
        firstFireAge,
        extraSavingYearsAfterFire,
        currentAge: ctx.currentAge,
        monthlyExpense: ctx.monthlyExpense,
        medicalMonthlyExpense: ctx.medicalMonthlyExpense,
        medicalReserve: ctx.medicalReserve,
        expectedPension: ctx.expectedPension,
        pensionAge: ctx.pensionAge,
        inflationRate: ctx.inflationRate,
        pensionGrowthRate: ctx.pensionGrowthRate,
        investmentReturn: ctx.investmentReturn
    });
}

function renderTrendChart(trendData, firstFireAge, pensionAge, ctx) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        const fallback = document.getElementById('chart-fallback');
        if (fallback) fallback.classList.remove('hidden');
        return;
    }

    const fallback = document.getElementById('chart-fallback');
    if (fallback) fallback.classList.add('hidden');

    const labels = trendData.map((item) => item.age + '岁');
    const stopImmediatelyAssetSeries = buildAssetSeries(trendData, firstFireAge, ctx, 0).map(value => Math.round(value));
    const continueSavingAssetSeries = buildAssetSeries(trendData, firstFireAge, ctx, ctx.extraSavingYearsAfterFire).map(value => Math.round(value));
    const requiredSeries = window.FireProjection.calculateRequiredCapitalSeries({
        trendData,
        firstFireAge,
        extraSavingYearsAfterFire: ctx.extraSavingYearsAfterFire
    }).map(value => value === null ? null : Math.round(value));
    const ageToIndex = new Map(trendData.map((item, index) => [item.age, index]));

    const labelPlugin = {
        id: 'keyPointLabelPlugin',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                if (!dataset.keyPointLabel) return;
                const meta = chart.getDatasetMeta(datasetIndex);
                const point = meta.data[0];
                if (!point) return;

                const text = dataset.keyPointLabel;
                ctx.save();
                ctx.fillStyle = dataset.borderColor || '#333';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(text, point.x + 8, point.y - 8);
                ctx.restore();
            });
        }
    };

    const keyPointDatasets = [];
    const pushKeyPoint = (age, value, color, text) => {
        if (age === null || age === undefined || Number.isNaN(age)) return;
        const idx = ageToIndex.get(age);
        if (idx === undefined) return;
        keyPointDatasets.push({
            type: 'scatter',
            label: text,
            data: [{ x: labels[idx], y: Math.round(value) }],
            borderColor: color,
            backgroundColor: color,
            pointRadius: 5,
            pointHoverRadius: 7,
            showLine: false,
            keyPointLabel: text
        });
    };

    if (firstFireAge !== -1) {
        const fireItem = trendData.find((item) => item.age === firstFireAge);
        if (fireItem) {
            pushKeyPoint(firstFireAge, fireItem.assets, '#2e7d32', '最早FIRE ' + firstFireAge + '岁');
        }
    }

    const pensionItem = trendData.find((item) => item.age === pensionAge);
    if (pensionItem) {
        pushKeyPoint(pensionAge, pensionItem.required, '#f57c00', '退休金起领 ' + pensionAge + '岁');
    }

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '继续储蓄资产',
                    data: continueSavingAssetSeries,
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30,136,229,0.12)',
                    tension: 0.25,
                    pointRadius: 2
                },
                {
                    label: '立即停止储蓄资产',
                    data: stopImmediatelyAssetSeries,
                    borderColor: '#43a047',
                    backgroundColor: 'rgba(67,160,71,0.10)',
                    tension: 0.25,
                    pointRadius: 2
                },
                {
                    label: '退休所需资金',
                    data: requiredSeries,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244,67,54,0.10)',
                    tension: 0.25,
                    pointRadius: 2
                },
                ...keyPointDatasets
            ]
        },
        plugins: [labelPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        filter(item) {
                            return item.text === '继续储蓄资产' || item.text === '立即停止储蓄资产' || item.text === '退休所需资金';
                        }
                    }
                },
                tooltip: { mode: 'index', intersect: false }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    position: 'left',
                    ticks: {
                        callback(value) {
                            return '¥' + Number(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderCashflowChart(trendData, firstFireAge, ctx) {
    const canvas = document.getElementById('cashflow-chart');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        const fallback = document.getElementById('cashflow-chart-fallback');
        if (fallback) fallback.classList.remove('hidden');
        return;
    }

    const fallback = document.getElementById('cashflow-chart-fallback');
    if (fallback) fallback.classList.add('hidden');

    const labels = trendData.map((item) => item.age + '岁');
    const assetSeries = buildAssetSeries(trendData, firstFireAge, ctx, ctx.extraSavingYearsAfterFire).map(value => Math.round(value));
    const spendingSeries = window.FireProjection.calculateAnnualSpendingSeries({
        trendData,
        firstFireAge,
        extraSavingYearsAfterFire: ctx.extraSavingYearsAfterFire,
        currentAge: ctx.currentAge,
        monthlyExpense: ctx.monthlyExpense,
        medicalMonthlyExpense: ctx.medicalMonthlyExpense,
        expectedPension: ctx.expectedPension,
        pensionAge: ctx.pensionAge,
        inflationRate: ctx.inflationRate,
        pensionGrowthRate: ctx.pensionGrowthRate
    }).map(value => value === null ? null : Math.round(value));
    const netOutflowSeries = trendData.map(item => {
        const actualRetireAge = window.FireProjection.calculateActualRetireAge({
            firstFireAge,
            extraSavingYearsAfterFire: ctx.extraSavingYearsAfterFire,
            fallbackAge: ctx.pensionAge
        });
        if (firstFireAge === -1 || item.age < actualRetireAge) return null;
        return Math.round(window.FireProjection.calculateYearlyNetOutflow(ctx, item.age));
    });
    const pensionSeries = trendData.map(item => {
        const actualRetireAge = window.FireProjection.calculateActualRetireAge({
            firstFireAge,
            extraSavingYearsAfterFire: ctx.extraSavingYearsAfterFire,
            fallbackAge: ctx.pensionAge
        });
        if (firstFireAge === -1 || item.age < actualRetireAge || item.age < ctx.pensionAge) return null;
        return Math.round(ctx.expectedPension * Math.pow(1 + ctx.pensionGrowthRate, item.age - ctx.pensionAge) * 12);
    });

    if (cashflowChartInstance) {
        cashflowChartInstance.destroy();
    }

    cashflowChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: '退休后资产余额',
                    data: assetSeries,
                    yAxisID: 'asset',
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30,136,229,0.10)',
                    tension: 0.25,
                    pointRadius: 2
                },
                {
                    label: '年度消费额',
                    data: spendingSeries,
                    yAxisID: 'cashflow',
                    borderColor: '#8e24aa',
                    backgroundColor: 'rgba(142,36,170,0.10)',
                    borderDash: [6, 4],
                    tension: 0.25,
                    pointRadius: 2
                },
                {
                    label: '年度净支出',
                    data: netOutflowSeries,
                    yAxisID: 'cashflow',
                    borderColor: '#ef6c00',
                    backgroundColor: 'rgba(239,108,0,0.10)',
                    tension: 0.25,
                    pointRadius: 2
                },
                {
                    label: '年度退休金',
                    data: pensionSeries,
                    yAxisID: 'cashflow',
                    borderColor: '#00897b',
                    backgroundColor: 'rgba(0,137,123,0.10)',
                    tension: 0.25,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                asset: {
                    position: 'left',
                    ticks: {
                        callback(value) {
                            return '¥' + Number(value).toLocaleString();
                        }
                    }
                },
                cashflow: {
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        callback(value) {
                            return '¥' + Number(value).toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function getRiskClass(level) {
    if (level === '充足') return 'risk-level risk-level-good';
    if (level === '不足') return 'risk-level risk-level-bad';
    return 'risk-level risk-level-mid';
}

function renderScenarioTable(trendData, firstFireAge, ctx) {
    const tbody = document.getElementById('scenario-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    [
        { label: '立即退休', years: 0 },
        { label: '再工作 3 年', years: 3 },
        { label: '再工作 5 年', years: 5 },
        { label: '当前输入', years: ctx.extraSavingYearsAfterFire }
    ].forEach(scenario => {
        const actualRetireAge = window.FireProjection.calculateActualRetireAge({
            firstFireAge,
            extraSavingYearsAfterFire: scenario.years,
            fallbackAge: ctx.pensionAge
        });
        const retireData = trendData.find(item => item.age === actualRetireAge) || trendData[trendData.length - 1];
        const assetSeries = buildAssetSeries(trendData, firstFireAge, ctx, scenario.years);
        const depletionAge = window.FireProjection.calculateAssetDepletionAge(trendData, assetSeries);
        const safety = window.FireProjection.calculateSafetyMetrics({
            assets: retireData.assets,
            required: retireData.required
        });
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + scenario.label + '</td>' +
            '<td>' + actualRetireAge + ' 岁</td>' +
            '<td>¥ ' + Math.round(retireData.assets).toLocaleString() + '</td>' +
            '<td>' + (Number.isFinite(safety.ratio) ? safety.ratio.toFixed(2) : '∞') + 'x</td>' +
            '<td>' + (depletionAge === null ? '未耗尽' : depletionAge + ' 岁') + '</td>' +
            '<td><span class="' + getRiskClass(safety.level) + '">' + safety.level + '</span></td>';
        tbody.appendChild(tr);
    });
}

function calculateRequiredSpendingCapitalAtAge(params) {
    return window.FireProjection.calculateRequiredSpendingCapitalAtAge(params);
}

function calculateReverseTargetAnnualSavings(params) {
    const {
        targetRetireAge, currentAge, currentAssets, investmentReturn,
        lifeExpectancy, monthlyExpense, medicalMonthlyExpense,
        expectedPension, pensionAge, inflationRate,
        pensionGrowthRate
    } = params;

    if (targetRetireAge === null || Number.isNaN(targetRetireAge)) {
        return {
            requiredAnnualSavings: null,
            desc: '未填写目标退休年龄，未执行反推'
        };
    }
    if (targetRetireAge <= currentAge) {
        return {
            requiredAnnualSavings: 0,
            desc: '目标年龄 ' + targetRetireAge + ' 岁不大于当前年龄，无法反推'
        };
    }
    if (targetRetireAge >= lifeExpectancy) {
        return {
            requiredAnnualSavings: 0,
            desc: '目标年龄需小于预期寿命（当前寿命设置为 ' + lifeExpectancy + ' 岁）'
        };
    }

    const requiredCapital = calculateRequiredSpendingCapitalAtAge({
        retireAge: targetRetireAge, lifeExpectancy, currentAge,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        pensionAge, inflationRate, pensionGrowthRate,
        investmentReturn
    });

    const years = targetRetireAge - currentAge;
    const assetFutureValue = currentAssets * Math.pow(1 + investmentReturn, years);
    const gap = requiredCapital - assetFutureValue;

    if (gap <= 0) {
        return {
            requiredAnnualSavings: 0,
            desc: '按目标 ' + targetRetireAge + ' 岁退休，当前资产已覆盖所需资金'
        };
    }

    const factor = annuityFutureFactor(investmentReturn, years);
    const requiredAnnualSavings = gap / factor;

    return {
        requiredAnnualSavings: Math.max(0, requiredAnnualSavings),
        desc: '目标退休年龄 ' + targetRetireAge + ' 岁，反推年储蓄额'
    };
}

function resetForm() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = input.defaultValue || input.getAttribute('value') || '';
    });
    document.querySelector('input[name="gender"][value="male"]').checked = true;
    document.getElementById('pension-age').value = 63;
    document.getElementById('result-section').classList.add('hidden');

    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }
    if (cashflowChartInstance) {
        cashflowChartInstance.destroy();
        cashflowChartInstance = null;
    }

    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.clearFormData) {
        window.retirementCalculatorStorage.clearFormData();
    }
}
