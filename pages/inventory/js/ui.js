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
                ModalsManager.openAddItemModal();
            });
        }
        
        // 高级筛选事件
        if (this.elements.advancedFilterButton) {
            this.elements.advancedFilterButton.addEventListener('click', () => {
                ModalsManager.openAdvancedFilterModal(this.filters, (newFilters) => {
                    this.filters = { ...this.filters, ...newFilters };
                    this.pagination.currentPage = 1;
                    this.renderContent();
                });
            });
        }
        
        // 刷新按钮事件
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                this.refreshData();
            });
        }
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
                <div class="search-result-name">${item.name}</div>
                <div class="search-result-details">
                    <span>${item.category || '未分类'} · ${item.spec || ''}</span>
                    <span class="status-badge status-${status}">${statusText} (${item.quantity})</span>
                </div>
            `;
            
            // 点击搜索结果查看详情
            resultItem.addEventListener('click', () => {
                this.elements.searchResults.style.display = 'none';
                this.elements.searchInput.value = '';
                ModalsManager.openItemDetailsModal(item.id);
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
        
        // 更新分类下拉框
        this.renderCategoryFilter();
        
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
     * 渲染摘要信息
     */
    renderSummary() {
        const stats = InventoryData.getInventoryStats();
        
        if (this.elements.totalItemsCount) {
            this.elements.totalItemsCount.textContent = stats.totalItems;
        }
        
        if (this.elements.totalBatchesCount) {
            this.elements.totalBatchesCount.textContent = stats.totalBatches;
        }
        
        if (this.elements.totalValue) {
            this.elements.totalValue.textContent = Utils.formatPrice(stats.totalValue);
        }
    }
    
    /**
     * 渲染主内容
     */
    renderContent() {
        // 获取并筛选商品
        let items = [];
        
        if (this.filters.searchQuery) {
            items = InventoryData.searchItems(this.filters.searchQuery, this.filters);
        } else {
            items = InventoryData.searchItems('', this.filters);
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
     * 渲染商品列表
     */
    renderItems() {
        // 根据当前视图渲染
        if (this.currentView === 'card') {
            this.renderCardView();
        } else {
            this.renderTableView();
        }
    }
    
    /**
     * 渲染卡片视图
     */
    renderCardView() {
        if (!this.elements.cardView) return;
        
        this.elements.cardView.innerHTML = '';
        
        this.displayedItems.forEach(item => {
            const card = this.createItemCard(item);
            this.elements.cardView.appendChild(card);
        });
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
                <h3 class="card-title">${item.name}</h3>
                <div class="card-status">
                    <span class="status-badge status-${status}">${statusText}</span>
                </div>
            </div>
            
            <div class="card-category">
                <span class="icon">📂</span>${item.category || '未分类'}
            </div>
            
            ${expiring ? `
            <div class="card-expiry expiring">
                <span class="icon">⚠️</span>将在 ${Utils.daysBetween(today, new Date(nearestExpiryDate))} 天后过期
            </div>
            ` : ''}
            
            <div class="card-specs">
                ${item.spec ? `<div class="card-spec"><span class="icon">📏</span>${item.spec}</div>` : ''}
                ${item.brand ? `<div class="card-spec"><span class="icon">🏷️</span>${item.brand}</div>` : ''}
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
                    <span class="icon">📍</span>${item.storage}
                </div>
                ` : ''}
                
                ${item.remark ? `<div class="card-note">${item.remark}</div>` : ''}
            </div>
            
            <div class="card-actions">
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
                    case 'edit':
                        ModalsManager.openEditItemModal(item.id);
                        break;
                    case 'adjust':
                        ModalsManager.openAdjustQuantityModal(item.id);
                        break;
                    case 'delete':
                        ModalsManager.openDeleteItemModal(item.id);
                        break;
                }
            });
        });
        
        // 点击卡片查看详情
        card.addEventListener('click', () => {
            ModalsManager.openItemDetailsModal(item.id);
        });
        
        return card;
    }
    
    /**
     * 渲染表格视图
     */
    renderTableView() {
        if (!this.elements.tableBody) return;
        
        this.elements.tableBody.innerHTML = '';
        
        this.displayedItems.forEach(item => {
            const row = this.createItemTableRow(item);
            this.elements.tableBody.appendChild(row);
        });
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
                <div class="table-item-name">${item.name}</div>
                ${expiring ? '<div class="table-item-expiry text-warning"><span class="icon">⚠️</span>即将过期</div>' : ''}
            </td>
            <td>${item.category || '未分类'}</td>
            <td>${item.spec || '-'}</td>
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
                        ModalsManager.openEditItemModal(item.id);
                        break;
                    case 'adjust':
                        ModalsManager.openAdjustQuantityModal(item.id);
                        break;
                    case 'delete':
                        ModalsManager.openDeleteItemModal(item.id);
                        break;
                }
            });
        });
        
        // 点击行查看详情
        row.addEventListener('click', () => {
            ModalsManager.openItemDetailsModal(item.id);
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