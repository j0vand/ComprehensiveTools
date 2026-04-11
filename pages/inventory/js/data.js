/**
 * 数据处理模块
 * 负责管理库存数据、分类数据的存储和操作
 */

// 存储键名常量
const STORAGE_KEYS = {
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
        this.loadCategories();
        this.loadBrands();
        this.loadSettings();
        this.loadHistory();
        this.loadShoppingList();
    }
    
    /**
     * 保存所有数据
     */
    saveAllData() {
        this.saveItems();
        this.saveCategories();
        this.saveBrands();
        this.saveSettings();
        this.saveHistory();
        this.saveShoppingList();
    }
    
    /**
     * 加载库存商品数据
     */
    loadItems() {
        this.items = Utils.getLocalStorageItem(STORAGE_KEYS.INVENTORY_ITEMS, []);
        
        // 确保所有必要字段都存在
        this.items.forEach(item => {
            if (!item.id) {
                item.id = Utils.generateUUID();
            }
            
            if (!item.batches) {
                item.batches = [{
                    id: Utils.generateUUID(),
                    quantity: item.quantity || 0,
                    purchaseDate: item.purchaseDate || new Date().toISOString(),
                    expiryDate: item.expiryDate || null,
                    price: item.price || 0
                }];
            }
            
            // 计算总数量
            item.quantity = item.batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
        });
    }
    
    /**
     * 保存库存商品数据
     */
    saveItems() {
        Utils.setLocalStorageItem(STORAGE_KEYS.INVENTORY_ITEMS, this.items);
    }
    
    /**
     * 加载分类数据
     */
    loadCategories() {
        this.categories = Utils.getLocalStorageItem(STORAGE_KEYS.CATEGORIES, []);
        
        // 如果没有分类数据，初始化默认分类
        if (this.categories.length === 0) {
            this.categories = DEFAULT_CATEGORIES.map(name => ({
                id: Utils.generateUUID(),
                name: name,
                count: 0
            }));
            this.saveCategories();
        }
        
        // 更新每个分类的数量统计
        this.updateCategoryCounts();
    }
    
    /**
     * 保存分类数据
     */
    saveCategories() {
        Utils.setLocalStorageItem(STORAGE_KEYS.CATEGORIES, this.categories);
    }
    
    /**
     * 加载品牌数据
     */
    loadBrands() {
        this.brands = Utils.getLocalStorageItem(STORAGE_KEYS.BRANDS, []);
    }
    
    /**
     * 保存品牌数据
     */
    saveBrands() {
        Utils.setLocalStorageItem(STORAGE_KEYS.BRANDS, this.brands);
    }
    
    /**
     * 加载设置数据
     */
    loadSettings() {
        const savedSettings = Utils.getLocalStorageItem(STORAGE_KEYS.SETTINGS, {});
        this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
    }
    
    /**
     * 保存设置数据
     */
    saveSettings() {
        Utils.setLocalStorageItem(STORAGE_KEYS.SETTINGS, this.settings);
    }
    
    /**
     * 加载历史记录数据
     */
    loadHistory() {
        this.history = Utils.getLocalStorageItem(STORAGE_KEYS.HISTORY, []);
    }
    
    /**
     * 保存历史记录数据
     */
    saveHistory() {
        Utils.setLocalStorageItem(STORAGE_KEYS.HISTORY, this.history);
    }
    
    /**
     * 加载购物清单数据
     */
    loadShoppingList() {
        this.shoppingList = Utils.getLocalStorageItem(STORAGE_KEYS.SHOPPING_LIST, []);
    }
    
    /**
     * 保存购物清单数据
     */
    saveShoppingList() {
        Utils.setLocalStorageItem(STORAGE_KEYS.SHOPPING_LIST, this.shoppingList);
    }
    
    /**
     * 更新分类计数
     */
    updateCategoryCounts() {
        // 重置所有分类的计数
        this.categories.forEach(category => {
            category.count = 0;
        });
        
        // 统计每个分类下的商品数量
        this.items.forEach(item => {
            const category = this.categories.find(c => c.name === item.category);
            if (category) {
                category.count++;
            }
        });
        
        // 保存更新后的分类数据
        this.saveCategories();
    }
    
    /**
     * 添加商品
     * @param {Object} item - 商品数据
     * @returns {string} 新商品的ID
     */
    addItem(item) {
        // 生成唯一ID
        const newItem = {
            ...item,
            id: Utils.generateUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 确保批次信息正确
        if (!newItem.batches || !Array.isArray(newItem.batches) || newItem.batches.length === 0) {
            newItem.batches = [{
                id: Utils.generateUUID(),
                quantity: newItem.quantity || 0,
                purchaseDate: newItem.purchaseDate || new Date().toISOString(),
                expiryDate: newItem.expiryDate || null,
                price: newItem.price || 0
            }];
        }
        
        // 计算总数量
        newItem.quantity = newItem.batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
        
        // 添加到数组
        this.items.push(newItem);
        
        // 添加历史记录
        this.addHistory({
            type: 'add',
            itemId: newItem.id,
            itemName: newItem.name,
            details: `添加商品 ${newItem.name}，初始数量 ${newItem.quantity}`
        });
        
        // 更新品牌列表
        if (newItem.brand && !this.brands.includes(newItem.brand)) {
            this.brands.push(newItem.brand);
            this.saveBrands();
        }
        
        // 保存数据
        this.saveItems();
        this.updateCategoryCounts();
        
        return newItem.id;
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
        
        const oldItem = Utils.deepClone(this.items[index]);
        const updatedItem = { ...oldItem, ...updates, updatedAt: new Date().toISOString() };
        
        // 如果批次信息被更新，重新计算总数量
        if (updates.batches) {
            updatedItem.quantity = updatedItem.batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
        }
        
        this.items[index] = updatedItem;
        
        // 添加历史记录
        this.addHistory({
            type: 'update',
            itemId: id,
            itemName: updatedItem.name,
            details: `更新商品 ${updatedItem.name} 的信息`
        });
        
        // 更新品牌列表
        if (updatedItem.brand && !this.brands.includes(updatedItem.brand)) {
            this.brands.push(updatedItem.brand);
            this.saveBrands();
        }
        
        // 保存数据
        this.saveItems();
        this.updateCategoryCounts();
        
        return true;
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
        this.items.splice(index, 1);
        
        // 添加历史记录
        this.addHistory({
            type: 'delete',
            itemId: id,
            itemName: deletedItem.name,
            details: `删除商品 ${deletedItem.name}`
        });
        
        // 保存数据
        this.saveItems();
        this.updateCategoryCounts();
        
        return true;
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
        const item = this.items.find(item => item.id === id);
        if (!item) return false;
        
        // 检查数量是否有效
        if (item.quantity + quantityChange < 0) {
            return false;
        }
        
        let targetBatch;
        
        // 如果指定了批次ID
        if (batchId) {
            targetBatch = item.batches.find(batch => batch.id === batchId);
            if (!targetBatch) return false;
            
            // 检查批次数量是否足够
            if (targetBatch.quantity + quantityChange < 0) {
                return false;
            }
            
            targetBatch.quantity += quantityChange;
        } else {
            // 没有指定批次ID，默认调整最早的批次
            // 按照购买日期从早到晚排序批次
            const sortedBatches = [...item.batches].sort((a, b) => {
                return new Date(a.purchaseDate) - new Date(b.purchaseDate);
            });
            
            let remainingChange = quantityChange;
            
            // 如果是减少数量（负数变化）
            if (quantityChange < 0) {
                // 从最早的批次开始减
                for (const batch of sortedBatches) {
                    if (remainingChange === 0) break;
                    
                    const change = Math.max(-batch.quantity, remainingChange);
                    batch.quantity += change;
                    remainingChange -= change;
                }
            } else {
                // 如果是增加数量（正数变化），添加到最新的批次
                const latestBatch = sortedBatches[sortedBatches.length - 1];
                latestBatch.quantity += quantityChange;
            }
        }
        
        // 重新计算总数量
        item.quantity = item.batches.reduce((sum, batch) => sum + batch.quantity, 0);
        item.updatedAt = new Date().toISOString();
        
        // 添加历史记录
        this.addHistory({
            type: 'adjust',
            itemId: id,
            itemName: item.name,
            details: `${quantityChange > 0 ? '增加' : '减少'}商品 ${item.name} 数量 ${Math.abs(quantityChange)}${reason ? `，原因：${reason}` : ''}`
        });
        
        // 保存数据
        this.saveItems();
        
        return true;
    }
    
    /**
     * 添加批次
     * @param {string} itemId - 商品ID
     * @param {Object} batch - 批次数据
     * @returns {boolean} 是否成功
     */
    addBatch(itemId, batch) {
        const item = this.items.find(item => item.id === itemId);
        if (!item) return false;
        
        const newBatch = {
            ...batch,
            id: Utils.generateUUID(),
            purchaseDate: batch.purchaseDate || new Date().toISOString()
        };
        
        item.batches.push(newBatch);
        
        // 重新计算总数量
        item.quantity = item.batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
        item.updatedAt = new Date().toISOString();
        
        // 添加历史记录
        this.addHistory({
            type: 'batch-add',
            itemId: itemId,
            itemName: item.name,
            details: `为商品 ${item.name} 添加新批次，数量 ${newBatch.quantity}`
        });
        
        // 保存数据
        this.saveItems();
        
        return true;
    }
    
    /**
     * 更新批次
     * @param {string} itemId - 商品ID
     * @param {string} batchId - 批次ID
     * @param {Object} updates - 更新数据
     * @returns {boolean} 是否成功
     */
    updateBatch(itemId, batchId, updates) {
        const item = this.items.find(item => item.id === itemId);
        if (!item) return false;
        
        const batchIndex = item.batches.findIndex(batch => batch.id === batchId);
        if (batchIndex === -1) return false;
        
        const oldBatch = Utils.deepClone(item.batches[batchIndex]);
        item.batches[batchIndex] = { ...oldBatch, ...updates };
        
        // 重新计算总数量
        item.quantity = item.batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0);
        item.updatedAt = new Date().toISOString();
        
        // 添加历史记录
        this.addHistory({
            type: 'batch-update',
            itemId: itemId,
            itemName: item.name,
            details: `更新商品 ${item.name} 的批次信息`
        });
        
        // 保存数据
        this.saveItems();
        
        return true;
    }
    
    /**
     * 删除批次
     * @param {string} itemId - 商品ID
     * @param {string} batchId - 批次ID
     * @returns {boolean} 是否成功
     */
    deleteBatch(itemId, batchId) {
        const item = this.items.find(item => item.id === itemId);
        if (!item) return false;
        
        const batchIndex = item.batches.findIndex(batch => batch.id === batchId);
        if (batchIndex === -1) return false;
        
        const deletedBatch = item.batches[batchIndex];
        item.batches.splice(batchIndex, 1);
        
        // 如果没有批次了，删除整个商品
        if (item.batches.length === 0) {
            return this.deleteItem(itemId);
        }
        
        // 重新计算总数量
        item.quantity = item.batches.reduce((sum, batch) => sum + batch.quantity, 0);
        item.updatedAt = new Date().toISOString();
        
        // 添加历史记录
        this.addHistory({
            type: 'batch-delete',
            itemId: itemId,
            itemName: item.name,
            details: `删除商品 ${item.name} 的一个批次，数量 ${deletedBatch.quantity}`
        });
        
        // 保存数据
        this.saveItems();
        
        return true;
    }
    
    /**
     * 添加分类
     * @param {string} name - 分类名称
     * @returns {string} 新分类的ID
     */
    addCategory(name) {
        // 检查是否已存在
        if (this.categories.some(category => category.name === name)) {
            return null;
        }
        
        const newCategory = {
            id: Utils.generateUUID(),
            name: name,
            count: 0
        };
        
        this.categories.push(newCategory);
        this.saveCategories();
        
        return newCategory.id;
    }
    
    /**
     * 更新分类
     * @param {string} id - 分类ID
     * @param {string} newName - 新名称
     * @returns {boolean} 是否成功
     */
    updateCategory(id, newName) {
        // 检查新名称是否已存在
        if (this.categories.some(category => category.name === newName && category.id !== id)) {
            return false;
        }
        
        const category = this.categories.find(category => category.id === id);
        if (!category) return false;
        
        const oldName = category.name;
        category.name = newName;
        
        // 更新所有使用该分类的商品
        this.items.forEach(item => {
            if (item.category === oldName) {
                item.category = newName;
            }
        });
        
        // 保存数据
        this.saveCategories();
        this.saveItems();
        
        return true;
    }
    
    /**
     * 删除分类
     * @param {string} id - 分类ID
     * @param {string} replacementId - 替代分类的ID（可选）
     * @returns {boolean} 是否成功
     */
    deleteCategory(id, replacementId) {
        const index = this.categories.findIndex(category => category.id === id);
        if (index === -1) return false;
        
        const deletedCategory = this.categories[index];
        
        // 如果指定了替代分类，更新所有使用被删除分类的商品
        if (replacementId) {
            const replacementCategory = this.categories.find(category => category.id === replacementId);
            if (replacementCategory) {
                this.items.forEach(item => {
                    if (item.category === deletedCategory.name) {
                        item.category = replacementCategory.name;
                    }
                });
            }
        } else {
            // 如果没有指定替代分类，将使用该分类的商品设为"其他"
            this.items.forEach(item => {
                if (item.category === deletedCategory.name) {
                    item.category = '其他';
                }
            });
        }
        
        // 删除分类
        this.categories.splice(index, 1);
        
        // 保存数据
        this.saveCategories();
        this.saveItems();
        this.updateCategoryCounts();
        
        return true;
    }
    
    /**
     * 添加历史记录
     * @param {Object} record - 历史记录数据
     */
    addHistory(record) {
        const newRecord = {
            ...record,
            id: Utils.generateUUID(),
            timestamp: new Date().toISOString()
        };
        
        this.history.unshift(newRecord);
        
        // 限制历史记录数量，最多保留1000条
        if (this.history.length > 1000) {
            this.history = this.history.slice(0, 1000);
        }
        
        this.saveHistory();
    }
    
    /**
     * 清空历史记录
     */
    clearHistory() {
        this.history = [];
        this.saveHistory();
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
                }
            }
            
            // 价格范围过滤
            if (filters.minPrice !== undefined) {
                results = results.filter(item => item.price >= filters.minPrice);
            }
            
            if (filters.maxPrice !== undefined) {
                results = results.filter(item => item.price <= filters.maxPrice);
            }
            
            // 过期筛选
            if (filters.expiringSoon) {
                const { expiryWarningDays } = this.settings;
                const today = new Date();
                const warningDate = new Date();
                warningDate.setDate(today.getDate() + expiryWarningDays);
                
                results = results.filter(item => {
                    return item.batches.some(batch => {
                        if (!batch.expiryDate) return false;
                        const expiryDate = new Date(batch.expiryDate);
                        return expiryDate <= warningDate && expiryDate >= today;
                    });
                });
            }
            
            // 已过期筛选
            if (this.settings.showExpired && filters.expired) {
                const today = new Date();
                
                results = results.filter(item => {
                    return item.batches.some(batch => {
                        if (!batch.expiryDate) return false;
                        const expiryDate = new Date(batch.expiryDate);
                        return expiryDate < today;
                    });
                });
            }
            
            // 购买日期范围过滤
            if (filters.fromDate) {
                const fromDate = new Date(filters.fromDate);
                results = results.filter(item => {
                    return item.batches.some(batch => {
                        if (!batch.purchaseDate) return false;
                        const purchaseDate = new Date(batch.purchaseDate);
                        return purchaseDate >= fromDate;
                    });
                });
            }
            
            if (filters.toDate) {
                const toDate = new Date(filters.toDate);
                results = results.filter(item => {
                    return item.batches.some(batch => {
                        if (!batch.purchaseDate) return false;
                        const purchaseDate = new Date(batch.purchaseDate);
                        return purchaseDate <= toDate;
                    });
                });
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
            return sum + item.batches.reduce((batchSum, batch) => {
                return batchSum + (batch.quantity * (batch.price || 0));
            }, 0);
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
        const categoryStats = {};
        this.categories.forEach(category => {
            categoryStats[category.name] = 0;
        });
        
        this.items.forEach(item => {
            if (item.category && categoryStats.hasOwnProperty(item.category)) {
                categoryStats[item.category]++;
            } else if (item.category) {
                categoryStats[item.category] = 1;
            } else {
                categoryStats['其他'] = (categoryStats['其他'] || 0) + 1;
            }
        });
        
        // 过期统计
        const today = new Date();
        const expiringItems = this.items.filter(item => {
            return item.batches.some(batch => {
                if (!batch.expiryDate) return false;
                const expiryDate = new Date(batch.expiryDate);
                const daysToExpiry = Utils.daysBetween(today, expiryDate);
                return daysToExpiry >= 0 && daysToExpiry <= this.settings.expiryWarningDays;
            });
        }).length;
        
        const expiredItems = this.items.filter(item => {
            return item.batches.some(batch => {
                if (!batch.expiryDate) return false;
                const expiryDate = new Date(batch.expiryDate);
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
     * 更新设置
     * @param {Object} newSettings - 新设置
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
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
            return false;
        }
        
        const entry = {
            id: Utils.generateUUID(),
            itemId: itemId,
            itemName: item.name,
            reason: reason,
            addedAt: new Date().toISOString(),
            purchased: false
        };
        
        this.shoppingList.push(entry);
        this.saveShoppingList();
        return true;
    }
    
    /**
     * 从购物清单移除商品
     * @param {string} entryId - 购物清单条目ID
     * @returns {boolean} 是否成功
     */
    removeFromShoppingList(entryId) {
        const index = this.shoppingList.findIndex(entry => entry.id === entryId);
        if (index === -1) return false;
        
        this.shoppingList.splice(index, 1);
        this.saveShoppingList();
        return true;
    }
    
    /**
     * 标记购物清单项为已购买
     * @param {string} entryId - 购物清单条目ID
     * @returns {boolean} 是否成功
     */
    markShoppingListItemPurchased(entryId) {
        const entry = this.shoppingList.find(e => e.id === entryId);
        if (!entry) return false;
        
        entry.purchased = true;
        entry.purchasedAt = new Date().toISOString();
        this.saveShoppingList();
        return true;
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
                    const expiryDate = new Date(batch.expiryDate);
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