/**
 * 工具函数库
 * 包含常用的辅助函数，如日期格式化、通知显示、数据验证等
 */

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
 * 计算两个日期之间的天数差
 * @param {Date|string} date1 - 第一个日期
 * @param {Date|string} date2 - 第二个日期
 * @returns {number} 天数差
 */
function daysBetween(date1, date2) {
    if (!date1 || !date2) return 0;
    
    const d1 = date1 instanceof Date ? date1 : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    
    // 将时间部分重置为午夜，避免夏令时和时区问题
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.floor((utc2 - utc1) / MS_PER_DAY);
}

/**
 * 格式化价格
 * @param {number} price - 价格
 * @param {string} currency - 货币符号，默认为人民币(¥)
 * @returns {string} 格式化后的价格
 */
function formatPrice(price, currency = '¥') {
    if (price === undefined || price === null || isNaN(parseFloat(price))) {
        return `${currency}0.00`;
    }
    
    return `${currency}${parseFloat(price).toFixed(2)}`;
}

/**
 * 截断文本并添加省略号
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 处理后的文本
 */
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 计算百分比
 * @param {number} part - 部分值
 * @param {number} total - 总值
 * @returns {number} 百分比值(0-100)
 */
function calculatePercentage(part, total) {
    if (!total || isNaN(total) || total === 0) return 0;
    return Math.min(100, Math.max(0, (part / total) * 100));
}

/**
 * 生成UUID
 * @returns {string} UUID字符串
 */
function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

/**
 * 获取商品状态
 * @param {number} quantity - 当前数量
 * @param {number} threshold - 低库存阈值
 * @returns {string} 状态标识：'out-stock', 'low-stock', 'in-stock'
 */
function getItemStatus(quantity, threshold = 2) {
    if (quantity <= 0) return 'out-stock';
    if (quantity <= threshold) return 'low-stock';
    return 'in-stock';
}

/**
 * 获取状态文本
 * @param {string} status - 状态标识
 * @returns {string} 状态中文文本
 */
function getStatusText(status) {
    const statusMap = {
        'out-stock': '已用完',
        'low-stock': '低库存',
        'in-stock': '充足',
        'expiring': '即将过期'
    };
    
    return statusMap[status] || '未知';
}

/**
 * 获取类名列表的字符串
 * @param {object} classObj - 类名对象，键为类名，值为布尔值表示是否包含该类
 * @returns {string} 类名字符串
 */
function classNames(classObj) {
    return Object.entries(classObj)
        .filter(([_, include]) => include)
        .map(([className]) => className)
        .join(' ');
}

/**
 * 显示通知信息
 * @param {string} message - 通知内容
 * @param {string} type - 通知类型：'success', 'warning', 'error', 'info'
 * @param {number} duration - 显示时间（毫秒）
 */
