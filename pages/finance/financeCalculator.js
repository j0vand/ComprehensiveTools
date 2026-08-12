/**
 * 理财计算器
 * 提供复利计算、贷款计算、定投收益、目标规划、资金耗尽等五个计算工具
 * @module FinanceCalculator
 */

const STORAGE_KEY = window.StorageKeys.FINANCE_CALCULATOR_INPUTS;
let investmentData = null;
let targetData = null;

/**
 * 切换计算器类型
 * @param {string} type - 计算器类型
 */
function switchCalculator(type) {
    document.querySelectorAll('.calculator-section').forEach(section => {
        section.classList.toggle('active', section.id === type);
    });

    document.querySelectorAll('.type-button').forEach(button => {
        const active = button.dataset.calcType === type;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
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

// 复利计算
function calculateCompound() {
    document.getElementById('compoundResult').hidden = true;
    const principal = getElementValue('compoundPrincipal', 'float', NaN);
    const rate = getElementValue('compoundRate', 'float', NaN);
    const years = getElementValue('compoundYears', 'float', NaN);

    // 验证输入
    if (!Number.isFinite(principal) || principal <= 0 || !Number.isInteger(years) || years <= 0 || years > 200 ||
        !Number.isFinite(rate) || rate <= -100) {
        showNotification('请输入有效的本金、1–200 年整数年限和大于 -100% 的收益率', 'error');
        return;
    }

    // 计算最终金额，使用精确的指数计算
    const annualRate = rate / 100;
    const total = principal * Math.pow(1 + annualRate, years);
    if (!Number.isFinite(total)) {
        showNotification('当前参数产生的金额过大，请缩短年限或降低收益率', 'error');
        return;
    }
    const interest = total - principal;

    // 更新总体结果
    document.getElementById('compoundResult').hidden = false;
    document.getElementById('compoundPrincipalResult').textContent = formatMoney(principal) + '元';
    document.getElementById('compoundInterestResult').textContent = formatMoney(interest) + '元';
    document.getElementById('compoundTotalResult').textContent = formatMoney(total) + '元';

    // 生成年度明细
    const tbody = document.getElementById('yearlyTable').querySelector('tbody');
    tbody.innerHTML = '';

    let currentPrincipal = principal;
    for (let year = 1; year <= years; year++) {
        const yearStartAmount = currentPrincipal;
        const yearlyInterest = yearStartAmount * annualRate;
        currentPrincipal = yearStartAmount + yearlyInterest;
        const cumulativeRate = (currentPrincipal / principal - 1) * 100;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${year}</td>
            <td>${formatMoney(yearStartAmount)}元</td>
            <td>${formatMoney(yearlyInterest)}元</td>
            <td>${formatMoney(currentPrincipal)}元</td>
            <td>${cumulativeRate.toFixed(2)}%</td>
        `;
    }
}

// 贷款计算
function calculateLoan() {
    document.getElementById('loanResult').hidden = true;
    const amount = getElementValue('loanAmount', 'float', NaN);
    const rate = getElementValue('loanRate', 'float', NaN);
    const years = getElementValue('loanYears', 'float', NaN);

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
        showNotification('请输入有效的贷款金额和利率', 'error');
        return;
    }

    let totalMonths;
    let monthlyRate;
    let monthlyPayment;
    try {
        totalMonths = window.FinanceCalculations.loanYearsToMonths(years);
        monthlyRate = window.FinanceCalculations.nominalMonthlyRate(rate);
        monthlyPayment = window.FinanceCalculations.equalPayment(amount, rate, totalMonths);
    } catch (error) {
        showNotification(error.message, 'error');
        return;
    }
    const totalPayment = monthlyPayment * totalMonths;
    const totalInterest = totalPayment - amount;
    if (!Number.isFinite(totalPayment) || !Number.isFinite(totalInterest)) {
        showNotification('当前参数产生的还款金额过大，请降低贷款金额或利率', 'error');
        return;
    }

    // 更新总体结果
    document.getElementById('loanResult').hidden = false;
    document.getElementById('monthlyPaymentResult').textContent = formatMoney(monthlyPayment) + '元';
    document.getElementById('totalPaymentResult').textContent = formatMoney(totalPayment) + '元';
    document.getElementById('totalInterestResult').textContent = formatMoney(totalInterest) + '元';

    // 生成还款计划明细
    const tbody = document.getElementById('loanTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    let remainingPrincipal = amount;
    for (let month = 1; month <= totalMonths; month++) {
        const monthlyInterest = remainingPrincipal * monthlyRate;
        const monthlyPrincipal = monthlyPayment - monthlyInterest;
        remainingPrincipal -= monthlyPrincipal;

        if (month % 12 === 1 || month === totalMonths) {  // 只显示每年第一个月和最后一个月
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>第${month}期</td>
                <td>${formatMoney(monthlyPayment)}元</td>
                <td>${formatMoney(monthlyPrincipal)}元</td>
                <td>${formatMoney(monthlyInterest)}元</td>
                <td>${formatMoney(Math.max(0, remainingPrincipal))}元</td>
            `;
        }
    }
}

/** 同步明细粒度按钮，只允许从源周期完整汇总到更粗粒度。 */
function syncDetailButtons(viewGroup, sourcePeriodsPerYear, preferredView, totalPeriods) {
    const buttons = Array.from(document.querySelectorAll(`.period-button[data-view-type="${viewGroup}"]`));
    buttons.forEach(button => {
        const viewType = button.getAttribute('data-period');
        const available = window.FinanceCalculations.canAggregatePeriods(sourcePeriodsPerYear, viewType, totalPeriods);
        button.disabled = !available;
        button.setAttribute('aria-disabled', String(!available));
        button.setAttribute('aria-pressed', 'false');
        if (!available) button.classList.remove('active');
    });

    const preferredButton =
        buttons.find(button => !button.disabled && button.getAttribute('data-period') === preferredView);
    const selectedButton = preferredButton || buttons.find(button => !button.disabled);
    buttons.forEach(button => {
        const active = button === selectedButton;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    return selectedButton ? selectedButton.getAttribute('data-period') : null;
}

// 定投收益计算
function calculateInvestment() {
    document.getElementById('investmentResult').hidden = true;
    const amount = getElementValue('investmentAmount', 'float', NaN);
    const period = document.getElementById('investmentPeriod').value;
    const rate = getElementValue('investmentRate', 'float', NaN);
    const years = getElementValue('investmentYears', 'float', NaN);
    const periodsPerYear = window.FinanceCalculations.PERIODS_PER_YEAR[period];
    const validation = window.FinanceCalculations.validateRecurringInvestment({
        amount,
        annualPercent: rate,
        years,
        periodsPerYear
    });
    if (!validation.valid) {
        showNotification(validation.error, 'error');
        return;
    }

    const {periodRate, totalPeriods} = validation;

    // 生成所有投资期间的数据
    const periodData = [];
    let currentAmount = 0;
    let totalInvestment = 0;

    for (let p = 1; p <= totalPeriods; p++) {
        const periodStartAmount = currentAmount;
        totalInvestment += amount;

        currentAmount = (currentAmount + amount) * (1 + periodRate);
        const periodInterest = currentAmount - periodStartAmount - amount;
        const totalReturn = ((currentAmount - totalInvestment) / totalInvestment * 100);
        if (!Number.isFinite(currentAmount) || !Number.isFinite(totalReturn)) {
            showNotification('当前参数产生的金额过大，请缩短年限或降低收益率', 'error');
            return;
        }

        periodData.push({
            startAmount: periodStartAmount,
            investment: amount,
            interest: periodInterest,
            endAmount: currentAmount,
            totalReturn
        });
    }

    // 更新总体结果
    document.getElementById('investmentResult').hidden = false;
    document.getElementById('totalInvestmentResult').textContent = formatMoney(totalInvestment) + '元';
    document.getElementById('investmentInterestResult').textContent =
        formatMoney(currentAmount - totalInvestment) + '元';
    document.getElementById('investmentTotalResult').textContent = formatMoney(currentAmount) + '元';

    // 保存数据用于切换视图
    investmentData = {periodData, periodsPerYear};

    switchInvestmentView('year');
}

// 切换投资明细视图
function switchInvestmentView(viewType) {
    if (!investmentData) return;

    const {periodData, periodsPerYear} = investmentData;
    const selectedView = syncDetailButtons('investment', periodsPerYear, viewType, periodData.length);
    if (!selectedView) return;

    const tbody = document.getElementById('investmentTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    const groups = window.FinanceCalculations.groupPeriods(periodData, periodsPerYear, selectedView);
    const viewsPerYear = window.FinanceCalculations.PERIODS_PER_YEAR[selectedView];
    groups.forEach((rows, index) => {
        let label = `第${index + 1}年`;
        if (selectedView === 'quarter') {
            label = `第${Math.floor(index / 4) + 1}年Q${(index % 4) + 1}`;
        } else if (selectedView === 'month') {
            label = `第${Math.floor(index / viewsPerYear) + 1}年${(index % viewsPerYear) + 1}月`;
        } else if (selectedView === 'week') {
            label = `第${Math.floor(index / viewsPerYear) + 1}年第${(index % viewsPerYear) + 1}周`;
        }

        const end = rows[rows.length - 1];
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${label}</td>
            <td>${formatMoney(rows[0].startAmount)}元</td>
            <td>${formatMoney(rows.reduce((sum, item) => sum + item.investment, 0))}元</td>
            <td>${formatMoney(rows.reduce((sum, item) => sum + item.interest, 0))}元</td>
            <td>${formatMoney(end.endAmount)}元</td>
            <td>${end.totalReturn.toFixed(2)}%</td>
        `;
    });
}

// 目标规划计算
function calculateTarget() {
    document.getElementById('targetResult').hidden = true;
    const target = getElementValue('targetAmount', 'float', NaN);
    const period = document.getElementById('targetPeriod').value;
    const duration = getElementValue('targetDuration', 'float', NaN);
    const rate = getElementValue('targetRate', 'float', NaN);
    const periodsPerYear = window.FinanceCalculations.PERIODS_PER_YEAR[period];
    const plan = window.FinanceCalculations.calculateTargetPlan({
        target,
        annualPercent: rate,
        duration,
        periodsPerYear
    });
    if (!plan.valid) {
        showNotification(plan.error, 'error');
        return;
    }

    // 更新总体结果
    document.getElementById('targetResult').hidden = false;
    const periodUnit = {day: '天', week: '周', month: '月', quarter: '季度', year: '年'}[period];
    document.getElementById('periodRequiredResult').textContent = `${formatMoney(plan.periodRequired)}元/${periodUnit}`;
    document.getElementById('totalRequiredResult').textContent = formatMoney(plan.totalRequired) + '元';
    document.getElementById('targetInterestResult').textContent = formatMoney(plan.totalInterest) + '元';

    // 保存数据用于切换视图
    targetData = {periodData: plan.periodData, periodsPerYear, target};

    switchTargetView('year');
}

// 切换目标规划明细视图
function switchTargetView(viewType) {
    if (!targetData) return;

    const {periodData, periodsPerYear, target} = targetData;
    const selectedView = syncDetailButtons('target', periodsPerYear, viewType, periodData.length);
    if (!selectedView) return;

    const tbody = document.getElementById('targetTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    const groups = window.FinanceCalculations.groupPeriods(periodData, periodsPerYear, selectedView);
    const viewsPerYear = window.FinanceCalculations.PERIODS_PER_YEAR[selectedView];
    groups.forEach((rows, index) => {
        let label = `第${index + 1}年`;
        if (selectedView === 'quarter') {
            label = `第${Math.floor(index / viewsPerYear) + 1}年Q${(index % viewsPerYear) + 1}`;
        } else if (selectedView === 'month') {
            label = `第${Math.floor(index / viewsPerYear) + 1}年${(index % viewsPerYear) + 1}月`;
        } else if (selectedView === 'week') {
            label = `第${Math.floor(index / viewsPerYear) + 1}年第${(index % viewsPerYear) + 1}周`;
        } else if (selectedView === 'day') {
            label = `第${index + 1}天`;
        }

        const endAmount = rows[rows.length - 1].endAmount;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${label}</td>
            <td>${formatMoney(rows[0].startAmount)}元</td>
            <td>${formatMoney(rows.reduce((sum, item) => sum + item.investment, 0))}元</td>
            <td>${formatMoney(rows.reduce((sum, item) => sum + item.interest, 0))}元</td>
            <td>${formatMoney(endAmount)}元</td>
            <td>${(endAmount / target * 100).toFixed(2)}%</td>
            <td>${formatMoney(Math.max(0, target - endAmount))}元</td>
        `;
    });
}

/** 格式化资金耗尽时长：优先显示「X年Y个月」。 */
function formatRunwayDuration(months) {
    const totalMonths = Math.max(0, Math.round(months));
    const years = Math.floor(totalMonths / 12);
    const remainMonths = totalMonths % 12;
    if (years === 0) return `${remainMonths}个月`;
    if (remainMonths === 0) return `${years}年`;
    return `${years}年${remainMonths}个月`;
}

/** 读取页面上的阶段性支出调整。 */
function collectRunwayAdjustments() {
    return Array.from(document.querySelectorAll('#runway-adjustment-list [data-role="runway-adjustment"]'))
        .map(row => {
            const afterYearsRaw = row.querySelector('[data-field="afterYears"]').value.trim();
            const monthlySpendRaw = row.querySelector('[data-field="monthlySpend"]').value.trim();
            return {
                afterYears: afterYearsRaw === '' ? NaN : Number(afterYearsRaw),
                monthlySpend: monthlySpendRaw === '' ? NaN : Number(monthlySpendRaw),
                applyInflation: row.querySelector('[data-field="applyInflation"]').checked
            };
        });
}

/** 新增一条阶段性支出调整；默认勾选考虑通胀。 */
function addRunwayAdjustment(preset = {}) {
    const list = document.getElementById('runway-adjustment-list');
    const max = window.FinanceCalculations.MAX_RUNWAY_ADJUSTMENTS;
    if (list.children.length >= max) {
        showNotification(`最多添加 ${max} 条支出调整`, 'error');
        return null;
    }

    const row = document.createElement('div');
    row.className = 'runway-adjustment';
    row.setAttribute('data-role', 'runway-adjustment');
    const afterYears = preset.afterYears == null ? '' : String(preset.afterYears);
    const monthlySpend = preset.monthlySpend == null ? '' : String(preset.monthlySpend);
    const applyInflation = preset.applyInflation !== false;
    row.innerHTML = `
        <div class="runway-adjustment-grid">
            <label>
                多少年后开始
                <div class="input-addon" data-unit="年">
                    <input type="number" class="input-field" data-field="afterYears" min="1" max="200" step="1" placeholder="例如 10" value="${afterYears}">
                </div>
            </label>
            <label>
                每月支出改为
                <div class="input-addon" data-unit="元">
                    <input type="number" class="input-field" data-field="monthlySpend" min="0.01" step="0.01" placeholder="填写金额" value="${monthlySpend}">
                </div>
            </label>
        </div>
        <label class="runway-adjustment-check">
            <input type="checkbox" data-field="applyInflation"${applyInflation ? ' checked' : ''}>
            考虑通胀（按初始购买力换算）
        </label>
        <div class="runway-adjustment-actions">
            <button type="button" class="runway-remove-btn" data-action="remove-adjustment">删除</button>
        </div>
    `;
    list.appendChild(row);
    return row;
}

/** 用草稿数据重建调整列表。 */
function renderRunwayAdjustments(adjustments) {
    const list = document.getElementById('runway-adjustment-list');
    list.innerHTML = '';
    if (!Array.isArray(adjustments) || adjustments.length === 0) return;
    adjustments.forEach(item => addRunwayAdjustment(item));
}

/** 初始资金 + 年化收益 + 每月支出 → 可支撑多久。 */
function calculateRunway() {
    document.getElementById('runwayResult').hidden = true;
    document.getElementById('runwayDetails').hidden = true;

    const inflationInput = document.getElementById('runwayInflation').value.trim();
    const result = window.FinanceCalculations.calculateCapitalRunway({
        principal: getElementValue('runwayPrincipal', 'float', NaN),
        annualPercent: getElementValue('runwayRate', 'float', NaN),
        monthlySpend: getElementValue('runwayMonthlySpend', 'float', NaN),
        inflationPercent: inflationInput === '' ? 0 : Number(inflationInput),
        adjustments: collectRunwayAdjustments()
    });
    if (!result.valid) {
        showNotification(result.error, 'error');
        return;
    }

    document.getElementById('runwayResult').hidden = false;
    const durationEl = document.getElementById('runwayDurationResult');
    const monthsEl = document.getElementById('runwayMonthsResult');
    const withdrawnEl = document.getElementById('runwayWithdrawnResult');

    if (result.sustainable) {
        durationEl.textContent = result.capped
            ? `超过 ${window.FinanceCalculations.MAX_RUNWAY_MONTHS / 12} 年`
            : '可长期维持';
        monthsEl.textContent = '本金不会被花完';
        withdrawnEl.textContent = '—';
        return;
    }

    durationEl.textContent = formatRunwayDuration(result.months);
    monthsEl.textContent = `${result.months}个月`;
    withdrawnEl.textContent = formatMoney(result.totalWithdrawn) + '元';

    const tbody = document.getElementById('runwayTable').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    result.yearDetails.forEach(row => {
        const tr = tbody.insertRow();
        tr.innerHTML = `
            <td>第${row.year}年</td>
            <td>${formatMoney(row.startBalance)}元</td>
            <td>${formatMoney(row.interest)}元</td>
            <td>${formatMoney(row.withdrawn)}元</td>
            <td>${formatMoney(row.monthlySpend)}元</td>
            <td>${formatMoney(row.endBalance)}元</td>
        `;
    });
    document.getElementById('runwayDetails').hidden = result.yearDetails.length === 0;
}

// 更新周期单位显示
function updatePeriodInput() {
    const period = document.getElementById('targetPeriod').value;
    const unitMap = {day: '天', week: '周', month: '月', quarter: '季度', year: '年'};
    document.getElementById('periodUnit').textContent = unitMap[period];
}

function getPersistedControls() {
    return document.querySelectorAll('input[type="number"], #investmentPeriod, #targetPeriod');
}

/** 收集理财计算器输入快照（含空字符串，确保清空字段可恢复）。 */
function collectDraft() {
    const inputData = {};
    getPersistedControls().forEach(item => {
        if (!item.id) return;
        inputData[item.id] = item.value;
    });
    const activeType = document.querySelector('.type-button.active');
    if (activeType) {
        inputData.calculatorType = activeType.getAttribute('data-calc-type');
    }
    inputData.runwayAdjustments = collectRunwayAdjustments().map(item => ({
        afterYears: Number.isFinite(item.afterYears) ? item.afterYears : '',
        monthlySpend: Number.isFinite(item.monthlySpend) ? item.monthlySpend : '',
        applyInflation: item.applyInflation !== false
    }));
    return inputData;
}

/** 将快照写回表单。 */
function applyDraft(savedData) {
    if (!savedData || typeof savedData !== 'object' || Array.isArray(savedData)) return;

    // 直接切换类型，避免走按钮 click 触发二次持久化（恢复中途草稿尚未写完）。
    if (savedData.calculatorType && typeof switchCalculator === 'function') {
        // 旧版「信用卡免息」草稿回退到资金耗尽
        const type = savedData.calculatorType === 'creditCard'
            ? 'runway'
            : savedData.calculatorType;
        if (document.getElementById(type)) {
            switchCalculator(type);
        }
    }

    getPersistedControls().forEach(control => {
        if (!Object.prototype.hasOwnProperty.call(savedData, control.id)) return;
        const value = savedData[control.id];
        if (value === undefined || value === null) return;
        if (control.tagName === 'SELECT' && value !== '' &&
            !Array.from(control.options).some(option => option.value === String(value))) {
            return;
        }
        control.value = String(value);
    });

    renderRunwayAdjustments(savedData.runwayAdjustments);
}

/** 将当前表单写入方案容器草稿。 */
function persistDraft() {
    const result = window.FormImportExport.writeDraft(
        STORAGE_KEY,
        collectDraft(),
        window.StorageService
    );
    if (!result.ok) {
        showNotification('输入保存失败，刷新页面后可能无法恢复', 'error');
    }
    return result;
}

// 恢复输入并在变更时持久化。
function initInputPersistence() {
    const controls = getPersistedControls();
    const store = window.FormImportExport.readStore(STORAGE_KEY, window.StorageService);
    applyDraft(store.draft || {});

    controls.forEach(control => {
        control.addEventListener('change', persistDraft);
    });
    updatePeriodInput();
}

window.FinanceCalculatorStorage = {
    STORAGE_KEY,
    collectDraft,
    applyDraft,
    persistDraft
};

// 初始化事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 计算器类型切换按钮
    document.querySelectorAll('.type-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-calc-type');
            switchCalculator(type);
            persistDraft();
        });
    });

    document.getElementById('calculate-compound-btn').addEventListener('click', calculateCompound);
    document.getElementById('calculate-loan-btn').addEventListener('click', calculateLoan);
    document.getElementById('calculate-investment-btn').addEventListener('click', calculateInvestment);
    document.getElementById('calculate-target-btn').addEventListener('click', calculateTarget);
    document.getElementById('calculate-runway-btn').addEventListener('click', calculateRunway);

    document.getElementById('add-runway-adjustment-btn').addEventListener('click', () => {
        addRunwayAdjustment();
        persistDraft();
    });
    document.getElementById('runway-adjustment-list').addEventListener('click', event => {
        const removeBtn = event.target.closest('[data-action="remove-adjustment"]');
        if (!removeBtn) return;
        const row = removeBtn.closest('[data-role="runway-adjustment"]');
        if (row) row.remove();
        persistDraft();
    });
    document.getElementById('runway-adjustment-list').addEventListener('change', persistDraft);

    // 投资明细视图切换按钮
    document.querySelectorAll('.period-button[data-view-type="investment"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const period = this.getAttribute('data-period');
            switchInvestmentView(period);
        });
    });

    // 目标规划明细视图切换按钮
    document.querySelectorAll('.period-button[data-view-type="target"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const period = this.getAttribute('data-period');
            switchTargetView(period);
        });
    });

    // 目标规划周期选择器变化事件
    document.getElementById('targetPeriod').addEventListener('change', updatePeriodInput);

    // 页面加载时初始化
    initInputPersistence();

    // 为所有数字输入框添加实时验证
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', function() {
            validateInput(this.id);
        });
    });
});
