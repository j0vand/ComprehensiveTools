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
            if (id === 'current-age' || id === 'retire-age' || id === 'paid-years') {
                updateStopAgeHint();
            }
            window.PensionCalculatorStorage.saveFormData();
        });
    });

    document.querySelectorAll('input[name="gender"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('retire-age').value = radio.value === 'female_worker' ? 58 : 63;
            syncAgeLimits();
            updateStopAgeHint();
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
    updateStopAgeHint();
}

/**
 * 按当前年龄、已缴费年限与退休年份门槛，提示至少需缴费到多少岁。
 * 仅在「提前停止缴费」时展示；不强制改写用户已填的停缴年龄。
 */
function updateStopAgeHint() {
    const hint = document.getElementById('stop-age-hint');
    if (!hint) return;

    const paymentPlan = window.CommonUtils.getRadioValue('payment-plan', 'continuous');
    if (paymentPlan !== 'stop_early') {
        hint.hidden = true;
        hint.textContent = '';
        hint.classList.remove('is-warning');
        return;
    }

    const currentAge = Number.parseInt(document.getElementById('current-age').value, 10);
    const retireAge = Number.parseInt(document.getElementById('retire-age').value, 10);
    const paidYears = getRequiredNumber('paid-years');
    const estimate = window.PensionCalculatorCore.getMinimumStopContributionAge({
        currentAge,
        retireAge,
        paidYears,
        retireYear: Number.isInteger(currentAge) && Number.isInteger(retireAge)
            ? new Date().getFullYear() + (retireAge - currentAge)
            : undefined
    });

    if (!estimate.valid) {
        hint.hidden = false;
        hint.classList.remove('is-warning');
        hint.textContent = '请先填写有效的当前年龄、退休年龄和已缴费年限，以估算最低停缴年龄。';
        return;
    }

    hint.hidden = false;
    if (estimate.alreadyMet) {
        hint.classList.remove('is-warning');
        hint.innerHTML = `按退休年份 ${estimate.retireYear} 的最低缴费门槛 <strong>${formatYears(estimate.minimumContributionYears)} 年</strong>估算，当前已缴费年限已达标，最低可填当前年龄 <strong>${estimate.minStopAge}</strong> 岁。`;
        return;
    }

    if (!estimate.achievable) {
        hint.classList.add('is-warning');
        hint.innerHTML = `按退休年份 ${estimate.retireYear} 门槛 <strong>${formatYears(estimate.minimumContributionYears)} 年</strong>估算，还需再缴 <strong>${estimate.yearsNeeded}</strong> 年，至少缴至 <strong>${estimate.requiredStopAge}</strong> 岁；但退休年龄仅 <strong>${retireAge}</strong> 岁，即使缴到退休仍可能不够领取资格。`;
        return;
    }

    hint.classList.remove('is-warning');
    hint.innerHTML = `按退休年份 ${estimate.retireYear} 的最低缴费门槛 <strong>${formatYears(estimate.minimumContributionYears)} 年</strong>估算，还需再缴 <strong>${estimate.yearsNeeded}</strong> 年，建议至少缴费至 <strong>${estimate.minStopAge}</strong> 岁。`;
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
    updateStopAgeHint();
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

        renderResults(result, retirementInfo, inputs);
    } catch (error) {
        console.error('养老金计算失败:', error);
        showError(`计算失败：${error.message || '未知错误'}`);
    }
}

/** 年限最多保留两位小数，避免很小的资格差额被显示成0.0。 */
function formatYears(years) {
    return String(Math.round(years * 100) / 100);
}

/** 增长率等小数转百分数字符串，去掉多余尾零。 */
function formatPercent(rate) {
    return `${Number((rate * 100).toFixed(4))}%`;
}

/** 缴费指数展示：最多四位小数。 */
function formatIndex(value) {
    return String(Number(Number(value).toFixed(4)));
}

/** 渲染主结果，并在不具领取资格时保留账户余额、隐藏所有待遇金额。 */
function renderResults(result, retirementInfo, inputs) {
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

    renderCalculationDetails(result, retirementInfo, inputs);
    renderYearDetailsTable(result.yearDetails, result.futureAvgSalary, result.currentAvgSalary);
}

/**
 * 参数名值对表格（手机可读，不用悬停）。
 * @param {Array<{label: string, value: string}>} params
 */
