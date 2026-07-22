/**
 * 数据处理模块
 * 负责管理库存数据、分类数据的存储和操作
 */

// 使用统一的存储键名管理，独立命名避免与经典脚本中的全局常量冲突。
const INVENTORY_STORAGE_KEYS = (typeof window !== 'undefined' && window.StorageKeys) ? {
    INVENTORY_ITEMS: window.StorageKeys.INVENTORY_ITEMS,
    CATEGORIES: window.StorageKeys.INVENTORY_CATEGORIES,
    BRANDS: window.StorageKeys.INVENTORY_BRANDS,
    SETTINGS: window.StorageKeys.INVENTORY_SETTINGS,
    HISTORY: window.StorageKeys.INVENTORY_HISTORY,
    SHOPPING_LIST: window.StorageKeys.INVENTORY_SHOPPING_LIST
} : {
    // 降级处理：如果全局 StorageKeys 未加载，使用本地常量
    INVENTORY_ITEMS: 'inventory-items',
    CATEGORIES: 'inventory-categories',
    BRANDS: 'inventory-brands',
    SETTINGS: 'inventory-settings',
    HISTORY: 'inventory-history',
    SHOPPING_LIST: 'inventory-shopping-list'
};

// 默认分类（针对化妆品和护肤品）
const DEFAULT_CATEGORIES = [
    '彩妆', '护肤', '香水', '美发', '美甲', '工具', '其他'
];

// 初始设置
const DEFAULT_SETTINGS = {
    pageSize: 12,
    lowStockThreshold: 3,
    expiryWarningDays: 30,
    defaultView: 'card',
    defaultSort: 'date-desc',
    showExpired: false
};

// 库存模型成功落盘后发布该事件，由页面入口统一刷新摘要和图表。
const INVENTORY_DATA_CHANGED_EVENT = 'inventory-data-changed';

/**
 * 判断值是否为可安全重建的普通对象，拒绝数组和异常原型数据。
 */
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
        Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * 只解析数值本身或完整的十进制数值字符串，拒绝布尔值、数组和隐式类型转换。
 */
function inventoryNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

/**
 * 将库存数值归一为有限非负数，非法值使用同样受控的回退值。
 */
function nonNegativeNumber(value, fallback = 0) {
    const number = inventoryNumber(value);
    if (number !== null && number >= 0) return number;
    const fallbackNumber = inventoryNumber(fallback);
    return fallbackNumber !== null && fallbackNumber >= 0 ? fallbackNumber : 0;
}

/**
 * 只接收持久化文本字段，避免对象在搜索、排序或渲染阶段触发异常。
 */
