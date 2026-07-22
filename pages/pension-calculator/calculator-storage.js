/**
 * 养老金计算器 - 数据存储模块
 * 负责表单数据的保存和恢复
 */

/** 养老金表单的页面默认值。 */
const DEFAULT_VALUES = {
    currentAge: 30,
    retireAge: 63,
    paidYears: 5,
    accountBalance: 20000,
    salaryBase: 8000,
    avgSalary: 8000,
    pastAvgIndex: 1.0,
    baseChangeMode: 'follow_salary',
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
 * 获取输入框当前数值，空白或非法内容保存为null。
 */
function getRawValue(id) {
    const element = document.getElementById(id);
    if (!element) return null;
    const value = element.value.trim();
    if (value === '') return null;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
}

/**
 * 仅恢复当前版本保存的有限数值；null表示用户主动清空。
 */
function restoreNumericValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    if (value === undefined) return;
    if (value === null) {
        element.value = '';
        return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) element.value = value;
}

/**
 * 保存表单数据到 localStorage
 */
function saveFormData() {
    const formData = {
        // 基本信息
        gender: window.CommonUtils.getRadioValue('gender', 'male'),
        currentAge: getRawValue('current-age'),
        retireAge: getRawValue('retire-age'),
        avgSalary: getRawValue('avg-salary'),

        // 缴费详情
        paidYears: getRawValue('paid-years'),
        accountBalance: getRawValue('account-balance'),
        salaryBase: getRawValue('salary-base'),
        pastAvgIndex: getRawValue('past-avg-index'),
        futureAvgIndex: getRawValue('avg-index'),
        baseChangeMode: window.CommonUtils.getRadioValue('base-change-mode', DEFAULT_VALUES.baseChangeMode),
        paymentPlan: window.CommonUtils.getRadioValue('payment-plan', 'continuous'),
        stopAge: getRawValue('stop-age'),

        // 高级参数（保存原始值，允许null表示用户清空，0表示用户输入0）
        salaryGrowth: getRawValue('salary-growth'),
        socAvgGrowth: getRawValue('soc-avg-growth'),
        interestRate: getRawValue('interest-rate')
    };
    
    const result = window.StorageService.setJson(STORAGE_KEY, formData);
    if (!result.ok) {
        console.warn('无法保存数据到 localStorage:', result.error);
    }
}

/**
 * 从 localStorage 恢复表单数据
 */
function restoreFormData() {
    const formData = window.StorageService.getJson(STORAGE_KEY, null);
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return;
    
    // 恢复基本信息
    if (['male', 'female_worker'].includes(formData.gender)) {
        const genderRadio = Array.from(document.querySelectorAll('input[name="gender"]'))
            .find(radio => radio.value === formData.gender);
        if (genderRadio) genderRadio.checked = true;
    }
    
    restoreNumericValue('current-age', formData.currentAge);
    restoreNumericValue('retire-age', formData.retireAge);
    restoreNumericValue('avg-salary', formData.avgSalary);

    // 恢复缴费详情
    restoreNumericValue('paid-years', formData.paidYears);
    restoreNumericValue('account-balance', formData.accountBalance);
    restoreNumericValue('salary-base', formData.salaryBase);
    restoreNumericValue('past-avg-index', formData.pastAvgIndex);
    restoreNumericValue('avg-index', formData.futureAvgIndex);
    
    if (['follow_salary', 'fixed'].includes(formData.baseChangeMode)) {
        const baseChangeModeRadio = Array.from(document.querySelectorAll('input[name="base-change-mode"]'))
            .find(radio => radio.value === formData.baseChangeMode);
        if (baseChangeModeRadio) baseChangeModeRadio.checked = true;
    }
    
    if (['continuous', 'stop_early'].includes(formData.paymentPlan)) {
        const paymentPlanRadio = Array.from(document.querySelectorAll('input[name="payment-plan"]'))
            .find(radio => radio.value === formData.paymentPlan);
        if (paymentPlanRadio) paymentPlanRadio.checked = true;
    }
    
    restoreNumericValue('stop-age', formData.stopAge);
    restoreNumericValue('salary-growth', formData.salaryGrowth);
    restoreNumericValue('soc-avg-growth', formData.socAvgGrowth);
    restoreNumericValue('interest-rate', formData.interestRate);
}

/**
 * 清除保存的数据
 */
function clearFormData() {
    const result = window.StorageService.remove(STORAGE_KEY);
    if (!result.ok) {
        console.warn('无法清除 localStorage 数据:', result.error);
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.PensionCalculatorStorage = {
        saveFormData,
        restoreFormData,
        clearFormData,
        DEFAULT_VALUES,
        STORAGE_KEY
    };
}
