/**
 * 养老金计算器核心逻辑
 * 
 * 包含：
 * 1. 数据初始化 (城市选择)
 * 2. 养老金计算模型 (包含复利增长)
 * 3. UI 交互控制
 */

// ==========================================
// 0. 常量定义
// ==========================================
// 注意：以下常量已在其他模块中定义，在同一全局作用域中可直接使用：
// - PERSONAL_CONTRIBUTION_RATE, BASIC_PENSION_RATE, MIN_CONTRIBUTION_RATE (calculator-core.js)
// - DEFAULT_VALUES (calculator-storage.js)

document.addEventListener('DOMContentLoaded', function() {
    // 使用存储模块恢复数据
    if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.restoreFormData) {
        window.PensionCalculatorStorage.restoreFormData();
    } else {
        restoreFormData();  // 降级处理
    }
    initEventListeners();
});

// ==========================================
// 1. 初始化与事件监听
// ==========================================


/**
 * 保存表单数据到 localStorage
 */
function saveFormData() {
    // 辅助函数：获取输入框的实际值（保存时原样保存，不使用默认值）
    const getRawValue = (id, type = 'float') => {
        const element = document.getElementById(id);
        if (!element) return null;
        const value = element.value.trim();
        if (value === '') return null;
        const parsedValue = type === 'int' ? parseInt(value) : parseFloat(value);
        return isNaN(parsedValue) ? null : parsedValue;
    };

    // 获取未来平均缴费指数（选填）
    const futureAvgIndexEl = document.getElementById('avg-index');
    let futureAvgIndex = null;
    if (futureAvgIndexEl && futureAvgIndexEl.value && futureAvgIndexEl.value.trim() !== '') {
        futureAvgIndex = parseFloat(futureAvgIndexEl.value);
        if (isNaN(futureAvgIndex)) futureAvgIndex = null;
    }

    const formData = {
        // 基本信息
        gender: getRadioValue('gender', 'male'),
        currentAge: getElementValue('current-age', 'int', DEFAULT_VALUES.currentAge),
        avgSalary: getElementValue('avg-salary', 'float', DEFAULT_VALUES.avgSalary),

        // 缴费详情
        paidYears: getElementValue('paid-years', 'float', DEFAULT_VALUES.paidYears),
        accountBalance: getElementValue('account-balance', 'float', DEFAULT_VALUES.accountBalance),
        salaryBase: getElementValue('salary-base', 'float', DEFAULT_VALUES.salaryBase),
        pastAvgIndex: getElementValue('past-avg-index', 'float', DEFAULT_VALUES.pastAvgIndex),
        futureAvgIndex: futureAvgIndex,  // 可能是null
        baseChangeMode: getRadioValue('base-change-mode', DEFAULT_VALUES.baseChangeMode),
        paymentPlan: getRadioValue('payment-plan', 'continuous'),
        stopAge: getElementValue('stop-age', 'int', DEFAULT_VALUES.stopAge),

        // 高级参数（保存实际值，允许为null表示用户清空了）
        salaryGrowth: getRawValue('salary-growth', 'float'),
        socAvgGrowth: getRawValue('soc-avg-growth', 'float'),
        interestRate: getRawValue('interest-rate', 'float')
    };
    
    // 使用统一的存储键名和函数
    const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.PENSION_CALCULATOR) || 'pensionCalculator_data';
    if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
        window.CommonUtils.setLocalStorageItem(STORAGE_KEY, formData);
    } else {
        // 降级处理：如果公共工具库未加载，使用本地实现
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        } catch (e) {
            console.warn('无法保存数据到 localStorage:', e);
        }
    }
}

/**
 * 从 localStorage 恢复表单数据
 */
