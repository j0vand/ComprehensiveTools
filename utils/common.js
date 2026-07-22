/**
 * 公共工具函数库
 * 包含通用的DOM操作、格式化、存储等函数
 */

/**
 * 获取DOM元素的值
 * @param {string} id - 元素ID
 * @param {string} type - 值类型：'int' 或 'float'
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的值或默认值
 */
function getElementValue(id, type = 'float', defaultValue = 0) {
    const element = document.getElementById(id);
    if (!element) return defaultValue;

    const value = element.value.trim();
    if (value === '') return defaultValue;

    const parsedValue = type === 'int' ? parseInt(value) : parseFloat(value);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
}

/**
 * 获取选中的radio按钮值
 * @param {string} name - radio按钮的name属性
 * @param {*} defaultValue - 默认值
 * @returns {*} 选中的值或默认值
 */
function getRadioValue(name, defaultValue = '') {
    const radio = document.querySelector(`input[name="${name}"]:checked`);
    return radio ? radio.value : defaultValue;
}

/**
 * 设置元素的文本内容
 * @param {string} id - 元素ID
 * @param {*} value - 要设置的值
 */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/**
 * 格式化金额（人民币格式）
 * @param {number} num - 金额数值
 * @returns {string} 格式化后的金额字符串
 */
function formatMoney(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0.00';
    }
    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * 安全获取本地存储中的JSON数据
 * @param {string} key - 存储键名
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的数据或默认值
 */
function getLocalStorageItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (e) {
        console.error(`Error getting localStorage item ${key}:`, e);
        return defaultValue;
    }
}

/**
 * 安全设置本地存储中的JSON数据
 * @param {string} key - 存储键名
 * @param {*} value - 要存储的数据
 * @returns {boolean} 是否成功
 */
function setLocalStorageItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Error setting localStorage item ${key}:`, e);
        return false;
    }
}

/**
 * 安全删除本地存储中的数据
 * @param {string} key - 存储键名
 * @returns {boolean} 是否成功
 */
function removeLocalStorageItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error(`Error removing localStorage item ${key}:`, e);
        return false;
    }
}

/** 维持页面原有通知调用签名，实际展示统一交给对话框服务。 */
function showNotification(message, type = 'info', duration = 3000) {
    if (typeof window !== 'undefined'
        && window.DialogService
        && typeof window.DialogService.showToast === 'function') {
        return window.DialogService.showToast(message, type, { duration });
    }
    console.error(message);
    return null;
}

/**
 * 增强 number 输入在移动端的键盘体验
 * - 整数输入使用 numeric
 * - 小数输入使用 decimal
 */
function enhanceNumberInputMode() {
    if (typeof document === 'undefined') return;
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        if (input.getAttribute('inputmode')) return;
        const step = input.getAttribute('step');
        const useDecimal = step === 'any' || (step && step !== '1');
        input.setAttribute('inputmode', useDecimal ? 'decimal' : 'numeric');
    });
}

/**
 * 自动关联未绑定 for 的 label 与输入控件
 * 兼容旧页面结构，提升点击标签聚焦与读屏体验
 */
function enhanceLabelAssociations() {
    if (typeof document === 'undefined') return;

    const labels = document.querySelectorAll('label:not([for])');
    labels.forEach((label, index) => {
        if (label.querySelector('input, select, textarea')) return;

        const container = label.parentElement;
        if (!container) return;
        const control = container.querySelector('input:not([type="hidden"]), select, textarea');
        if (!control) return;

        if (!control.id) {
            control.id = `auto-field-${index}`;
        }
        label.setAttribute('for', control.id);
    });
}

/**
 * 注入统一焦点可视化样式，避免页面禁用 outline 后不可聚焦
 */
function injectGlobalFocusVisibleStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('common-focus-visible-style')) return;

    const style = document.createElement('style');
    style.id = 'common-focus-visible-style';
    style.textContent = `
        :where(button, [type="button"], [type="submit"], [type="reset"], a, input, select, textarea):focus-visible {
            outline: 2px solid #1976d2 !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.2) !important;
        }
    `;
    document.head.appendChild(style);
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            enhanceNumberInputMode();
            enhanceLabelAssociations();
            injectGlobalFocusVisibleStyle();
        }, { once: true });
    } else {
        enhanceNumberInputMode();
        enhanceLabelAssociations();
        injectGlobalFocusVisibleStyle();
    }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.CommonUtils = {
        getElementValue,
        getRadioValue,
        setText,
        formatMoney,
        getLocalStorageItem,
        setLocalStorageItem,
        removeLocalStorageItem,
        showNotification,
        enhanceNumberInputMode,
        enhanceLabelAssociations,
        injectGlobalFocusVisibleStyle
    };
}
