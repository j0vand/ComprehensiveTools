/**
 * 养老金计算器页面交互。
 * calculator-core.js负责计算，calculator-storage.js负责持久化，本文件只管理输入与渲染。
 */

document.addEventListener('DOMContentLoaded', function() {
    try {
        window.PensionCalculatorStorage.restoreFormData();
    } catch (error) {
        console.warn('养老金表单恢复失败，继续使用页面当前值:', error);
    }
    syncAgeLimits();
    toggleStopAgeInput();
    initEventListeners();
});

/** 绑定表单交互，并在用户修改后通过存储模块统一保存。 */
function initEventListeners() {
    document.getElementById('calculate-btn').addEventListener('click', calculateAndShow);
    document.getElementById('reset-btn').addEventListener('click', resetForm);

    document.querySelectorAll('input[name="payment-plan"]').forEach(radio => {
        radio.addEventListener('change', () => {
            toggleStopAgeInput();
            window.PensionCalculatorStorage.saveFormData();
        });
    });

    const inputIds = [
        'current-age', 'retire-age', 'avg-salary',
        'paid-years', 'account-balance', 'salary-base',
        'past-avg-index', 'avg-index', 'stop-age',
        'salary-growth', 'soc-avg-growth', 'interest-rate'
    ];

    inputIds.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', () => {
            if (id === 'current-age' || id === 'retire-age') syncAgeLimits();
            window.PensionCalculatorStorage.saveFormData();
        });
    });

    document.querySelectorAll('input[name="gender"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('retire-age').value = radio.value === 'female_worker' ? 58 : 63;
            syncAgeLimits();
            window.PensionCalculatorStorage.saveFormData();
        });
    });

    document.querySelectorAll('input[name="base-change-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            window.PensionCalculatorStorage.saveFormData();
        });
    });
}

/** 根据当前缴费方案控制停缴年龄字段，不改变用户已经填写的值。 */
function toggleStopAgeInput() {
    const stopAgeGroup = document.getElementById('stop-age-group');
    const paymentPlan = window.CommonUtils.getRadioValue('payment-plan', 'continuous');
    stopAgeGroup.classList.toggle('hidden', paymentPlan !== 'stop_early');
}

/** 退休年龄是年龄约束的唯一上界，性别不参与校验和计算。 */
function syncAgeLimits() {
    const currentAgeInput = document.getElementById('current-age');
    const retireAgeInput = document.getElementById('retire-age');
    const stopAgeInput = document.getElementById('stop-age');
    const retireAge = Number.parseInt(retireAgeInput.value, 10);
    const currentAge = Number.parseInt(currentAgeInput.value, 10);

    if (Number.isInteger(retireAge) && retireAge >= 40 && retireAge <= 70) {
        currentAgeInput.max = String(retireAge - 1);
        stopAgeInput.max = String(retireAge);
    }
    if (Number.isInteger(currentAge)) {
        stopAgeInput.min = String(currentAge);
    }
}

/** 必填数值不使用默认值，空白或非法文本交由validateInputs统一拒绝。 */
function getRequiredNumber(id) {
    const raw = document.getElementById(id).value.trim();
    return raw === '' ? Number.NaN : Number(raw);
}

/** 获取页面输入并把百分数统一换算为小数。 */
function getInputs() {
    const defaults = window.PensionCalculatorStorage.DEFAULT_VALUES;
    const futureAvgIndexInput = document.getElementById('avg-index');
    const futureAvgIndex = futureAvgIndexInput.value.trim() === ''
        ? null
        : Number(futureAvgIndexInput.value);

    return {
        currentAge: getRequiredNumber('current-age'),
        retireAge: getRequiredNumber('retire-age'),
        avgSalary: getRequiredNumber('avg-salary'),
        paidYears: getRequiredNumber('paid-years'),
        accountBalance: getRequiredNumber('account-balance'),
        salaryBase: getRequiredNumber('salary-base'),
        pastAvgIndex: getRequiredNumber('past-avg-index'),
        futureAvgIndex,
        baseChangeMode: window.CommonUtils.getRadioValue('base-change-mode', defaults.baseChangeMode),
        paymentPlan: window.CommonUtils.getRadioValue('payment-plan', 'continuous'),
        stopAge: getRequiredNumber('stop-age'),
        salaryGrowth: getRequiredNumber('salary-growth') / 100,
        socAvgGrowth: getRequiredNumber('soc-avg-growth') / 100,
        interestRate: getRequiredNumber('interest-rate') / 100
    };
}

