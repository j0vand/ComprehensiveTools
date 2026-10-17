/**
 * FIRE 退休规划器 - 数据存储模块
 */

// 单位调整后只恢复当前表单格式，旧格式直接忽略。
// v2：医疗备用金展示单位由千元改为万元。
const STORAGE_VERSION = 2;
const STORAGE_KEY = window.StorageKeys.RETIREMENT_CALCULATOR;
let saveWarningShown = false;

function getFormRoot() {
    return document.getElementById('fire-form');
}

/** 收集可写入草稿/方案的快照。 */
function collectDraft() {
    const formData = window.FormImportExport.collectFormData(getFormRoot());
    return {
        version: STORAGE_VERSION,
        fields: formData.fields
    };
}

/** 应用草稿快照到表单。 */
function applyDraft(formData) {
    if (!formData || formData.version !== STORAGE_VERSION
        || !formData.fields || typeof formData.fields !== 'object' || Array.isArray(formData.fields)) {
        return false;
    }
    window.FormImportExport.applyFormData(getFormRoot(), formData);
    return true;
}

/** 生成可读的校验失败提示，尽量指出具体字段。 */
function describeInvalidField(form) {
    let fieldLabel = '';
    if (typeof form.querySelector === 'function') {
        const invalidControl = form.querySelector(':invalid');
        const label = invalidControl && invalidControl.labels && invalidControl.labels[0];
        if (label) fieldLabel = label.textContent.trim();
    }
    return fieldLabel
        ? '「' + fieldLabel + '」未填写或超出范围，请修正后再保存方案'
        : '表单中有未填写或超出范围的数值，请修正后再保存方案';
}

/**
 * 保存方案前先校验表单：加载路径会做严格校验，
 * 不合法快照一旦写入方案列表，该方案将永久无法加载。
 * 校验失败时抛出 message 可读的 Error，由保存流程提示用户。
 */
function collectValidatedDraft() {
    const form = getFormRoot();
    if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) {
        throw new Error(describeInvalidField(form));
    }
    return collectDraft();
}

/** 保存表单原始展示值，单位换算仅发生在计算入口。 */
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
        window.DialogService.showToast('当前设置无法保存，刷新页面后可能丢失', 'warning');
    }
    return false;
}

/** 仅恢复当前版本且符合页面约束的表单快照。 */
function restoreFormData() {
    const store = window.FormImportExport.readStore(STORAGE_KEY, window.StorageService);
    if (store.draft == null) return;

    try {
        if (!applyDraft(store.draft)) return;
    } catch (error) {
        console.warn('忽略无效的 FIRE 表单存储:', error);
    }
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

    window.DialogService.showToast('表单已重置，但旧设置未能从浏览器存储中清除', 'warning');
    return false;
}

window.retirementCalculatorStorage = {
    STORAGE_KEY,
    collectDraft,
    collectValidatedDraft,
    applyDraft,
    saveFormData,
    restoreFormData,
    clearFormData
};