function restoreFormData() {
    // 使用统一的存储键名和函数
    const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.PENSION_CALCULATOR) || 'pensionCalculator_data';
    let formData;
    if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
        formData = window.CommonUtils.getLocalStorageItem(STORAGE_KEY, null);
        if (!formData) return;
    } else {
        // 降级处理：如果公共工具库未加载，使用本地实现
        try {
            const savedData = localStorage.getItem(STORAGE_KEY);
            if (!savedData) return;
            formData = JSON.parse(savedData);
        } catch (e) {
            console.warn('无法从 localStorage 恢复数据:', e);
            return;
        }
    }
        
        // 恢复基本信息
        const genderRadio = document.querySelector(`input[name="gender"][value="${formData.gender}"]`);
        if (genderRadio) genderRadio.checked = true;
        
        const currentAgeEl = document.getElementById('current-age');
        if (currentAgeEl && formData.currentAge !== undefined) currentAgeEl.value = formData.currentAge;
        
        const avgSalaryEl = document.getElementById('avg-salary');
        if (avgSalaryEl && formData.avgSalary !== undefined) avgSalaryEl.value = formData.avgSalary;
        
        // 恢复缴费详情
        const paidYearsEl = document.getElementById('paid-years');
        if (paidYearsEl && formData.paidYears !== undefined) paidYearsEl.value = formData.paidYears;
        
        const accountBalanceEl = document.getElementById('account-balance');
        if (accountBalanceEl && formData.accountBalance !== undefined) accountBalanceEl.value = formData.accountBalance;
        
        const salaryBaseEl = document.getElementById('salary-base');
        if (salaryBaseEl && formData.salaryBase !== undefined) salaryBaseEl.value = formData.salaryBase;
        
        const pastAvgIndexEl = document.getElementById('past-avg-index');
        if (pastAvgIndexEl && formData.pastAvgIndex !== undefined) pastAvgIndexEl.value = formData.pastAvgIndex;
        
        const futureAvgIndexEl = document.getElementById('avg-index');
        if (futureAvgIndexEl) {
            if (formData.futureAvgIndex !== undefined && formData.futureAvgIndex !== null) {
                futureAvgIndexEl.value = formData.futureAvgIndex;
            } else {
                futureAvgIndexEl.value = '';
            }
        }
        
        const baseChangeModeRadio = document.querySelector(`input[name="base-change-mode"][value="${formData.baseChangeMode || DEFAULT_VALUES.baseChangeMode}"]`);
        if (baseChangeModeRadio) baseChangeModeRadio.checked = true;
        
        const paymentPlanRadio = document.querySelector(`input[name="payment-plan"][value="${formData.paymentPlan}"]`);
        if (paymentPlanRadio) {
            paymentPlanRadio.checked = true;
            // 触发显示/隐藏停止年龄输入框
            const stopAgeGroupEl = document.getElementById('stop-age-group');
            if (stopAgeGroupEl) {
                if (formData.paymentPlan === 'stop_early') {
                    stopAgeGroupEl.classList.remove('hidden');
                } else {
                    stopAgeGroupEl.classList.add('hidden');
                }
            }
        }
        
        const stopAgeEl = document.getElementById('stop-age');
        if (stopAgeEl && formData.stopAge !== undefined) stopAgeEl.value = formData.stopAge;
        
        // 恢复高级参数（如果保存的值是null，则清空输入框；如果是0也要正确恢复）
        const salaryGrowthEl = document.getElementById('salary-growth');
        if (salaryGrowthEl) {
            // 检查 formData 中是否有这个字段（包括0值）
            if ('salaryGrowth' in formData) {
                if (formData.salaryGrowth !== null) {
                    salaryGrowthEl.value = formData.salaryGrowth;  // 包括0值
                } else {
                    salaryGrowthEl.value = '';  // 用户上次清空了，恢复为空
                }
            }
        }

        const socAvgGrowthEl = document.getElementById('soc-avg-growth');
        if (socAvgGrowthEl) {
            if ('socAvgGrowth' in formData) {
                if (formData.socAvgGrowth !== null) {
                    socAvgGrowthEl.value = formData.socAvgGrowth;
                } else {
                    socAvgGrowthEl.value = '';
                }
            }
        }

        const interestRateEl = document.getElementById('interest-rate');
        if (interestRateEl) {
            if ('interestRate' in formData) {
                if (formData.interestRate !== null) {
                    interestRateEl.value = formData.interestRate;
                } else {
                    interestRateEl.value = '';
                }
            }
        }
        
}

function initEventListeners() {
    // 按钮事件
    const calculateBtn = document.getElementById('calculate-btn');
    const resetBtn = document.getElementById('reset-btn');
    if (calculateBtn) calculateBtn.addEventListener('click', calculateAndShow);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);
    
    // 监听缴费规划变化
    const planRadios = document.querySelectorAll('input[name="payment-plan"]');
    planRadios.forEach(radio => {
        radio.addEventListener('change', toggleStopAgeInput);
        radio.addEventListener('change', () => {
            // 使用存储模块保存数据
            if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.saveFormData) {
                window.PensionCalculatorStorage.saveFormData();
            } else {
                saveFormData();  // 降级处理
            }
        });
    });
    
    // 监听所有输入框变化，自动保存
    const inputIds = [
        'current-age', 'avg-salary',
        'paid-years', 'account-balance', 'salary-base',
        'past-avg-index', 'avg-index', 'stop-age',
        'salary-growth', 'soc-avg-growth', 'interest-rate'
    ];
    
    inputIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', () => {
                if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.saveFormData) {
                    window.PensionCalculatorStorage.saveFormData();
                } else {
                    saveFormData();  // 降级处理
                }
            });
            element.addEventListener('change', () => {
                if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.saveFormData) {
                    window.PensionCalculatorStorage.saveFormData();
                } else {
                    saveFormData();  // 降级处理
                }
            });
        }
    });
    
    // 监听性别选择变化
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.saveFormData) {
                window.PensionCalculatorStorage.saveFormData();
            } else {
                saveFormData();  // 降级处理
            }
        });
    });
    
    // 监听缴费基数变化方式选择变化
    const baseChangeModeRadios = document.querySelectorAll('input[name="base-change-mode"]');
    baseChangeModeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.saveFormData) {
                window.PensionCalculatorStorage.saveFormData();
            } else {
                saveFormData();  // 降级处理
            }
        });
    });
}