function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('alertContainer');
    if (!container) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    // 图标映射
    const icons = {
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'info': 'ℹ️'
    };
    
    alert.innerHTML = `
        <span class="alert-icon">${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(alert);
    
    // 添加动画效果
    setTimeout(() => {
        alert.style.opacity = '1';
    }, 10);
    
    // 自动移除
    setTimeout(() => {
        alert.style.opacity = '0';
        setTimeout(() => {
            container.removeChild(alert);
        }, 300);
    }, duration);
}

/**
 * 深拷贝对象
 * @param {*} obj - 要拷贝的对象
 * @returns {*} 拷贝后的新对象
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (obj instanceof Object) {
        const copy = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }
    
    return obj;
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖处理后的函数
 */
function debounce(func, wait = 300) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Function} 节流处理后的函数
 */
function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

/**
 * 将驼峰命名转换为短横线命名
 * @param {string} str - 驼峰命名的字符串
 * @returns {string} 短横线命名的字符串
 */
function camelToKebab(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 将短横线命名转换为驼峰命名
 * @param {string} str - 短横线命名的字符串
 * @returns {string} 驼峰命名的字符串
 */
function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
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
 * 将数组按指定属性分组
 * @param {Array} array - 要分组的数组
 * @param {string|Function} key - 分组依据的属性或函数
 * @returns {Object} 分组后的对象
 */
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!result[groupKey]) {
            result[groupKey] = [];
        }
        result[groupKey].push(item);
        return result;
    }, {});
}

/**
 * 根据拼音首字母搜索
 * @param {string} searchText - 搜索文本
 * @param {string} targetText - 目标文本
 * @returns {boolean} 是否匹配
 */
function matchByPinyin(searchText, targetText) {
    if (!searchText || !targetText) return false;
    
    // 直接文本匹配
    if (targetText.toLowerCase().includes(searchText.toLowerCase())) {
        return true;
    }
    
    try {
        // 使用pinyin-pro库进行拼音匹配
        if (typeof pinyinPro !== 'undefined') {
            // 获取拼音首字母
            const pinyinInitials = pinyinPro.pinyin(targetText, { toneType: 'none', type: 'first' }).join('');
            // 匹配拼音首字母
            return pinyinInitials.toLowerCase().includes(searchText.toLowerCase());
        }
    } catch (e) {
        console.error('拼音匹配失败:', e);
    }
    
    return false;
}

/**
 * 比较两个对象是否相等
 * @param {Object} obj1 - 第一个对象
 * @param {Object} obj2 - 第二个对象
 * @returns {boolean} 是否相等
 */
function isEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 === null || obj2 === null) return false;
    
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        
        const val1 = obj1[key];
        const val2 = obj2[key];
        
        if (typeof val1 === 'object' && typeof val2 === 'object') {
            if (!isEqual(val1, val2)) return false;
        } else if (val1 !== val2) {
            return false;
        }
    }
    
    return true;
}

/**
 * 初始化暗色模式
 */
function initDarkMode() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    // 检查用户偏好
    const savedTheme = localStorage.getItem('inventory-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 应用主题
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    } else if (prefersDark) {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.setAttribute('data-theme', 'light');
    }
    
    // 主题切换事件
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('inventory-theme', newTheme);
        
        // 如果存在图表，更新图表主题
        if (typeof updateChartsTheme === 'function') {
            updateChartsTheme();
        }
    });
}

/**
 * 是否为移动设备
 * @returns {boolean}
 */
function isMobileDevice() {
    return (window.innerWidth <= 768) || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * 校验表单数据
 * @param {Object} data - 表单数据
 * @param {Object} rules - 验证规则
 * @returns {Object} 验证结果，包含isValid和errors
 */
function validateForm(data, rules) {
    const result = {
        isValid: true,
        errors: {}
    };
    
    for (const field in rules) {
        if (rules.hasOwnProperty(field)) {
            const fieldRules = rules[field];
            const value = data[field];
            
            // 必填验证
            if (fieldRules.required && (value === undefined || value === null || value === '')) {
                result.isValid = false;
                result.errors[field] = '该字段不能为空';
                continue;
            }
            
            // 如果值为空且不是必填，跳过其他验证
            if (value === undefined || value === null || value === '') {
                continue;
            }
            
            // 最小值验证
            if (fieldRules.min !== undefined && Number(value) < fieldRules.min) {
                result.isValid = false;
                result.errors[field] = `数值不能小于 ${fieldRules.min}`;
                continue;
            }
            
            // 最大值验证
            if (fieldRules.max !== undefined && Number(value) > fieldRules.max) {
                result.isValid = false;
                result.errors[field] = `数值不能大于 ${fieldRules.max}`;
                continue;
            }
            
            // 最小长度验证
            if (fieldRules.minLength !== undefined && String(value).length < fieldRules.minLength) {
                result.isValid = false;
                result.errors[field] = `长度不能少于 ${fieldRules.minLength} 个字符`;
                continue;
            }
            
            // 最大长度验证
            if (fieldRules.maxLength !== undefined && String(value).length > fieldRules.maxLength) {
                result.isValid = false;
                result.errors[field] = `长度不能超过 ${fieldRules.maxLength} 个字符`;
                continue;
            }
            
            // 正则表达式验证
            if (fieldRules.pattern && !fieldRules.pattern.test(String(value))) {
                result.isValid = false;
                result.errors[field] = fieldRules.message || '格式不正确';
                continue;
            }
            
            // 自定义验证函数
            if (typeof fieldRules.validator === 'function') {
                const validatorResult = fieldRules.validator(value, data);
                if (validatorResult !== true) {
                    result.isValid = false;
                    result.errors[field] = validatorResult || '验证失败';
                    continue;
                }
            }
        }
    }
    
    return result;
}

// 导出工具函数
window.Utils = {
    formatDate,
    daysBetween,
    formatPrice,
    truncateText,
    calculatePercentage,
    generateUUID,
    getItemStatus,
    getStatusText,
    classNames,
    showNotification,
    deepClone,
    debounce,
    throttle,
    camelToKebab,
    kebabToCamel,
    getLocalStorageItem,
    setLocalStorageItem,
    groupBy,
    matchByPinyin,
    isEqual,
    initDarkMode,
    isMobileDevice,
    validateForm
}; 