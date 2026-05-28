/**
 * FIRE 退休规划器 - 数据存储模块
 * 负责表单数据的保存和恢复
 */

function getElementValue(id, type = 'float', defaultValue = 0) {
    if (window.CommonUtils && window.CommonUtils.getElementValue) {
        return window.CommonUtils.getElementValue(id, type, defaultValue);
    }
    const el = document.getElementById(id);
    if (!el) return defaultValue;
    const v = el.value.trim();
    if (v === '') return defaultValue;
    const parsed = type === 'int' ? parseInt(v) : parseFloat(v);
    return isNaN(parsed) ? defaultValue : parsed;
}

function getRadioValue(name, defaultValue = '') {
    if (window.CommonUtils && window.CommonUtils.getRadioValue) {
        return window.CommonUtils.getRadioValue(name, defaultValue);
    }
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : defaultValue;
}

function getRawIntValue(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = el.value.trim();
    if (v === '') return null;
    const parsed = parseInt(v);
    return isNaN(parsed) ? null : parsed;
}

const STORAGE_KEY = (typeof window !== 'undefined' && window.StorageKeys)
    ? window.StorageKeys.RETIREMENT_CALCULATOR
    : 'retirementCalculator_data';

/**
 * 保存表单数据到 localStorage
 */
function saveFormData() {
    const formData = {
        currentAge: getElementValue('current-age', 'int', 30),
        lifeExpectancy: getElementValue('life-expectancy', 'int', 85),
        gender: getRadioValue('gender', 'male'),
        currentAssets: getElementValue('current-assets', 'float', 0),
        annualSavings: getElementValue('annual-savings', 'float', 0),
        monthlyExpense: getElementValue('monthly-expense', 'float', 0),
        medicalMonthlyExpense: getElementValue('medical-monthly-expense', 'float', 1200),
        medicalReserve: getElementValue('medical-reserve', 'float', 0),
        targetRetireAge: getRawIntValue('target-retire-age'),
        extraSavingYearsAfterFire: getElementValue('extra-saving-years-after-fire', 'int', 0),
        expectedPension: getElementValue('expected-pension', 'float', 0),
        pensionAge: getElementValue('pension-age', 'int', 63),
        inflationRate: getElementValue('inflation-rate', 'float', 3),
        investmentReturn: getElementValue('investment-return', 'float', 1.5),
        pensionGrowthRate: getElementValue('pension-growth-rate', 'float', 0)
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

    if (!formData) return;

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value !== undefined) el.value = value;
    };

    setValue('current-age', formData.currentAge);
    setValue('life-expectancy', formData.lifeExpectancy);
    setValue('current-assets', formData.currentAssets);
    setValue('annual-savings', formData.annualSavings);
    setValue('monthly-expense', formData.monthlyExpense);
    setValue('medical-monthly-expense', formData.medicalMonthlyExpense);
    setValue('medical-reserve', formData.medicalReserve);
    if (formData.targetRetireAge === null || formData.targetRetireAge === undefined) {
        const targetEl = document.getElementById('target-retire-age');
        if (targetEl) targetEl.value = '';
    } else {
        setValue('target-retire-age', formData.targetRetireAge);
    }
    setValue('extra-saving-years-after-fire', formData.extraSavingYearsAfterFire);
    setValue('expected-pension', formData.expectedPension);
    setValue('pension-age', formData.pensionAge);
    setValue('inflation-rate', formData.inflationRate);
    setValue('investment-return', formData.investmentReturn);
    setValue('pension-growth-rate', formData.pensionGrowthRate);

    const genderRadio = document.querySelector(`input[name="gender"][value="${formData.gender}"]`);
    if (genderRadio) genderRadio.checked = true;
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

if (typeof window !== 'undefined') {
    window.retirementCalculatorStorage = {
        saveFormData,
        restoreFormData,
        clearFormData
    };
}
