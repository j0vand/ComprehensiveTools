let trendChartInstance = null;
let cashflowChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fire-form').addEventListener('submit', event => {
        event.preventDefault();
        calculateFIRE();
    });
    document.getElementById('reset-btn').addEventListener('click', resetForm);

    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        radio.addEventListener('input', event => {
            document.getElementById('pension-age').value = event.target.value === 'male' ? 63 : 58;
        });
    });

    window.retirementCalculatorStorage.restoreFormData();
    bindScenarioControls();
    bindChartTabs();
    bindFormPersistence();
});

/** 任一模型输入变化后立即废弃旧结果，并同步当前表单。 */
function bindFormPersistence() {
    const form = document.getElementById('fire-form');
    form.addEventListener('input', () => {
        document.getElementById('result-section').classList.add('hidden');
        // 编辑中的空值或越界值不覆盖最后一份可恢复快照。
        if (form.checkValidity()) window.retirementCalculatorStorage.saveFormData();
    });
}

function syncScenarioButtons() {
    const currentValue = document.getElementById('extra-saving-years-after-fire').value || '0';
    document.querySelectorAll('.scenario-button').forEach(button => {
        const active = button.dataset.extraSavingYears === currentValue;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function bindScenarioControls() {
    const extraInput = document.getElementById('extra-saving-years-after-fire');
    const buttons = document.querySelectorAll('.scenario-button');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            extraInput.value = button.dataset.extraSavingYears || '0';
            extraInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });
    extraInput.addEventListener('input', syncScenarioButtons);
    syncScenarioButtons();
}

function bindChartTabs() {
    const tabs = Array.from(document.querySelectorAll('.chart-tab'));
    const activateTab = (tab, shouldFocus = false) => {
        const view = tab.dataset.chartView;
        tabs.forEach(item => {
            const active = item === tab;
            item.classList.toggle('active', active);
            item.setAttribute('aria-selected', String(active));
            item.tabIndex = active ? 0 : -1;
        });

        const assetsPanel = document.getElementById('chart-panel-assets');
        const cashflowPanel = document.getElementById('chart-panel-cashflow');
        assetsPanel.classList.toggle('hidden', view !== 'assets');
        cashflowPanel.classList.toggle('hidden', view !== 'cashflow');
        assetsPanel.setAttribute('aria-hidden', String(view !== 'assets'));
        cashflowPanel.setAttribute('aria-hidden', String(view !== 'cashflow'));
        if (trendChartInstance) trendChartInstance.resize();
        if (cashflowChartInstance) cashflowChartInstance.resize();
        if (shouldFocus) tab.focus();
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(tab));
        tab.addEventListener('keydown', event => {
            let targetIndex = null;
            if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') targetIndex = 0;
            if (event.key === 'End') targetIndex = tabs.length - 1;
            if (targetIndex === null) return;

            event.preventDefault();
            activateTab(tabs[targetIndex], true);
        });
    });
    activateTab(tabs.find(tab => tab.classList.contains('active')) || tabs[0]);
}

/** 读取必填数值字段，保留空值和非法值交给统一校验。 */
function readNumber(id) {
    const rawValue = document.getElementById(id).value.trim();
    return rawValue === '' ? NaN : Number(rawValue);
}

function collectFormInputs() {
    const currentAge = readNumber('current-age');
    const lifeExpectancy = readNumber('life-expectancy');
    const currentAssets = readNumber('current-assets') * 10000;
    const annualSavings = readNumber('annual-savings') * 10000;
    const monthlyExpense = readNumber('monthly-expense');
    const medicalMonthlyExpense = readNumber('medical-monthly-expense');
    const medicalReserve = readNumber('medical-reserve') * 10000;
    const targetRetireAgeInput = document.getElementById('target-retire-age').value.trim();
    const targetRetireAge = targetRetireAgeInput === '' ? null : Number(targetRetireAgeInput);
    const extraSavingYearsAfterFire = readNumber('extra-saving-years-after-fire');
    const expectedPension = readNumber('expected-pension');
    const pensionAge = readNumber('pension-age');
    const inflationRate = readNumber('inflation-rate') / 100;
    const investmentReturn = readNumber('investment-return') / 100;
    const pensionGrowthRate = readNumber('pension-growth-rate') / 100;

    return {
        currentAge, lifeExpectancy, currentAssets, annualSavings,
        monthlyExpense, medicalMonthlyExpense, medicalReserve,
        targetRetireAge, extraSavingYearsAfterFire, expectedPension, pensionAge,
        inflationRate, investmentReturn, pensionGrowthRate
    };
}

