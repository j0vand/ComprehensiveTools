/**
 * 养老金计算器 - 数据存储模块
 * 负责表单数据的保存和恢复
 */

/**
 * 获取DOM元素的值（从公共工具库或降级处理）
 */
function getElementValue(id, type = 'float', defaultValue = 0) {
    if (window.CommonUtils && window.CommonUtils.getElementValue) {
        return window.CommonUtils.getElementValue(id, type, defaultValue);
    }
    // 降级处理
    const element = document.getElementById(id);
    if (!element || !element.value) return defaultValue;
    return type === 'int' ? parseInt(element.value) || defaultValue : parseFloat(element.value) || defaultValue;
}

/**
 * 获取选中的radio值（从公共工具库或降级处理）
 */
function getRadioValue(name, defaultValue = '') {
    if (window.CommonUtils && window.CommonUtils.getRadioValue) {
        return window.CommonUtils.getRadioValue(name, defaultValue);
    }
    // 降级处理
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : defaultValue;
}

// 表单默认值配置
const DEFAULT_VALUES = {
    currentAge: 30,
    paidYears: 5,
    accountBalance: 20000,
    salaryBase: 8000,
    avgSalary: 8000,
    pastAvgIndex: 1.0,
    futureAvgIndex: null,  // 改为null，表示选填
    baseChangeMode: 'follow_salary',  // 默认跟着工资增长
    stopAge: 50,
    salaryGrowth: 3,
    socAvgGrowth: 3,
    interestRate: 3
};

// 使用统一的存储键名管理
const STORAGE_KEY = (typeof window !== 'undefined' && window.StorageKeys) 
    ? window.StorageKeys.PENSION_CALCULATOR 
    : 'pensionCalculator_data';

/**
 * 保存表单数据到 localStorage
 */
function saveFormData() {
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
        
        // 高级参数
        salaryGrowth: getElementValue('salary-growth', 'float', DEFAULT_VALUES.salaryGrowth),
        socAvgGrowth: getElementValue('soc-avg-growth', 'float', DEFAULT_VALUES.socAvgGrowth),
        interestRate: getElementValue('interest-rate', 'float', DEFAULT_VALUES.interestRate)
    };
    
    // 使用公共工具库的存储函数
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
    // 使用公共工具库的存储函数
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
    
    // 恢复高级参数
    const salaryGrowthEl = document.getElementById('salary-growth');
    if (salaryGrowthEl && formData.salaryGrowth !== undefined) salaryGrowthEl.value = formData.salaryGrowth;
    
    const socAvgGrowthEl = document.getElementById('soc-avg-growth');
    if (socAvgGrowthEl && formData.socAvgGrowth !== undefined) socAvgGrowthEl.value = formData.socAvgGrowth;
    
    const interestRateEl = document.getElementById('interest-rate');
    if (interestRateEl && formData.interestRate !== undefined) interestRateEl.value = formData.interestRate;
}

/**
 * 清除保存的数据
 */
function clearFormData() {
    if (window.CommonUtils && window.CommonUtils.removeLocalStorageItem) {
        window.CommonUtils.removeLocalStorageItem(STORAGE_KEY);
    } else {
        // 降级处理：如果公共工具库未加载，使用本地实现
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('无法清除 localStorage 数据:', e);
        }
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.PensionCalculatorStorage = {
        saveFormData,
        restoreFormData,
        clearFormData,
        DEFAULT_VALUES,
        STORAGE_KEY,
        getElementValue,  // 导出供其他模块使用
        getRadioValue     // 导出供其他模块使用
    };
}