/**
 * 校验核心模型需要的输入边界。
 * 年龄字段必须为整数；已缴费年限允许按半年填写以匹配动态领取门槛。
 */
function validateInputs(data) {
    if (!Number.isInteger(data.retireAge) || data.retireAge < 40 || data.retireAge > 70) {
        showError('退休年龄必须是40至70之间的整数。');
        return false;
    }
    if (!Number.isInteger(data.currentAge) || data.currentAge < 18 || data.currentAge >= data.retireAge) {
        showError(`当前年龄必须是18岁以上且小于退休年龄（${data.retireAge}岁）的整数。`);
        return false;
    }
    if (data.paymentPlan === 'stop_early' && (
        !Number.isInteger(data.stopAge) ||
        data.stopAge < data.currentAge ||
        data.stopAge > data.retireAge
    )) {
        showError(`停止缴费年龄必须是当前年龄至${data.retireAge}岁之间的整数。`);
        return false;
    }
    if (!Number.isFinite(data.avgSalary) || data.avgSalary <= 0) {
        showError('请输入有效的当地月平均工资。');
        return false;
    }
    if (!Number.isFinite(data.paidYears) || data.paidYears < 0 || data.paidYears > 60 ||
        !Number.isInteger(data.paidYears * 2)) {
        showError('已缴费年限必须在0至60年之间，并按0.5年填写。');
        return false;
    }
    if (!Number.isFinite(data.accountBalance) || data.accountBalance < 0) {
        showError('请输入有效的个人账户余额。');
        return false;
    }
    if (!Number.isFinite(data.salaryBase) || data.salaryBase <= 0) {
        showError('请输入有效的缴费基数。');
        return false;
    }
    if (!Number.isFinite(data.pastAvgIndex) || data.pastAvgIndex < 0) {
        showError('请输入有效的过去平均缴费指数。');
        return false;
    }
    if (data.futureAvgIndex !== null && (
        !Number.isFinite(data.futureAvgIndex) ||
        data.futureAvgIndex < 0.6 ||
        data.futureAvgIndex > 3
    )) {
        showError('未来平均缴费指数应在0.6至3之间，或留空自动计算。');
        return false;
    }
    if (!Number.isFinite(data.salaryGrowth) || data.salaryGrowth < 0 || data.salaryGrowth > 0.2) {
        showError('工资增长率应在0%至20%之间。');
        return false;
    }
    if (!Number.isFinite(data.socAvgGrowth) || data.socAvgGrowth < 0 || data.socAvgGrowth > 0.2) {
        showError('社平工资增长率应在0%至20%之间。');
        return false;
    }
    if (!Number.isFinite(data.interestRate) || data.interestRate < 0 || data.interestRate > 0.1) {
        showError('个人账户记账利率应在0%至10%之间。');
        return false;
    }
    return true;
}

/** 显示页面校验或计算错误，不使用阻塞式原生弹窗。 */
function showError(message) {
    window.CommonUtils.showNotification(message, 'error', 5000);
}

/** 校验输入、调用核心模型并渲染结果。 */
function calculateAndShow() {
    document.getElementById('result-section').classList.add('hidden');
    try {
        const inputs = getInputs();
        if (!validateInputs(inputs)) return;

        const yearsToRetire = inputs.retireAge - inputs.currentAge;
        const retirementInfo = {
            retireAge: inputs.retireAge,
            yearsToRetire,
            retireYear: new Date().getFullYear() + yearsToRetire
        };
        const result = window.PensionCalculatorCore.calculatePension(inputs, retirementInfo);
        const pensionValueIsValid = result.eligible
            ? Number.isFinite(result.totalPension)
            : result.totalPension === null;

        if (!Number.isFinite(result.totalAccountBalance) || !pensionValueIsValid) {
            throw new Error('计算结果无效，请检查输入数据');
        }

        renderResults(result, retirementInfo);
    } catch (error) {
        console.error('养老金计算失败:', error);
        showError(`计算失败：${error.message || '未知错误'}`);
    }
}

/** 年限最多保留两位小数，避免很小的资格差额被显示成0.0。 */
function formatYears(years) {
    return String(Math.round(years * 100) / 100);
}