function buildParamTable(params) {
    if (!params || params.length === 0) return '';
    const rows = params.map(item => `
                    <div class="detail-param-row">
                        <span class="detail-param-label">${item.label}</span>
                        <span class="detail-param-value">${item.value}</span>
                    </div>`).join('');
    return `
                <p class="detail-formula-label">参数</p>
                <div class="detail-param-table" role="list">${rows}
                </div>`;
}

/**
 * 短算式列表，每行一条，避免长文揉在一起。
 * @param {string[]} equations
 */
function buildEquationList(equations) {
    if (!equations || equations.length === 0) return '';
    const items = equations.map(line => `<li>${line}</li>`).join('');
    return `
                <p class="detail-formula-label">算式</p>
                <ol class="detail-equation-list">${items}</ol>`;
}

/**
 * 明细项：公式 + 参数表 + 短算式 + 结果。
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.formula
 * @param {Array<{label: string, value: string}>} options.params
 * @param {string[]} options.equations
 * @param {string} options.resultHtml
 * @param {string} [options.note]
 */
function buildDetailSection({ title, formula, params, equations, resultHtml, note = '' }) {
    const noteHtml = note
        ? `<p class="detail-formula-note">${note}</p>`
        : '';
    return `
            <article class="detail-section">
                <h5>${title}</h5>
                <p class="detail-formula-label">公式</p>
                <p class="detail-formula">${formula}</p>
                ${buildParamTable(params)}
                ${buildEquationList(equations)}
                ${noteHtml}
                <p class="detail-result">结果 <strong>${resultHtml}</strong></p>
            </article>`;
}

