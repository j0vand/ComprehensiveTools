/**
 * UI交互模块
 * 负责处理界面交互、DOM操作和动态内容渲染
 */

/**
 * UI管理类
 */
class UIManager {
    constructor() {
        // 当前视图模式：'card' 或 'table'
        this.currentView = 'card';
        
        // 当前排序方式
        this.currentSort = 'date-desc';
        
        // 当前筛选条件
        this.filters = {
            category: '',
            brand: '',
            name: '',
            storage: '',
            status: 'all'
        };
        
        // 分页信息
        this.pagination = {
            currentPage: 1,
            pageSize: 12,
            totalPages: 1
        };
        
        // 当前显示的商品列表
        this.displayedItems = [];
        
        // 缓存的DOM元素
        this.elements = {};
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化UI管理器
     */
    init() {
        // 缓存DOM元素
        this.cacheElements();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载设置
        this.loadSettings();
        
        // 初始化筛选器
        this.initFilters();
        
        // 渲染初始内容
        this.renderContent();
    }
    
    /**
     * 缓存频繁使用的DOM元素
     */
    cacheElements() {
        this.elements = {
            // 视图容器
            cardView: document.getElementById('cardView'),
            tableView: document.getElementById('tableView'),
            tableBody: document.getElementById('tableBody'),
            
            // 视图切换按钮
            cardViewButton: document.getElementById('cardViewButton'),
            tableViewButton: document.getElementById('tableViewButton'),
            
            // 搜索和筛选元素
            searchInput: document.getElementById('searchInput'),
            searchResults: document.getElementById('searchResults'),
            categoryFilter: document.getElementById('categoryFilter'),
            brandFilter: document.getElementById('brandFilter'),
            nameFilter: document.getElementById('nameFilter'),
            storageFilter: document.getElementById('storageFilter'),
            statusFilters: document.getElementsByName('statusFilter'),
            sortOption: document.getElementById('sortOption'),
            
            // 分页控制
            paginationControls: document.getElementById('paginationControls'),
            
            // 操作按钮
            addItemButton: document.getElementById('addItemButton'),
            advancedFilterButton: document.getElementById('advancedFilterButton'),
            refreshButton: document.getElementById('refreshButton'),
            
            // 摘要信息
            totalItemsCount: document.getElementById('totalItemsCount'),
            totalBatchesCount: document.getElementById('totalBatchesCount'),
            totalValue: document.getElementById('totalValue'),
            needToBuyCount: document.getElementById('needToBuyCount'),
            expiringSoonCount: document.getElementById('expiringSoonCount'),
            recentItemsCount: document.getElementById('recentItemsCount'),
            
            // 购物清单和提醒
            shoppingListButton: document.getElementById('shoppingListButton'),
            remindersButton: document.getElementById('remindersButton'),
            shoppingListBadge: document.getElementById('shoppingListBadge'),
            remindersBadge: document.getElementById('remindersBadge'),
            
            // 空状态显示
            emptyState: document.getElementById('emptyState'),
            
            // 模态窗容器
            modalContainer: document.getElementById('modalContainer')
        };
    }
    
    /**
     * 绑定事件处理函数
     */
    bindEvents() {
        // 搜索事件
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', Utils.debounce(() => {
                this.handleSearch();
            }, 300));
            
            this.elements.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleSearch();
                }
            });
        }
        
        // 视图切换事件
        if (this.elements.cardViewButton) {
            this.elements.cardViewButton.addEventListener('click', () => {
                this.switchView('card');
            });
        }
        
        if (this.elements.tableViewButton) {
            this.elements.tableViewButton.addEventListener('click', () => {
                this.switchView('table');
            });
        }
        
        // 分类筛选事件
        if (this.elements.categoryFilter) {
            this.elements.categoryFilter.addEventListener('change', () => {
                this.filters.category = this.elements.categoryFilter.value;
                this.pagination.currentPage = 1;
                this.renderContent();
            });
        }
        
        // 品牌筛选事件
        if (this.elements.brandFilter) {
            this.elements.brandFilter.addEventListener('change', () => {
                this.filters.brand = this.elements.brandFilter.value;
                this.pagination.currentPage = 1;
                this.renderContent();
            });
        }
        
        // 商品名称筛选事件
        if (this.elements.nameFilter) {
            this.elements.nameFilter.addEventListener('input', Utils.debounce(() => {
                this.filters.name = this.elements.nameFilter.value.trim();
                this.pagination.currentPage = 1;
                this.renderContent();
            }, 300));
        }
        
        // 存放位置筛选事件
        if (this.elements.storageFilter) {
            this.elements.storageFilter.addEventListener('input', Utils.debounce(() => {
                this.filters.storage = this.elements.storageFilter.value.trim();
                this.pagination.currentPage = 1;
                this.renderContent();
            }, 300));
        }
        
        // 状态筛选事件
        if (this.elements.statusFilters) {
            for (const radio of this.elements.statusFilters) {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        this.filters.status = radio.value;
                        this.pagination.currentPage = 1;
                        this.renderContent();
                    }
                });
            }
        }
        
        // 排序事件
        if (this.elements.sortOption) {
            this.elements.sortOption.addEventListener('change', () => {
                this.currentSort = this.elements.sortOption.value;
                this.renderContent();
            });
        }
        
        // 添加商品事件
        if (this.elements.addItemButton) {
            this.elements.addItemButton.addEventListener('click', () => {
                if (window.ModalsManager) {
                    window.ModalsManager.openAddItemModal();
                } else {
                    console.error('ModalsManager is not initialized');
                }
            });
        }
        
        // 高级筛选事件
        if (this.elements.advancedFilterButton) {
            this.elements.advancedFilterButton.addEventListener('click', () => {
                if (window.ModalsManager) {
                    window.ModalsManager.openAdvancedFilterModal(this.filters, (newFilters) => {
                        this.filters = { ...this.filters, ...newFilters };
                        this.pagination.currentPage = 1;
                        this.renderContent();
                    });
                }
            });
        }
        
        // 刷新按钮事件
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                this.refreshData();
            });
        }
        
        // 购物清单按钮事件
        if (this.elements.shoppingListButton) {
            this.elements.shoppingListButton.addEventListener('click', () => {
                if (window.ModalsManager) {
                    window.ModalsManager.openShoppingListModal();
                }
            });
        }
        
        // 提醒按钮事件
        if (this.elements.remindersButton) {
            this.elements.remindersButton.addEventListener('click', () => {
                if (window.ModalsManager) {
                    window.ModalsManager.openRemindersModal();
                }
            });
        }
        
        // 快速筛选按钮事件（使用事件委托，因为按钮是动态创建的）
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-filter-btn')) {
                const filter = e.target.dataset.filter;
                this.handleQuickFilter(filter);
            }
        });
        
        // 清除筛选按钮事件
        const clearFiltersButton = document.getElementById('clearFiltersButton');
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
    }
    
    /**
     * 清除所有筛选条件
     */
    clearAllFilters() {
        // 重置筛选条件
        this.filters = {
            category: '',
            brand: '',
            name: '',
            storage: '',
            status: 'all',
            expiringSoon: false,
            fromDate: undefined,
            searchQuery: ''
        };
        
        // 重置UI元素
        if (this.elements.categoryFilter) {
            this.elements.categoryFilter.value = '';
        }
        if (this.elements.brandFilter) {
            this.elements.brandFilter.value = '';
        }
        if (this.elements.nameFilter) {
            this.elements.nameFilter.value = '';
        }
        if (this.elements.storageFilter) {
            this.elements.storageFilter.value = '';
        }
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        
        // 重置状态筛选
        if (this.elements.statusFilters) {
            const allRadio = Array.from(this.elements.statusFilters).find(r => r.value === 'all');
            if (allRadio) allRadio.checked = true;
        }
        
        // 重置快速筛选按钮
        document.querySelectorAll('.quick-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 重新渲染
        this.pagination.currentPage = 1;
        this.renderContent();
        
        Utils.showNotification('已清除所有筛选条件', 'success');
    }
    
    /**
     * 处理快速筛选
     * @param {string} filter - 筛选类型
     */
    handleQuickFilter(filter) {
        const btn = document.querySelector(`[data-filter="${filter}"]`);
        const isActive = btn && btn.classList.contains('active');
        
        // 移除所有快速筛选按钮的active状态
        document.querySelectorAll('.quick-filter-btn').forEach(b => {
            b.classList.remove('active');
        });
        
        // 如果点击的是已激活的按钮，则取消筛选
        if (isActive) {
            this.filters.fromDate = undefined;
            this.filters.expiringSoon = false;
        } else {
            // 激活当前按钮
            if (btn) btn.classList.add('active');
            
            // 应用筛选
            if (filter === 'recent') {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                this.filters.fromDate = sevenDaysAgo.toISOString().split('T')[0];
                this.filters.expiringSoon = false;
            } else if (filter === 'expiring') {
                this.filters.expiringSoon = true;
                this.filters.fromDate = undefined;
            }
        }
        
        this.pagination.currentPage = 1;
        this.renderContent();
    }
    
    /**
     * 加载用户设置
     */
    loadSettings() {
        const settings = InventoryData.settings;
        
        // 设置分页大小
        this.pagination.pageSize = settings.pageSize || 12;
        
        // 设置视图模式
        this.currentView = settings.defaultView || 'card';
        this.switchView(this.currentView, false);
        
        // 设置排序方式
        this.currentSort = settings.defaultSort || 'date-desc';
        if (this.elements.sortOption) {
            this.elements.sortOption.value = this.currentSort;
        }
    }
    
    /**
     * 切换视图模式
     * @param {string} view - 视图模式：'card' 或 'table'
     * @param {boolean} saveSettings - 是否保存设置
     */
    switchView(view, saveSettings = true) {
        if (view !== 'card' && view !== 'table') return;
        
        this.currentView = view;
        
        // 更新UI
        if (this.elements.cardView) {
            this.elements.cardView.style.display = view === 'card' ? 'grid' : 'none';
        }
        
        if (this.elements.tableView) {
            this.elements.tableView.style.display = view === 'table' ? 'block' : 'none';
        }
        
        // 更新按钮状态
        if (this.elements.cardViewButton) {
            this.elements.cardViewButton.classList.toggle('active', view === 'card');
        }
        
        if (this.elements.tableViewButton) {
            this.elements.tableViewButton.classList.toggle('active', view === 'table');
        }
        
        // 保存设置
        if (saveSettings) {
            InventoryData.updateSettings({ defaultView: view });
        }
        
        // 重新渲染内容
        this.renderContent();
    }
    
    /**
     * 处理搜索操作
     */
    handleSearch() {
        const query = this.elements.searchInput.value.trim();
        
        if (query.length === 0) {
            // 隐藏搜索结果
            this.elements.searchResults.style.display = 'none';
            this.renderContent();
            return;
        }
        
        // 执行搜索
        const results = InventoryData.searchItems(query);
        
        if (results.length === 0) {
            this.elements.searchResults.innerHTML = `
                <div class="search-result-item">
                    <div class="search-result-name">没有找到匹配结果</div>
                </div>
            `;
            this.elements.searchResults.style.display = 'block';
            return;
        }
        
        // 显示搜索结果
        this.elements.searchResults.innerHTML = '';
        
        // 限制显示的结果数量
        const limitedResults = results.slice(0, 5);
        
        limitedResults.forEach(item => {
            const status = Utils.getItemStatus(item.quantity, InventoryData.settings.lowStockThreshold);
            const statusText = Utils.getStatusText(status);
            
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <div class="search-result-name">${Utils.escapeHtml(item.name)}</div>
                <div class="search-result-details">
                    <span>${Utils.escapeHtml(item.category) || '未分类'} · ${Utils.escapeHtml(item.spec) || ''}</span>
                    <span class="status-badge status-${status}">${statusText} (${item.quantity})</span>
                </div>
            `;
            
            // 点击搜索结果查看详情
            resultItem.addEventListener('click', () => {
                this.elements.searchResults.style.display = 'none';
                this.elements.searchInput.value = '';
                if (window.ModalsManager) {
                    window.ModalsManager.openItemDetailsModal(item.id);
                }
            });
            
            this.elements.searchResults.appendChild(resultItem);
        });
        
        // 如果结果数量超过限制，显示查看更多选项
        if (results.length > 5) {
            const viewAllItem = document.createElement('div');
            viewAllItem.className = 'search-result-item';
            viewAllItem.innerHTML = `
                <div class="search-result-name text-center">查看全部 ${results.length} 个结果</div>
            `;
            
            viewAllItem.addEventListener('click', () => {
                this.elements.searchResults.style.display = 'none';
                this.filters = {
                    ...this.filters,
                    searchQuery: query
                };
                this.pagination.currentPage = 1;
                this.renderContent();
            });
            
            this.elements.searchResults.appendChild(viewAllItem);
        }
        
        this.elements.searchResults.style.display = 'block';
    }
    
    /**
     * 刷新数据并重新渲染
     */
    refreshData() {
        Utils.showNotification('正在刷新数据...', 'info');
        
        // 重新加载数据
        InventoryData.loadAllData();
        
        // 重新渲染内容
        this.renderContent();
        
        // 更新筛选下拉框
        this.renderCategoryFilter();
        this.renderBrandFilter();
        
        Utils.showNotification('数据已刷新', 'success');
    }
    
    /**
     * 渲染分类筛选下拉框
     */
    renderCategoryFilter() {
        if (!this.elements.categoryFilter) return;
        
        const categories = InventoryData.getAllCategories();
        
        // 保存当前选择的值
        const currentValue = this.elements.categoryFilter.value;
        
        // 清空下拉框
        this.elements.categoryFilter.innerHTML = `<option value="">全部分类</option>`;
        
        // 添加分类选项
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = `${category.name} (${category.count})`;
            this.elements.categoryFilter.appendChild(option);
        });
        
        // 恢复选择的值
        if (currentValue && categories.some(c => c.name === currentValue)) {
            this.elements.categoryFilter.value = currentValue;
        }
    }
    
    /**
     * 渲染品牌筛选下拉框
     */
    renderBrandFilter() {
        if (!this.elements.brandFilter) return;
        
        const brands = InventoryData.getAllBrands();
        const items = InventoryData.getAllItems();
        
        // 统计每个品牌的商品数量
        const brandCounts = {};
        items.forEach(item => {
            if (item.brand) {
                brandCounts[item.brand] = (brandCounts[item.brand] || 0) + 1;
            }
        });
        
        // 保存当前选择的值
        const currentValue = this.elements.brandFilter.value;
        
        // 清空下拉框
        this.elements.brandFilter.innerHTML = `<option value="">全部品牌</option>`;
        
        // 按品牌名称排序
        const sortedBrands = brands.sort((a, b) => a.localeCompare(b));
        
        // 添加品牌选项
        sortedBrands.forEach(brand => {
            const count = brandCounts[brand] || 0;
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = `${brand}${count > 0 ? ` (${count})` : ''}`;
            this.elements.brandFilter.appendChild(option);
        });
        
        // 恢复选择的值
        if (currentValue && brands.includes(currentValue)) {
            this.elements.brandFilter.value = currentValue;
        }
    }
    
    /**
     * 渲染摘要信息
     */
    renderSummary() {
        const stats = InventoryData.getInventoryStats();
        const overview = InventoryData.getQuickOverview();
        const reminders = InventoryData.getReminders();
        
        if (this.elements.totalItemsCount) {
            this.elements.totalItemsCount.textContent = overview.totalItems;
        }
        
        if (this.elements.totalBatchesCount) {
            this.elements.totalBatchesCount.textContent = stats.totalBatches;
        }
        
        if (this.elements.totalValue) {
            this.elements.totalValue.textContent = Utils.formatPrice(stats.totalValue);
        }
        
        if (this.elements.needToBuyCount) {
            this.elements.needToBuyCount.textContent = overview.needToBuyCount;
        }
        
        if (this.elements.expiringSoonCount) {
            this.elements.expiringSoonCount.textContent = overview.expiringSoonCount;
        }
        
        if (this.elements.recentItemsCount) {
            this.elements.recentItemsCount.textContent = overview.recentItemsCount;
        }
        
        // 更新购物清单和提醒徽章
        const shoppingList = InventoryData.getShoppingList();
        const unpurchasedCount = shoppingList.filter(item => !item.purchased).length;
        const totalReminders = reminders.expiringSoon.length + reminders.needToBuy.length;
        
        if (this.elements.shoppingListBadge) {
            if (unpurchasedCount > 0) {
                this.elements.shoppingListBadge.textContent = unpurchasedCount;
                this.elements.shoppingListBadge.style.display = 'inline-block';
            } else {
                this.elements.shoppingListBadge.style.display = 'none';
            }
        }
        
        if (this.elements.remindersBadge) {
            if (totalReminders > 0) {
                this.elements.remindersBadge.textContent = totalReminders;
                this.elements.remindersBadge.style.display = 'inline-block';
            } else {
                this.elements.remindersBadge.style.display = 'none';
            }
        }
    }
    
    /**
     * 渲染主内容
     */
    renderContent() {
        // 获取并筛选商品
        let items = [];
        
        // 构建筛选条件
        const searchFilters = {
            category: this.filters.category || undefined,
            brand: this.filters.brand || undefined,
            name: this.filters.name || undefined,
            storage: this.filters.storage || undefined,
            status: this.filters.status === 'all' ? undefined : this.filters.status,
            expiringSoon: this.filters.expiringSoon || undefined,
            fromDate: this.filters.fromDate || undefined
        };
        
        // 如果搜索框有内容，使用搜索；否则使用筛选
        if (this.filters.searchQuery) {
            items = InventoryData.searchItems(this.filters.searchQuery, searchFilters);
        } else {
            items = InventoryData.searchItems('', searchFilters);
        }
        
        // 排序
        items = InventoryData.sortItems(items, this.currentSort);
        
        // 设置分页
        this.pagination.totalPages = Math.ceil(items.length / this.pagination.pageSize);
        
        if (this.pagination.currentPage > this.pagination.totalPages) {
            this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
        }
        
        // 获取当前页的商品
        const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;
        const endIndex = startIndex + this.pagination.pageSize;
        this.displayedItems = items.slice(startIndex, endIndex);
        
        // 渲染内容
        this.renderItems();
        
        // 渲染分页控件
        this.renderPagination();
        
        // 渲染摘要信息
        this.renderSummary();
        
        // 显示或隐藏空状态
        if (this.elements.emptyState) {
            this.elements.emptyState.style.display = items.length === 0 ? 'flex' : 'none';
        }
    }
    
    /**
     * 初始化时渲染所有筛选器
     */
    initFilters() {
        this.renderCategoryFilter();
        this.renderBrandFilter();
    }
    
    /**
     * 渲染商品列表
     */
    renderItems() {
        // 对于大数据量，显示加载提示
        if (this.displayedItems.length > 100) {
            this.showLoadingIndicator();

            // 使用requestAnimationFrame延迟渲染，避免阻塞UI
            requestAnimationFrame(() => {
                // 根据当前视图渲染
                if (this.currentView === 'card') {
                    this.renderCardView();
                } else {
                    this.renderTableView();
                }
                this.hideLoadingIndicator();
            });
        } else {
            // 数据量小，直接渲染
            if (this.currentView === 'card') {
                this.renderCardView();
            } else {
                this.renderTableView();
            }
        }
    }

    /**
     * 显示加载指示器
     */
    showLoadingIndicator() {
        const container = this.currentView === 'card' ? this.elements.cardView : this.elements.tableBody?.parentElement;
        if (!container) return;

        const loader = document.createElement('div');
        loader.id = 'rendering-loader';
        loader.style.cssText = 'text-align:center;padding:40px;color:#666;font-size:14px;';
        loader.textContent = '正在加载数据...';
        container.appendChild(loader);
    }

    /**
     * 隐藏加载指示器
     */
    hideLoadingIndicator() {
        const loader = document.getElementById('rendering-loader');
        if (loader) {
            loader.remove();
        }
    }
    
    /**
     * 渲染卡片视图
     */
    renderCardView() {
        if (!this.elements.cardView) return;

        this.elements.cardView.innerHTML = '';

        // 使用DocumentFragment优化性能，减少DOM重排
        const fragment = document.createDocumentFragment();

        this.displayedItems.forEach(item => {
            const card = this.createItemCard(item);
            fragment.appendChild(card);
        });

        // 一次性添加所有卡片
        this.elements.cardView.appendChild(fragment);
    }
    
    /**
     * 创建商品卡片
     * @param {Object} item - 商品数据
     * @returns {HTMLElement} 卡片元素
     */
    createItemCard(item) {
        const threshold = InventoryData.settings.lowStockThreshold || 3;
        const status = Utils.getItemStatus(item.quantity, threshold);
        const statusText = Utils.getStatusText(status);
        
        // 检查是否有即将过期的批次
        const today = new Date();
        const warningDays = InventoryData.settings.expiryWarningDays || 30;
        
        let expiring = false;
        let nearestExpiryDate = null;
        
        item.batches.forEach(batch => {
            if (batch.expiryDate) {
                const expiryDate = new Date(batch.expiryDate);
                const daysToExpiry = Utils.daysBetween(today, expiryDate);
                
                if (daysToExpiry >= 0 && daysToExpiry <= warningDays) {
                    expiring = true;
                    
                    if (!nearestExpiryDate || expiryDate < new Date(nearestExpiryDate)) {
                        nearestExpiryDate = batch.expiryDate;
                    }
                }
            }
        });
        
        // 计算库存百分比
        let percentFill = 100;
        if (item.quantity <= 0) {
            percentFill = 0;
        } else if (item.quantity <= threshold) {
            percentFill = (item.quantity / threshold) * 100;
        }
        
        // 创建卡片元素
        const card = document.createElement('div');
        card.className = `inventory-card ${status} ${expiring ? 'expiring' : ''}`;
        card.dataset.id = item.id;
        
        // 卡片内容
        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${Utils.escapeHtml(item.name)}</h3>
                <div class="card-status">
                    <span class="status-badge status-${status}">${statusText}</span>
                </div>
            </div>
            
            <div class="card-category">
                <span class="icon">📂</span>${Utils.escapeHtml(item.category) || '未分类'}
            </div>
            
            ${expiring ? `
            <div class="card-expiry expiring">
                <span class="icon">⚠️</span>将在 ${Utils.daysBetween(today, new Date(nearestExpiryDate))} 天后过期
            </div>
            ` : ''}
            
            <div class="card-specs">
                ${item.spec ? `<div class="card-spec"><span class="icon">📏</span>${Utils.escapeHtml(item.spec)}</div>` : ''}
                ${item.brand ? `<div class="card-spec"><span class="icon">🏷️</span>${Utils.escapeHtml(item.brand)}</div>` : ''}
            </div>
            
            <div class="card-info">
                <div class="card-info-row">
                    <div class="card-info-label">数量:</div>
                    <div class="card-info-value ${status === 'out-stock' ? 'error' : status === 'low-stock' ? 'warning' : ''}">${item.quantity}</div>
                </div>
                
                <div class="card-quantity-bar">
                    <div class="card-quantity-fill ${status}" style="width: ${percentFill}%"></div>
                </div>
                
                <div class="card-info-row">
                    <div class="card-info-label">价格:</div>
                    <div class="card-info-value highlight">${Utils.formatPrice(item.price)}</div>
                </div>
                
                <div class="card-info-row">
                    <div class="card-info-label">批次:</div>
                    <div class="card-info-value">${item.batches.length}</div>
                </div>
                
                ${item.storage ? `
                <div class="card-storage">
                    <span class="icon">📍</span>${Utils.escapeHtml(item.storage)}
                </div>
                ` : ''}
                
                ${item.remark ? `<div class="card-note">${Utils.escapeHtml(item.remark)}</div>` : ''}
            </div>
            
            <div class="card-actions">
                <button class="card-action-button card-action-quick-decrease" data-action="quick-decrease" title="快速减少1">➖</button>
                <button class="card-action-button card-action-add-to-list" data-action="add-to-list" title="添加到购物清单">🛒</button>
                <button class="card-action-button card-action-mark-empty" data-action="mark-empty" title="标记为用完">✓</button>
                <button class="card-action-button card-action-edit" data-action="edit" title="编辑商品">✏️</button>
                <button class="card-action-button card-action-adjust" data-action="adjust" title="调整数量">🔄</button>
                <button class="card-action-button card-action-delete" data-action="delete" title="删除商品">🗑️</button>
            </div>
        `;
        
        // 添加事件处理
        const actionButtons = card.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = button.dataset.action;
                
                switch (action) {
                    case 'quick-decrease':
                        if (item.quantity > 0) {
                            InventoryData.adjustQuantity(item.id, -1, null, '快速减少');
                            this.renderContent();
                            Utils.showNotification(`${item.name} 数量已减少1`, 'success');
                        }
                        break;
                    case 'add-to-list':
                        const reason = item.quantity <= 0 ? '已用完' : '低库存';
                        if (InventoryData.addToShoppingList(item.id, reason)) {
                            Utils.showNotification(`${item.name} 已添加到购物清单`, 'success');
                            this.renderSummary();
                        } else {
                            Utils.showNotification(`${item.name} 已在购物清单中`, 'info');
                        }
                        break;
                    case 'mark-empty':
                        if (confirm(`确定将 ${item.name} 标记为用完吗？`)) {
                            InventoryData.adjustQuantity(item.id, -item.quantity, null, '标记为用完');
                            this.renderContent();
                            Utils.showNotification(`${item.name} 已标记为用完`, 'success');
                        }
                        break;
                    case 'edit':
                        if (window.ModalsManager) window.ModalsManager.openEditItemModal(item.id);
                        break;
                    case 'adjust':
                        if (window.ModalsManager) window.ModalsManager.openAdjustQuantityModal(item.id);
                        break;
                    case 'delete':
                        if (window.ModalsManager) window.ModalsManager.openDeleteItemModal(item.id);
                        break;
                }
            });
        });
        
        // 点击卡片查看详情
        card.addEventListener('click', () => {
            if (window.ModalsManager) {
                window.ModalsManager.openItemDetailsModal(item.id);
            }
        });
        
        return card;
    }
    
    /**
     * 渲染表格视图
     */
    renderTableView() {
        if (!this.elements.tableBody) return;

        this.elements.tableBody.innerHTML = '';

        // 使用DocumentFragment优化性能，减少DOM重排
        const fragment = document.createDocumentFragment();

        this.displayedItems.forEach(item => {
            const row = this.createItemTableRow(item);
            fragment.appendChild(row);
        });

        // 一次性添加所有行
        this.elements.tableBody.appendChild(fragment);
    }
    
    /**
     * 创建商品表格行
     * @param {Object} item - 商品数据
     * @returns {HTMLElement} 表格行元素
     */
    createItemTableRow(item) {
        const threshold = InventoryData.settings.lowStockThreshold || 3;
        const status = Utils.getItemStatus(item.quantity, threshold);
        const statusText = Utils.getStatusText(status);
        
        // 检查是否有即将过期的批次
        const today = new Date();
        const warningDays = InventoryData.settings.expiryWarningDays || 30;
        
        let expiring = false;
        
        item.batches.forEach(batch => {
            if (batch.expiryDate) {
                const expiryDate = new Date(batch.expiryDate);
                const daysToExpiry = Utils.daysBetween(today, expiryDate);
                
                if (daysToExpiry >= 0 && daysToExpiry <= warningDays) {
                    expiring = true;
                }
            }
        });
        
        // 创建表格行
        const row = document.createElement('tr');
        row.dataset.id = item.id;
        
        // 表格行内容
        row.innerHTML = `
            <td>
                <div class="table-item-name">${Utils.escapeHtml(item.name)}</div>
                ${expiring ? '<div class="table-item-expiry text-warning"><span class="icon">⚠️</span>即将过期</div>' : ''}
            </td>
            <td>${Utils.escapeHtml(item.category) || '未分类'}</td>
            <td>${Utils.escapeHtml(item.spec) || '-'}</td>
            <td class="${status === 'out-stock' ? 'text-error' : status === 'low-stock' ? 'text-warning' : ''}">${item.quantity}</td>
            <td class="text-primary font-bold">${Utils.formatPrice(item.price)}</td>
            <td><span class="status-badge status-${status}">${statusText}</span></td>
            <td>
                <div class="action-column">
                    <button class="action-icon action-icon-edit" data-action="edit" title="编辑商品">✏️</button>
                    <button class="action-icon action-icon-adjust" data-action="adjust" title="调整数量">🔄</button>
                    <button class="action-icon action-icon-delete" data-action="delete" title="删除商品">🗑️</button>
                </div>
            </td>
        `;
        
        // 添加事件处理
        const actionButtons = row.querySelectorAll('[data-action]');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = button.dataset.action;
                
                switch (action) {
                    case 'edit':
                        if (window.ModalsManager) window.ModalsManager.openEditItemModal(item.id);
                        break;
                    case 'adjust':
                        if (window.ModalsManager) window.ModalsManager.openAdjustQuantityModal(item.id);
                        break;
                    case 'delete':
                        if (window.ModalsManager) window.ModalsManager.openDeleteItemModal(item.id);
                        break;
                }
            });
        });
        
        // 点击行查看详情
        row.addEventListener('click', () => {
            if (window.ModalsManager) {
                window.ModalsManager.openItemDetailsModal(item.id);
            }
        });
        
        return row;
    }
    
    /**
     * 渲染分页控件
     */
    renderPagination() {
        if (!this.elements.paginationControls) return;
        
        const { currentPage, totalPages } = this.pagination;
        
        // 如果只有一页，隐藏分页控件
        if (totalPages <= 1) {
            this.elements.paginationControls.style.display = 'none';
            return;
        }
        
        this.elements.paginationControls.style.display = 'flex';
        this.elements.paginationControls.innerHTML = '';
        
        // 上一页按钮
        const prevButton = document.createElement('button');
        prevButton.className = `page-button ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.textContent = '←';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                this.pagination.currentPage--;
                this.renderContent();
            }
        });
        this.elements.paginationControls.appendChild(prevButton);
        
        // 页码按钮
        const maxPageButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
        
        if (endPage - startPage + 1 < maxPageButtons) {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }
        
        // 第一页
        if (startPage > 1) {
            const firstPageButton = document.createElement('button');
            firstPageButton.className = 'page-button';
            firstPageButton.textContent = '1';
            firstPageButton.addEventListener('click', () => {
                this.pagination.currentPage = 1;
                this.renderContent();
            });
            this.elements.paginationControls.appendChild(firstPageButton);
            
            // 省略号
            if (startPage > 2) {
                const ellipsisButton = document.createElement('button');
                ellipsisButton.className = 'page-button disabled';
                ellipsisButton.textContent = '...';
                ellipsisButton.disabled = true;
                this.elements.paginationControls.appendChild(ellipsisButton);
            }
        }
        
        // 页码
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `page-button ${i === currentPage ? 'active' : ''}`;
            pageButton.textContent = i.toString();
            
            if (i !== currentPage) {
                pageButton.addEventListener('click', () => {
                    this.pagination.currentPage = i;
                    this.renderContent();
                });
            }
            
            this.elements.paginationControls.appendChild(pageButton);
        }
        
        // 最后一页
        if (endPage < totalPages) {
            // 省略号
            if (endPage < totalPages - 1) {
                const ellipsisButton = document.createElement('button');
                ellipsisButton.className = 'page-button disabled';
                ellipsisButton.textContent = '...';
                ellipsisButton.disabled = true;
                this.elements.paginationControls.appendChild(ellipsisButton);
            }
            
            const lastPageButton = document.createElement('button');
            lastPageButton.className = 'page-button';
            lastPageButton.textContent = totalPages.toString();
            lastPageButton.addEventListener('click', () => {
                this.pagination.currentPage = totalPages;
                this.renderContent();
            });
            this.elements.paginationControls.appendChild(lastPageButton);
        }
        
        // 下一页按钮
        const nextButton = document.createElement('button');
        nextButton.className = `page-button ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.textContent = '→';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                this.pagination.currentPage++;
                this.renderContent();
            }
        });
        this.elements.paginationControls.appendChild(nextButton);
    }
}

// 在文档加载完成后初始化UI管理器
document.addEventListener('DOMContentLoaded', () => {
    // 初始化暗色模式
    Utils.initDarkMode();
    
    // 创建全局UI管理器实例
    window.InventoryUI = new UIManager();
}); 