// 核心计算逻辑
let trendChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // 恢复上次保存的数据
    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.restoreFormData) {
        window.retirementCalculatorStorage.restoreFormData();
    } else if (typeof restoreFormData === 'function') {
        restoreFormData();
    }

    // 绑定事件
    document.getElementById('calculate-btn').addEventListener('click', calculateFIRE);
    document.getElementById('reset-btn').addEventListener('click', resetForm);

    // 性别单选框联动默认退休金年龄
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const ageInput = document.getElementById('pension-age');
            if (e.target.value === 'male') {
                ageInput.value = 63;
            } else {
                ageInput.value = 58;
            }
            saveFormDataDebounced();
        });
    });

    // 输入或选项变更时自动保存（防抖，避免输入过程中频繁写入）
    bindAutoSave();
});

/** 防抖保存 */
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

/** 绑定所有输入控件的自动保存 */
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

function calculateFIRE() {
    // 获取输入值
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

    if (currentAge >= lifeExpectancy) {
        alert("当前年龄不能大于预期寿命");
        return;
    }

    // 存储年度趋势数据
    let trendData = [];
    let firstFireAge = -1;
    let firstFireAssets = 0;

    // 从当前年龄一直模拟到预期寿命前一年，尝试每个年龄作为“退休年龄”
    for (let retireAge = currentAge; retireAge <= lifeExpectancy; retireAge++) {
        
        // 1. 计算到 retireAge 时，累积了多少资产
        // 假设每年末存入 annualSavings，期初存量产生一整年收益
        let assetsAtRetire = currentAssets;
        for (let year = currentAge; year < retireAge; year++) {
            assetsAtRetire = assetsAtRetire * (1 + investmentReturn) + annualSavings;
        }

        const requiredCapital = calculateRequiredCapitalAtAge({
            retireAge,
            lifeExpectancy,
            currentAge,
            monthlyExpense,
            medicalMonthlyExpense,
            expectedPension,
            pensionAge,
            inflationRate,
            pensionGrowthRate,
            investmentReturn,
            medicalReserve
        });

        // 记录该退休年龄的数据
        trendData.push({
            age: retireAge,
            assets: assetsAtRetire,
            required: requiredCapital,
            isFire: assetsAtRetire >= requiredCapital
        });

        // 记录最早可退休年龄
        if (assetsAtRetire >= requiredCapital && firstFireAge === -1) {
            firstFireAge = retireAge;
            firstFireAssets = assetsAtRetire;
        }
    }

    // 渲染结果
    renderResults(
        trendData,
        firstFireAge,
        firstFireAssets,
        currentAge,
        pensionAge,
        lifeExpectancy,
        monthlyExpense,
        expectedPension,
        inflationRate,
        pensionGrowthRate,
        medicalReserve,
        targetRetireAge,
        annualSavings,
        currentAssets,
        investmentReturn,
        medicalMonthlyExpense
    );
}

