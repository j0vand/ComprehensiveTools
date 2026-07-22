/**
 * 房贷计算器
 * 支持商业贷款、公积金贷款、组合贷款的等额本息和等额本金计算
 * @module MortgageCalculator
 */

let currentLoanType = 'commercial';
let chart = null;

const STORAGE_KEY = window.StorageKeys.MORTGAGE_CALCULATOR_DATA;

/**
 * 保存表单数据到 localStorage
 */
function saveFormData() {
    const formData = {
        loanType: currentLoanType,
        commercialAmount: document.getElementById('commercialAmount').value,
        commercialYears: document.getElementById('commercialYears').value,
        commercialRate: document.getElementById('commercialRate').value,
        fundAmount: document.getElementById('fundAmount').value,
        fundYears: document.getElementById('fundYears').value,
        fundRate: document.getElementById('fundRate').value,
        combinedCommercialAmount: document.getElementById('combinedCommercialAmount').value,
        combinedCommercialRate: document.getElementById('combinedCommercialRate').value,
        combinedFundAmount: document.getElementById('combinedFundAmount').value,
        combinedFundRate: document.getElementById('combinedFundRate').value,
        combinedYears: document.getElementById('combinedYears').value,
        repaymentMethod: document.getElementById('repaymentMethod').value
    };

    const result = window.StorageService.setJson(STORAGE_KEY, formData);
    if (!result.ok) {
        showNotification('输入保存失败，刷新页面后可能无法恢复', 'error');
    }
}

/**
 * 从 localStorage 恢复表单数据
 */
function restoreFormData() {
    const formData = window.StorageService.getJson(STORAGE_KEY, null);
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return;

    // 恢复贷款类型
    if (['commercial', 'fund', 'combined'].includes(formData.loanType)) {
        currentLoanType = formData.loanType;
        switchLoanType(currentLoanType);
    }

    // 恢复所有输入框的值
    const fields = [
        'commercialAmount', 'commercialYears', 'commercialRate', 'fundAmount', 'fundYears', 'fundRate',
        'combinedCommercialAmount', 'combinedCommercialRate', 'combinedFundAmount', 'combinedFundRate', 'combinedYears'
    ];

    fields.forEach(field => {
        const el = document.getElementById(field);
        if (el && formData[field] !== undefined && formData[field] !== '') {
            el.value = formData[field];
        }
    });

    // 恢复还款方式
    const repaymentMethodEl = document.getElementById('repaymentMethod');
    if (repaymentMethodEl && ['equal', 'principal'].includes(formData.repaymentMethod)) {
        repaymentMethodEl.value = formData.repaymentMethod;
    }
}

// 切换贷款类型
function switchLoanType(type) {
    if (!['commercial', 'fund', 'combined'].includes(type)) return;
    currentLoanType = type;
    const resultCard = document.querySelector('.result-card');
    resultCard.hidden = true;
    document.querySelectorAll('.loan-type-button').forEach(btn => {
        const active = btn.dataset.loanType === type;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    document.querySelectorAll('#commercial-inputs, #fund-inputs, #combined-inputs').forEach(div => {
        div.hidden = div.id !== type + '-inputs';
    });
}

// 切换标签页
function switchTab(tab) {
    if (!['schedule', 'chart'].includes(tab)) return;
    document.querySelectorAll('.tab-button').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', String(active));
    });

    document.getElementById('schedule-tab').hidden = tab !== 'schedule';
    document.getElementById('chart-tab').hidden = tab !== 'chart';

    if (tab === 'chart' && chart) {
        chart.resize();
    }
}

/**
 * 验证输入字段
 * @param {string} inputId - 输入框ID
 */
function validateInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const inputGroup = input.closest('.input-group');
    if (!inputGroup) return;

    const invalid = input.value !== '' && !input.validity.valid;
    inputGroup.classList.toggle('error', invalid);
}

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 恢复保存的表单数据
    restoreFormData();

    // 贷款类型切换按钮
    document.querySelectorAll('.loan-type-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-loan-type');
            switchLoanType(type);
            saveFormData();
        });
    });

    // 计算按钮
    document.getElementById('calculate-mortgage-btn').addEventListener('click', calculate);

    // 标签页切换按钮
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // 监听所有输入框的变化，自动保存并验证
    const inputFields = document.querySelectorAll('input[type="number"], select');
    inputFields.forEach(field => {
        field.addEventListener('change', saveFormData);
        // 为数字输入框添加实时验证
        if (field.type === 'number') {
            field.addEventListener('input', function() {
                validateInput(this.id);
            });
        }
    });
});