/** 渲染主结果，并在不具领取资格时保留账户余额、隐藏所有待遇金额。 */
function renderResults(result, retirementInfo) {
    const section = document.getElementById('result-section');
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    window.CommonUtils.setText('res-retire-age', retirementInfo.retireAge);
    window.CommonUtils.setText('res-retire-year', retirementInfo.retireYear);
    window.CommonUtils.setText('res-months', result.paymentMonths);
    window.CommonUtils.setText('res-account-total', window.CommonUtils.formatMoney(result.totalAccountBalance));
    window.CommonUtils.setText('res-total-years', formatYears(result.totalYears));

    const eligibilityMessage = document.getElementById('eligibility-message');
    eligibilityMessage.classList.toggle('hidden', result.eligible);
    eligibilityMessage.textContent = result.eligible
        ? ''
        : `暂不满足领取条件，还差 ${formatYears(result.eligibilityGap)} 年（退休年份最低缴费 ${formatYears(result.minimumContributionYears)} 年）。`;

    document.querySelectorAll('.pension-currency, .pension-value-unit').forEach(element => {
        element.classList.toggle('hidden', !result.eligible);
    });

    if (result.eligible) {
        window.CommonUtils.setText('res-total-pension', window.CommonUtils.formatMoney(result.totalPension));
        window.CommonUtils.setText('res-basic-pension', window.CommonUtils.formatMoney(result.basicPension));
        window.CommonUtils.setText('res-personal-pension', window.CommonUtils.formatMoney(result.personalPension));
        const replaceRate = result.totalPension / result.futureAvgSalary * 100;
        const equivalentNow = result.currentAvgSalary * result.totalPension / result.futureAvgSalary;
        window.CommonUtils.setText('res-replace-rate', replaceRate.toFixed(1));
        window.CommonUtils.setText('res-equivalent-now', window.CommonUtils.formatMoney(equivalentNow));
    } else {
        window.CommonUtils.setText('res-total-pension', '—');
        window.CommonUtils.setText('res-basic-pension', '—');
        window.CommonUtils.setText('res-personal-pension', '—');
        window.CommonUtils.setText('res-replace-rate', '—');
        window.CommonUtils.setText('res-equivalent-now', '—');
    }

    renderCalculationDetails(result);
    renderYearDetailsTable(result.yearDetails, result.futureAvgSalary, result.currentAvgSalary);
}

/** 渲染与核心轨迹一致的计算口径说明。 */
function renderCalculationDetails(result) {
    const detailsContainer = document.getElementById('calculation-details');
    const basicPension = result.eligible ? `¥ ${window.CommonUtils.formatMoney(result.basicPension)}` : '—';
    const personalPension = result.eligible ? `¥ ${window.CommonUtils.formatMoney(result.personalPension)}` : '—';
    const totalPension = result.eligible ? `¥ ${window.CommonUtils.formatMoney(result.totalPension)}` : '—';

    detailsContainer.innerHTML = `
        <details class="calculation-details">
            <summary><span>▶</span> 详细计算说明（点击展开）</summary>
            <div class="detail-section">
                <h5>1. 退休时社会平均工资</h5>
                <p>当前社平工资 × (1 + 社平工资年增长率)^剩余年限</p>
                <p>计算结果：<strong>¥ ${window.CommonUtils.formatMoney(result.futureAvgSalary)}</strong></p>
            </div>
            <div class="detail-section">
                <h5>2. 缴费基数规则</h5>
                <p>${result.baseChangeMode === 'fixed'
                    ? '原始基数保持为当前填写值。'
                    : '第 i 个未来缴费年的原始基数 = 当前基数 × (1 + 工资增长率)^i，首年不预先增长。'}</p>
                <p>每年再将原始基数限制在当年社平工资的60%至300%之间。</p>
            </div>
            <div class="detail-section">
                <h5>3. 个人账户累计余额</h5>
                <p>每个工作年先对年初余额计息，再于年末加入全年个人缴费。</p>
                <ul>
                    <li>现有余额复利增值：¥ ${window.CommonUtils.formatMoney(result.balanceFutureValue)}</li>
                    <li>未来缴费本息和：¥ ${window.CommonUtils.formatMoney(result.futureContributionTotal)}</li>
                </ul>
                <p>退休年初合计：<strong>¥ ${window.CommonUtils.formatMoney(result.totalAccountBalance)}</strong></p>
            </div>
            <div class="detail-section">
                <h5>4. 加权平均缴费指数</h5>
                <p>过去和未来缴费指数按实际缴费年限加权；未来指数${result.futureAvgIndexCalculated ? '由每年钳制后的缴费基数除以当年社平工资计算' : '使用您填写的数值逐年计算'}。</p>
                <p>计算结果：<strong>${result.weightedAvgIndex.toFixed(2)}</strong></p>
            </div>
            <div class="detail-section">
                <h5>5. 领取资格</h5>
                <p>退休年份最低缴费年限：${formatYears(result.minimumContributionYears)} 年；预计累计：${formatYears(result.totalYears)} 年。</p>
                <p><strong>${result.eligible ? '满足当前模型的最低缴费年限' : `暂不满足领取条件，还差 ${formatYears(result.eligibilityGap)} 年`}</strong></p>
            </div>
            <div class="detail-section">
                <h5>6. 基础养老金</h5>
                <p>退休时社平工资 × (1 + 平均缴费指数) / 2 × 累计缴费年限 × 1%</p>
                <p>计算结果：<strong>${basicPension}</strong></p>
            </div>
            <div class="detail-section">
                <h5>7. 个人账户养老金</h5>
                <p>个人账户累计余额 / 计发月数（${result.paymentMonths}个月）</p>
                <p>计算结果：<strong>${personalPension}</strong></p>
            </div>
            <div class="detail-section">
                <h5>8. 月领养老金总额</h5>
                <p>基础养老金 + 个人账户养老金</p>
                <p>计算结果：<strong>${totalPension}</strong></p>
            </div>
        </details>
    `;

    const detailsElement = detailsContainer.querySelector('details');
    const icon = detailsContainer.querySelector('summary span');
    detailsElement.addEventListener('toggle', function() {
        icon.textContent = this.open ? '▼' : '▶';
    });
}