function calculateFIRE() {
    const form = document.getElementById('fire-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    document.getElementById('result-section').classList.add('hidden');
    const params = collectFormInputs();
    const validation = window.FireProjection.validateInputs(params);

    if (!validation.valid) {
        window.DialogService.showError(validation.error);
        return;
    }
    if (validation.warnings && validation.warnings.length > 0) {
        window.DialogService.showToast(validation.warnings.join('；'), 'warning', { duration: 6000 });
    }

    const { trendData, firstFireAge, firstFireAssets } =
        window.FireProjection.calculateFireTrend(params);
    if (trendData.some(item =>
        !Number.isFinite(item.assets)
        || !Number.isFinite(item.required)
        || Math.abs(item.assets) > Number.MAX_SAFE_INTEGER
        || Math.abs(item.required) > Number.MAX_SAFE_INTEGER
    )) {
        window.DialogService.showError('输入金额过大，长期复利结果已超出可靠计算范围');
        return;
    }
    const actualRetireAge = window.FireProjection.calculateActualRetireAge({
        firstFireAge,
        extraSavingYearsAfterFire: params.extraSavingYearsAfterFire,
        lifeExpectancy: params.lifeExpectancy
    });
    // 仍展示最早 FIRE 结论；当前继续储蓄场景标为不可用。
    if (firstFireAge !== -1 && actualRetireAge === null) {
        window.DialogService.showToast(
            '最早 FIRE 年龄加继续储蓄年数必须小于预期寿命，请缩短继续储蓄年数',
            'warning',
            { duration: 5000 }
        );
    }

    renderResults({
        trendData, firstFireAge, firstFireAssets, actualRetireAge, ...params
    });
}

function renderResults(ctx) {
    const {
        trendData, firstFireAge, firstFireAssets, actualRetireAge,
        currentAge, pensionAge, lifeExpectancy,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        inflationRate, pensionGrowthRate, medicalReserve,
        targetRetireAge, currentAssets, investmentReturn
    } = ctx;

    const resultSection = document.getElementById('result-section');
    const resultSuccess = document.getElementById('result-success');
    const resultFail = document.getElementById('result-fail');
    const tbody = document.getElementById('trend-table-body');
    const medicalReserveInflatedEl = document.getElementById('res-medical-reserve-inflated');
    const medicalAgeEl = document.getElementById('res-medical-age');
    const targetAnnualSavingsEl = document.getElementById('res-target-annual-savings');
    const targetDescEl = document.getElementById('res-target-desc');
    const targetReverseCard = document.getElementById('target-reverse-card');
    const fireAssetsRealEl = document.getElementById('res-fire-assets-real');
    const actualRetireAgeEl = document.getElementById('res-actual-retire-age');
    const depletionAgeEl = document.getElementById('res-depletion-age');
    const depletionDescEl = document.getElementById('res-depletion-desc');
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
    displayAges.add(currentAge);
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
            tags.push('<span class="status-ok">最早 FIRE 点</span>');
            tr.classList.add('highlight-fire-age');
        } else if (data.isFire) {
            tags.push('<span class="status-ok">可退休 (FIRE)</span>');
            tr.classList.add('highlight-fire-ready');
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

    renderTrendChart(trendData, firstFireAge, pensionAge, ctx);
    renderCashflowChart(trendData, firstFireAge, ctx);
    renderScenarioTable(trendData, firstFireAge, ctx);

    renderPostRetirementMonthlyTable(ctx);

    if (actualRetireAge === null) {
        actualRetireAgeEl.textContent = '—';
        depletionAgeEl.textContent = '—';
        depletionDescEl.textContent = '退休场景不可用';
        medicalReserveInflatedEl.textContent = '—';
        medicalAgeEl.textContent = '—';
        safetyLevelEl.textContent = '不可用';
        safetyLevelEl.className = '';
        safetyBufferEl.textContent = '—';
        safetyRatioEl.textContent = '—';
    } else {
        actualRetireAgeEl.textContent = actualRetireAge;

        const currentScenarioAssets = buildAssetSeries(trendData, firstFireAge, ctx, ctx.extraSavingYearsAfterFire);
        const depletionAge = window.FireProjection.calculateAssetDepletionAge(trendData, currentScenarioAssets, ctx);
        depletionAgeEl.textContent = depletionAge === null ? '未耗尽' : depletionAge + ' 岁';
        depletionDescEl.textContent = depletionAge === null || depletionAge >= lifeExpectancy - 1
            ? '覆盖到预期寿命'
            : '早于预期寿命耗尽';

        const inflatedMedicalReserve = medicalReserve
            * Math.pow(1 + inflationRate, actualRetireAge - currentAge);
        medicalReserveInflatedEl.textContent = Math.round(inflatedMedicalReserve).toLocaleString();
        medicalAgeEl.textContent = actualRetireAge;

        const retireData = trendData.find((item) => item.age === actualRetireAge);
        if (retireData) {
            const safetyMetrics = window.FireProjection.calculateSafetyMetrics({
                assets: retireData.assets,
                required: retireData.required
            });
            safetyLevelEl.textContent = safetyMetrics.level;
            safetyLevelEl.className = getRiskClass(safetyMetrics.level);
            safetyBufferEl.textContent = Math.round(safetyMetrics.buffer).toLocaleString();
            safetyRatioEl.textContent = safetyMetrics.ratio === null ? '—' : safetyMetrics.ratio.toFixed(2) + 'x';
        } else {
            safetyLevelEl.textContent = '不可用';
            safetyLevelEl.className = '';
            safetyBufferEl.textContent = '—';
            safetyRatioEl.textContent = '—';
        }
    }

    const realReturnRate = ((1 + investmentReturn) / (1 + inflationRate) - 1) * 100;
    realReturnRateEl.textContent = realReturnRate.toFixed(2);

    const reverseResult = window.FireProjection.calculateTargetAnnualSavings({
        targetRetireAge, currentAge, currentAssets, investmentReturn,
        lifeExpectancy, monthlyExpense, medicalMonthlyExpense,
        medicalReserve, expectedPension, pensionAge, inflationRate,
        pensionGrowthRate
    });
    targetAnnualSavingsEl.textContent = reverseResult.requiredAnnualSavings === null
        ? '—'
        : Math.round(reverseResult.requiredAnnualSavings).toLocaleString();
    targetDescEl.textContent = reverseResult.desc;
    targetReverseCard.classList.toggle(
        'disabled-card',
        reverseResult.requiredAnnualSavings === null
    );

    resultSection.scrollIntoView({ behavior: 'smooth' });
    resultSection.focus({ preventScroll: true });
}

function renderPostRetirementMonthlyTable(ctx) {
    const { actualRetireAge, lifeExpectancy, currentAge, inflationRate } = ctx;

    const postRetirementTitle = document.getElementById('post-retirement-title');
    const postRetirementBody = document.getElementById('post-retirement-body');
    postRetirementBody.innerHTML = '';

    if (actualRetireAge === null) {
        postRetirementTitle.textContent = '退休后月度开销明细（暂无可用退休场景）';
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" class="empty-table-cell">当前条件未达到 FIRE，暂无可用退休场景</td>';
        postRetirementBody.appendChild(row);
        return;
    }

    postRetirementTitle.textContent = '退休后月度开销明细（按实际退休年龄 ' + actualRetireAge + ' 岁测算）';

    for (let age = actualRetireAge; age < lifeExpectancy; age += 1) {
        const yearsFromNow = age - currentAge;
        const cashflow = window.FireProjection.calculateYearlyCashflow(ctx, age);
        const monthlyNetReal = cashflow.monthlyNetOutflow / Math.pow(1 + inflationRate, yearsFromNow);

        const row = document.createElement('tr');
        row.innerHTML =
            '<td>' + age + ' 岁</td>' +
            '<td>¥ ' + Math.round(cashflow.monthlyExpense).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(cashflow.monthlyMedicalExpense).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(cashflow.monthlyPension).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(cashflow.monthlyNetOutflow).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(monthlyNetReal).toLocaleString() + '</td>';
        postRetirementBody.appendChild(row);
    }
}

function buildAssetSeries(trendData, firstFireAge, ctx, extraSavingYearsAfterFire) {
    return window.FireProjection.calculateStopSavingAssetSeries({
        ...ctx,
        trendData,
        firstFireAge,
        extraSavingYearsAfterFire
    });
}

function renderTrendChart(trendData, firstFireAge, pensionAge, ctx) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        canvas.classList.add('hidden');
        const fallback = document.getElementById('chart-fallback');
        if (fallback) fallback.classList.remove('hidden');
        return;
    }

    canvas.classList.remove('hidden');
    const fallback = document.getElementById('chart-fallback');
    if (fallback) fallback.classList.add('hidden');

    const labels = trendData.map((item) => item.age + '岁');
    const hasRetireScenario = firstFireAge !== -1 && ctx.actualRetireAge !== null;
    const currentAssetSeries = hasRetireScenario
        ? buildAssetSeries(trendData, firstFireAge, ctx, ctx.extraSavingYearsAfterFire).map(value => Math.round(value))
        : trendData.map(item => Math.round(item.assets));
    const requiredSeries = trendData.map(item => (
        !hasRetireScenario || item.age <= ctx.actualRetireAge ? Math.round(item.required) : null
    ));
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

    const assetDatasets = [{
        label: '当前场景资产',
        data: currentAssetSeries,
        borderColor: '#1e88e5',
        backgroundColor: 'rgba(30,136,229,0.12)',
        tension: 0.25,
        pointRadius: 2
    }];
    if (firstFireAge !== -1 && ctx.extraSavingYearsAfterFire > 0) {
        assetDatasets.push({
            label: '最早 FIRE 后退休',
            data: buildAssetSeries(trendData, firstFireAge, ctx, 0).map(value => Math.round(value)),
            borderColor: '#43a047',
            backgroundColor: 'rgba(67,160,71,0.10)',
            tension: 0.25,
            pointRadius: 2
        });
    }

    trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                ...assetDatasets,
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
                        filter(item, chartData) {
                            return !chartData.datasets[item.datasetIndex].keyPointLabel;
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

    const fallback = document.getElementById('cashflow-chart-fallback');
    if (firstFireAge === -1 || ctx.actualRetireAge === null) {
        if (cashflowChartInstance) {
            cashflowChartInstance.destroy();
            cashflowChartInstance = null;
        }
        canvas.classList.add('hidden');
        if (fallback) {
            fallback.textContent = firstFireAge === -1
                ? '当前条件未达到 FIRE，暂无退休后现金流场景。'
                : '继续储蓄后的实际退休年龄超过预期寿命，暂无退休后现金流场景。';
            fallback.classList.remove('hidden');
        }
        return;
    }

    canvas.classList.remove('hidden');

    if (typeof Chart === 'undefined') {
        canvas.classList.add('hidden');
        if (fallback) {
            fallback.textContent = '图表库加载失败，现金流图暂不可用。请检查网络后刷新页面重试。';
            fallback.classList.remove('hidden');
        }
        return;
    }

    if (fallback) fallback.classList.add('hidden');

    const labels = trendData.map((item) => item.age + '岁');
    const assetSeries = buildAssetSeries(trendData, firstFireAge, ctx, ctx.extraSavingYearsAfterFire).map(value => Math.round(value));
    const cashflows = trendData.map(item => (
        item.age < ctx.actualRetireAge
            ? null
            : window.FireProjection.calculateYearlyCashflow(ctx, item.age)
    ));
    const spendingSeries = cashflows.map(cashflow =>
        cashflow === null ? null : Math.round(cashflow.yearlyGrossSpending)
    );
    const netOutflowSeries = cashflows.map(cashflow =>
        cashflow === null ? null : Math.round(cashflow.yearlyNetOutflow)
    );
    const pensionSeries = cashflows.map(cashflow =>
        cashflow === null || cashflow.yearlyPension === 0 ? null : Math.round(cashflow.yearlyPension)
    );

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

    const scenarios = [
        { label: '立即退休', years: 0 },
        { label: '再工作 3 年', years: 3 },
        { label: '再工作 5 年', years: 5 }
    ];
    if (!scenarios.some(scenario => scenario.years === ctx.extraSavingYearsAfterFire)) {
        scenarios.push({
            label: '再工作 ' + ctx.extraSavingYearsAfterFire + ' 年',
            years: ctx.extraSavingYearsAfterFire
        });
    }

    scenarios.forEach(scenario => {
        const label = scenario.years === ctx.extraSavingYearsAfterFire
            ? scenario.label + '（当前输入）'
            : scenario.label;
        const actualRetireAge = window.FireProjection.calculateActualRetireAge({
            firstFireAge,
            extraSavingYearsAfterFire: scenario.years,
            lifeExpectancy: ctx.lifeExpectancy
        });
        if (firstFireAge === -1 || actualRetireAge === null) {
            const reason = firstFireAge === -1 ? '未达到 FIRE' : '超过预期寿命';
            const tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + label + '</td>' +
                '<td>不可用</td>' +
                '<td>—</td>' +
                '<td>—</td>' +
                '<td>—</td>' +
                '<td><span class="risk-level risk-level-bad">' + reason + '</span></td>';
            tbody.appendChild(tr);
            return;
        }

        const retireData = trendData.find(item => item.age === actualRetireAge);
        if (!retireData) return;
        const assetSeries = buildAssetSeries(trendData, firstFireAge, ctx, scenario.years);
        const depletionAge = window.FireProjection.calculateAssetDepletionAge(
            trendData,
            assetSeries,
            { ...ctx, actualRetireAge }
        );
        const safety = window.FireProjection.calculateSafetyMetrics({
            assets: retireData.assets,
            required: retireData.required
        });
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + label + '</td>' +
            '<td>' + actualRetireAge + ' 岁</td>' +
            '<td>¥ ' + Math.round(retireData.assets).toLocaleString() + '</td>' +
            '<td>' + (safety.ratio === null ? '—' : safety.ratio.toFixed(2) + 'x') + '</td>' +
            '<td>' + (depletionAge === null ? '未耗尽' : depletionAge + ' 岁') + '</td>' +
            '<td><span class="' + getRiskClass(safety.level) + '">' + safety.level + '</span></td>';
        tbody.appendChild(tr);
    });
}

function resetForm() {
    document.querySelectorAll('#fire-form input[type="number"]').forEach(input => {
        input.value = input.defaultValue;
    });
    document.querySelector('input[name="gender"][value="male"]').checked = true;
    document.getElementById('pension-age').value = 63;
    document.getElementById('result-section').classList.add('hidden');
    syncScenarioButtons();

    if (trendChartInstance) {
        trendChartInstance.destroy();
        trendChartInstance = null;
    }
    if (cashflowChartInstance) {
        cashflowChartInstance.destroy();
        cashflowChartInstance = null;
    }

    document.querySelector('.chart-tab[data-chart-view="assets"]').click();
    window.retirementCalculatorStorage.clearFormData();
}