function toggleStopAgeInput(e) {
    const stopAgeGroup = document.getElementById('stop-age-group');
    if (!stopAgeGroup) return;
    if (e.target.value === 'stop_early') {
        stopAgeGroup.classList.remove('hidden');
    } else {
        stopAgeGroup.classList.add('hidden');
    }
}

// ==========================================
// 2. 核心计算逻辑
// ==========================================

/**
 * 获取计发月数（从核心模块引用）
 * @param {number} age - 退休年龄
 * @returns {number} 计发月数
 */
function getPaymentMonths(age) {
    // 优先使用核心模块的函数
    if (window.PensionCalculatorCore && window.PensionCalculatorCore.getPaymentMonths) {
        return window.PensionCalculatorCore.getPaymentMonths(age);
    }
    // 降级处理：如果核心模块未加载，使用本地实现
    if (age < 40) return 233;
    if (age > 70) return 56;
    const floorAge = Math.floor(age);
    // 简化的计发月数表（仅用于降级）
    const PAYMENT_MONTHS = {
        40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
        45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
        50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
        55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
        60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
        65: 101, 66: 93,  67: 84,  68: 75,  69: 65,
        70: 56
    };
    return PAYMENT_MONTHS[floorAge] || PAYMENT_MONTHS[Math.min(70, Math.max(40, floorAge))] || 139;
}

function calculateAndShow() {
    try {
        // 1. 获取输入数据
        const inputs = getInputs();
        if (!validateInputs(inputs)) return;

        // 2. 计算退休信息
        const retirementInfo = calculateRetirementInfo(inputs.gender, inputs.currentAge);
        
        // 再次验证：停止缴费年龄不能大于退休年龄
        if (inputs.paymentPlan === 'stop_early') {
            if (inputs.stopAge > retirementInfo.retireAge) {
                showError(`您的预计退休年龄为 ${retirementInfo.retireAge} 岁，停止缴费年龄不能大于退休年龄。`);
                return;
            }
            if (inputs.stopAge <= inputs.currentAge) {
                showError("停止缴费年龄必须大于当前年龄。");
                return;
            }
        }

        // 3. 执行核心计算
        let result;
        try {
            // 使用核心计算模块
            if (window.PensionCalculatorCore && window.PensionCalculatorCore.calculatePension) {
                result = window.PensionCalculatorCore.calculatePension(inputs, retirementInfo);
            } else {
                result = calculatePension(inputs, retirementInfo);
            }
        } catch (calcError) {
            console.error('计算过程出错:', calcError);
            showError('计算过程中发生错误：' + (calcError.message || '未知错误') + '\n请检查输入数据是否合理。');
            return;
        }

        // 验证计算结果的有效性
        if (!result || typeof result.totalPension !== 'number' || isNaN(result.totalPension) || !isFinite(result.totalPension)) {
            showError('计算结果无效，请检查输入数据。');
            console.error('计算结果无效:', result);
            return;
        }

        // 4. 渲染结果
        try {
            renderResults(result, retirementInfo);
        } catch (renderError) {
            console.error('渲染结果出错:', renderError);
            showError('显示结果时发生错误：' + (renderError.message || '未知错误') + '\n计算结果已生成，但无法显示。');
        }
    } catch (error) {
        console.error('计算过程发生未预期的错误:', error);
        showError('发生未预期的错误：' + (error.message || '未知错误') + '\n请刷新页面重试。');
    }
}

/**
 * 获取元素值的辅助函数（使用公共工具库）
 */
