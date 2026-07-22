/**
 * FIRE 退休规划器 - 数据存储模块
 */

// 单位调整后只恢复当前表单格式，旧格式直接忽略。
// v2：医疗备用金展示单位由千元改为万元。
const STORAGE_VERSION = 2;
const STORAGE_KEY = window.StorageKeys.RETIREMENT_CALCULATOR;
let saveWarningShown = false;

/** 保存表单原始展示值，单位换算仅发生在计算入口。 */
function saveFormData() {
    const formData = window.FormImportExport.collectFormData(document.getElementById('fire-form'));
    const result = window.StorageService.setJson(STORAGE_KEY, {
        version: STORAGE_VERSION,
        fields: formData.fields
    });

    if (result.ok) {
        saveWarningShown = false;
        return true;
    }
    if (!saveWarningShown) {
        saveWarningShown = true;
        window.DialogService.showToast('当前设置无法保存，刷新页面后可能丢失', 'warning');
    }
    return false;
}

/** 仅恢复当前版本且符合页面约束的表单快照。 */
function restoreFormData() {
    const formData = window.StorageService.getJson(STORAGE_KEY, null);
    if (!formData || formData.version !== STORAGE_VERSION
        || !formData.fields || typeof formData.fields !== 'object' || Array.isArray(formData.fields)) {
        return;
    }

    try {
        window.FormImportExport.applyFormData(document.getElementById('fire-form'), formData);
    } catch (error) {
        console.warn('忽略无效的 FIRE 表单存储:', error);
    }
}

/** 清除持久化表单；失败时明确告知刷新后可能恢复旧值。 */
function clearFormData() {
    const result = window.StorageService.remove(STORAGE_KEY);
    if (result.ok) return true;

    window.DialogService.showToast('表单已重置，但旧设置未能从浏览器存储中清除', 'warning');
    return false;
}

window.retirementCalculatorStorage = {
    saveFormData,
    restoreFormData,
    clearFormData
};
