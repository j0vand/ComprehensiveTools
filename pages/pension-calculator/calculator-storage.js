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
 * 写入失败只提示一次：表单每次输入都会保存，反复弹窗会淹没页面。
 * 写入成功后重置，下一次失败仍会提醒用户。
 */
let saveWarningShown = false;

/**
 * 提示存储写入失败。
 * 页面正常加载了 dialog.js 时走统一的 toast（与 FIRE 页同文案）；
 * 缺少对话框模块的环境退化为控制台告警，避免提示本身把保存流程打断。
 */
function notifyStorageFailure(message) {
    if (typeof window !== 'undefined'
        && window.DialogService
        && typeof window.DialogService.showToast === 'function') {
        window.DialogService.showToast(message, 'warning');
        return;
    }
    console.warn(message);
}

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

/** 收集当前表单快照，供草稿与命名方案共用。 */
function collectDraft() {
    return {
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
}

/** 将快照写回表单控件。 */
function applyDraft(formData) {
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
 * 保存表单数据到 localStorage（写入方案容器的草稿）。
 * 失败时告知用户设置不会被记住，而不是静默失败。
 */
function saveFormData() {
    const result = window.FormImportExport.writeDraft(
        STORAGE_KEY,
        collectDraft(),
        window.StorageService
    );
    if (result.ok) {
        saveWarningShown = false;
        return true;
    }
    if (!saveWarningShown) {
        saveWarningShown = true;
        notifyStorageFailure('当前设置无法保存，刷新页面后可能丢失');
    }
    return false;
}

/**
 * 从 localStorage 恢复表单数据
 */
function restoreFormData() {
    const store = window.FormImportExport.readStore(STORAGE_KEY, window.StorageService);
    if (store.draft == null) return;
    applyDraft(store.draft);
}

/**
 * 清除当前草稿并取消当前方案指针，保留已命名方案列表。
 * 失败时明确告知刷新后可能恢复旧草稿。
 */
function clearFormData() {
    const result = window.FormImportExport.clearDraft(
        STORAGE_KEY,
        window.StorageService
    );
    if (result.ok) return true;

    notifyStorageFailure('表单已重置，但旧设置未能从浏览器存储中清除');
    return false;
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.PensionCalculatorStorage = {
        collectDraft,
        applyDraft,
        saveFormData,
        restoreFormData,
        clearFormData,
        DEFAULT_VALUES,
        STORAGE_KEY
    };
}