function inventoryText(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

/**
 * 接收 UUID、数字表格 ID 等可比较标识，拒绝空白、控制字符和超长值。
 */
function inventoryId(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    const id = String(value).trim();
    return id && id.length <= 128 && !/[\u0000-\u001f\u007f]/.test(id) ? id : '';
}

/**
 * 从年月日构造受控日历值；使用 UTC 仅做合法性反校验，不表达业务时区。
 */
function calendarDateFromParts(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const candidate = new Date(0);
    candidate.setUTCHours(0, 0, 0, 0);
    candidate.setUTCFullYear(year, month - 1, day);
    if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 ||
        candidate.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 将本地 Date 转为 YYYY-MM-DD，避免 UTC 序列化令凌晨日期退到前一天。
 */
function localCalendarDate(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
    return calendarDateFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * 归一库存购买日和过期日；日历值只持久化 YYYY-MM-DD，不混入时间戳。
 */
function inventoryCalendarDate(value, fallback = null) {
    if (value instanceof Date) return localCalendarDate(value) || fallback;
    if (typeof value === 'string') {
        const text = value.trim();
        const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
        if (match) {
            return calendarDateFromParts(Number(match[1]), Number(match[2]), Number(match[3])) || fallback;
        }
    }
    return fallback;
}

/**
 * 将受控日历字符串还原为本地午夜，供筛选、过期和先进先出计算使用。
 */
function inventoryCalendarDateObject(value) {
    const normalized = inventoryCalendarDate(value, null);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * 归一创建、更新和历史记录时间；时间戳仍按绝对时间持久化为 ISO 字符串。
 */
function inventoryTimestamp(value, fallback = null) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return fallback;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

/**
 * 重建单个批次，只保留库存业务使用的受控字段。
 */
function normalizeBatch(batch, fallbackPrice = 0, fallbackDate = localCalendarDate()) {
    if (!isPlainObject(batch)) return null;
    const id = inventoryId(batch.id) || Utils.generateUUID();
    const quantity = nonNegativeNumber(batch.quantity);
    const price = nonNegativeNumber(batch.price, fallbackPrice);
    if (!Number.isFinite(quantity * price)) return null;
    return {
        id,
        quantity,
        purchaseDate: inventoryCalendarDate(batch.purchaseDate, fallbackDate),
        expiryDate: inventoryCalendarDate(batch.expiryDate, null),
        price
    };
}

/**
 * 重建商品并以有效批次推导总数量和加权平均价；零数量时回退到商品原价。
 */
function normalizeItem(item, forcedId = null) {
    if (!isPlainObject(item)) return null;
    const name = inventoryText(item.name);
    if (!name) return null;

    const now = new Date().toISOString();
    const today = localCalendarDate();
    const fallbackPrice = nonNegativeNumber(item.price);
    let sourceBatches = Array.isArray(item.batches) ? item.batches : [];
    if (sourceBatches.length === 0) {
        sourceBatches = [{
            quantity: item.quantity,
            price: item.price,
            purchaseDate: item.purchaseDate,
            expiryDate: item.expiryDate
        }];
    }

    const batchIds = new Set();
    const batches = sourceBatches
        .map(batch => normalizeBatch(batch, fallbackPrice, today))
        .filter(Boolean)
        .map(batch => {
            if (batchIds.has(batch.id)) batch.id = Utils.generateUUID();
            batchIds.add(batch.id);
            return batch;
        });
    let quantity = 0;
    let totalValue = 0;
    for (let index = batches.length - 1; index >= 0; index--) {
        const batch = batches[index];
        const nextQuantity = quantity + batch.quantity;
        const nextValue = totalValue + batch.quantity * batch.price;
        if (!Number.isFinite(nextQuantity) || !Number.isFinite(nextValue)) {
            batches.splice(index, 1);
            continue;
        }
        quantity = nextQuantity;
        totalValue = nextValue;
    }
    if (batches.length === 0) {
        batches.push(normalizeBatch({}, fallbackPrice, today));
        quantity = batches[0].quantity;
        totalValue = batches[0].quantity * batches[0].price;
    }
    const id = inventoryId(forcedId) || inventoryId(item.id) || Utils.generateUUID();
    const weightedPrice = quantity > 0 ? totalValue / quantity : fallbackPrice;

    return {
        id,
        name,
        category: inventoryText(item.category, '其他') || '其他',
        brand: inventoryText(item.brand),
        spec: inventoryText(item.spec),
        storage: inventoryText(item.storage),
        remark: inventoryText(item.remark),
        batches,
        quantity,
        price: Number.isFinite(weightedPrice) && weightedPrice >= 0 ? weightedPrice : 0,
        createdAt: inventoryTimestamp(item.createdAt, now),
        updatedAt: inventoryTimestamp(item.updatedAt, now)
    };
}

/**
 * 数据管理类
 */
class DataManager {
    constructor() {
        this.items = [];
        this.categories = [];
        this.brands = [];
        this.settings = { ...DEFAULT_SETTINGS };
        this.history = [];
        this.shoppingList = [];
        
        this.loadAllData();
    }

    /**
     * 加载所有数据
     */
    loadAllData() {
        this.loadItems();
        const categoriesLoaded = this.loadCategories();
        this.loadBrands();
        this.loadSettings();
        this.loadHistory();
        this.loadShoppingList();
        return categoriesLoaded !== false;
    }

    /**
     * 保存所有数据
     */
    saveAllData() {
        return this._persistMutation(
            ['items', 'categories', 'brands', 'settings', 'history', 'shoppingList'],
            () => {}
        );
    }
    
    /**
     * 加载库存商品数据
     */
    loadItems() {
        const savedItems = Utils.getLocalStorageItem(INVENTORY_STORAGE_KEYS.INVENTORY_ITEMS, []);
        const itemIds = new Set();
        this.items = (Array.isArray(savedItems) ? savedItems : [])
            .map(item => normalizeItem(item))
            .filter(Boolean)
            .map(item => {
                if (itemIds.has(item.id)) item.id = Utils.generateUUID();
                itemIds.add(item.id);
                return item;
            });
    }
    
    /**
     * 保存库存商品数据
     */
    saveItems() {
        return this._saveField('items');
    }
    
    /**
     * 加载分类数据
     */
    loadCategories() {
        const savedCategories = Utils.getLocalStorageItem(INVENTORY_STORAGE_KEYS.CATEGORIES, []);
        const categoryIds = new Set();
        const categoryNames = new Set();
        this.categories = (Array.isArray(savedCategories) ? savedCategories : [])
            .filter(isPlainObject)
            .map(category => ({
                id: inventoryId(category.id) || Utils.generateUUID(),
                name: inventoryText(category.name),
                count: 0
            }))
            .filter(category => {
                if (!category.name || categoryNames.has(category.name)) return false;
                if (categoryIds.has(category.id)) category.id = Utils.generateUUID();
                categoryIds.add(category.id);
                categoryNames.add(category.name);
                return true;
            });

        let needsSave = false;
        if (this.categories.length === 0) {
            this.categories = DEFAULT_CATEGORIES.map(name => ({
                id: Utils.generateUUID(),
                name: name,
                count: 0
            }));
            needsSave = true;
        } else if (!categoryNames.has('其他')) {
            this.categories.push({ id: Utils.generateUUID(), name: '其他', count: 0 });
            needsSave = true;
        }

        this._refreshCategoryCounts();
        return needsSave ? this.saveCategories() : true;
    }
    
    /**
     * 保存分类数据
     */
    saveCategories() {
        return this._saveField('categories');
    }
    
    /**
     * 加载品牌数据
     */
    loadBrands() {
        const savedBrands = Utils.getLocalStorageItem(INVENTORY_STORAGE_KEYS.BRANDS, []);
        this.brands = [...new Set(
            (Array.isArray(savedBrands) ? savedBrands : [])
                .map(brand => inventoryText(brand))
                .filter(Boolean)
        )];
    }
    
    /**
     * 保存品牌数据
     */
    saveBrands() {
        return this._saveField('brands');
    }
    
    /**
     * 加载设置数据
     */
    loadSettings() {
        const savedSettings = Utils.getLocalStorageItem(INVENTORY_STORAGE_KEYS.SETTINGS, {});
        const source = isPlainObject(savedSettings) ? savedSettings : {};
        const pageSize = Math.trunc(nonNegativeNumber(source.pageSize, DEFAULT_SETTINGS.pageSize));
        const defaultSorts = ['name', 'date-desc', 'date-asc', 'price-desc', 'price-asc', 'quantity-desc', 'quantity-asc'];
        this.settings = {
            pageSize: pageSize > 0 && pageSize <= 100 ? pageSize : DEFAULT_SETTINGS.pageSize,
            lowStockThreshold: nonNegativeNumber(source.lowStockThreshold, DEFAULT_SETTINGS.lowStockThreshold),
            expiryWarningDays: nonNegativeNumber(source.expiryWarningDays, DEFAULT_SETTINGS.expiryWarningDays),
            defaultView: ['card', 'table'].includes(source.defaultView) ? source.defaultView : DEFAULT_SETTINGS.defaultView,
            defaultSort: defaultSorts.includes(source.defaultSort) ? source.defaultSort : DEFAULT_SETTINGS.defaultSort,
            showExpired: typeof source.showExpired === 'boolean' ? source.showExpired : DEFAULT_SETTINGS.showExpired
        };
    }
    
    /**
     * 保存设置数据
     */
    saveSettings() {
        return this._saveField('settings');
    }
    
    /**
     * 加载历史记录数据
     */
    loadHistory() {
        const savedHistory = Utils.getLocalStorageItem(INVENTORY_STORAGE_KEYS.HISTORY, []);
        this.history = (Array.isArray(savedHistory) ? savedHistory : [])
            .filter(isPlainObject)
            .map(record => ({
                id: inventoryId(record.id) || Utils.generateUUID(),
                type: inventoryText(record.type, 'unknown'),
                itemId: inventoryText(record.itemId),
                itemName: inventoryText(record.itemName),
                details: inventoryText(record.details),
                timestamp: inventoryTimestamp(record.timestamp, new Date().toISOString())
            }))
            .slice(0, 1000);
    }
    
    /**
     * 保存历史记录数据
     */
    saveHistory() {
        return this._saveField('history');
    }
    
    /**
     * 加载购物清单数据
     */
    loadShoppingList() {
        const savedShoppingList = Utils.getLocalStorageItem(INVENTORY_STORAGE_KEYS.SHOPPING_LIST, []);
        this.shoppingList = (Array.isArray(savedShoppingList) ? savedShoppingList : [])
            .filter(isPlainObject)
            .map(entry => ({
                id: inventoryId(entry.id) || Utils.generateUUID(),
                itemId: inventoryId(entry.itemId),
                itemName: inventoryText(entry.itemName),
                reason: inventoryText(entry.reason, '低库存'),
                addedAt: inventoryTimestamp(entry.addedAt, new Date().toISOString()),
                purchased: entry.purchased === true,
                purchasedAt: entry.purchased === true ? inventoryTimestamp(entry.purchasedAt, null) : null
            }))
            .filter(entry => entry.itemId && entry.itemName);
    }
    
    /**
     * 保存购物清单数据
     */
    saveShoppingList() {
        return this._saveField('shoppingList');
    }

    /**
     * 单独保存一个模型字段；失败时统一提示，供兼容旧调用点使用。
     */
    _saveField(field) {
        const storageKeys = {
            items: INVENTORY_STORAGE_KEYS.INVENTORY_ITEMS,
            categories: INVENTORY_STORAGE_KEYS.CATEGORIES,
            brands: INVENTORY_STORAGE_KEYS.BRANDS,
            settings: INVENTORY_STORAGE_KEYS.SETTINGS,
            history: INVENTORY_STORAGE_KEYS.HISTORY,
            shoppingList: INVENTORY_STORAGE_KEYS.SHOPPING_LIST
        };
        const saved = Utils.setLocalStorageItem(storageKeys[field], this[field]);
        if (!saved) {
            Utils.showNotification('保存失败，浏览器存储不可用', 'error');
        } else {
            this._notifyChange([field]);
        }
        return saved;
    }

    /**
     * 发布已持久化字段变更；无事件 API 的测试或降级环境静默跳过。
     */
    _notifyChange(fields) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' ||
            typeof window.CustomEvent !== 'function') return;
        window.dispatchEvent(new window.CustomEvent(INVENTORY_DATA_CHANGED_EVENT, {
            detail: { fields: [...fields] }
        }));
    }

    /**
     * 对跨键业务变更提供事务边界；任一写入失败即恢复内存并回写已成功的键。
     */
    _persistMutation(fields, mutate) {
        const storageKeys = {
            items: INVENTORY_STORAGE_KEYS.INVENTORY_ITEMS,
            categories: INVENTORY_STORAGE_KEYS.CATEGORIES,
            brands: INVENTORY_STORAGE_KEYS.BRANDS,
            settings: INVENTORY_STORAGE_KEYS.SETTINGS,
            history: INVENTORY_STORAGE_KEYS.HISTORY,
            shoppingList: INVENTORY_STORAGE_KEYS.SHOPPING_LIST
        };
        const targets = [...new Set(fields)];
        const before = {};
        targets.forEach(field => {
            before[field] = Utils.deepClone(this[field]);
        });

        try {
            mutate();
            const written = [];
            for (const field of targets) {
                if (!Utils.setLocalStorageItem(storageKeys[field], this[field])) {
                    throw { field, written };
                }
                written.push(field);
            }
            this._notifyChange(targets);
            return true;
        } catch (error) {
            targets.forEach(field => {
                this[field] = Utils.deepClone(before[field]);
            });
            const storageFailure = error && Array.isArray(error.written);
            const written = storageFailure ? error.written : [];
            let compensationFailed = false;
            [...written].reverse().forEach(field => {
                if (!Utils.setLocalStorageItem(storageKeys[field], before[field])) {
                    compensationFailed = true;
                }
            });
            if (compensationFailed) {
                this.loadAllData();
                this._notifyChange(targets);
            }
            if (!storageFailure) {
                console.error('库存变更执行失败:', error);
            }
            Utils.showNotification(
                compensationFailed ? '保存失败且部分回滚未完成，已按实际存储刷新数据' :
                    (storageFailure ? '保存失败，操作已撤销，请检查浏览器存储空间' : '操作失败，变更已撤销'),
                'error'
            );
            return false;
        }
    }

    /**
     * 只更新内存中的分类计数，由外层事务决定何时持久化。
     */
    _refreshCategoryCounts() {
        this.categories.forEach(category => {
            category.count = this.items.filter(item => item.category === category.name).length;
        });
    }

    /**
     * 追加一条受控历史记录，不在内部单独写盘，确保与业务变更同成同败。
     */
    _recordHistory(record) {
        this.history.unshift({
            id: Utils.generateUUID(),
            type: inventoryText(record.type, 'unknown'),
            itemId: inventoryId(record.itemId),
            itemName: inventoryText(record.itemName),
            details: inventoryText(record.details),
            timestamp: new Date().toISOString()
        });
        this.history = this.history.slice(0, 1000);
    }

    /**
     * 更新分类计数
     */
    updateCategoryCounts(save = true) {
        if (!save) {
            this._refreshCategoryCounts();
            return true;
        }
        return this._persistMutation(['categories'], () => this._refreshCategoryCounts());
    }
    
    /**
     * 添加商品
     * @param {Object} item - 商品数据
     * @returns {string} 新商品的ID
     */
    addItem(item) {
        const id = Utils.generateUUID();
        const now = new Date().toISOString();
        const newItem = normalizeItem({ ...item, createdAt: now, updatedAt: now }, id);
        if (!newItem) return null;

        const saved = this._persistMutation(
            ['items', 'history', 'brands', 'categories'],
            () => {
                this.items.push(newItem);
                if (newItem.brand && !this.brands.includes(newItem.brand)) {
                    this.brands.push(newItem.brand);
                }
                if (!this.categories.some(category => category.name === newItem.category)) {
                    this.categories.push({ id: Utils.generateUUID(), name: newItem.category, count: 0 });
                }
                this._recordHistory({
                    type: 'add',
                    itemId: newItem.id,
                    itemName: newItem.name,
                    details: `添加商品 ${newItem.name}，初始数量 ${newItem.quantity}`
                });
                this._refreshCategoryCounts();
            }
        );
        return saved ? id : false;
    }
    
    /**
     * 更新商品
     * @param {string} id - 商品ID
     * @param {Object} updates - 更新的字段
     * @returns {boolean} 是否成功
     */
    updateItem(id, updates) {
        const index = this.items.findIndex(item => item.id === id);
        if (index === -1) return false;

        const oldItem = this.items[index];
        const updatedItem = normalizeItem({
            ...oldItem,
            ...(isPlainObject(updates) ? updates : {}),
            createdAt: oldItem.createdAt,
            updatedAt: new Date().toISOString()
        }, id);
        if (!updatedItem) return false;

        return this._persistMutation(
            ['items', 'history', 'brands', 'categories'],
            () => {
                this.items[index] = updatedItem;
                if (updatedItem.brand && !this.brands.includes(updatedItem.brand)) {
                    this.brands.push(updatedItem.brand);
                }
                if (!this.categories.some(category => category.name === updatedItem.category)) {
                    this.categories.push({ id: Utils.generateUUID(), name: updatedItem.category, count: 0 });
                }
                this._recordHistory({
                    type: 'update',
                    itemId: id,
                    itemName: updatedItem.name,
                    details: `更新商品 ${updatedItem.name} 的信息`
                });
                this._refreshCategoryCounts();
            }
        );
    }
    
    /**
     * 删除商品
     * @param {string} id - 商品ID
     * @returns {boolean} 是否成功
     */
    deleteItem(id) {
        const index = this.items.findIndex(item => item.id === id);
        if (index === -1) return false;

        const deletedItem = this.items[index];
        return this._persistMutation(['items', 'history', 'categories'], () => {
            this.items.splice(index, 1);
            this._recordHistory({
                type: 'delete',
                itemId: id,
                itemName: deletedItem.name,
                details: `删除商品 ${deletedItem.name}`
            });
            this._refreshCategoryCounts();
        });
    }
    
    /**
     * 调整商品数量
     * @param {string} id - 商品ID
     * @param {number} quantityChange - 数量变化值（正数增加，负数减少）
     * @param {string} batchId - 批次ID（可选，如不指定则默认调整最早的批次）
     * @param {string} reason - 调整原因
     * @returns {boolean} 是否成功
     */
    adjustQuantity(id, quantityChange, batchId, reason) {
        const index = this.items.findIndex(item => item.id === id);
        const changeValue = inventoryNumber(quantityChange);
        if (index === -1 || changeValue === null || changeValue === 0) return false;
        if (!Number.isFinite(this.items[index].quantity + changeValue) ||
            this.items[index].quantity + changeValue < 0) return false;
        if (batchId) {
            const batch = this.items[index].batches.find(entry => entry.id === batchId);
            if (!batch || !Number.isFinite(batch.quantity + changeValue) || batch.quantity + changeValue < 0) return false;
        }

        return this._persistMutation(['items', 'history'], () => {
            const item = this.items[index];
            const sortedBatches = [...item.batches].sort((a, b) =>
                inventoryCalendarDateObject(a.purchaseDate) - inventoryCalendarDateObject(b.purchaseDate)
            );
            if (batchId) {
                item.batches.find(batch => batch.id === batchId).quantity += changeValue;
            } else if (changeValue < 0) {
                let remainingChange = changeValue;
                for (const batch of sortedBatches) {
                    if (remainingChange === 0) break;
                    const batchChange = Math.max(-batch.quantity, remainingChange);
                    batch.quantity += batchChange;
                    remainingChange -= batchChange;
                }
            } else {
                sortedBatches[sortedBatches.length - 1].quantity += changeValue;
            }

            item.updatedAt = new Date().toISOString();
            this.items[index] = normalizeItem(item, id);
            this._recordHistory({
                type: 'adjust',
                itemId: id,
                itemName: item.name,
                details: `${changeValue > 0 ? '增加' : '减少'}商品 ${item.name} 数量 ${Math.abs(changeValue)}${reason ? `，原因：${inventoryText(reason)}` : ''}`
            });
        });
    }
    
    /**
     * 添加批次
     * @param {string} itemId - 商品ID
     * @param {Object} batch - 批次数据
     * @returns {boolean} 是否成功
     */
    addBatch(itemId, batch) {
        const index = this.items.findIndex(item => item.id === itemId);
        const newBatch = normalizeBatch(
            { ...(isPlainObject(batch) ? batch : {}), id: Utils.generateUUID() },
            this.items[index] ? this.items[index].price : 0
        );
        if (index === -1 || !newBatch) return false;

        return this._persistMutation(['items', 'history'], () => {
            const item = this.items[index];
            item.batches.push(newBatch);
            item.updatedAt = new Date().toISOString();
            this.items[index] = normalizeItem(item, itemId);
            this._recordHistory({
                type: 'batch-add',
                itemId,
                itemName: item.name,
                details: `为商品 ${item.name} 添加新批次，数量 ${newBatch.quantity}`
            });
        });
    }
    
    /**
     * 更新批次
     * @param {string} itemId - 商品ID
     * @param {string} batchId - 批次ID
     * @param {Object} updates - 更新数据
     * @returns {boolean} 是否成功
     */
    updateBatch(itemId, batchId, updates) {
        const itemIndex = this.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;
        const batchIndex = this.items[itemIndex].batches.findIndex(batch => batch.id === batchId);
        if (batchIndex === -1) return false;
        const updatedBatch = normalizeBatch({
            ...this.items[itemIndex].batches[batchIndex],
            ...(isPlainObject(updates) ? updates : {}),
            id: batchId
        }, this.items[itemIndex].price);
        if (!updatedBatch) return false;

        return this._persistMutation(['items', 'history'], () => {
            const item = this.items[itemIndex];
            item.batches[batchIndex] = updatedBatch;
            item.updatedAt = new Date().toISOString();
            this.items[itemIndex] = normalizeItem(item, itemId);
            this._recordHistory({
                type: 'batch-update',
                itemId,
                itemName: item.name,
                details: `更新商品 ${item.name} 的批次信息`
            });
        });
    }
    
    /**
     * 删除批次
     * @param {string} itemId - 商品ID
     * @param {string} batchId - 批次ID
     * @returns {boolean} 是否成功
     */
    deleteBatch(itemId, batchId) {
        const itemIndex = this.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return false;
        const batchIndex = this.items[itemIndex].batches.findIndex(batch => batch.id === batchId);
        if (batchIndex === -1) return false;
        const deletedBatch = this.items[itemIndex].batches[batchIndex];

        return this._persistMutation(['items', 'history', 'categories'], () => {
            const item = this.items[itemIndex];
            item.batches.splice(batchIndex, 1);
            if (item.batches.length === 0) {
                this.items.splice(itemIndex, 1);
            } else {
                item.updatedAt = new Date().toISOString();
                this.items[itemIndex] = normalizeItem(item, itemId);
            }
            this._recordHistory({
                type: item.batches.length === 0 ? 'delete' : 'batch-delete',
                itemId,
                itemName: item.name,
                details: item.batches.length === 0 ? `删除商品 ${item.name}` :
                    `删除商品 ${item.name} 的一个批次，数量 ${deletedBatch.quantity}`
            });
            this._refreshCategoryCounts();
        });
    }
    
    /**
     * 添加分类
     * @param {string} name - 分类名称
     * @returns {string} 新分类的ID
     */
    addCategory(name) {
        const categoryName = inventoryText(name);
        if (!categoryName || this.categories.some(category => category.name === categoryName)) {
            return null;
        }

        const newCategory = {
            id: Utils.generateUUID(),
            name: categoryName,
            count: 0
        };

        const saved = this._persistMutation(['categories'], () => {
            this.categories.push(newCategory);
        });
        return saved ? newCategory.id : false;
    }
    
    /**
     * 更新分类
     * @param {string} id - 分类ID
     * @param {string} newName - 新名称
     * @returns {boolean} 是否成功
     */
    updateCategory(id, newName) {
        const categoryName = inventoryText(newName);
        if (!categoryName || this.categories.some(category => category.name === categoryName && category.id !== id)) {
            return false;
        }

        const index = this.categories.findIndex(category => category.id === id);
        if (index === -1) return false;
        const oldName = this.categories[index].name;

        return this._persistMutation(['categories', 'items'], () => {
            this.categories[index].name = categoryName;
            this.items.forEach(item => {
                if (item.category === oldName) item.category = categoryName;
            });
            this._refreshCategoryCounts();
        });
    }
    
    /**
     * 删除分类
     * @param {string} id - 分类ID
     * @returns {boolean} 是否成功
     */
    deleteCategory(id) {
        const index = this.categories.findIndex(category => category.id === id);
        if (index === -1) return false;

        const deletedCategory = this.categories[index];

        return this._persistMutation(['categories', 'items'], () => {
            this.categories.splice(index, 1);
            let replacement = this.categories.find(category => category.name === '其他');
            if (!replacement) {
                replacement = { id: Utils.generateUUID(), name: '其他', count: 0 };
                this.categories.push(replacement);
            }
            this.items.forEach(item => {
                if (item.category === deletedCategory.name) item.category = replacement.name;
            });
            this._refreshCategoryCounts();
        });
    }
    
    /**
     * 添加历史记录
     * @param {Object} record - 历史记录数据
     */
    addHistory(record) {
        if (!isPlainObject(record)) return false;
        return this._persistMutation(['history'], () => this._recordHistory(record));
    }
    
    /**
     * 清空历史记录
     */
    clearHistory() {
        return this._persistMutation(['history'], () => {
            this.history = [];
        });
    }
    
    /**
     * 获取所有商品
     * @returns {Array} 商品列表
     */
    getAllItems() {
        return Utils.deepClone(this.items);
    }
    
    /**
     * 获取商品
     * @param {string} id - 商品ID
     * @returns {Object} 商品数据
     */
    getItem(id) {
        const item = this.items.find(item => item.id === id);
        return item ? Utils.deepClone(item) : null;
    }
    
    /**
     * 获取所有分类
     * @returns {Array} 分类列表
     */
    getAllCategories() {
        return Utils.deepClone(this.categories);
    }
    
    /**
     * 获取所有品牌
     * @returns {Array} 品牌列表
     */
    getAllBrands() {
        return Utils.deepClone(this.brands);
    }
    
    /**
     * 获取历史记录
     * @param {number} limit - 限制数量
     * @param {number} offset - 偏移量
     * @returns {Array} 历史记录列表
     */
    getHistory(limit = 50, offset = 0) {
        return Utils.deepClone(this.history.slice(offset, offset + limit));
    }
    
    /**
     * 搜索商品
     * @param {string} query - 搜索关键词
     * @param {Object} filters - 过滤条件
     * @returns {Array} 搜索结果
     */
    searchItems(query, filters = {}) {
        let results = [...this.items];
        
        // 关键词搜索
        if (query) {
            results = results.filter(item => {
                // 匹配名称
                if (Utils.matchByPinyin(query, item.name)) {
                    return true;
                }
                
                // 匹配品牌
                if (item.brand && Utils.matchByPinyin(query, item.brand)) {
                    return true;
                }
                
                // 匹配分类
                if (item.category && Utils.matchByPinyin(query, item.category)) {
                    return true;
                }
                
                // 匹配规格
                if (item.spec && Utils.matchByPinyin(query, item.spec)) {
                    return true;
                }
                
                // 匹配备注
                if (item.remark && Utils.matchByPinyin(query, item.remark)) {
                    return true;
                }
                
                return false;
            });
        }
        
        // 应用过滤条件
        if (filters) {
            // 分类过滤
            if (filters.category) {
                results = results.filter(item => item.category === filters.category);
            }
            
            // 品牌过滤
            if (filters.brand) {
                results = results.filter(item => item.brand === filters.brand);
            }
            
            // 商品名称过滤（支持拼音匹配）
            if (filters.name) {
                results = results.filter(item => {
                    return Utils.matchByPinyin(filters.name, item.name);
                });
            }
            
            // 存放位置过滤（支持拼音匹配）
            if (filters.storage) {
                results = results.filter(item => {
                    if (!item.storage) return false;
                    return Utils.matchByPinyin(filters.storage, item.storage);
                });
            }
            
            // 库存状态过滤
            if (filters.status) {
                const { lowStockThreshold } = this.settings;
                
                switch (filters.status) {
                    case 'in-stock':
                        results = results.filter(item => item.quantity > lowStockThreshold);
                        break;
                    case 'low-stock':
                        results = results.filter(item => item.quantity > 0 && item.quantity <= lowStockThreshold);
                        break;
                    case 'out-stock':
                        results = results.filter(item => item.quantity <= 0);
                        break;
                    case 'need-to-buy': {
                        const pendingIds = new Set(
                            this.shoppingList
                                .filter(e => !e.purchased)
                                .map(e => e.itemId)
                        );
                        results = results.filter(item => pendingIds.has(item.id));
                        break;
                    }
                }
            }
            
            // 价格边界包含等值，非法输入不参与筛选
            const minPrice = Number(filters.minPrice);
            const maxPrice = Number(filters.maxPrice);
            if (filters.minPrice !== undefined && Number.isFinite(minPrice)) {
                results = results.filter(item => item.price >= minPrice);
            }
            if (filters.maxPrice !== undefined && Number.isFinite(maxPrice)) {
                results = results.filter(item => item.price <= maxPrice);
            }

            // 两个过期状态同时勾选时使用并集，并以自然日作为边界
            if (filters.expiringSoon || filters.expired) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const warningDate = new Date(today);
                warningDate.setDate(warningDate.getDate() + this.settings.expiryWarningDays);
                results = results.filter(item => item.batches.some(batch => {
                    if (!batch.expiryDate) return false;
                    const expiryDate = inventoryCalendarDateObject(batch.expiryDate);
                    if (!expiryDate) return false;
                    const expired = filters.expired && expiryDate < today;
                    const expiringSoon = filters.expiringSoon &&
                        expiryDate >= today && expiryDate <= warningDate;
                    return expired || expiringSoon;
                }));
            }

            // 日期输入按本地自然日解析，结束日包含当天 23:59:59.999
            let fromDate = null;
            let toDate = null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate || '')) {
                const [year, month, day] = filters.fromDate.split('-').map(Number);
                const candidate = new Date(year, month - 1, day);
                if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
                    fromDate = candidate;
                }
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(filters.toDate || '')) {
                const [year, month, day] = filters.toDate.split('-').map(Number);
                const candidate = new Date(year, month - 1, day, 23, 59, 59, 999);
                if (candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day) {
                    toDate = candidate;
                }
            }
            if (fromDate || toDate) {
                results = results.filter(item => item.batches.some(batch => {
                    const purchaseDate = inventoryCalendarDateObject(batch.purchaseDate);
                    if (!purchaseDate) return false;
                    return (!fromDate || purchaseDate >= fromDate) && (!toDate || purchaseDate <= toDate);
                }));
            }
        }
        
        return Utils.deepClone(results);
    }
    
    /**
     * 排序商品
     * @param {Array} items - 商品列表
     * @param {string} sortBy - 排序方式
     * @returns {Array} 排序后的商品列表
     */
    sortItems(items, sortBy = 'date-desc') {
        const sortedItems = [...items];
        
        switch (sortBy) {
            case 'name':
                sortedItems.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'date-desc':
                sortedItems.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                break;
            case 'date-asc':
                sortedItems.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
                break;
            case 'price-desc':
                sortedItems.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'price-asc':
                sortedItems.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'quantity-desc':
                sortedItems.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
                break;
            case 'quantity-asc':
                sortedItems.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
                break;
            default:
                sortedItems.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }
        
        return sortedItems;
    }
    
    /**
     * 获取库存统计信息
     * @returns {Object} 统计信息
     */
    getInventoryStats() {
        const totalItems = this.items.length;
        const totalBatches = this.items.reduce((sum, item) => sum + item.batches.length, 0);
        const totalValue = this.items.reduce((sum, item) => {
            const itemValue = item.batches.reduce((batchSum, batch) => {
                const nextValue = batchSum + batch.quantity * batch.price;
                return Number.isFinite(nextValue) ? nextValue : Number.MAX_VALUE;
            }, 0);
            const nextValue = sum + itemValue;
            return Number.isFinite(nextValue) ? nextValue : Number.MAX_VALUE;
        }, 0);
        
        // 状态统计
        const { lowStockThreshold } = this.settings;
        const statusStats = {
            inStock: 0,
            lowStock: 0,
            outStock: 0
        };
        
        this.items.forEach(item => {
            const status = Utils.getItemStatus(item.quantity, lowStockThreshold);
            switch (status) {
                case 'in-stock':
                    statusStats.inStock++;
                    break;
                case 'low-stock':
                    statusStats.lowStock++;
                    break;
                case 'out-stock':
                    statusStats.outStock++;
                    break;
            }
        });
        
        // 分类统计
        const categoryStats = Object.create(null);
        this.categories.forEach(category => {
            categoryStats[category.name] = { quantity: 0, value: 0 };
        });
        
        this.items.forEach(item => {
            const categoryName = item.category || '其他';
            if (!categoryStats[categoryName]) {
                categoryStats[categoryName] = { quantity: 0, value: 0 };
            }

            const itemQuantity = item.quantity;
            const itemValue = (item.batches || []).reduce((batchSum, batch) => {
                const nextValue = batchSum + batch.quantity * batch.price;
                return Number.isFinite(nextValue) ? nextValue : Number.MAX_VALUE;
            }, 0);

            const nextQuantity = categoryStats[categoryName].quantity + itemQuantity;
            const nextValue = categoryStats[categoryName].value + itemValue;
            categoryStats[categoryName].quantity = Number.isFinite(nextQuantity) ? nextQuantity : Number.MAX_VALUE;
            categoryStats[categoryName].value = Number.isFinite(nextValue) ? nextValue : Number.MAX_VALUE;
        });
        
        // 过期统计
        const today = new Date();
        const expiringItems = this.items.filter(item => {
            return item.batches.some(batch => {
                if (!batch.expiryDate) return false;
                const expiryDate = inventoryCalendarDateObject(batch.expiryDate);
                if (!expiryDate) return false;
                const daysToExpiry = Utils.daysBetween(today, expiryDate);
                return daysToExpiry >= 0 && daysToExpiry <= this.settings.expiryWarningDays;
            });
        }).length;
        
        const expiredItems = this.items.filter(item => {
            return item.batches.some(batch => {
                if (!batch.expiryDate) return false;
                const expiryDate = inventoryCalendarDateObject(batch.expiryDate);
                if (!expiryDate) return false;
                return expiryDate < today;
            });
        }).length;
        
        return {
            totalItems,
            totalBatches,
            totalValue,
            statusStats,
            categoryStats,
            expiringItems,
            expiredItems
        };
    }

    /**
     * 原子导入一组已解析商品；按业务身份幂等更新，ID 冲突时保护现有商品。
     */
    importItems(importedItems) {
        if (!Array.isArray(importedItems)) return { success: false, count: 0 };
        const candidates = importedItems
            .filter(isPlainObject)
            .map(item => normalizeItem(item, inventoryId(item.id) || Utils.generateUUID()))
            .filter(Boolean);
        if (candidates.length === 0) return { success: true, count: 0 };

        let importedCount = 0;
        const saved = this._persistMutation(
            ['items', 'categories', 'brands', 'history'],
            () => {
                candidates.forEach(candidate => {
                    const identity = [candidate.name, candidate.category, candidate.brand, candidate.spec, candidate.storage]
                        .map(value => value.toLocaleLowerCase())
                        .join('\u0000');
                    const idIndex = this.items.findIndex(item => item.id === candidate.id);
                    const identityIndex = this.items.findIndex(item =>
                        [item.name, item.category, item.brand, item.spec, item.storage]
                            .map(value => value.toLocaleLowerCase())
                            .join('\u0000') === identity
                    );
                    let targetIndex = identityIndex;

                    if (idIndex !== -1) {
                        const idIdentity = [
                            this.items[idIndex].name,
                            this.items[idIndex].category,
                            this.items[idIndex].brand,
                            this.items[idIndex].spec,
                            this.items[idIndex].storage
                        ].map(value => value.toLocaleLowerCase()).join('\u0000');
                        if (idIdentity === identity) {
                            targetIndex = idIndex;
                        } else if (identityIndex === -1) {
                            candidate.id = Utils.generateUUID();
                            targetIndex = -1;
                        }
                    }

                    if (targetIndex !== -1) {
                        candidate.id = this.items[targetIndex].id;
                        candidate.createdAt = this.items[targetIndex].createdAt;
                        candidate.updatedAt = new Date().toISOString();
                        this.items[targetIndex] = candidate;
                    } else {
                        this.items.push(candidate);
                    }

                    if (!this.categories.some(category => category.name === candidate.category)) {
                        this.categories.push({ id: Utils.generateUUID(), name: candidate.category, count: 0 });
                    }
                    if (candidate.brand && !this.brands.includes(candidate.brand)) {
                        this.brands.push(candidate.brand);
                    }
                    this._recordHistory({
                        type: targetIndex === -1 ? 'add' : 'update',
                        itemId: candidate.id,
                        itemName: candidate.name,
                        details: `导入商品 ${candidate.name}`
                    });
                    importedCount++;
                });
                this._refreshCategoryCounts();
            }
        );
        return { success: saved, count: saved ? importedCount : 0 };
    }
    
    /**
     * 更新设置
     * @param {Object} newSettings - 新设置
     */
    updateSettings(newSettings) {
        if (!isPlainObject(newSettings)) return false;
        const merged = { ...this.settings, ...newSettings };
        const pageSize = Math.trunc(nonNegativeNumber(merged.pageSize, DEFAULT_SETTINGS.pageSize));
        const defaultSorts = ['name', 'date-desc', 'date-asc', 'price-desc', 'price-asc', 'quantity-desc', 'quantity-asc'];
        const nextSettings = {
            pageSize: pageSize > 0 && pageSize <= 100 ? pageSize : DEFAULT_SETTINGS.pageSize,
            lowStockThreshold: nonNegativeNumber(merged.lowStockThreshold, DEFAULT_SETTINGS.lowStockThreshold),
            expiryWarningDays: nonNegativeNumber(merged.expiryWarningDays, DEFAULT_SETTINGS.expiryWarningDays),
            defaultView: ['card', 'table'].includes(merged.defaultView) ? merged.defaultView : DEFAULT_SETTINGS.defaultView,
            defaultSort: defaultSorts.includes(merged.defaultSort) ? merged.defaultSort : DEFAULT_SETTINGS.defaultSort,
            showExpired: typeof merged.showExpired === 'boolean' ? merged.showExpired : DEFAULT_SETTINGS.showExpired
        };
        return this._persistMutation(['settings'], () => {
            this.settings = nextSettings;
        });
    }
    
    /**
     * 获取购物清单
     * @returns {Array} 购物清单
     */
    getShoppingList() {
        return Utils.deepClone(this.shoppingList);
    }
    
    /**
     * 添加商品到购物清单
     * @param {string} itemId - 商品ID
     * @param {string} reason - 添加原因
     * @returns {boolean} 是否成功
     */
    addToShoppingList(itemId, reason = '低库存') {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return false;
        
        // 检查是否已在购物清单中
        if (this.shoppingList.some(entry => entry.itemId === itemId && !entry.purchased)) {
            return null;
        }
        
        const entry = {
            id: Utils.generateUUID(),
            itemId,
            itemName: item.name,
            reason: inventoryText(reason, '低库存'),
            addedAt: new Date().toISOString(),
            purchased: false
        };

        return this._persistMutation(['shoppingList'], () => {
            this.shoppingList.push(entry);
        });
    }
    
    /**
     * 从购物清单移除商品
     * @param {string} entryId - 购物清单条目ID
     * @returns {boolean} 是否成功
     */
    removeFromShoppingList(entryId) {
        const index = this.shoppingList.findIndex(entry => entry.id === entryId);
        if (index === -1) return false;

        return this._persistMutation(['shoppingList'], () => {
            this.shoppingList.splice(index, 1);
        });
    }
    
    /**
     * 标记购物清单项为已购买
     * @param {string} entryId - 购物清单条目ID
     * @returns {boolean} 是否成功
     */
    markShoppingListItemPurchased(entryId) {
        const index = this.shoppingList.findIndex(entry => entry.id === entryId);
        if (index === -1) return false;

        return this._persistMutation(['shoppingList'], () => {
            this.shoppingList[index].purchased = true;
            this.shoppingList[index].purchasedAt = new Date().toISOString();
        });
    }

    /**
     * 批量加入自动生成的待购项，只写一次存储，避免部分成功。
     */
    addGeneratedShoppingList() {
        const pendingIds = new Set(
            this.shoppingList.filter(entry => !entry.purchased).map(entry => entry.itemId)
        );
        const entries = this.generateShoppingList()
            .filter(item => !pendingIds.has(item.itemId))
            .map(item => ({
                id: Utils.generateUUID(),
                itemId: item.itemId,
                itemName: item.itemName,
                reason: item.reason,
                addedAt: new Date().toISOString(),
                purchased: false
            }));
        if (entries.length === 0) return 0;
        const saved = this._persistMutation(['shoppingList'], () => {
            this.shoppingList.push(...entries);
        });
        return saved ? entries.length : false;
    }

    /**
     * 一次性清除全部已购项，写失败时恢复完整清单。
     */
    clearPurchasedShoppingList() {
        const purchasedCount = this.shoppingList.filter(entry => entry.purchased).length;
        if (purchasedCount === 0) return 0;
        const saved = this._persistMutation(['shoppingList'], () => {
            this.shoppingList = this.shoppingList.filter(entry => !entry.purchased);
        });
        return saved ? purchasedCount : false;
    }
    
    /**
     * 自动生成购物清单（低库存和已用完的商品）
     * @returns {Array} 需要购买的商品列表
     */
    generateShoppingList() {
        const { lowStockThreshold } = this.settings;
        const needToBuy = [];
        
        this.items.forEach(item => {
            const status = Utils.getItemStatus(item.quantity, lowStockThreshold);
            
            if (status === 'out-stock') {
                needToBuy.push({
                    itemId: item.id,
                    itemName: item.name,
                    reason: '已用完',
                    priority: 'high'
                });
            } else if (status === 'low-stock') {
                needToBuy.push({
                    itemId: item.id,
                    itemName: item.name,
                    reason: '低库存',
                    priority: 'medium'
                });
            }
        });
        
        return needToBuy;
    }
    
    /**
     * 获取提醒信息
     * @returns {Object} 提醒统计
     */
    getReminders() {
        const today = new Date();
        const warningDays = this.settings.expiryWarningDays || 30;
        const { lowStockThreshold } = this.settings;
        
        const reminders = {
            expiringSoon: [], // 即将过期
            lowStock: [], // 低库存
            outOfStock: [], // 已用完
            needToBuy: [] // 需要购买
        };
        
        this.items.forEach(item => {
            const status = Utils.getItemStatus(item.quantity, lowStockThreshold);
            
            // 检查过期提醒
            item.batches.forEach(batch => {
                if (batch.expiryDate) {
                    const expiryDate = inventoryCalendarDateObject(batch.expiryDate);
                    if (!expiryDate) return;
                    const daysToExpiry = Utils.daysBetween(today, expiryDate);
                    
                    if (daysToExpiry >= 0 && daysToExpiry <= warningDays) {
                        if (!reminders.expiringSoon.find(r => r.itemId === item.id)) {
                            reminders.expiringSoon.push({
                                itemId: item.id,
                                itemName: item.name,
                                daysToExpiry: daysToExpiry,
                                expiryDate: batch.expiryDate
                            });
                        }
                    }
                }
            });
            
            // 库存状态提醒
            if (status === 'out-stock') {
                reminders.outOfStock.push({
                    itemId: item.id,
                    itemName: item.name
                });
                reminders.needToBuy.push({
                    itemId: item.id,
                    itemName: item.name,
                    reason: '已用完'
                });
            } else if (status === 'low-stock') {
                reminders.lowStock.push({
                    itemId: item.id,
                    itemName: item.name,
                    quantity: item.quantity
                });
                reminders.needToBuy.push({
                    itemId: item.id,
                    itemName: item.name,
                    reason: '低库存'
                });
            }
        });
        
        return reminders;
    }
    
    /**
     * 获取快速概览统计
     * @returns {Object} 概览统计
     */
    getQuickOverview() {
        const reminders = this.getReminders();
        const stats = this.getInventoryStats();
        
        // 最近添加的商品（7天内）
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentItems = this.items.filter(item => {
            return new Date(item.createdAt) >= sevenDaysAgo;
        }).length;
        
        return {
            totalItems: stats.totalItems,
            needToBuyCount: reminders.needToBuy.length,
            expiringSoonCount: reminders.expiringSoon.length,
            recentItemsCount: recentItems
        };
    }
}

// 创建全局数据管理器实例
window.InventoryData = new DataManager();