function renderResults(
    trendData,
    firstFireAge,
    firstFireAssets,
    currentAge,
    pensionAge,
    lifeExpectancy,
    monthlyExpense,
    expectedPension,
    inflationRate,
    pensionGrowthRate,
    medicalReserve,
    targetRetireAge,
    annualSavings,
    currentAssets,
    investmentReturn,
    medicalMonthlyExpense
) {
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

    // 关键拐点：资金最紧张年龄（资金缺口最大）
    const tightestPoint = trendData.reduce((maxItem, item) => {
        const gap = item.required - item.assets;
        if (!maxItem || gap > maxItem.gap) {
            return { age: item.age, gap };
        }
        return maxItem;
    }, null);

    // 渲染表格 (提取关键年份展示，避免太长。比如当前年龄、每隔5年、最早退休年龄、法定退休金年龄)
    tbody.innerHTML = '';
    
    let displayAges = new Set();
    // 强制加入：当前年龄 + 1
    displayAges.add(currentAge + 1);
    // 强制加入最早退休年龄
    if (firstFireAge !== -1) displayAges.add(firstFireAge);
    // 强制加入领退休金年龄
    displayAges.add(pensionAge);
    // 强制加入资金最紧张年龄
    if (tightestPoint) displayAges.add(tightestPoint.age);
    
    // 加入每 5 年的节点
    for (let age = currentAge; age <= trendData[trendData.length - 1].age; age++) {
        if (age % 5 === 0) {
            displayAges.add(age);
        }
    }

    // 排序并过滤出存在的数据
    let sortedAges = Array.from(displayAges).sort((a, b) => a - b);
    
    sortedAges.forEach(age => {
        let data = trendData.find(d => d.age === age);
        if (!data) return;

        let tr = document.createElement('tr');
        
        // 状态判定
        let statusHtml = '';
        if (data.isFire) {
            statusHtml = '<span class="status-ok">可退休 (FIRE)</span>';
            tr.style.backgroundColor = '#f1f8e9'; // 浅绿高亮
        } else {
            statusHtml = '<span class="status-wait">需继续攒钱</span>';
        }

        // 如果是刚刚达到的最早退休年龄，特殊标记
        if (age === firstFireAge) {
            statusHtml = '<span class="status-ok">⭐ 最早 FIRE 点</span>';
            tr.style.fontWeight = 'bold';
        }
        if (age === pensionAge) {
            tr.classList.add('highlight-pension-age');
            statusHtml = '<span class="status-wait">退休金开始领取</span>';
        }
        if (tightestPoint && age === tightestPoint.age) {
            tr.classList.add('highlight-tightest-age');
            statusHtml = '<span class="status-fail">资金最紧张年龄</span>';
        }

        tr.innerHTML = `
            <td>${data.age} 岁</td>
            <td>¥ ${Math.round(data.assets).toLocaleString()}</td>
            <td>¥ ${Math.round(data.required).toLocaleString()}</td>
            <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    renderTrendChart(trendData, firstFireAge, pensionAge, tightestPoint);

    renderPostRetirementMonthlyTable(
        firstFireAge,
        pensionAge,
        lifeExpectancy,
        currentAge,
        monthlyExpense,
        medicalMonthlyExpense,
        expectedPension,
        inflationRate,
        pensionGrowthRate,
        postRetirementTitle,
        postRetirementBody
    );

    const assumeRetireAge = firstFireAge !== -1 ? firstFireAge : pensionAge;
    const inflatedMedicalReserve = calculateInflatedMedicalReserve(
        medicalReserve,
        currentAge,
        assumeRetireAge,
        inflationRate
    );
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
        targetRetireAge,
        currentAge,
        currentAssets,
        investmentReturn,
        lifeExpectancy,
        monthlyExpense,
        medicalMonthlyExpense,
        expectedPension,
        pensionAge,
        inflationRate,
        pensionGrowthRate,
        medicalReserve
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

    // 滚动到结果区域
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

function renderPostRetirementMonthlyTable(
    firstFireAge,
    pensionAge,
    lifeExpectancy,
    currentAge,
    monthlyExpense,
    medicalMonthlyExpense,
    expectedPension,
    inflationRate,
    pensionGrowthRate,
    postRetirementTitle,
    postRetirementBody
) {
    postRetirementBody.innerHTML = '';

    const assumeRetireAge = firstFireAge !== -1 ? firstFireAge : pensionAge;
    const titleText = firstFireAge !== -1
        ? `退休后月度开销明细（按最早 FIRE 年龄 ${assumeRetireAge} 岁测算）`
        : `退休后月度开销明细（按参考退休年龄 ${assumeRetireAge} 岁测算）`;
    postRetirementTitle.textContent = titleText;

    for (let age = assumeRetireAge; age < lifeExpectancy; age += 1) {
        const yearsFromNow = age - currentAge;
        const currentMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate, yearsFromNow);
        const currentMonthlyMedicalExpense = calculateInflatedMedicalReserve(
            medicalMonthlyExpense,
            currentAge,
            age,
            inflationRate
        );
        const currentMonthlyPension = age >= pensionAge
            ? expectedPension * Math.pow(1 + pensionGrowthRate, age - pensionAge)
            : 0;
        const currentMonthlyNet = Math.max(0, currentMonthlyExpense + currentMonthlyMedicalExpense - currentMonthlyPension);
        const currentMonthlyNetReal = currentMonthlyNet / Math.pow(1 + inflationRate, yearsFromNow);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${age} 岁</td>
            <td>¥ ${Math.round(currentMonthlyExpense).toLocaleString()}</td>
            <td>¥ ${Math.round(currentMonthlyMedicalExpense).toLocaleString()}</td>
            <td>¥ ${Math.round(currentMonthlyPension).toLocaleString()}</td>
            <td>¥ ${Math.round(currentMonthlyNet).toLocaleString()}</td>
            <td>¥ ${Math.round(currentMonthlyNetReal).toLocaleString()}</td>
        `;
        postRetirementBody.appendChild(row);
    }
}

function renderTrendChart(trendData, firstFireAge, pensionAge, tightestPoint) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = trendData.map((item) => `${item.age}岁`);
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
            pushKeyPoint(firstFireAge, fireItem.assets, '#2e7d32', `最早FIRE ${firstFireAge}岁`);
        }
    }

    const pensionItem = trendData.find((item) => item.age === pensionAge);
    if (pensionItem) {
        pushKeyPoint(pensionAge, pensionItem.required, '#f57c00', `退休金起领 ${pensionAge}岁`);
    }

    if (tightestPoint) {
        const tightItem = trendData.find((item) => item.age === tightestPoint.age);
        if (tightItem) {
            pushKeyPoint(tightestPoint.age, tightItem.required, '#c62828', `最紧张 ${tightestPoint.age}岁`);
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
                            return `¥${Number(value).toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
}

function calculateRequiredCapitalAtAge(params) {
    const {
        retireAge,
        lifeExpectancy,
        currentAge,
        monthlyExpense,
        medicalMonthlyExpense,
        expectedPension,
        pensionAge,
        inflationRate,
        pensionGrowthRate,
        investmentReturn,
        medicalReserve
    } = params;

    let requiredCapital = 0;

    for (let year = retireAge; year < lifeExpectancy; year++) {
        const yearsFromNow = year - currentAge;
        const inflatedMonthlyExpense = monthlyExpense * Math.pow(1 + inflationRate, yearsFromNow);
        const yearlyLivingExpense = inflatedMonthlyExpense * 12;
        const inflatedMonthlyMedicalExpense = calculateInflatedMedicalReserve(
            medicalMonthlyExpense,
            currentAge,
            year,
            inflationRate
        );
        const yearlyMedicalExpense = inflatedMonthlyMedicalExpense * 12;

        let yearlyPension = 0;
        if (year >= pensionAge) {
            const pensionGrowthYears = year - pensionAge;
            const inflatedPension = expectedPension * Math.pow(1 + pensionGrowthRate, pensionGrowthYears);
            yearlyPension = inflatedPension * 12;
        }

        const netCashOutflow = Math.max(0, yearlyLivingExpense + yearlyMedicalExpense - yearlyPension);
        const discountYears = year - retireAge;
        const presentValueOfOutflow = netCashOutflow / Math.pow(1 + investmentReturn, discountYears);
        requiredCapital += presentValueOfOutflow;
    }

    const inflatedMedicalReserve = calculateInflatedMedicalReserve(
        medicalReserve,
        currentAge,
        retireAge,
        inflationRate
    );
    requiredCapital += inflatedMedicalReserve;

    return requiredCapital;
}

function calculateReverseTargetAnnualSavings(params) {
    const {
        targetRetireAge,
        currentAge,
        currentAssets,
        investmentReturn,
        lifeExpectancy,
        monthlyExpense,
        medicalMonthlyExpense,
        expectedPension,
        pensionAge,
        inflationRate,
        pensionGrowthRate,
        medicalReserve
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
            desc: `目标年龄 ${targetRetireAge} 岁不大于当前年龄，无法反推`
        };
    }
    if (targetRetireAge >= lifeExpectancy) {
        return {
            requiredAnnualSavings: 0,
            desc: `目标年龄需小于预期寿命（当前寿命设置为 ${lifeExpectancy} 岁）`
        };
    }

    const requiredCapital = calculateRequiredCapitalAtAge({
        retireAge: targetRetireAge,
        lifeExpectancy,
        currentAge,
        monthlyExpense,
        medicalMonthlyExpense,
        expectedPension,
        pensionAge,
        inflationRate,
        pensionGrowthRate,
        investmentReturn,
        medicalReserve
    });

    const years = targetRetireAge - currentAge;
    const assetFutureValue = currentAssets * Math.pow(1 + investmentReturn, years);
    const gap = requiredCapital - assetFutureValue;

    if (gap <= 0) {
        return {
            requiredAnnualSavings: 0,
            desc: `按目标 ${targetRetireAge} 岁退休，当前资产已覆盖所需资金`
        };
    }

    let requiredAnnualSavings = 0;
    if (investmentReturn === 0) {
        requiredAnnualSavings = gap / years;
    } else {
        const annuityFactor = (Math.pow(1 + investmentReturn, years) - 1) / investmentReturn;
        requiredAnnualSavings = gap / annuityFactor;
    }

    return {
        requiredAnnualSavings: Math.max(0, requiredAnnualSavings),
        desc: `目标退休年龄 ${targetRetireAge} 岁，反推年储蓄额`
    };
}

function calculateInflatedMedicalReserve(baseMedicalReserve, currentAge, targetAge, inflationRate) {
    let value = baseMedicalReserve;
    for (let age = currentAge; age < targetAge; age += 1) {
        value *= (1 + inflationRate);
    }
    return value;
}

function resetForm() {
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.value = input.defaultValue || input.getAttribute('value') || '';
    });
    document.querySelector('input[name="gender"][value="male"]').checked = true;
    document.getElementById('pension-age').value = 63;
    document.getElementById('result-section').classList.add('hidden');

    if (window.retirementCalculatorStorage && window.retirementCalculatorStorage.clearFormData) {
        window.retirementCalculatorStorage.clearFormData();
    }
}
