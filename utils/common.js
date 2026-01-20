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
    if (!element || !element.value) return defaultValue;
    return type === 'int' ? parseInt(element.value) || defaultValue : parseFloat(element.value) || defaultValue;
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
 * 格式化日期为本地字符串
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {object} options - 格式化选项
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date, options = {}) {
    if (!date) return '';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) return '';
    
    const defaultOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    return new Intl.DateTimeFormat('zh-CN', mergedOptions).format(dateObj);
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

/**
 * 显示通知消息（简单的实现，可以后续扩展）
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型：'success', 'error', 'warning', 'info'
 * @param {number} duration - 显示时长（毫秒），默认3000
 */
function showNotification(message, type = 'info', duration = 3000) {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '4px',
        backgroundColor: type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : type === 'warning' ? '#ff9800' : '#2196F3',
        color: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: '10000',
        fontSize: '14px',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    document.body.appendChild(notification);
    
    // 自动移除
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.CommonUtils = {
        getElementValue,
        getRadioValue,
        setText,
        formatMoney,
        formatDate,
        getLocalStorageItem,
        setLocalStorageItem,
        removeLocalStorageItem,
        showNotification
    };
}