/**
 * 渲染年度轨迹：待遇和累计年限取年初状态，缴费基数、缴费额及账户余额取按计划年末状态。
 */
function renderYearDetailsTable(yearDetails, futureAvgSalary, currentAvgSalary) {
    const tableContainer = document.getElementById('year-details-table');
    const minimumContributionYears = yearDetails.at(-1).minimumContributionYears;
    const firstEligibleIndex = yearDetails.findIndex(detail => detail.eligible);
    const hiddenRowsCount = firstEligibleIndex > 0 ? firstEligibleIndex : 0;
    let html = `
        <div class="year-details-table">
            <h4>年度缴费明细表</h4>
    `;

    if (hiddenRowsCount > 0) {
        html += `
            <div class="table-toggle-row">
                <button id="toggle-hidden-rows" class="btn btn-secondary" type="button">
                    显示未达到 ${formatYears(minimumContributionYears)} 年门槛的 ${hiddenRowsCount} 行
                </button>
            </div>
        `;
    }

    html += `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>年份</th>
                        <th>年龄</th>
                        <th>如现在停止<br>月领养老金</th>
                        <th>相当于现在<br>(元/月)</th>
                        <th>社平工资<br>(元/月)</th>
                        <th>最低基数<br>(60%)</th>
                        <th>最高基数<br>(300%)</th>
                        <th>缴费基数<br>(按计划)</th>
                        <th>当年缴费<br>(按计划)</th>
                        <th>账户余额<br>(按计划年末)</th>
                        <th>累计年限<br>(年初)</th>
                        <th>如现在停止<br>退休时余额</th>
                    </tr>
                </thead>
                <tbody>
    `;

    yearDetails.forEach((detail, index) => {
        const rowClasses = [];
        if (detail.isRetirementYear) rowClasses.push('last-year');
        if (index < hiddenRowsCount) rowClasses.push('hidden-row');
        const rowStyle = index < hiddenRowsCount ? ' style="display: none;"' : '';
        const pensionCell = detail.eligible
            ? window.CommonUtils.formatMoney(detail.pensionIfStop)
            : `<span class="eligibility-gap">差 ${formatYears(detail.eligibilityGap)} 年</span>`;
        const equivalentNowCell = detail.eligible
            ? window.CommonUtils.formatMoney(currentAvgSalary * detail.pensionIfStop / futureAvgSalary)
            : '—';
        let baseCell = '—';
        if (detail.isContributionYear) {
            let marker = '';
            if (detail.isRaisedByMinBase) marker = '<span class="base-limit-tag">60%下限</span>';
            if (detail.isLoweredByMaxBase) marker = '<span class="base-limit-tag">300%上限</span>';
            const title = detail.isRaisedByMinBase
                ? '原始基数低于60%下限，已按最低基数计算'
                : detail.isLoweredByMaxBase
                    ? '原始基数高于300%上限，已按最高基数计算'
                    : '';
            baseCell = `<span${title ? ` title="${title}"` : ''}>${window.CommonUtils.formatMoney(detail.yearBase)}</span>${marker}`;
        }

        html += `
            <tr class="${rowClasses.join(' ')}"${rowStyle}>
                <td>${detail.year}</td>
                <td>${detail.age}岁</td>
                <td>${pensionCell}</td>
                <td>${equivalentNowCell}</td>
                <td>${window.CommonUtils.formatMoney(detail.currentYearAvgSalary)}</td>
                <td>${window.CommonUtils.formatMoney(detail.minBase)}</td>
                <td>${window.CommonUtils.formatMoney(detail.maxBase)}</td>
                <td class="${detail.isRaisedByMinBase || detail.isLoweredByMaxBase ? 'base-limited' : ''}">${baseCell}</td>
                <td>${detail.isContributionYear ? window.CommonUtils.formatMoney(detail.yearContribution) : '—'}</td>
                <td>${window.CommonUtils.formatMoney(detail.accumulatedBalance)}</td>
                <td class="${detail.eligible ? '' : 'not-eligible'}" title="退休年份最低缴费年限为${formatYears(detail.minimumContributionYears)}年">${formatYears(detail.accumulatedYears)}</td>
                <td>${window.CommonUtils.formatMoney(detail.balanceAtRetirement)}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <p class="table-note">
            “如现在停止”按该年龄年初的余额、累计年限和缴费指数估算；“按计划”列包含当年利息与年末缴费。<br>
            退休年份最低缴费年限为 ${formatYears(minimumContributionYears)} 年；未达到门槛时不展示待遇金额，账户余额仍正常估算。<br>
            相当于现在 = 当前社平工资 × 未来养老金替代率，仅用于理解购买力。
        </p>
        </div>
    `;

    tableContainer.innerHTML = html;

    if (hiddenRowsCount > 0) {
        const toggleButton = tableContainer.querySelector('#toggle-hidden-rows');
        let expanded = false;
        toggleButton.addEventListener('click', () => {
            expanded = !expanded;
            tableContainer.querySelectorAll('.hidden-row').forEach(row => {
                row.style.display = expanded ? '' : 'none';
            });
            toggleButton.textContent = expanded
                ? `隐藏未达到 ${formatYears(minimumContributionYears)} 年门槛的 ${hiddenRowsCount} 行`
                : `显示未达到 ${formatYears(minimumContributionYears)} 年门槛的 ${hiddenRowsCount} 行`;
        });
    }
}

/** 清除持久化数据并恢复页面默认输入。 */
function resetForm() {
    const defaults = window.PensionCalculatorStorage.DEFAULT_VALUES;
    window.PensionCalculatorStorage.clearFormData();

    document.getElementById('current-age').value = defaults.currentAge;
    document.getElementById('retire-age').value = defaults.retireAge;
    document.getElementById('paid-years').value = defaults.paidYears;
    document.getElementById('account-balance').value = defaults.accountBalance;
    document.getElementById('salary-base').value = defaults.salaryBase;
    document.getElementById('avg-salary').value = defaults.avgSalary;
    document.getElementById('past-avg-index').value = defaults.pastAvgIndex;
    document.getElementById('avg-index').value = '';
    document.getElementById('stop-age').value = defaults.stopAge;
    document.getElementById('salary-growth').value = defaults.salaryGrowth;
    document.getElementById('soc-avg-growth').value = defaults.socAvgGrowth;
    document.getElementById('interest-rate').value = defaults.interestRate;
    document.querySelector('input[name="gender"][value="male"]').checked = true;
    document.querySelector(`input[name="base-change-mode"][value="${defaults.baseChangeMode}"]`).checked = true;
    document.querySelector('input[name="payment-plan"][value="continuous"]').checked = true;

    toggleStopAgeInput();
    syncAgeLimits();
    document.getElementById('result-section').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