function getElementValue(id, type = 'float', defaultValue = 0) {
    if (window.CommonUtils && window.CommonUtils.getElementValue) {
        return window.CommonUtils.getElementValue(id, type, defaultValue);
    }
    // 降级处理：如果公共工具库未加载，使用本地实现
    const element = document.getElementById(id);
    if (!element) return defaultValue;

    // 如果输入框值为空字符串，且有默认值，则使用默认值
    // 否则返回实际值或0
    const value = element.value.trim();
    if (value === '') return defaultValue;

    const parsedValue = type === 'int' ? parseInt(value) : parseFloat(value);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
}

/**
 * 获取选中的radio值（使用公共工具库）
 */
function getRadioValue(name, defaultValue = '') {
    if (window.CommonUtils && window.CommonUtils.getRadioValue) {
        return window.CommonUtils.getRadioValue(name, defaultValue);
    }
    // 降级处理：如果公共工具库未加载，使用本地实现
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : defaultValue;
}

function getInputs() {
    // 使用存储模块的默认值（如果可用）
    const DEFAULT_VALUES = (window.PensionCalculatorStorage && window.PensionCalculatorStorage.DEFAULT_VALUES) || {
        currentAge: 30,
        paidYears: 5,
        accountBalance: 20000,
        salaryBase: 8000,
        avgSalary: 8000,
        pastAvgIndex: 1.0,
        futureAvgIndex: null,
        baseChangeMode: 'follow_salary',
        stopAge: 50,
        salaryGrowth: 3,
        socAvgGrowth: 3,
        interestRate: 3
    };

    // 获取未来平均缴费指数（选填）
    const futureAvgIndexEl = document.getElementById('avg-index');
    let futureAvgIndex = null;
    if (futureAvgIndexEl && futureAvgIndexEl.value && futureAvgIndexEl.value.trim() !== '') {
        futureAvgIndex = parseFloat(futureAvgIndexEl.value);
        if (isNaN(futureAvgIndex)) futureAvgIndex = null;
    }
    
    return {
        gender: getRadioValue('gender', 'male'),
        currentAge: getElementValue('current-age', 'int', DEFAULT_VALUES.currentAge),
        avgSalary: getElementValue('avg-salary', 'float', DEFAULT_VALUES.avgSalary),
        paidYears: getElementValue('paid-years', 'float', DEFAULT_VALUES.paidYears),
        accountBalance: getElementValue('account-balance', 'float', DEFAULT_VALUES.accountBalance),
        salaryBase: getElementValue('salary-base', 'float', DEFAULT_VALUES.salaryBase),
        pastAvgIndex: getElementValue('past-avg-index', 'float', DEFAULT_VALUES.pastAvgIndex),
        futureAvgIndex: futureAvgIndex,  // 可能是null
        
        // 缴费基数变化方式
        baseChangeMode: getRadioValue('base-change-mode', DEFAULT_VALUES.baseChangeMode),
        
        // 缴费规划
        paymentPlan: getRadioValue('payment-plan', 'continuous'),
        stopAge: getElementValue('stop-age', 'int', DEFAULT_VALUES.stopAge),

        // 高级参数（如果输入框为空，使用默认值）
        salaryGrowth: getElementValue('salary-growth', 'float', DEFAULT_VALUES.salaryGrowth) / 100,
        socAvgGrowth: getElementValue('soc-avg-growth', 'float', DEFAULT_VALUES.socAvgGrowth) / 100,
        interestRate: getElementValue('interest-rate', 'float', DEFAULT_VALUES.interestRate) / 100
    };
}

function validateInputs(data) {
    // 验证年龄：18岁以上，且未达到退休年龄
    if (data.currentAge < 18) {
        showError("请输入有效的年龄 (18岁以上)");
        return false;
    }
    
    // 根据性别检查是否已退休
    let retireAge = 65;  // 男性65岁退休
    if (data.gender === 'female_worker') retireAge = 60;  // 女性60岁退休
    
    if (data.currentAge >= retireAge) {
        showError(`您已达到退休年龄 (${retireAge}岁)，无需计算。`);
        return false;
    }
    
    // 验证平均工资
    if (data.avgSalary <= 0 || !isFinite(data.avgSalary)) {
        showError("请输入有效的平均工资");
        return false;
    }
    
    // 验证已缴费年限
    if (data.paidYears < 0 || !isFinite(data.paidYears)) {
        showError("请输入有效的已缴费年限");
        return false;
    }
    
    // 验证账户余额
    if (data.accountBalance < 0 || !isFinite(data.accountBalance)) {
        showError("请输入有效的账户余额");
        return false;
    }
    
    // 验证缴费基数
    if (data.salaryBase <= 0 || !isFinite(data.salaryBase)) {
        showError("请输入有效的缴费基数");
        return false;
    }
    
    // 验证过去平均缴费指数
    if (data.pastAvgIndex < 0 || !isFinite(data.pastAvgIndex)) {
        showError("请输入有效的过去平均缴费指数");
        return false;
    }
    
    // 验证未来平均缴费指数（如果填写了）
    if (data.futureAvgIndex !== null && data.futureAvgIndex !== undefined) {
        if (data.futureAvgIndex < 0 || !isFinite(data.futureAvgIndex)) {
            showError("请输入有效的未来平均缴费指数");
            return false;
        }
    }
    
    // 验证增长率参数
    if (data.salaryGrowth < 0 || data.salaryGrowth > 1 || !isFinite(data.salaryGrowth)) {
        showError("工资增长率应在0%到100%之间");
        return false;
    }
    
    if (data.socAvgGrowth < 0 || data.socAvgGrowth > 1 || !isFinite(data.socAvgGrowth)) {
        showError("社平工资增长率应在0%到100%之间");
        return false;
    }
    
    if (data.interestRate < 0 || data.interestRate > 1 || !isFinite(data.interestRate)) {
        showError("记账利率应在0%到100%之间");
        return false;
    }
    
    return true;
}

