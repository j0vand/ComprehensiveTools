let trendChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.restoreFormData) {
        window.retirementCalculatorStorage.restoreFormData();
    } else if (typeof restoreFormData === 'function') {
        restoreFormData();
    }

    document.getElementById('calculate-btn').addEventListener('click', calculateFIRE);
    document.getElementById('reset-btn').addEventListener('click', resetForm);

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
        'target-retire-age', 'expected-pension', 'pension-age',
        'inflation-rate', 'investment-return', 'pension-growth-rate'
    ];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', saveFormDataDebounced);
        if (el) el.addEventListener('change', saveFormDataDebounced);
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
    const currentAssets = parseFloat(document.getElementById('current-assets').value) || 0;
    const annualSavings = parseFloat(document.getElementById('annual-savings').value) || 0;
    const monthlyExpense = parseFloat(document.getElementById('monthly-expense').value) || 0;
    const medicalMonthlyExpense = parseFloat(document.getElementById('medical-monthly-expense').value) || 0;
    const medicalReserve = parseFloat(document.getElementById('medical-reserve').value) || 0;
    const targetRetireAgeInput = document.getElementById('target-retire-age').value.trim();
    const targetRetireAge = targetRetireAgeInput === '' ? null : parseInt(targetRetireAgeInput);
    const expectedPension = parseFloat(document.getElementById('expected-pension').value) || 0;
    const pensionAge = parseInt(document.getElementById('pension-age').value) || 63;
    const inflationRate = (parseFloat(document.getElementById('inflation-rate').value) || 0) / 100;
    const investmentReturn = (parseFloat(document.getElementById('investment-return').value) || 0) / 100;
    const pensionGrowthRate = (parseFloat(document.getElementById('pension-growth-rate').value) || 0) / 100;

    return {
        currentAge, lifeExpectancy, currentAssets, annualSavings,
        monthlyExpense, medicalMonthlyExpense, medicalReserve,
        targetRetireAge, expectedPension, pensionAge,
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

    // O(n) 增量计算累积资产，避免每次从头算
    let assetsAtRetire = currentAssets;
    for (let retireAge = currentAge; retireAge <= lifeExpectancy; retireAge++) {
        const requiredCapital = calculateRequiredCapitalAtAge({
            retireAge, lifeExpectancy, currentAge,
            monthlyExpense, medicalMonthlyExpense, expectedPension,
            pensionAge, inflationRate, pensionGrowthRate,
            investmentReturn, medicalReserve
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
    const gapAmountEl = document.getElementById('res-gap-amount');
    const gapAmountRealEl = document.getElementById('res-gap-amount-real');
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

    const tightestPoint = trendData.reduce((maxItem, item) => {
        const gap = item.required - item.assets;
        if (!maxItem || gap > maxItem.gap) {
            return { age: item.age, gap };
        }
        return maxItem;
    }, null);

    // 构建要显示的关键年龄集合
    tbody.innerHTML = '';

    const displayAges = new Set();
    displayAges.add(currentAge + 1);
    if (firstFireAge !== -1) displayAges.add(firstFireAge);
    displayAges.add(pensionAge);
    if (tightestPoint) displayAges.add(tightestPoint.age);

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
        const isTightest = tightestPoint && age === tightestPoint.age;

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
        if (isTightest) {
            tags.push('<span class="status-fail">资金最紧张年龄</span>');
            if (!isFirePoint && !isPensionAge) tr.classList.add('highlight-tightest-age');
        }

        tr.innerHTML =
            '<td>' + data.age + ' 岁</td>' +
            '<td>¥ ' + Math.round(data.assets).toLocaleString() + '</td>' +
            '<td>¥ ' + Math.round(data.required).toLocaleString() + '</td>' +
            '<td>' + tags.join(' / ') + '</td>';
        tbody.appendChild(tr);
    });

    renderTrendChart(trendData, firstFireAge, pensionAge, tightestPoint);

    renderPostRetirementMonthlyTable({
        firstFireAge, pensionAge, lifeExpectancy, currentAge,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        inflationRate, pensionGrowthRate
    });

    const assumeRetireAge = firstFireAge !== -1 ? firstFireAge : pensionAge;
    const inflatedMedicalReserve = applyInflation(medicalReserve, currentAge, assumeRetireAge, inflationRate);
    medicalReserveInflatedEl.textContent = Math.round(inflatedMedicalReserve).toLocaleString();
    medicalAgeEl.textContent = assumeRetireAge;

    const assumeData = trendData.find((item) => item.age === assumeRetireAge);
    const gapAmount = assumeData ? Math.max(0, assumeData.required - assumeData.assets) : 0;
    const gapAmountReal = gapAmount / Math.pow(1 + inflationRate, Math.max(0, assumeRetireAge - currentAge));
    gapAmountEl.textContent = Math.round(gapAmount).toLocaleString();
    gapAmountRealEl.textContent = Math.round(gapAmountReal).toLocaleString();
    const realReturnRate = ((1 + investmentReturn) / (1 + inflationRate) - 1) * 100;
    realReturnRateEl.textContent = realReturnRate.toFixed(2);

    const reverseResult = calculateReverseTargetAnnualSavings({
        targetRetireAge, currentAge, currentAssets, investmentReturn,
        lifeExpectancy, monthlyExpense, medicalMonthlyExpense,
        expectedPension, pensionAge, inflationRate,
        pensionGrowthRate, medicalReserve
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

function renderTrendChart(trendData, firstFireAge, pensionAge, tightestPoint) {
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
    const assetSeries = trendData.map((item) => Math.round(item.assets));
    const requiredSeries = trendData.map((item) => Math.round(item.required));
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

    if (tightestPoint) {
        const tightItem = trendData.find((item) => item.age === tightestPoint.age);
        if (tightItem) {
            pushKeyPoint(tightestPoint.age, tightItem.required, '#c62828', '最紧张 ' + tightestPoint.age + '岁');
        }
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
                    label: '累积资产',
                    data: assetSeries,
                    borderColor: '#1e88e5',
                    backgroundColor: 'rgba(30,136,229,0.12)',
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
                            return item.text === '累积资产' || item.text === '退休所需资金';
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

function calculateRequiredCapitalAtAge(params) {
    const {
        retireAge, lifeExpectancy, currentAge,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        pensionAge, inflationRate, pensionGrowthRate,
        investmentReturn, medicalReserve
    } = params;

    let requiredCapital = 0;

    for (let year = retireAge; year < lifeExpectancy; year++) {
        const yearsFromNow = year - currentAge;
        const inflatedMonthlyExpense = applyInflation(monthlyExpense, 0, yearsFromNow, inflationRate);
        const yearlyLivingExpense = inflatedMonthlyExpense * 12;
        const inflatedMonthlyMedicalExpense = applyInflation(medicalMonthlyExpense, currentAge, year, inflationRate);
        const yearlyMedicalExpense = inflatedMonthlyMedicalExpense * 12;

        let yearlyPension = 0;
        if (year >= pensionAge) {
            const inflatedPension = expectedPension * Math.pow(1 + pensionGrowthRate, year - pensionAge);
            yearlyPension = inflatedPension * 12;
        }

        const netCashOutflow = Math.max(0, yearlyLivingExpense + yearlyMedicalExpense - yearlyPension);
        const discountYears = year - retireAge;
        const presentValueOfOutflow = investmentReturn === 0
            ? netCashOutflow
            : netCashOutflow / Math.pow(1 + investmentReturn, discountYears);
        requiredCapital += presentValueOfOutflow;
    }

    const inflatedMedicalReserve = applyInflation(medicalReserve, currentAge, retireAge, inflationRate);
    requiredCapital += inflatedMedicalReserve;

    return requiredCapital;
}

function calculateReverseTargetAnnualSavings(params) {
    const {
        targetRetireAge, currentAge, currentAssets, investmentReturn,
        lifeExpectancy, monthlyExpense, medicalMonthlyExpense,
        expectedPension, pensionAge, inflationRate,
        pensionGrowthRate, medicalReserve
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

    const requiredCapital = calculateRequiredCapitalAtAge({
        retireAge: targetRetireAge, lifeExpectancy, currentAge,
        monthlyExpense, medicalMonthlyExpense, expectedPension,
        pensionAge, inflationRate, pensionGrowthRate,
        investmentReturn, medicalReserve
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

    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.clearFormData) {
        window.retirementCalculatorStorage.clearFormData();
    }
}
