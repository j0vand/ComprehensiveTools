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

/**
 * 统一的错误处理函数
 * @param {Error|string} error - 错误对象或错误消息
 * @param {string} context - 错误上下文（用于日志）
 * @param {boolean} showToUser - 是否向用户显示错误
 */
function handleError(error, context = '', showToUser = true) {
    // 提取错误消息
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 记录到控制台（用于调试）
    console.error(`[${context}] 错误:`, error);

    // 向用户显示友好的错误提示
    if (showToUser) {
        let userMessage = '操作失败，请稍后重试';

        // 根据错误类型提供更友好的提示
        if (errorMessage.includes('localStorage')) {
            userMessage = '无法保存数据，请检查浏览器设置';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            userMessage = '网络连接失败，请检查网络';
        } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
            userMessage = '数据格式错误，请重新输入';
        } else if (errorMessage.includes('permission')) {
            userMessage = '权限不足，请检查浏览器权限设置';
        } else if (context) {
            userMessage = `${context}失败: ${errorMessage}`;
        }

        showNotification(userMessage, 'error', 5000);
    }

    // 可选：发送错误日志到服务器（未实现）
    // sendErrorLog(error, context);
}

/**
 * 安全执行函数，自动捕获并处理错误
 * @param {Function} fn - 要执行的函数
 * @param {string} context - 上下文描述
 * @param {*} defaultReturn - 发生错误时的默认返回值
 * @returns {*} 函数返回值或默认值
 */
function safeExecute(fn, context = '', defaultReturn = null) {
    try {
        return fn();
    } catch (error) {
        handleError(error, context, true);
        return defaultReturn;
    }
}

/**
 * 安全执行异步函数
 * @param {Function} fn - 要执行的异步函数
 * @param {string} context - 上下文描述
 * @param {*} defaultReturn - 发生错误时的默认返回值
 * @returns {Promise<*>} Promise结果或默认值
 */
async function safeExecuteAsync(fn, context = '', defaultReturn = null) {
    try {
        return await fn();
    } catch (error) {
        handleError(error, context, true);
        return defaultReturn;
    }
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
        showNotification,
        handleError,
        safeExecute,
        safeExecuteAsync
    };
}