/**
 * 显示错误消息（统一使用通知组件）
 */
function showError(message) {
    if (window.CommonUtils && window.CommonUtils.showNotification) {
        window.CommonUtils.showNotification(message, 'error', 5000);
    } else {
        // 降级处理：如果公共工具库未加载，使用 alert
        alert(message);
    }
}

function calculateRetirementInfo(gender, currentAge) {
    let retireAge = 65;  // 男性65岁退休
    if (gender === 'female_worker') retireAge = 60;  // 女性60岁退休

    const yearsToRetire = Math.max(0, retireAge - currentAge);
    const retireYear = new Date().getFullYear() + yearsToRetire;

    return {
        retireAge,
        yearsToRetire,
        retireYear
    };
}

// calculatePension 和 calculateYearDetails 统一使用 calculator-core.js 中的实现
// 本文件中的降级版本 (getPaymentMonths) 仅在核心模块未加载时使用

// ==========================================
// 3. 结果渲染
// ==========================================

function renderResults(result, retirementInfo) {
    const section = document.getElementById('result-section');
    if (!section) return;
    section.classList.remove('hidden');

    // 滚动到结果
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 填充基本数据
    setText('res-retire-age', retirementInfo.retireAge);
    setText('res-retire-year', retirementInfo.retireYear);
    
    setText('res-total-pension', formatMoney(result.totalPension));
    setText('res-basic-pension', formatMoney(result.basicPension));
    setText('res-personal-pension', formatMoney(result.personalPension));
    
    setText('res-months', result.paymentMonths);
    setText('res-account-total', formatMoney(result.totalAccountBalance));
    setText('res-total-years', result.totalYears.toFixed(1));

    // 计算替代率 (相对于退休时的预估社平工资)
    const replaceRate = (result.totalPension / result.futureAvgSalary) * 100;
    setText('res-replace-rate', replaceRate.toFixed(1));
    // 按当前购买力约相当于（当前社平 × 替代率）
    const equivalentNow = result.futureAvgSalary > 0 && isFinite(result.futureAvgSalary)
        ? result.currentAvgSalary * (result.totalPension / result.futureAvgSalary)
        : 0;
    setText('res-equivalent-now', formatMoney(equivalentNow));
    
    // 渲染详细计算说明
    renderCalculationDetails(result, retirementInfo);
    
    // 渲染年度明细表格
    renderYearDetailsTable(result.yearDetails, result.futureAvgSalary, result.currentAvgSalary);
}

/**
 * 渲染详细计算说明
 */
