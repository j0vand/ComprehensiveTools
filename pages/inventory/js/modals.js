class InventoryModals {
    constructor() {
        this.modalContainer = document.getElementById('modalContainer');
        if (!this.modalContainer) {
            this.modalContainer = document.createElement('div');
            this.modalContainer.id = 'modalContainer';
            document.body.appendChild(this.modalContainer);
        }
        
        // 绑定 ESC 键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !e.defaultPrevented) {
                this.closeAllModals();
            }
        });
    }

    /**
     * 显示模态框
     * @param {string} html - 模态框 HTML 内容
     * @param {string} modalId - 模态框 ID
     * @param {Function} onOpen - 打开后的回调
     */
    showModal(html, modalId, onOpen) {
        // 关闭现有的同名模态框
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }

        // 添加新模态框到容器
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html.trim();
        const modal = tempDiv.firstChild;
        this.modalContainer.appendChild(modal);

        // 绑定关闭按钮事件
        const closeButtons = modal.querySelectorAll('.close-button, .cancel-button');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal(modalId));
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modalId);
            }
        });

        // 显示动画
        requestAnimationFrame(() => {
            modal.classList.add('show');
            if (onOpen) onOpen(modal);
        });
    }

    /**
     * 关闭模态框
     * @param {string} modalId - 模态框 ID
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 300); // 等待过渡动画结束
        }
    }

    /**
     * 关闭所有模态框
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            this.closeModal(modal.id);
        });
    }

    /**
     * 打开分类管理模态框
     */
    openCategoryManagerModal() {
        const html = `
            <div class="modal" id="categoryManagerModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">分类管理</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="add-category-form mb-4">
                            <div class="input-with-addon">
                                <input type="text" id="newCategoryName" class="form-control" placeholder="新分类名称">
                                <button id="addCategoryBtn" class="primary-button" style="border-radius: 0 4px 4px 0;">添加</button>
                            </div>
                        </div>
                        
                        <div class="category-list-container" style="max-height: 400px; overflow-y: auto;">
                            <table class="inventory-table">
                                <thead>
                                    <tr>
                                        <th>分类名称</th>
                                        <th>商品数量</th>
                                        <th style="text-align: right;">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="categoryListBody">
                                    <!-- 动态加载 -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'categoryManagerModal', (modal) => {
            const input = modal.querySelector('#newCategoryName');
            const addBtn = modal.querySelector('#addCategoryBtn');
            const listBody = modal.querySelector('#categoryListBody');

            const renderList = () => {
                const categories = InventoryData.getAllCategories();
                listBody.replaceChildren();
                categories.forEach(category => {
                    const row = document.createElement('tr');
                    const name = document.createElement('td');
                    name.textContent = category.name;
                    const count = document.createElement('td');
                    count.textContent = category.count;
                    const actions = document.createElement('td');
                    actions.style.textAlign = 'right';
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'action-icon action-icon-delete';
                    deleteButton.dataset.id = category.id;
                    deleteButton.title = '删除分类';
                    deleteButton.textContent = '🗑️';
                    actions.appendChild(deleteButton);
                    row.appendChild(name);
                    row.appendChild(count);
                    row.appendChild(actions);
                    listBody.appendChild(row);

                    deleteButton.addEventListener('click', async () => {
                        const confirmed = await window.DialogService.confirmAction(
                            '确定删除该分类吗？该分类下的商品将被归类为“其他”。'
                        );
                        if (!confirmed) return;
                        if (InventoryData.deleteCategory(deleteButton.dataset.id)) {
                            renderList();
                            if (window.InventoryUI) {
                                window.InventoryUI.renderCategoryFilter();
                                window.InventoryUI.renderBrandFilter();
                                window.InventoryUI.renderContent();
                            }
                            Utils.showNotification('分类已删除', 'success');
                        }
                    });
                });
            };

            renderList();

            const addCategory = () => {
                const name = input.value.trim();
                if (!name) return;

                const newId = InventoryData.addCategory(name);
                if (newId) {
                    input.value = '';
                    renderList();
                    // 刷新主界面的分类筛选器
                    if (window.InventoryUI) {
                        window.InventoryUI.renderCategoryFilter();
                        window.InventoryUI.renderBrandFilter();
                    }
                    Utils.showNotification('分类添加成功', 'success');
                } else if (newId === null) {
                    Utils.showNotification('分类已存在', 'error');
                }
            };

            addBtn.addEventListener('click', addCategory);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addCategory();
            });
        });
    }

    /**
     * 打开添加商品模态框
     */
    openAddItemModal() {
        const html = `
            <div class="modal" id="addItemModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">添加新商品</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="addItemForm" class="form">
                            <div class="form-group">
                                <label class="form-label required">商品名称</label>
                                <input type="text" name="name" class="form-control" required placeholder="例如：洗手液">
                            </div>
                            
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label required">分类</label>
                                    <div class="select-container">
                                        <select name="category" class="form-control" required>
                                            <option value="">请选择分类</option>
                                        </select>
                                        <div class="arrow-down"></div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">品牌</label>
                                    <div class="autocomplete-container">
                                        <input type="text" name="brand" class="form-control" placeholder="例如：兰蔻、雅诗兰黛、SK-II" autocomplete="off" list="brandList">
                                        <datalist id="brandList"></datalist>
                                        <div class="suggestions" id="brandSuggestions"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">规格/型号</label>
                                <div class="spec-input-container">
                                    <input type="text" name="spec" class="form-control" placeholder="例如：30ml、50ml、100ml" list="commonSpecs">
                                    <datalist id="commonSpecs">
                                        <option value="30ml">
                                        <option value="50ml">
                                        <option value="100ml">
                                        <option value="150ml">
                                        <option value="200ml">
                                        <option value="30g">
                                        <option value="50g">
                                        <option value="100g">
                                    </datalist>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <div class="batch-header">
                                    <label class="form-label required">批次信息</label>
                                    <button type="button" id="addBatchBtn" class="small-button">+ 添加批次</button>
                                </div>
                                <div id="batchesContainer" class="batches-container">
                                    <div class="batch-item-form" data-batch-index="0">
                                        <div class="batch-item-header">
                                            <span class="batch-number">批次 1</span>
                                            <button type="button" class="batch-remove-btn" style="display: none;">删除</button>
                                        </div>
                                        <div class="form-grid">
                                            <div class="form-group">
                                                <label class="form-label required">数量</label>
                                                <input type="number" name="batch[0][quantity]" class="form-control batch-quantity" min="1" value="1" required>
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label required">购买日期</label>
                                                <input type="date" name="batch[0][purchaseDate]" class="form-control batch-purchase-date" required value="${localCalendarDate()}">
                                            </div>
                                        </div>
                                        <div class="form-grid">
                                            <div class="form-group">
                                                <label class="form-label">过期日期</label>
                                                <input type="date" name="batch[0][expiryDate]" class="form-control batch-expiry-date">
                                            </div>
                                            <div class="form-group">
                                                <label class="form-label required">单价</label>
                                                <div class="input-with-addon">
                                                    <span class="input-addon">¥</span>
                                                    <input type="number" name="batch[0][price]" class="form-control batch-price" step="0.01" min="0" required placeholder="0.00">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-text">可以为同一商品添加多个批次，每个批次可以有不同的过期时间</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">存放位置</label>
                                <input type="text" name="storage" class="form-control" placeholder="例如：储物柜A-2">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">备注</label>
                                <textarea name="remark" class="form-control" placeholder="填写更多商品信息..."></textarea>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="secondary-button cancel-button">取消</button>
                                <button type="submit" class="primary-button">保存商品</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'addItemModal', (modal) => {
            const form = modal.querySelector('#addItemForm');
            this._fillCategoryOptions(modal.querySelector('select[name="category"]'));

            // 填充品牌列表到datalist
            const brandList = modal.querySelector('#brandList');
            const brands = InventoryData.getAllBrands();
            brands.forEach(brand => {
                const option = document.createElement('option');
                option.value = brand;
                brandList.appendChild(option);
            });
            
            // 品牌自动补全
            this._setupBrandAutocomplete(modal.querySelector('input[name="brand"]'), modal.querySelector('#brandSuggestions'));
            
            // 批次管理
            let batchIndex = 1;
            const addBatchBtn = modal.querySelector('#addBatchBtn');
            const batchesContainer = modal.querySelector('#batchesContainer');
            
            addBatchBtn.addEventListener('click', () => {
                const batchHtml = `
                    <div class="batch-item-form" data-batch-index="${batchIndex}">
                        <div class="batch-item-header">
                            <span class="batch-number">批次 ${batchIndex + 1}</span>
                            <button type="button" class="batch-remove-btn">删除</button>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label required">数量</label>
                                <input type="number" name="batch[${batchIndex}][quantity]" class="form-control batch-quantity" min="1" value="1" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label required">购买日期</label>
                                <input type="date" name="batch[${batchIndex}][purchaseDate]" class="form-control batch-purchase-date" required value="${localCalendarDate()}">
                            </div>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">过期日期</label>
                                <input type="date" name="batch[${batchIndex}][expiryDate]" class="form-control batch-expiry-date">
                            </div>
                            <div class="form-group">
                                <label class="form-label required">单价</label>
                                <div class="input-with-addon">
                                    <span class="input-addon">¥</span>
                                    <input type="number" name="batch[${batchIndex}][price]" class="form-control batch-price" step="0.01" min="0" required placeholder="0.00">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = batchHtml;
                const batchElement = tempDiv.firstChild;
                batchesContainer.appendChild(batchElement);
                
                batchIndex++;
                updateBatchNumbers();
            });
            
            // 更新批次编号和删除按钮显示
            const updateBatchNumbers = () => {
                const batchForms = batchesContainer.querySelectorAll('.batch-item-form');
                batchForms.forEach((form, index) => {
                    form.querySelector('.batch-number').textContent = `批次 ${index + 1}`;
                    const removeBtn = form.querySelector('.batch-remove-btn');
                    if (batchForms.length > 1) {
                        removeBtn.style.display = 'inline-block';
                    } else {
                        removeBtn.style.display = 'none';
                    }
                });
            };
            
            // 为所有批次绑定删除按钮事件（使用事件委托）
            batchesContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('batch-remove-btn')) {
                    const batchForm = e.target.closest('.batch-item-form');
                    const batchForms = batchesContainer.querySelectorAll('.batch-item-form');
                    if (batchForms.length > 1 && batchForm) {
                        batchForm.remove();
                        updateBatchNumbers();
                    }
                }
            });
            
            // 初始化时更新批次编号
            updateBatchNumbers();
            
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                
                // 提取基本商品信息
                const data = {
                    name: formData.get('name'),
                    category: formData.get('category'),
                    brand: formData.get('brand') || '',
                    spec: formData.get('spec') || '',
                    storage: formData.get('storage') || '',
                    remark: formData.get('remark') || ''
                };
                
                // 提取批次信息
                const batches = [];
                const batchForms = batchesContainer.querySelectorAll('.batch-item-form');
                
                batchForms.forEach((batchForm, index) => {
                    const quantity = parseInt(batchForm.querySelector('.batch-quantity').value) || 0;
                    const purchaseDate = batchForm.querySelector('.batch-purchase-date').value;
                    const expiryDate = batchForm.querySelector('.batch-expiry-date').value || null;
                    const price = parseFloat(batchForm.querySelector('.batch-price').value) || 0;
                    
                    if (quantity > 0 && purchaseDate) {
                        batches.push({
                            id: Utils.generateUUID(),
                            quantity: quantity,
                            purchaseDate: purchaseDate,
                            expiryDate: expiryDate,
                            price: price
                        });
                    }
                });
                
                if (batches.length === 0) {
                    Utils.showNotification('请至少添加一个批次', 'error');
                    return;
                }
                
                // 设置批次信息
                data.batches = batches;
                
                // 计算总数量和平均价格
                data.quantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
                const totalPrice = batches.reduce((sum, batch) => sum + (batch.price * batch.quantity), 0);
                data.price = data.quantity > 0 ? totalPrice / data.quantity : 0;
                
                try {
                    if (InventoryData.addItem(data)) {
                        Utils.showNotification('商品添加成功', 'success');
                        this.closeModal('addItemModal');
                        if (window.InventoryUI) {
                            window.InventoryUI.renderBrandFilter();
                            window.InventoryUI.renderContent();
                        }
                    }
                } catch (error) {
                    console.error(error);
                    Utils.showNotification('添加失败：' + error.message, 'error');
                }
            });
        });
    }

    /**
     * 打开编辑商品模态框
     * @param {string} itemId - 商品ID
     */
    openEditItemModal(itemId) {
        const item = InventoryData.getItem(itemId);
        if (!item) {
            Utils.showNotification('商品不存在', 'error');
            return;
        }

        const html = `
            <div class="modal" id="editItemModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">编辑商品</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="editItemForm" class="form">
                            <input type="hidden" name="id">
                            
                            <div class="form-group">
                                <label class="form-label required">商品名称</label>
                                <input type="text" name="name" class="form-control" required>
                            </div>
                            
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label required">分类</label>
                                    <div class="select-container">
                                        <select name="category" class="form-control" required>
                                            <option value="">请选择分类</option>
                                        </select>
                                        <div class="arrow-down"></div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">品牌</label>
                                    <div class="autocomplete-container">
                                        <input type="text" name="brand" class="form-control" autocomplete="off">
                                        <div class="suggestions" id="editBrandSuggestions"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">规格/型号</label>
                                    <input type="text" name="spec" class="form-control">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">存放位置</label>
                                    <input type="text" name="storage" class="form-control">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">备注</label>
                                <textarea name="remark" class="form-control"></textarea>
                            </div>
                            
                            <div class="alert alert-info">
                                <div class="alert-icon">ℹ️</div>
                                <div>注意：数量和价格请在"批次管理"或"调整数量"中修改</div>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="secondary-button cancel-button">取消</button>
                                <button type="submit" class="primary-button">保存修改</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'editItemModal', (modal) => {
            const form = modal.querySelector('#editItemForm');
            form.elements.id.value = item.id;
            form.elements.name.value = item.name;
            form.elements.brand.value = item.brand;
            form.elements.spec.value = item.spec;
            form.elements.storage.value = item.storage;
            form.elements.remark.value = item.remark;
            this._fillCategoryOptions(form.elements.category, item.category);

            this._setupBrandAutocomplete(modal.querySelector('input[name="brand"]'), modal.querySelector('#editBrandSuggestions'));
            
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const updates = Object.fromEntries(formData.entries());
                
                try {
                    if (InventoryData.updateItem(item.id, updates)) {
                        Utils.showNotification('商品更新成功', 'success');
                        this.closeModal('editItemModal');
                        if (window.InventoryUI) {
                            window.InventoryUI.renderBrandFilter();
                            window.InventoryUI.renderContent();
                        }
                    }
                } catch (error) {
                    Utils.showNotification('更新失败：' + error.message, 'error');
                }
            });
        });
    }

    /**
     * 打开调整数量模态框
     * @param {string} itemId - 商品ID
     */
    openAdjustQuantityModal(itemId) {
        const item = InventoryData.getItem(itemId);
        if (!item) return;

        const html = `
            <div class="modal" id="adjustQuantityModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">调整库存数量</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <h3 class="adjust-item-name"></h3>
                            <p class="text-secondary adjust-current-quantity"></p>
                        </div>
                        
                        <form id="adjustQuantityForm">
                            <div class="quantity-adjustment">
                                <button type="button" class="quantity-button quantity-decrease" id="btnDecrease">-</button>
                                <input type="number" id="adjustValue" class="quantity-value form-control text-center" value="1" min="1">
                                <button type="button" class="quantity-button quantity-increase" id="btnIncrease">+</button>
                            </div>
                            
                            <div class="adjustment-type text-center mb-3">
                                <label class="radio-label">
                                    <input type="radio" name="adjustType" value="add" checked> 入库 (增加)
                                </label>
                                <label class="radio-label ml-3">
                                    <input type="radio" name="adjustType" value="sub"> 出库 (减少)
                                </label>
                            </div>
                            
                            <div class="form-group adjustment-reason">
                                <label class="form-label">调整原因</label>
                                <select name="reason" class="form-control">
                                    <option value="日常使用">日常使用</option>
                                    <option value="新购入库">新购入库</option>
                                    <option value="损耗/过期">损耗/过期</option>
                                    <option value="库存盘点">库存盘点</option>
                                    <option value="其他">其他</option>
                                </select>
                            </div>
                            
                            <div class="form-actions">
                                <button type="button" class="secondary-button cancel-button">取消</button>
                                <button type="submit" class="primary-button">确认调整</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'adjustQuantityModal', (modal) => {
            const input = modal.querySelector('#adjustValue');
            const decreaseBtn = modal.querySelector('#btnDecrease');
            const increaseBtn = modal.querySelector('#btnIncrease');
            const form = modal.querySelector('#adjustQuantityForm');
            modal.querySelector('.adjust-item-name').textContent = item.name;
            modal.querySelector('.adjust-current-quantity').textContent = `当前库存: ${item.quantity}`;
            
            decreaseBtn.addEventListener('click', () => {
                const val = parseInt(input.value) || 0;
                if (val > 1) input.value = val - 1;
            });
            
            increaseBtn.addEventListener('click', () => {
                const val = parseInt(input.value) || 0;
                input.value = val + 1;
            });
            
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const val = parseInt(input.value) || 0;
                if (val <= 0) return;
                
                const type = form.querySelector('input[name="adjustType"]:checked').value;
                const change = type === 'add' ? val : -val;
                const reason = form.querySelector('select[name="reason"]').value;
                
                if (type === 'sub' && item.quantity + change < 0) {
                    Utils.showNotification('库存不足，无法减少', 'error');
                    return;
                }
                
                if (InventoryData.adjustQuantity(itemId, change, null, reason)) {
                    Utils.showNotification(`库存已${type === 'add' ? '增加' : '减少'} ${val}`, 'success');
                    this.closeModal('adjustQuantityModal');
                    if (window.InventoryUI) {
                        window.InventoryUI.renderBrandFilter();
                        window.InventoryUI.renderContent();
                    }
                }
            });
        });
    }

    /**
     * 打开删除确认模态框
     * @param {string} itemId - 商品ID
     */
    openDeleteItemModal(itemId) {
        const item = InventoryData.getItem(itemId);
        if (!item) return;

        const html = `
            <div class="modal" id="deleteItemModal">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2 class="modal-title text-error">删除确认</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>确定要删除商品 <strong class="delete-item-name"></strong> 吗？</p>
                        <p class="text-secondary text-small mt-2">此操作将删除该商品的所有库存记录和历史记录，且无法恢复。</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="secondary-button cancel-button">取消</button>
                        <button type="button" class="primary-button bg-error" id="confirmDelete">确认删除</button>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'deleteItemModal', (modal) => {
            modal.querySelector('.delete-item-name').textContent = item.name;
            modal.querySelector('#confirmDelete').addEventListener('click', () => {
                if (InventoryData.deleteItem(itemId)) {
                    Utils.showNotification('商品已删除', 'success');
                    this.closeModal('deleteItemModal');
                    if (window.InventoryUI) {
                        window.InventoryUI.renderBrandFilter();
                        window.InventoryUI.renderContent();
                    }
                }
            });
        });
    }

    /**
     * 打开商品详情模态框
     * @param {string} itemId - 商品ID
     */
    openItemDetailsModal(itemId) {
        const item = InventoryData.getItem(itemId);
        if (!item) return;

        const status = Utils.getItemStatus(item.quantity, InventoryData.settings.lowStockThreshold);
        const statusText = Utils.getStatusText(status);

        const html = `
            <div class="modal item-details-modal" id="itemDetailsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title details-item-name"></h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="item-details-grid">
                            <div class="item-detail-card">
                                <div class="item-detail-title">库存状态</div>
                                <div class="item-detail-value">
                                    <span class="status-badge details-status"></span>
                                </div>
                            </div>
                            <div class="item-detail-card">
                                <div class="item-detail-title">当前数量</div>
                                <div class="item-detail-value details-quantity"></div>
                            </div>
                            <div class="item-detail-card">
                                <div class="item-detail-title">分类</div>
                                <div class="item-detail-value details-category"></div>
                            </div>
                            <div class="item-detail-card">
                                <div class="item-detail-title">品牌/规格</div>
                                <div class="item-detail-value details-brand-spec"></div>
                            </div>
                        </div>

                        <div class="item-description">
                            <div class="item-description-title">备注</div>
                            <div class="item-description-content"></div>
                        </div>

                        <div class="tab-container">
                            <div class="tab-header">
                                <button class="tab-button active" data-tab="batches">批次信息</button>
                                <button class="tab-button" data-tab="history">历史记录</button>
                            </div>
                            
                            <div class="tab-content active" id="tab-batches">
                                <div class="inventory-table-container">
                                    <table class="inventory-table">
                                        <thead>
                                            <tr>
                                                <th>购买日期</th>
                                                <th>过期日期</th>
                                                <th>数量</th>
                                                <th>单价</th>
                                            </tr>
                                        </thead>
                                        <tbody class="details-batches"></tbody>
                                    </table>
                                </div>
                            </div>
                            
                            <div class="tab-content" id="tab-history">
                                <div class="timeline">
                                    <!-- 历史记录动态加载 -->
                                    <div class="text-center text-secondary p-3">加载中...</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="secondary-button" data-action="edit-item">编辑商品</button>
                        <button class="primary-button" data-action="adjust-quantity">调整库存</button>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'itemDetailsModal', (modal) => {
            modal.querySelector('.details-item-name').textContent = item.name;
            const statusBadge = modal.querySelector('.details-status');
            statusBadge.classList.add(`status-${status}`);
            statusBadge.textContent = statusText;
            const quantity = modal.querySelector('.details-quantity');
            if (status === 'out-stock') quantity.classList.add('text-error');
            quantity.textContent = item.quantity;
            modal.querySelector('.details-category').textContent = item.category || '-';
            modal.querySelector('.details-brand-spec').textContent = `${item.brand || '-'} / ${item.spec || '-'}`;
            const description = modal.querySelector('.item-description');
            if (item.remark) {
                description.querySelector('.item-description-content').textContent = item.remark;
            } else {
                description.remove();
            }

            const batches = modal.querySelector('.details-batches');
            item.batches.forEach(batch => {
                const row = document.createElement('tr');
                const purchaseDate = document.createElement('td');
                purchaseDate.textContent = Utils.formatDate(batch.purchaseDate);
                const expiryDate = document.createElement('td');
                const expiring = this._isExpiring(batch.expiryDate);
                if (expiring) expiryDate.classList.add('text-warning');
                expiryDate.textContent = `${batch.expiryDate ? Utils.formatDate(batch.expiryDate) : '-'}${expiring ? ' ⚠️' : ''}`;
                const batchQuantity = document.createElement('td');
                batchQuantity.textContent = batch.quantity;
                const price = document.createElement('td');
                price.textContent = Utils.formatPrice(batch.price);
                row.appendChild(purchaseDate);
                row.appendChild(expiryDate);
                row.appendChild(batchQuantity);
                row.appendChild(price);
                batches.appendChild(row);
            });
            modal.querySelectorAll('[data-action]').forEach(button => {
                button.dataset.itemId = item.id;
            });

            // 事件委托：处理动态生成的按钮点击
            modal.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                const itemId = e.target.getAttribute('data-item-id');
                
                if (action === 'edit-item' && itemId) {
                    e.preventDefault();
                    this.closeModal('itemDetailsModal');
                    setTimeout(() => this.openEditItemModal(itemId), 100);
                } else if (action === 'adjust-quantity' && itemId) {
                    e.preventDefault();
                    this.closeModal('itemDetailsModal');
                    setTimeout(() => this.openAdjustQuantityModal(itemId), 100);
                }
            });

            // Tab 切换逻辑
            const tabs = modal.querySelectorAll('.tab-button');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    modal.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
                    modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    
                    tab.classList.add('active');
                    const tabId = `tab-${tab.dataset.tab}`;
                    modal.querySelector(`#${tabId}`).classList.add('active');

                    if (tab.dataset.tab === 'history') {
                        this._loadItemHistory(item.id, modal.querySelector('#tab-history .timeline'));
                    }
                });
            });
        });
    }

    /**
     * 打开高级筛选模态框
     * @param {Object} currentFilters - 当前筛选条件
     * @param {Function} onApply - 应用回调
     */
    openAdvancedFilterModal(currentFilters, onApply) {
        const html = `
            <div class="modal" id="filterModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">高级筛选</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="filterForm" class="form">
                            <div class="form-group">
                                <label class="form-label">价格范围</label>
                                <div class="d-flex align-items-center gap-2">
                                    <input type="number" name="minPrice" class="form-control" placeholder="最低价" min="0">
                                    <span>-</span>
                                    <input type="number" name="maxPrice" class="form-control" placeholder="最高价" min="0">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">购买日期</label>
                                <div class="d-flex align-items-center gap-2">
                                    <input type="date" name="fromDate" class="form-control">
                                    <span>至</span>
                                    <input type="date" name="toDate" class="form-control">
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">特殊状态</label>
                                <div class="d-flex flex-column gap-2">
                                    <label class="checkbox-label d-flex align-items-center">
                                        <input type="checkbox" name="expiringSoon">
                                        <span class="ml-2 expiring-filter-label"></span>
                                    </label>
                                    <label class="checkbox-label d-flex align-items-center">
                                        <input type="checkbox" name="expired">
                                        <span class="ml-2">已过期</span>
                                    </label>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="secondary-button" id="clearFilters">清除筛选</button>
                                <button type="submit" class="primary-button">应用筛选</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'filterModal', (modal) => {
            const form = modal.querySelector('#filterForm');
            form.elements.minPrice.value = currentFilters.minPrice ?? '';
            form.elements.maxPrice.value = currentFilters.maxPrice ?? '';
            form.elements.fromDate.value = currentFilters.fromDate || '';
            form.elements.toDate.value = currentFilters.toDate || '';
            form.elements.expiringSoon.checked = Boolean(currentFilters.expiringSoon);
            form.elements.expired.checked = Boolean(currentFilters.expired);
            modal.querySelector('.expiring-filter-label').textContent =
                `即将过期 (${InventoryData.settings.expiryWarningDays}天内)`;

            modal.querySelector('#clearFilters').addEventListener('click', () => {
                form.reset();
            });

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const filters = {
                    minPrice: formData.get('minPrice') ? parseFloat(formData.get('minPrice')) : undefined,
                    maxPrice: formData.get('maxPrice') ? parseFloat(formData.get('maxPrice')) : undefined,
                    fromDate: formData.get('fromDate') || undefined,
                    toDate: formData.get('toDate') || undefined,
                    expiringSoon: formData.get('expiringSoon') === 'on',
                    expired: formData.get('expired') === 'on'
                };
                
                onApply(filters);
                this.closeModal('filterModal');
            });
        });
    }

    /**
     * 使用安全属性和文本填充分类选项，供新增与编辑表单复用。
     */
    _fillCategoryOptions(select, selectedCategory = null) {
        const categories = InventoryData.getAllCategories();
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            option.selected = category.name === selectedCategory;
            select.appendChild(option);
        });
    }

    /**
     * 辅助方法：设置品牌自动补全
     */
    _setupBrandAutocomplete(input, suggestionsContainer) {
        const brands = InventoryData.getAllBrands();
        
        input.addEventListener('input', () => {
            const val = input.value.toLowerCase();
            if (!val) {
                suggestionsContainer.style.display = 'none';
                return;
            }
            
            const matches = brands.filter(b => b.toLowerCase().includes(val));
            if (matches.length > 0) {
                suggestionsContainer.replaceChildren();
                matches.forEach(brand => {
                    const suggestion = document.createElement('div');
                    suggestion.className = 'suggestion-item';
                    suggestion.textContent = brand;
                    suggestionsContainer.appendChild(suggestion);
                });
                suggestionsContainer.style.display = 'block';
                
                suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        input.value = item.textContent;
                        suggestionsContainer.style.display = 'none';
                    });
                });
            } else {
                suggestionsContainer.style.display = 'none';
            }
        });

        // 点击外部关闭（使用 once-safe 方式，在 modal 关闭时自动清理）
        const closeSuggestions = (e) => {
            if (e.target !== input && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.style.display = 'none';
            }
        };
        document.addEventListener('click', closeSuggestions);

        // 当 input 被移除时（modal 关闭），清理监听器
        const observer = new MutationObserver(() => {
            if (!document.contains(input)) {
                document.removeEventListener('click', closeSuggestions);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * 辅助方法：判断是否即将过期
     */
    _isExpiring(expiryDate) {
        if (!expiryDate) return false;
        const calendarDate = inventoryCalendarDateObject(expiryDate);
        if (!calendarDate) return false;
        const days = Utils.daysBetween(new Date(), calendarDate);
        return days >= 0 && days <= InventoryData.settings.expiryWarningDays;
    }

    /**
     * 辅助方法：加载商品历史记录
     */
    _loadItemHistory(itemId, container) {
        const history = InventoryData.getHistory(50).filter(h => h.itemId === itemId);
        
        if (history.length === 0) {
            container.innerHTML = '<div class="text-center text-secondary p-3">暂无历史记录</div>';
            return;
        }

        container.replaceChildren();
        history.forEach(record => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            const dot = document.createElement('div');
            dot.className = 'timeline-dot';
            const date = document.createElement('div');
            date.className = 'timeline-date';
            date.textContent = Utils.formatDate(record.timestamp, {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const content = document.createElement('div');
            content.className = 'timeline-content';
            const title = document.createElement('div');
            title.className = 'timeline-title';
            title.textContent = this._getHistoryTypeText(record.type);
            const detail = document.createElement('div');
            detail.className = 'timeline-detail';
            detail.textContent = record.details;
            content.appendChild(title);
            content.appendChild(detail);
            item.appendChild(dot);
            item.appendChild(date);
            item.appendChild(content);
            container.appendChild(item);
        });
    }

    _getHistoryTypeText(type) {
        const types = {
            'add': '新增商品',
            'update': '更新信息',
            'delete': '删除商品',
            'adjust': '调整库存',
            'batch-add': '添加批次',
            'batch-update': '更新批次',
            'batch-delete': '删除批次'
        };
        return types[type] || '操作记录';
    }
    
    /**
     * 打开购物清单模态框
     */
    openShoppingListModal() {
        const shoppingList = InventoryData.getShoppingList();
        const unpurchased = shoppingList.filter(item => !item.purchased);
        const purchased = shoppingList.filter(item => item.purchased);
        
        const html = `
            <div class="modal" id="shoppingListModal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 class="modal-title">购物清单</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="shopping-list-actions mb-3">
                            <button id="autoGenerateBtn" class="primary-button">自动生成清单</button>
                            <button id="clearPurchasedBtn" class="secondary-button">清除已购买</button>
                        </div>
                        
                        <div class="shopping-list-section">
                            <h3 class="section-title unpurchased-title"></h3>
                            <div id="unpurchasedList" class="shopping-list-items"></div>
                        </div>
                        
                        <div class="shopping-list-section purchased-section mt-4">
                            <h3 class="section-title purchased-title"></h3>
                            <div id="purchasedList" class="shopping-list-items"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(html, 'shoppingListModal', (modal) => {
            modal.querySelector('.unpurchased-title').textContent = `待购买 (${unpurchased.length})`;
            const unpurchasedList = modal.querySelector('#unpurchasedList');
            if (unpurchased.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-secondary text-center p-3';
                empty.textContent = '暂无待购买商品';
                unpurchasedList.appendChild(empty);
            }
            unpurchased.forEach(entry => {
                const row = document.createElement('div');
                row.className = 'shopping-list-item';
                row.dataset.id = entry.id;
                const info = document.createElement('div');
                info.className = 'shopping-item-info';
                const name = document.createElement('div');
                name.className = 'shopping-item-name';
                name.textContent = entry.itemName;
                const reason = document.createElement('div');
                reason.className = 'shopping-item-reason';
                reason.textContent = entry.reason;
                info.appendChild(name);
                info.appendChild(reason);
                const actions = document.createElement('div');
                actions.className = 'shopping-item-actions';
                const purchase = document.createElement('button');
                purchase.className = 'action-icon action-icon-check';
                purchase.dataset.action = 'purchase';
                purchase.title = '标记为已购买';
                purchase.textContent = '✓';
                const remove = document.createElement('button');
                remove.className = 'action-icon action-icon-delete';
                remove.dataset.action = 'remove';
                remove.title = '移除';
                remove.textContent = '✕';
                actions.appendChild(purchase);
                actions.appendChild(remove);
                row.appendChild(info);
                row.appendChild(actions);
                unpurchasedList.appendChild(row);
            });

            const purchasedSection = modal.querySelector('.purchased-section');
            if (purchased.length === 0) {
                purchasedSection.remove();
            } else {
                modal.querySelector('.purchased-title').textContent = `已购买 (${purchased.length})`;
                const purchasedList = modal.querySelector('#purchasedList');
                purchased.forEach(entry => {
                    const row = document.createElement('div');
                    row.className = 'shopping-list-item purchased';
                    row.dataset.id = entry.id;
                    const info = document.createElement('div');
                    info.className = 'shopping-item-info';
                    const name = document.createElement('div');
                    name.className = 'shopping-item-name';
                    name.textContent = entry.itemName;
                    const date = document.createElement('div');
                    date.className = 'shopping-item-date';
                    date.textContent = Utils.formatDate(entry.purchasedAt);
                    info.appendChild(name);
                    info.appendChild(date);
                    row.appendChild(info);
                    purchasedList.appendChild(row);
                });
            }

            // 自动生成清单
            modal.querySelector('#autoGenerateBtn').addEventListener('click', () => {
                const count = InventoryData.addGeneratedShoppingList();
                if (count === false) return;
                Utils.showNotification(`已添加 ${count} 个商品到购物清单`, count > 0 ? 'success' : 'info');
                if (count > 0) {
                    this.closeModal('shoppingListModal');
                    this.openShoppingListModal();
                }
            });
            
            // 清除已购买
            modal.querySelector('#clearPurchasedBtn').addEventListener('click', async () => {
                const confirmed = await window.DialogService.confirmAction('确定清除所有已购买的商品吗？');
                if (!confirmed) return;
                const count = InventoryData.clearPurchasedShoppingList();
                if (count !== false) {
                    Utils.showNotification('已清除已购买商品', 'success');
                    this.closeModal('shoppingListModal');
                    this.openShoppingListModal();
                }
            });
            
            // 标记为已购买
            modal.querySelectorAll('[data-action="purchase"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const itemId = btn.closest('.shopping-list-item').dataset.id;
                    if (InventoryData.markShoppingListItemPurchased(itemId)) {
                        Utils.showNotification('已标记为已购买', 'success');
                        if (window.InventoryUI) window.InventoryUI.renderSummary();
                        this.closeModal('shoppingListModal');
                        this.openShoppingListModal();
                    }
                });
            });
            
            // 移除
            modal.querySelectorAll('[data-action="remove"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const itemId = btn.closest('.shopping-list-item').dataset.id;
                    if (InventoryData.removeFromShoppingList(itemId)) {
                        Utils.showNotification('已从购物清单移除', 'success');
                        if (window.InventoryUI) window.InventoryUI.renderSummary();
                        this.closeModal('shoppingListModal');
                        this.openShoppingListModal();
                    }
                });
            });
        });
    }
    
    /**
     * 打开提醒模态框
     */
    openRemindersModal() {
        const reminders = InventoryData.getReminders();

        const html = `
            <div class="modal" id="remindersModal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 class="modal-title">提醒</h2>
                        <button class="close-button">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="reminders-content"></div>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html, 'remindersModal', (modal) => {
            const content = modal.querySelector('.reminders-content');
            if (reminders.expiringSoon.length === 0 && reminders.needToBuy.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-center text-secondary p-4';
                empty.textContent = '暂无提醒';
                content.appendChild(empty);
            }

            const sections = [
                {
                    entries: reminders.expiringSoon,
                    titleClass: 'warning',
                    title: `⚠️ 即将过期 (${reminders.expiringSoon.length})`,
                    detailText: item => `还有 ${item.daysToExpiry} 天过期`
                },
                {
                    entries: reminders.needToBuy,
                    titleClass: 'highlight',
                    title: `🛒 需要购买 (${reminders.needToBuy.length})`,
                    detailText: item => item.reason
                }
            ];

            sections.forEach(section => {
                if (section.entries.length === 0) return;
                const sectionElement = document.createElement('div');
                sectionElement.className = 'reminder-section';
                if (content.children.length > 0) sectionElement.classList.add('mt-4');
                const title = document.createElement('h3');
                title.className = `reminder-title ${section.titleClass}`;
                title.textContent = section.title;
                const items = document.createElement('div');
                items.className = 'reminder-items';

                section.entries.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'reminder-item';
                    const name = document.createElement('div');
                    name.className = 'reminder-item-name';
                    name.textContent = item.itemName;
                    const detail = document.createElement('div');
                    detail.className = 'reminder-item-detail';
                    detail.textContent = section.detailText(item);
                    const addButton = document.createElement('button');
                    addButton.className = 'action-icon action-icon-add';
                    addButton.dataset.action = 'add-to-shopping-list';
                    addButton.dataset.itemId = item.itemId;
                    addButton.title = '添加到购物清单';
                    addButton.textContent = '🛒';
                    row.appendChild(name);
                    row.appendChild(detail);
                    row.appendChild(addButton);
                    items.appendChild(row);
                });

                sectionElement.appendChild(title);
                sectionElement.appendChild(items);
                content.appendChild(sectionElement);
            });

            // 事件委托：处理动态生成的"添加到购物清单"按钮
            modal.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                const itemId = e.target.getAttribute('data-item-id');
                
                if (action === 'add-to-shopping-list' && itemId) {
                    e.preventDefault();
                    this.addToShoppingListFromReminder(itemId);
                }
            });
        });
    }
    
    /**
     * 从提醒添加到购物清单
     * @param {string} itemId - 商品ID
     */
    addToShoppingListFromReminder(itemId) {
        const item = InventoryData.getItem(itemId);
        if (!item) return;
        
        const reason = item.quantity <= 0 ? '已用完' : '低库存';
        const added = InventoryData.addToShoppingList(itemId, reason);
        if (added) {
            Utils.showNotification(`${item.name} 已添加到购物清单`, 'success');
            if (window.InventoryUI) window.InventoryUI.renderSummary();
        } else if (added === null) {
            Utils.showNotification(`${item.name} 已在购物清单中`, 'info');
        }
    }
}

// 导出实例
window.ModalsManager = new InventoryModals();