function calculate() {
    const resultCard = document.querySelector('.result-card');
    resultCard.hidden = true;

    // 修复：从select元素获取还款方式
    const repaymentMethodSelect = document.getElementById('repaymentMethod');
    const paymentMethod = repaymentMethodSelect ? repaymentMethodSelect.value : 'equal';
    if (!['equal', 'principal'].includes(paymentMethod)) {
        showNotification('还款方式无效，请重新选择', 'error');
        return;
    }
    const loanType = currentLoanType;
    let loanAmount = 0;
    let years = 0;
    let commercialRate = 0;
    let fundRate = 0;
    let commercialAmount = 0;
    let fundAmount = 0;

    if (loanType === 'commercial') {
        commercialAmount = getElementValue('commercialAmount', 'float', NaN);
        years = getElementValue('commercialYears', 'float', NaN);
        commercialRate = getElementValue('commercialRate', 'float', NaN);
        if (!Number.isFinite(commercialAmount) || commercialAmount <= 0 || !Number.isFinite(commercialRate) ||
            commercialRate < 0 || commercialRate > 100) {
            showNotification('请输入有效的贷款金额和利率', 'error');
            return;
        }
    } else if (loanType === 'fund') {
        fundAmount = getElementValue('fundAmount', 'float', NaN);
        years = getElementValue('fundYears', 'float', NaN);
        fundRate = getElementValue('fundRate', 'float', NaN);
        if (!Number.isFinite(fundAmount) || fundAmount <= 0 || !Number.isFinite(fundRate) || fundRate < 0 ||
            fundRate > 100) {
            showNotification('请输入有效的贷款金额和利率', 'error');
            return;
        }
    } else if (loanType === 'combined') {
        commercialAmount = getElementValue('combinedCommercialAmount', 'float', 0);
        fundAmount = getElementValue('combinedFundAmount', 'float', 0);
        years = getElementValue('combinedYears', 'float', 0);
        commercialRate = getElementValue('combinedCommercialRate', 'float', NaN);
        fundRate = getElementValue('combinedFundRate', 'float', NaN);
        const commercialRateInvalid =
            commercialAmount > 0 && (!Number.isFinite(commercialRate) || commercialRate < 0 || commercialRate > 100);
        const fundRateInvalid = fundAmount > 0 && (!Number.isFinite(fundRate) || fundRate < 0 || fundRate > 100);
        if (!Number.isFinite(commercialAmount) || !Number.isFinite(fundAmount) || commercialAmount < 0 ||
            fundAmount < 0 || (commercialAmount === 0 && fundAmount === 0) || commercialRateInvalid ||
            fundRateInvalid) {
            showNotification('请输入有效的贷款金额和利率', 'error');
            return;
        }
    }

    let months;
    try {
        months = window.FinanceCalculations.loanYearsToMonths(years);
    } catch (error) {
        showNotification(error.message, 'error');
        return;
    }

    const maxWanAmount = Number.MAX_SAFE_INTEGER / 10000;
    if (commercialAmount > maxWanAmount || fundAmount > maxWanAmount) {
        showNotification('贷款金额过大，无法进行精确计算', 'error');
        return;
    }

    commercialAmount *= 10000;
    fundAmount *= 10000;
    loanAmount = commercialAmount + fundAmount;
    if (!Number.isSafeInteger(Math.round(loanAmount))) {
        showNotification('贷款总额过大，无法进行精确计算', 'error');
        return;
    }

    // 计算月供和还款总额
    let schedule = [];

    if (loanType === 'combined') {
        // 分开计算商业贷款和公积金贷款
        const commercialSchedule =
            calculateSchedule(commercialAmount, commercialAmount > 0 ? commercialRate : 0, months, paymentMethod);
        const fundSchedule = calculateSchedule(fundAmount, fundAmount > 0 ? fundRate : 0, months, paymentMethod);

        // 合并两种贷款的还款计划
        for (let i = 0; i < months; i++) {
            const commercial = commercialSchedule[i];
            const fund = fundSchedule[i];

            schedule.push({
                month: i + 1,
                payment: commercial.payment + fund.payment,
                principal: commercial.principal + fund.principal,
                interest: commercial.interest + fund.interest,
                remaining: commercial.remaining + fund.remaining
            });
        }
    } else {
        // 单一类型贷款计算
        const rate = loanType === 'commercial' ? commercialRate : fundRate;
        schedule = calculateSchedule(loanAmount, rate, months, paymentMethod);
    }

    const totalInterest = schedule.reduce((sum, item) => sum + item.interest, 0);
    const totalPayment = schedule.reduce((sum, item) => sum + item.payment, 0);
    const firstPayment = schedule[0].payment;

    // 更新结果摘要
    resultCard.hidden = false;
    document.getElementById('totalLoan').textContent = formatMoney(loanAmount / 10000) + '万元';
    document.getElementById('totalInterest').textContent = formatMoney(totalInterest / 10000) + '万元';
    document.getElementById('totalPayment').textContent = formatMoney(totalPayment / 10000) + '万元';
    document.getElementById('firstPayment').textContent = formatMoney(firstPayment) + '元';

    // 更新还款计划表格
    const tbody = document.getElementById('repaymentSchedule');
    tbody.innerHTML = '';

    // 为了减少渲染压力，只显示部分数据
    const displaySchedule = getDisplaySchedule(schedule);

    displaySchedule.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${item.month}</td>
            <td>${formatMoney(item.payment)}</td>
            <td>${formatMoney(item.principal)}</td>
            <td>${formatMoney(item.interest)}</td>
            <td>${formatMoney(Math.max(0, item.remaining))}</td>
        `;
    });

    // 更新图表
    updateChart(schedule);
}

/** 按银行逐月到分的口径生成完整还款计划，最后一期结清舍入尾差。 */
function calculateSchedule(loanAmount, annualPercent, months, paymentMethod) {
    const schedule = [];
    let remainingPrincipal = loanAmount;
    const monthlyRate = window.FinanceCalculations.nominalMonthlyRate(annualPercent);
    const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;

    if (paymentMethod === 'equal') {
        // 等额本息
        const monthlyPayment = roundMoney(window.FinanceCalculations.equalPayment(loanAmount, annualPercent, months));

        for (let i = 1; i <= months; i++) {
            const interest = roundMoney(remainingPrincipal * monthlyRate);
            const principal = i === months ? remainingPrincipal : roundMoney(monthlyPayment - interest);
            const payment = i === months ? roundMoney(principal + interest) : monthlyPayment;
            remainingPrincipal = i === months ? 0 : Math.max(0, roundMoney(remainingPrincipal - principal));

            schedule.push({month: i, payment, principal, interest, remaining: remainingPrincipal});
        }
    } else {
        // 等额本金
        const monthlyPrincipal = roundMoney(loanAmount / months);

        for (let i = 1; i <= months; i++) {
            const interest = roundMoney(remainingPrincipal * monthlyRate);
            const principal = i === months ? remainingPrincipal : monthlyPrincipal;
            const payment = roundMoney(principal + interest);
            remainingPrincipal = i === months ? 0 : Math.max(0, roundMoney(remainingPrincipal - principal));

            schedule.push({month: i, payment, principal, interest, remaining: remainingPrincipal});
        }
    }

    return schedule;
}

// 获取展示用的还款计划（减少数据量）
function getDisplaySchedule(schedule) {
    const displaySchedule = schedule.slice(0, 12);
    const totalMonths = schedule.length;

    // 后续每年选择性显示
    if (totalMonths > 12) {
        // 每年的第一个月
        for (let i = 12; i < totalMonths; i += 12) {
            displaySchedule.push(schedule[i]);
        }

        // 始终显示最后一期
        if (displaySchedule[displaySchedule.length - 1].month !== totalMonths) {
            displaySchedule.push(schedule[totalMonths - 1]);
        }
    }

    return displaySchedule;
}

// 更新图表
function updateChart(schedule) {
    const chartContainer = document.getElementById('paymentChart');
    if (typeof echarts === 'undefined') {
        showNotification('图表库加载失败，已仅显示还款明细数据', 'warning');
        return;
    }
    if (!chart) {
        chart = echarts.init(chartContainer);
    }

    // 数据抽样优化：当数据点过多时，减少显示点数提升性能
    let sampledSchedule = schedule;
    const MAX_CHART_POINTS = 120;  // 最多显示120个点

    if (schedule.length > MAX_CHART_POINTS) {
        // 计算采样间隔
        const step = Math.ceil(schedule.length / MAX_CHART_POINTS);
        sampledSchedule = schedule.filter((_, index) => {
            // 保留第一个、最后一个，以及按间隔采样的点
            return index === 0 || index === schedule.length - 1 || index % step === 0;
        });
    }

    const months = sampledSchedule.map(item => item.month);
    const payments = sampledSchedule.map(item => item.payment);
    const principals = sampledSchedule.map(item => item.principal);
    const interests = sampledSchedule.map(item => item.interest);

    const option = {
        animation: sampledSchedule.length <= 60,
        title: {
            text: '还款构成分析' +
                (schedule.length !== sampledSchedule.length ?
                     ` (已采样${sampledSchedule.length}/${schedule.length}点)` :
                     ''),
            left: 'center',
            textStyle: {fontSize: 14}
        },
        legend: {data: ['月供', '本金', '利息'], top: 25, textStyle: {fontSize: 12}},
        grid: {left: '8%', right: '4%', bottom: '12%', top: '20%', containLabel: true},
        tooltip: {
            trigger: 'axis',
            confine: true,
            formatter: function(params) {
                return params[0].axisValue + '期<br/>' +
                    params
                        .map(item => {
                            return item.seriesName + ': ' + formatMoney(item.value) + '元';
                        })
                        .join('<br/>');
            }
        },
        xAxis: {type: 'category', boundaryGap: false, data: months, name: '期数', axisLabel: {interval: 'auto'}},
        yAxis: {type: 'value', name: '金额（元）'},
        series: [
            {name: '月供', type: 'line', data: payments}, {name: '本金', type: 'line', data: principals},
            {name: '利息', type: 'line', data: interests}
        ]
    };

    chart.setOption(option);
}

// 节流函数（用于 resize 事件）
function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

// 监听窗口大小变化，调整图表大小（使用节流优化性能）
window.addEventListener('resize', throttle(function() {
    if (chart) {
        chart.resize();
    }
}, 100));