function renderCalculationDetails(result, retirementInfo) {
    const detailsContainer = document.getElementById('calculation-details');
    if (!detailsContainer) return;
    
    const html = `
        <details class="calculation-details">
            <summary style="cursor: pointer; font-weight: 600; font-size: 1.1rem; color: var(--primary-color); margin-bottom: 15px; list-style: none; display: flex; align-items: center;">
                <span style="margin-right: 8px;">▶</span>详细计算说明（点击展开）
            </summary>

            <div class="detail-section">
                <h5>1. 退休时社会平均工资</h5>
                <p>计算公式：当前社平工资 × (1 + 社平工资年增长率)^剩余年限</p>
                <p>计算结果：<strong>¥ ${formatMoney(result.futureAvgSalary)}</strong></p>
            </div>
            
            <div class="detail-section">
                <h5>2. 缴费基数计算规则</h5>
                ${result.baseChangeMode === 'fixed' ? `
                    <p><strong>固定基数模式：</strong></p>
                    <p>每年的缴费基数 = max(您填写的固定基数, 当年社平工资 × 60%)</p>
                    <p>说明：缴费基数保持您填写的值不变，但当社平工资的60%超过您的固定基数时，公司会强制提高到社平工资的60%（满足最低缴费下限要求）。</p>
                ` : `
                    <p><strong>跟着工资增长模式：</strong></p>
                    <p>每年的缴费基数 = max(上一年基数 × (1 + 工资增长率), 当年社平工资 × 60%)</p>
                    <p>说明：缴费基数按您填写的工资增长率增长，但不能低于当年社平工资的60%（最低缴费下限）。如果工资增长率为0，缴费基数保持不变，但仍需满足最低缴费下限。</p>
                `}
            </div>
            
            <div class="detail-section">
                <h5>3. 个人账户累计余额</h5>
                <p>由两部分组成（采用按年复利计算方式）：</p>
                <ul>
                    <li><strong>现有余额复利增值</strong>：¥ ${formatMoney(result.balanceFutureValue)}</li>
                    <li><strong>未来缴费本息和</strong>：¥ ${formatMoney(result.futureContributionTotal)}<br>
                        <small style="color: #666;">说明：假设每年的缴费在年末计入账户，然后按年复利增长到退休</small>
                    </li>
                </ul>
                <p>合计：<strong>¥ ${formatMoney(result.totalAccountBalance)}</strong></p>
            </div>
            
            <div class="detail-section">
                <h5>4. 加权平均缴费指数</h5>
                <p>计算公式：(过去平均缴费指数 × 已缴费年限 + 未来平均缴费指数 × 未来缴费年限) / 总缴费年限</p>
                ${result.futureAvgIndexCalculated ? '<p><strong>注意：</strong>未来平均缴费指数未填写，已根据缴费基数变化方式自动计算。</p>' : ''}
                <p>计算结果：<strong>${result.weightedAvgIndex.toFixed(2)}</strong></p>
            </div>
            
            <div class="detail-section">
                <h5>5. 基础养老金</h5>
                <p>计算公式：退休时社平工资 × (1 + 平均缴费指数) / 2 × 累计缴费年限 × 1%</p>
                <p>计算结果：<strong>¥ ${formatMoney(result.basicPension)}</strong></p>
            </div>
            
            <div class="detail-section">
                <h5>6. 个人账户养老金</h5>
                <p>计算公式：个人账户累计余额 / 计发月数（${result.paymentMonths}个月）</p>
                <p>计算结果：<strong>¥ ${formatMoney(result.personalPension)}</strong></p>
            </div>
            
            <div class="detail-section">
                <h5>7. 月领养老金总额</h5>
                <p>计算公式：基础养老金 + 个人账户养老金</p>
                <p>计算结果：<strong>¥ ${formatMoney(result.totalPension)}</strong></p>
            </div>
        </details>
    `;

    detailsContainer.innerHTML = html;

    // 添加展开/折叠图标切换
    const detailsElement = detailsContainer.querySelector('details');
    const summaryElement = detailsContainer.querySelector('summary span');
    if (detailsElement && summaryElement) {
        detailsElement.addEventListener('toggle', function() {
            summaryElement.textContent = this.open ? '▼' : '▶';
        });
    }
}

/**
 * 渲染年度明细表格
 * @param {Array} yearDetails - 年度明细数据
 * @param {number} futureAvgSalary - 退休时社平工资（用于计算替代率）
 * @param {number} currentAvgSalary - 当前社平工资（用于计算「相当于现在」）
 */