/** 渲染与核心轨迹一致的计算口径说明，并展示公式各位置的原始输入。 */
function renderCalculationDetails(result, retirementInfo, inputs) {
    const detailsContainer = document.getElementById('calculation-details');
    const money = value => window.CommonUtils.formatMoney(value);
    const yearsToRetire = retirementInfo.yearsToRetire;
    const core = window.PensionCalculatorCore;
    const personalRatePct = formatPercent(core.PERSONAL_CONTRIBUTION_RATE);
    const basicRatePct = formatPercent(core.BASIC_PENSION_RATE);

    const firstContribution = result.yearDetails.find(row => row.isContributionYear);
    const pastIndexSum = inputs.pastAvgIndex * inputs.paidYears;
    const totalIndexSum = result.weightedAvgIndex * result.totalYears;
    const futureIndexSum = Math.max(0, totalIndexSum - pastIndexSum);
    const futurePaidYears = Math.max(0, result.totalYears - inputs.paidYears);
    const firstYearIndex = firstContribution
        ? formatIndex(firstContribution.yearBase / firstContribution.currentYearAvgSalary)
        : null;
    const futureIndexNote = result.futureAvgIndexCalculated
        ? (firstContribution
            ? `未来各年指数 = 钳制后基数 ÷ 当年社平；首年示例 ${money(firstContribution.yearBase)} ÷ ${money(firstContribution.currentYearAvgSalary)} = ${firstYearIndex}`
            : '未来各年指数由钳制后基数 ÷ 当年社平工资计算')
        : `未来各年指数固定为您填写的 ${formatIndex(inputs.futureAvgIndex)}`;

    const basicPension = result.eligible ? `¥ ${money(result.basicPension)}` : '—';
    const personalPension = result.eligible ? `¥ ${money(result.personalPension)}` : '—';
    const totalPension = result.eligible ? `¥ ${money(result.totalPension)}` : '—';

    detailsContainer.innerHTML = `
        <details class="calculation-details">
            <summary><span>▶</span> 详细计算说明（点击展开）</summary>
            ${buildDetailSection({
                title: '1. 退休时社会平均工资',
                formula: '当前社平工资 × (1 + 社平工资年增长率)^剩余年限',
                params: [
                    { label: '当前社平工资', value: `¥ ${money(inputs.avgSalary)}` },
                    { label: '社平工资年增长率', value: formatPercent(inputs.socAvgGrowth) },
                    { label: '剩余年限', value: `${yearsToRetire} 年` }
                ],
                equations: [
                    `${money(inputs.avgSalary)} × (1 + ${formatPercent(inputs.socAvgGrowth)})^${yearsToRetire} = ${money(result.futureAvgSalary)}`
                ],
                resultHtml: `¥ ${money(result.futureAvgSalary)}`
            })}
            ${buildDetailSection({
                title: '2. 个人账户累计余额',
                formula: '退休年初余额 = 现有余额复利增值 + 未来缴费本息和',
                params: [
                    { label: '当前账户余额', value: `¥ ${money(inputs.accountBalance)}` },
                    { label: '记账利率', value: formatPercent(inputs.interestRate) },
                    { label: '复利年限', value: `${yearsToRetire} 年` },
                    { label: '个人缴费比例', value: `${personalRatePct}（年末计入）` }
                ],
                equations: [
                    `现有余额复利 = ${money(inputs.accountBalance)} × (1 + ${formatPercent(inputs.interestRate)})^${yearsToRetire} = ${money(result.balanceFutureValue)}`,
                    `未来缴费本息和 = ${money(result.totalAccountBalance)} − ${money(result.balanceFutureValue)} = ${money(result.futureContributionTotal)}`,
                    `合计 = ${money(result.balanceFutureValue)} + ${money(result.futureContributionTotal)} = ${money(result.totalAccountBalance)}`
                ],
                resultHtml: `¥ ${money(result.totalAccountBalance)}`
            })}
            ${buildDetailSection({
                title: '3. 加权平均缴费指数',
                formula: '（过去缴费指数合计 + 未来缴费指数合计）÷ 累计缴费年限',
                params: [
                    { label: '过去平均缴费指数', value: formatIndex(inputs.pastAvgIndex) },
                    { label: '已缴费年限', value: `${formatYears(inputs.paidYears)} 年` },
                    { label: '过去指数合计', value: formatIndex(pastIndexSum) },
                    { label: '未来缴费年限', value: `${formatYears(futurePaidYears)} 年` },
                    { label: '未来指数合计', value: formatIndex(futureIndexSum) },
                    { label: '累计缴费年限', value: `${formatYears(result.totalYears)} 年` }
                ],
                equations: [
                    `(${formatIndex(pastIndexSum)} + ${formatIndex(futureIndexSum)}) ÷ ${formatYears(result.totalYears)} = ${formatIndex(result.weightedAvgIndex)}`
                ],
                note: futureIndexNote,
                resultHtml: formatIndex(result.weightedAvgIndex)
            })}
            ${buildDetailSection({
                title: '4. 基础养老金',
                formula: `退休时社平工资 × (1 + 平均缴费指数) ÷ 2 × 累计缴费年限 × ${basicRatePct}`,
                params: [
                    { label: '退休时社平工资', value: `¥ ${money(result.futureAvgSalary)}` },
                    { label: '平均缴费指数', value: formatIndex(result.weightedAvgIndex) },
                    { label: '累计缴费年限', value: `${formatYears(result.totalYears)} 年` },
                    { label: '计发比例', value: basicRatePct }
                ],
                equations: [
                    result.eligible
                        ? `${money(result.futureAvgSalary)} × (1 + ${formatIndex(result.weightedAvgIndex)}) ÷ 2 × ${formatYears(result.totalYears)} × ${basicRatePct} = ${money(result.basicPension)}`
                        : `${money(result.futureAvgSalary)} × (1 + ${formatIndex(result.weightedAvgIndex)}) ÷ 2 × ${formatYears(result.totalYears)} × ${basicRatePct}（暂不具备领取资格）`
                ],
                resultHtml: basicPension
            })}
            ${buildDetailSection({
                title: '5. 个人账户养老金',
                formula: '个人账户累计余额 ÷ 计发月数',
                params: [
                    { label: '个人账户累计余额', value: `¥ ${money(result.totalAccountBalance)}` },
                    { label: '退休年龄', value: `${retirementInfo.retireAge} 岁` },
                    { label: '计发月数', value: `${result.paymentMonths} 个月` }
                ],
                equations: [
                    result.eligible
                        ? `${money(result.totalAccountBalance)} ÷ ${result.paymentMonths} = ${money(result.personalPension)}`
                        : `${money(result.totalAccountBalance)} ÷ ${result.paymentMonths}（暂不具备领取资格）`
                ],
                resultHtml: personalPension
            })}
            ${buildDetailSection({
                title: '6. 月领养老金总额',
                formula: '基础养老金 + 个人账户养老金',
                params: [
                    { label: '基础养老金', value: basicPension },
                    { label: '个人账户养老金', value: personalPension }
                ],
                equations: [
                    result.eligible
                        ? `${money(result.basicPension)} + ${money(result.personalPension)} = ${money(result.totalPension)}`
                        : '暂不具备领取资格，不合计发放额'
                ],
                resultHtml: totalPension
            })}
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