function renderYearDetailsTable(yearDetails, futureAvgSalary, currentAvgSalary) {
    const tableContainer = document.getElementById('year-details-table');
    if (!tableContainer) return;

    // 养老金领取的最低缴费年限（设置为20年以确保更稳定的养老保障）
    const MIN_PAYMENT_YEARS = 20;
    const hasValidFutureAvg = futureAvgSalary > 0 && isFinite(futureAvgSalary);

    // 找到第一个满足最低缴费年限的行的索引
    let firstValidIndex = yearDetails.findIndex(detail => detail.accumulatedYears >= MIN_PAYMENT_YEARS);
    if (firstValidIndex === -1) {
        // 如果所有行都不满足，则显示所有行
        firstValidIndex = 0;
    }

    // 计算有多少行被隐藏
    const hiddenRowsCount = firstValidIndex;

    let html = `
        <div class="year-details-table">
            <h4>年度缴费明细表</h4>
    `;

    // 如果有隐藏的行，添加展开/折叠按钮
    if (hiddenRowsCount > 0) {
        html += `
            <div style="margin-bottom: 10px;">
                <button id="toggle-hidden-rows" class="btn btn-secondary" style="font-size: 14px; padding: 6px 12px;">
                    <span id="toggle-icon">▶</span> 显示不满${MIN_PAYMENT_YEARS}年缴费的${hiddenRowsCount}行
                </button>
                <small style="margin-left: 10px; color: #666;">
                    （累计缴费满${MIN_PAYMENT_YEARS}年可享受更稳定的养老保障）
                </small>
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
                            <th>如停止缴费<br/>月领养老金</th>
                            <th>相当于现在<br/>(元/月)</th>
                            <th>社平工资<br/>(元/月)</th>
                            <th>最低基数<br/>(60%)</th>
                            <th>缴费基数<br/>(元/月)</th>
                            <th>当年缴费<br/>(元)</th>
                            <th>账户余额<br/>(年末)</th>
                            <th>累计年限<br/>(年)</th>
                            <th>如停止缴费<br/>退休时余额</th>
                        </tr>
                    </thead>
                    <tbody id="year-details-tbody">
    `;

    yearDetails.forEach((detail, index) => {
        const isLastYear = index === yearDetails.length - 1;
        const isHidden = index < firstValidIndex;
        const rowClass = isLastYear ? 'last-year' : '';
        const hiddenClass = isHidden ? 'hidden-row' : '';
        const combinedClass = [rowClass, hiddenClass].filter(c => c).join(' ');

        // 相当于现在(元/月) = 当前社平 × (pensionIfStop / futureAvgSalary)
        let equivalentNowCell = '-';
        if (detail.pensionIfStop > 0 && detail.accumulatedYears >= MIN_PAYMENT_YEARS && hasValidFutureAvg) {
            const equivalentNow = currentAvgSalary * (detail.pensionIfStop / futureAvgSalary);
            equivalentNowCell = formatMoney(equivalentNow);
        } else if (detail.accumulatedYears < MIN_PAYMENT_YEARS) {
            equivalentNowCell = '<span style="color: #f44336;">不满20年</span>';
        }

        html += `
            <tr ${combinedClass ? `class="${combinedClass}"` : ''} ${isHidden ? 'style="display: none;"' : ''}>
                <td>${detail.year}</td>
                <td>${detail.age}岁</td>
                <td>${detail.pensionIfStop > 0 ? formatMoney(detail.pensionIfStop) : (detail.accumulatedYears < MIN_PAYMENT_YEARS ? '<span style="color: #f44336;">不满20年</span>' : '-')}</td>
                <td>${equivalentNowCell}</td>
                <td>${formatMoney(detail.currentYearAvgSalary)}</td>
                <td>${formatMoney(detail.minBase)}</td>
                <td ${detail.isRaisedByMinBase ? 'style="color: #f44336; font-weight: 600;" title="因满足最低缴费下限(60%)而提高"' : ''}>${formatMoney(detail.yearBase)}${detail.isRaisedByMinBase ? ' ⬆' : ''}</td>
                <td>${detail.yearContribution > 0 ? formatMoney(detail.yearContribution) : '-'}</td>
                <td>${formatMoney(detail.accumulatedBalance)}</td>
                <td ${detail.accumulatedYears < MIN_PAYMENT_YEARS ? 'style="color: #f44336; font-weight: 600;" title="未满最低缴费年限"' : ''}>${detail.accumulatedYears.toFixed(1)}</td>
                <td>${detail.balanceAtRetirement > 0 ? formatMoney(detail.balanceAtRetirement) : '-'}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
            <p class="table-note">
                注：表格显示如果从某一年开始停止缴费，到退休时的账户余额和月领养老金金额。<br>
                相当于现在(元/月) = 当前社平工资 × 替代率，用于理解未来养老金按当前购买力的大致水平。<br>
                <strong style="color: #f44336;">红色标注：</strong>累计缴费年限不满${MIN_PAYMENT_YEARS}年时建议继续缴费以获得更稳定的养老保障。
            </p>
        </div>
    `;

    tableContainer.innerHTML = html;

    // 绑定展开/折叠按钮事件
    if (hiddenRowsCount > 0) {
        const toggleBtn = document.getElementById('toggle-hidden-rows');
        const toggleIcon = document.getElementById('toggle-icon');
        if (toggleBtn && toggleIcon) {
            let isExpanded = false;
            toggleBtn.addEventListener('click', () => {
                const hiddenRows = document.querySelectorAll('.hidden-row');
                isExpanded = !isExpanded;
                hiddenRows.forEach(row => {
                    row.style.display = isExpanded ? '' : 'none';
                });
                toggleIcon.textContent = isExpanded ? '▼' : '▶';
                toggleBtn.innerHTML = `<span id="toggle-icon">${isExpanded ? '▼' : '▶'}</span> ${isExpanded ? '隐藏' : '显示'}不满${MIN_PAYMENT_YEARS}年缴费的${hiddenRowsCount}行`;
            });
        }
    }
}

function setText(id, value) {
    if (window.CommonUtils && window.CommonUtils.setText) {
        return window.CommonUtils.setText(id, value);
    }
    // 降级处理：如果公共工具库未加载，使用本地实现
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatMoney(num) {
    if (window.CommonUtils && window.CommonUtils.formatMoney) {
        return window.CommonUtils.formatMoney(num);
    }
    // 降级处理：如果公共工具库未加载，使用本地实现
    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function resetForm() {
    // 使用存储模块的默认值（如果可用）
    const DEFAULT_VALUES = (window.PensionCalculatorStorage && window.PensionCalculatorStorage.DEFAULT_VALUES) || {
        currentAge: 30,
        paidYears: 5,
        accountBalance: 20000,
        salaryBase: 8000,
        avgSalary: 8000,
        pastAvgIndex: 1.0,
        futureAvgIndex: null,
        baseChangeMode: 'follow_salary',
        stopAge: 50,
        salaryGrowth: 3,
        socAvgGrowth: 3,
        interestRate: 3
    };

    // 清除保存的数据（使用存储模块）
    const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.PENSION_CALCULATOR) || 'pensionCalculator_data';
    if (window.PensionCalculatorStorage && window.PensionCalculatorStorage.clearFormData) {
        window.PensionCalculatorStorage.clearFormData();
    } else if (window.CommonUtils && window.CommonUtils.removeLocalStorageItem) {
        window.CommonUtils.removeLocalStorageItem(STORAGE_KEY);
    } else {
        // 降级处理：如果公共工具库未加载，使用本地实现
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('无法清除 localStorage 数据:', e);
        }
    }
    
    // 重置所有输入值
    const currentAgeEl = document.getElementById('current-age');
    const paidYearsEl = document.getElementById('paid-years');
    const accountBalanceEl = document.getElementById('account-balance');
    const salaryBaseEl = document.getElementById('salary-base');
    const avgSalaryEl = document.getElementById('avg-salary');
    const pastAvgIndexEl = document.getElementById('past-avg-index');
    const futureAvgIndexEl = document.getElementById('avg-index');
    const stopAgeEl = document.getElementById('stop-age');
    const salaryGrowthEl = document.getElementById('salary-growth');
    const socAvgGrowthEl = document.getElementById('soc-avg-growth');
    const interestRateEl = document.getElementById('interest-rate');
    const stopAgeGroupEl = document.getElementById('stop-age-group');
    const resultSectionEl = document.getElementById('result-section');
    const continuousRadio = document.querySelector('input[value="continuous"]');
    const maleRadio = document.querySelector('input[name="gender"][value="male"]');

    if (currentAgeEl) currentAgeEl.value = DEFAULT_VALUES.currentAge;
    if (paidYearsEl) paidYearsEl.value = DEFAULT_VALUES.paidYears;
    if (accountBalanceEl) accountBalanceEl.value = DEFAULT_VALUES.accountBalance;
    if (salaryBaseEl) salaryBaseEl.value = DEFAULT_VALUES.salaryBase;
    if (avgSalaryEl) avgSalaryEl.value = DEFAULT_VALUES.avgSalary;
    if (pastAvgIndexEl) pastAvgIndexEl.value = DEFAULT_VALUES.pastAvgIndex;
    if (futureAvgIndexEl) futureAvgIndexEl.value = '';
    
    const baseChangeModeRadio = document.querySelector(`input[name="base-change-mode"][value="${DEFAULT_VALUES.baseChangeMode}"]`);
    if (baseChangeModeRadio) baseChangeModeRadio.checked = true;
    if (stopAgeEl) stopAgeEl.value = DEFAULT_VALUES.stopAge;
    if (salaryGrowthEl) salaryGrowthEl.value = DEFAULT_VALUES.salaryGrowth;
    if (socAvgGrowthEl) socAvgGrowthEl.value = DEFAULT_VALUES.socAvgGrowth;
    if (interestRateEl) interestRateEl.value = DEFAULT_VALUES.interestRate;
    
    // 重置缴费规划
    if (continuousRadio) continuousRadio.checked = true;
    if (stopAgeGroupEl) stopAgeGroupEl.classList.add('hidden');
    
    // 重置性别
    if (maleRadio) maleRadio.checked = true;

    if (resultSectionEl) resultSectionEl.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
