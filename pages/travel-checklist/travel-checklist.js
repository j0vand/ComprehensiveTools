/**
 * 出行清单 - 主逻辑
 * 多清单、待完成/已完成分区、增删改勾选、重置、导出导入
 */
(function() {
    'use strict';

    const DATA_VERSION = 1;
    const STORAGE_KEY = (typeof window !== 'undefined' && window.StorageKeys && window.StorageKeys.TRAVEL_CHECKLIST)
        ? window.StorageKeys.TRAVEL_CHECKLIST
        : 'travelChecklist_data';

    const DEFAULT_ITEMS = [
        { text: '身份证', type: 'item' },
        { text: '手机', type: 'item' },
        { text: '充电器', type: 'item' },
        { text: '钥匙', type: 'item' },
        { text: '证件', type: 'item' }
    ];

    /** 默认类型（每份清单可自定义，绑定到清单，复制时一并复制） */
    function getDefaultTypes() {
        return [{ id: 'item', name: '物品' }, { id: 'task', name: '事项' }];
    }

    const TEMPLATES = [
        { id: 'short', name: '短途 1～2 天', extra: [{ text: '充电宝', type: 'item' }, { text: '常用药', type: 'item' }] },
        { id: 'weekend', name: '周末出游', extra: [{ text: '换洗衣物', type: 'item' }, { text: '洗漱用品', type: 'item' }, { text: '充电宝', type: 'item' }] },
        { id: 'long', name: '长途', extra: [{ text: '换洗衣物', type: 'item' }, { text: '洗漱用品', type: 'item' }, { text: '充电宝', type: 'item' }, { text: '常用药', type: 'item' }, { text: '行程单', type: 'task' }] },
        { id: 'business', name: '商务出差', extra: [{ text: '电脑', type: 'item' }, { text: '名片', type: 'item' }, { text: '行程单', type: 'task' }] }
    ];

    let state = { lists: [], activeListId: null };
    let editingItemId = null;

    /**
     * 生成唯一 id
     * @returns {string}
     */
    function generateId() {
        return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }

    /**
     * 从默认项 + 可选模板扩展项 构建 items 数组（含 id, order, checked）
     * @param {string} [templateId] - 模板 id，不传则仅默认五项
     * @returns {Array<{id, text, checked, order, type}>}
     */
    function buildInitialItems(templateId) {
        const items = DEFAULT_ITEMS.map(function(item, index) {
            return {
                id: generateId(),
                text: item.text,
                checked: false,
                order: index,
                type: item.type || 'item'
            };
        });
        if (templateId) {
            const tpl = TEMPLATES.find(function(t) { return t.id === templateId; });
            if (tpl && tpl.extra && tpl.extra.length) {
                tpl.extra.forEach(function(item, i) {
                    items.push({
                        id: generateId(),
                        text: item.text,
                        checked: false,
                        order: items.length,
                        type: item.type || 'item'
                    });
                });
            }
        }
        return items;
    }

    /**
     * 显示提示
     * @param {string} message
     * @param {string} type
     */
    function showMessage(message, type) {
        window.DialogService.showToast(message, type, {
            duration: type === 'error' ? 5000 : 3000
        });
    }

    /**
     * 从本地存储读取并迁移旧格式
     */
    function loadData() {
        const raw = window.CommonUtils && window.CommonUtils.getLocalStorageItem
            ? window.CommonUtils.getLocalStorageItem(STORAGE_KEY, null)
            : null;
        if (raw && raw.data) {
            const data = raw.data;
            if (data.lists && Array.isArray(data.lists) && data.lists.length > 0) {
                state.lists = data.lists.map(function(list) {
                    var types = (list.types && list.types.length >= 2)
                        ? list.types.map(function(t) { return { id: t.id || generateId(), name: typeof t.name === 'string' ? t.name : '类型' }; })
                        : getDefaultTypes();
                    return {
                        id: list.id || generateId(),
                        name: typeof list.name === 'string' ? list.name : '未命名',
                        types: types,
                        items: (list.items || []).map(function(item, idx) {
                            return {
                                id: item.id || generateId(),
                                text: typeof item.text === 'string' ? item.text : '',
                                checked: Boolean(item.checked),
                                order: typeof item.order === 'number' ? item.order : idx,
                                type: typeof item.type === 'string' ? item.type : 'item'
                            };
                        })
                    };
                });
                state.activeListId = (data.activeListId && state.lists.some(function(l) { return l.id === data.activeListId; }))
                    ? data.activeListId
                    : state.lists[0].id;
                migrateIncompleteDefaultList();
                return;
            }
            if (data.items && Array.isArray(data.items)) {
                var migratedItems = data.items.map(function(item, idx) {
                    return {
                        id: item.id || generateId(),
                        text: typeof item.text === 'string' ? item.text : '',
                        checked: Boolean(item.checked),
                        order: typeof item.order === 'number' ? item.order : idx,
                        type: item.type === 'task' ? 'task' : 'item'
                    };
                });
                if (migratedItems.length <= 1 && (!migratedItems[0] || migratedItems[0].text === '身份证')) {
                    migratedItems = buildInitialItems();
                }
                state.lists = [{
                    id: generateId(),
                    name: migratedItems.length === 5 && !data.lists ? '我的清单' : '导入的清单',
                    types: getDefaultTypes(),
                    items: migratedItems
                }];
                state.activeListId = state.lists[0].id;
                saveData();
                return;
            }
        }
        state.lists = [{ id: generateId(), name: '我的清单', types: getDefaultTypes(), items: buildInitialItems() }];
        state.activeListId = state.lists[0].id;
    }

    /**
     * 迁移：若只有一份清单且只有一项「身份证」，补全为默认五项（身份证、手机、充电器、钥匙、证件）
     */
    function migrateIncompleteDefaultList() {
        if (state.lists.length !== 1) return;
        var list = state.lists[0];
        if (list.items.length !== 1 || !list.items[0] || list.items[0].text !== '身份证') return;
        list.name = '我的清单';
        list.items = buildInitialItems();
        saveData();
    }

    /**
     * 保存到本地
     * @returns {boolean}
     */
    function saveData() {
        const payload = { version: DATA_VERSION, data: { lists: state.lists, activeListId: state.activeListId } };
        if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
            return window.CommonUtils.setLocalStorageItem(STORAGE_KEY, payload);
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('保存出行清单失败:', e);
            return false;
        }
    }

    /**
     * 获取当前清单
     * @returns {{ id, name, items }|null}
     */
    function getCurrentList() {
        if (!state.activeListId) return null;
        return state.lists.find(function(l) { return l.id === state.activeListId; }) || null;
    }

    /**
     * 当前列表最大 order + 1
     * @returns {number}
     */
    function nextOrder() {
        const list = getCurrentList();
        if (!list || !list.items.length) return 0;
        return Math.max.apply(null, list.items.map(function(i) { return i.order; })) + 1;
    }

    function switchList(id) {
        if (!state.lists.some(function(l) { return l.id === id; })) return;
        state.activeListId = id;
        saveData();
        renderList();
    }

    /**
     * 新建清单
     * @param {string} name
     * @param {string} [templateId]
     */
    function createList(name, templateId) {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            showMessage('请输入清单名称', 'warning');
            return;
        }
        const list = {
            id: generateId(),
            name: trimmed,
            types: getDefaultTypes(),
            items: buildInitialItems(templateId)
        };
        state.lists.push(list);
        state.activeListId = list.id;
        saveData();
        renderList();
        showMessage('已创建清单', 'success');
    }

    /**
     * 复制清单，名称若重复则加数字后缀
     * @param {string} listId
     * @param {string} [newName]
     */
    function duplicateList(listId, newName) {
        const src = state.lists.find(function(l) { return l.id === listId; });
        if (!src) return;
        let name = (newName || '').trim() || (src.name + ' 副本');
        const base = name;
        let n = 1;
        while (state.lists.some(function(l) { return l.name === name; })) {
            name = base + ' ' + (++n);
        }
        const newList = {
            id: generateId(),
            name: name,
            types: (src.types && src.types.length >= 2)
                ? src.types.map(function(t) { return { id: t.id, name: t.name }; })
                : getDefaultTypes(),
            items: src.items.map(function(item) {
                return {
                    id: generateId(),
                    text: item.text,
                    checked: false,
                    order: item.order,
                    type: item.type || 'item'
                };
            })
        };
        state.lists.push(newList);
        state.activeListId = newList.id;
        saveData();
        renderList();
        showMessage('已复制清单', 'success');
    }

    function renameList(listId, name) {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        list.name = trimmed;
        saveData();
        renderList();
        showMessage('已重命名', 'success');
    }

    function deleteList(listId) {
        if (state.lists.length <= 1) {
            showMessage('至少保留一份清单', 'warning');
            return;
        }
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        window.DialogService.confirmAction('确定删除清单「' + list.name + '」？').then(function(confirmed) {
            if (!confirmed) return;
            state.lists = state.lists.filter(function(l) { return l.id !== listId; });
            if (state.activeListId === listId) {
                state.activeListId = state.lists[0].id;
            }
            saveData();
            renderList();
            showMessage('已删除', 'success');
        });
    }

    /**
     * 当前清单的类型列表（若无则返回默认）
     */
    function getListTypes(list) {
        return (list && list.types && list.types.length >= 2) ? list.types : getDefaultTypes();
    }

    /**
     * 根据类型 id 取显示名（绑定到当前清单的 types）
     */
    function getTypeName(list, typeId) {
        var types = getListTypes(list);
        var t = types.find(function(x) { return x.id === typeId; });
        return t ? t.name : (typeId || '物品');
    }

    /**
     * 添加类型到当前清单
     */
    function addType(listId, name) {
        var list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        var trimmed = (name || '').trim();
        if (!trimmed) {
            showMessage('请输入类型名称', 'warning');
            return;
        }
        if (!list.types) list.types = getDefaultTypes();
        if (list.types.some(function(t) { return t.name === trimmed; })) {
            showMessage('已存在同名类型', 'warning');
            return;
        }
        list.types.push({ id: 'type-' + generateId(), name: trimmed });
        saveData();
        renderList();
        showMessage('已添加类型', 'success');
    }

    /**
     * 重命名类型
     */
    function renameType(listId, typeId, name) {
        var list = state.lists.find(function(l) { return l.id === listId; });
        if (!list || !list.types) return;
        var trimmed = (name || '').trim();
        if (!trimmed) return;
        var t = list.types.find(function(x) { return x.id === typeId; });
        if (!t) return;
        t.name = trimmed;
        saveData();
        renderList();
        showMessage('已重命名', 'success');
    }

    /**
     * 删除类型，将其项归入第一个类型
     */
    function deleteType(listId, typeId) {
        var list = state.lists.find(function(l) { return l.id === listId; });
        if (!list || !list.types || list.types.length <= 2) {
            showMessage('至少保留两种类型', 'warning');
            return;
        }
        var firstId = list.types[0].id;
        if (typeId === firstId) {
            showMessage('不能删除第一种类型', 'warning');
            return;
        }
        list.items.forEach(function(i) { if (i.type === typeId) i.type = firstId; });
        list.types = list.types.filter(function(t) { return t.id !== typeId; });
        saveData();
        renderList();
        showMessage('已删除类型，相关项已归入第一种类型', 'success');
    }

    function addItem(text, typeId) {
        const list = getCurrentList();
        if (!list) return;
        const trimmed = (text || '').trim();
        if (!trimmed) {
            showMessage('请输入内容后再添加', 'warning');
            return;
        }
        var validType = (list.types && list.types.some(function(t) { return t.id === typeId; })) ? typeId : (list.types && list.types[0] ? list.types[0].id : 'item');
        list.items.push({
            id: generateId(),
            text: trimmed,
            checked: false,
            order: nextOrder(),
            type: validType
        });
        saveData();
        renderList();
        showMessage('已添加', 'success');
    }

    function deleteItem(listId, itemId) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        window.DialogService.confirmAction('确定删除「' + item.text + '」？').then(function(confirmed) {
            if (!confirmed) return;
            list.items = list.items.filter(function(i) { return i.id !== itemId; });
            saveData();
            renderList();
            showMessage('已删除', 'success');
        });
    }

    function updateItemText(listId, itemId, text) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        const trimmed = (text || '').trim();
        if (trimmed) item.text = trimmed;
        saveData();
        renderList();
        editingItemId = null;
    }

    /** 仅更新项文案并保存，不重新渲染（用于切换编辑目标时保存上一项） */
    function updateItemTextSilent(listId, itemId, text) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        const trimmed = (text || '').trim();
        if (trimmed) item.text = trimmed;
        saveData();
    }

    function toggleItem(listId, itemId) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        item.checked = !item.checked;
        saveData();
        renderList();
    }

    function resetChecked(listId) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return;
        window.DialogService.confirmAction('将取消所有勾选，列表不变。确定吗？').then(function(confirmed) {
            if (!confirmed) return;
            list.items.forEach(function(i) { i.checked = false; });
            saveData();
            renderList();
            showMessage('已重置勾选，可重新逐项确认', 'success');
        });
    }

    /**
     * 渲染清单选择下拉框
     */
    function renderListSwitcher() {
        const el = document.getElementById('list-switcher');
        if (!el) return;
        const cur = state.activeListId;
        el.innerHTML = '';
        state.lists.forEach(function(list) {
            const opt = document.createElement('option');
            opt.value = list.id;
            opt.textContent = list.name;
            if (list.id === cur) opt.selected = true;
            el.appendChild(opt);
        });
    }

    /**
     * 渲染添加区的类型选项（当前清单的 types，可自定义）
     */
    function renderTypeOptions() {
        var container = document.getElementById('type-options-container');
        if (!container) return;
        var list = getCurrentList();
        var types = getListTypes(list);
        container.innerHTML = '';
        types.forEach(function(t, index) {
            var label = document.createElement('label');
            label.className = 'type-option';
            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'new-item-type';
            radio.value = t.id;
            if (index === 0) radio.checked = true;
            radio.setAttribute('aria-label', t.name);
            var span = document.createElement('span');
            span.textContent = t.name;
            label.appendChild(radio);
            label.appendChild(span);
            container.appendChild(label);
        });
    }

    /**
     * 渲染待完成 / 已完成（按当前清单的 types 动态分块）
     */
    function renderPendingDone() {
        const list = getCurrentList();
        const pendingContainer = document.getElementById('pending-subsections');
        const doneContainer = document.getElementById('done-subsections');
        const progressText = document.getElementById('progress-text');
        const allDoneEl = document.getElementById('progress-all-done');

        if (!list || !pendingContainer || !doneContainer) return;

        const types = getListTypes(list);
        const items = list.items.slice().sort(function(a, b) { return a.order - b.order; });
        const pending = items.filter(function(i) { return !i.checked; });
        const done = items.filter(function(i) { return i.checked; });

        function makeItemNode(item, isDone) {
            const li = document.createElement('li');
            li.className = 'checklist-item' + (isDone ? ' checked' : '');
            li.setAttribute('data-id', item.id);
            li.setAttribute('data-list-id', list.id);

            const labelWrap = document.createElement('div');
            labelWrap.className = 'item-label-wrap';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'item-checkbox';
            checkbox.checked = item.checked;
            checkbox.setAttribute('aria-label', (isDone ? '取消勾选：' : '勾选：') + item.text);

            const typeTag = document.createElement('span');
            typeTag.className = 'item-type-tag' + (item.type === 'task' ? ' task' : '');
            typeTag.textContent = getTypeName(list, item.type);

            const textSpan = document.createElement('span');
            textSpan.className = 'item-text';
            textSpan.textContent = item.text;

            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.className = 'item-edit-input';
            editInput.value = item.text;
            editInput.setAttribute('aria-label', '编辑');

            labelWrap.appendChild(checkbox);
            labelWrap.appendChild(typeTag);
            labelWrap.appendChild(textSpan);
            labelWrap.appendChild(editInput);

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn btn-ghost item-edit';
            editBtn.textContent = '编辑';
            editBtn.setAttribute('aria-label', '编辑：' + item.text);

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-danger-small item-delete';
            delBtn.textContent = '删除';
            delBtn.setAttribute('aria-label', '删除：' + item.text);

            li.appendChild(labelWrap);
            li.appendChild(editBtn);
            li.appendChild(delBtn);
            return li;
        }

        function buildSubsections(containerEl, itemsByStatus) {
            containerEl.innerHTML = '';
            types.forEach(function(t) {
                var blockItems = itemsByStatus.filter(function(i) { return i.type === t.id; });
                if (blockItems.length === 0) return;
                var subsection = document.createElement('div');
                subsection.className = 'subsection';
                var h3 = document.createElement('h3');
                h3.className = 'subsection-title';
                h3.textContent = t.name;
                var ul = document.createElement('ul');
                ul.className = 'checklist-ul';
                ul.setAttribute('data-type-id', t.id);
                blockItems.forEach(function(item) { ul.appendChild(makeItemNode(item, itemsByStatus === done)); });
                subsection.appendChild(h3);
                subsection.appendChild(ul);
                containerEl.appendChild(subsection);
            });
        }

        buildSubsections(pendingContainer, pending);
        buildSubsections(doneContainer, done);

        if (progressText) progressText.textContent = done.length + ' / ' + items.length;
        if (allDoneEl) allDoneEl.classList.toggle('hidden', items.length === 0 || done.length < items.length);
    }

    /**
     * 渲染类型管理弹层内的类型列表
     */
    function renderModalTypes() {
        var list = getCurrentList();
        var types = getListTypes(list);
        var ul = document.getElementById('modal-types-list');
        if (!ul) return;
        ul.innerHTML = '';
        types.forEach(function(t) {
            var li = document.createElement('li');
            li.className = 'modal-type-row';
            li.setAttribute('data-type-id', t.id);
            var nameSpan = document.createElement('span');
            nameSpan.className = 'modal-type-name';
            nameSpan.textContent = t.name;
            var renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'btn btn-ghost modal-type-rename';
            renameBtn.textContent = '重命名';
            renameBtn.setAttribute('aria-label', '重命名：' + t.name);
            var delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-danger-small modal-type-delete';
            delBtn.textContent = '删除';
            delBtn.setAttribute('aria-label', '删除类型：' + t.name);
            if (types.length <= 2) delBtn.disabled = true;
            if (t.id === types[0].id) delBtn.disabled = true;
            li.appendChild(nameSpan);
            li.appendChild(renameBtn);
            li.appendChild(delBtn);
            ul.appendChild(li);
        });
    }

    /**
     * 填充模板下拉（新建清单弹层内）
     */
    function fillTemplateSelect() {
        const sel = document.getElementById('new-list-template');
        if (!sel) return;
        sel.innerHTML = '<option value="">请选择模板</option>';
        TEMPLATES.forEach(function(t) {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            sel.appendChild(opt);
        });
    }

    function renderList() {
        renderListSwitcher();
        renderTypeOptions();
        renderPendingDone();
    }

    /**
     * 开始内联编辑
     * @param {string} listId
     * @param {string} itemId
     */
    function startEdit(listId, itemId) {
        const wrapper = document.getElementById('checklist-wrapper');
        if (wrapper && editingItemId) {
            const prevLi = wrapper.querySelector('.checklist-item[data-id="' + editingItemId.itemId + '"]');
            const prevInput = prevLi && prevLi.querySelector('.item-edit-input');
            if (prevInput) {
                updateItemTextSilent(editingItemId.listId, editingItemId.itemId, prevInput.value);
            }
            editingItemId = null;
        }
        const list = state.lists.find(function(l) { return l.id === listId; });
        const item = list && list.items.find(function(i) { return i.id === itemId; });
        if (!item) return;
        editingItemId = { listId: listId, itemId: itemId };
        if (!wrapper) return;
        const li = wrapper.querySelector('.checklist-item[data-id="' + itemId + '"]');
        if (!li) return;
        const textSpan = li.querySelector('.item-text');
        const editInput = li.querySelector('.item-edit-input');
        if (!textSpan || !editInput) return;
        textSpan.classList.add('inline-edit');
        editInput.classList.add('show');
        editInput.value = item.text;
        editInput.focus();
        editInput.select();
    }

    /**
     * 提交内联编辑（保存）
     */
    function commitEdit(value) {
        if (!editingItemId) return;
        updateItemText(editingItemId.listId, editingItemId.itemId, value);
    }

    /**
     * 取消内联编辑
     */
    function cancelEdit() {
        editingItemId = null;
        renderList();
    }

    function exportData(mode) {
        if (mode === 'all') {
            const payload = { version: DATA_VERSION, exportTime: new Date().toISOString(), data: { lists: state.lists, activeListId: state.activeListId } };
            const str = JSON.stringify(payload, null, 2);
            const blob = new Blob([str], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '出行清单_全部_' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showMessage('已导出全部清单', 'success');
        } else {
            const list = getCurrentList();
            if (!list) return;
            const payload = { version: DATA_VERSION, listName: list.name, exportTime: new Date().toISOString(), data: { types: getListTypes(list), items: list.items } };
            const str = JSON.stringify(payload, null, 2);
            const blob = new Blob([str], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '出行清单_' + (list.name || '未命名').replace(/[/\\?%*:|"<>]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showMessage('导出成功', 'success');
        }
    }

    /**
     * 处理导入文件
     * @param {File} file
     * @param {string} mode - 'overwrite' | 'new'
     */
    function importData(file, mode) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                function normalizeImportedList(list, fallbackName) {
                    var normalizedName = (typeof list.name === 'string' && list.name.trim())
                        ? list.name.trim()
                        : (fallbackName || '导入的清单');

                    var sourceTypes = (list.types && list.types.length >= 2)
                        ? list.types
                        : getDefaultTypes();
                    var typeIdMap = {};
                    var normalizedTypes = sourceTypes.map(function(t, idx) {
                        var oldId = (t && typeof t.id === 'string') ? t.id : ('legacy-type-' + idx);
                        var nextId = 'type-' + generateId();
                        typeIdMap[oldId] = nextId;
                        return {
                            id: nextId,
                            name: (t && typeof t.name === 'string' && t.name.trim()) ? t.name.trim() : ('类型' + (idx + 1))
                        };
                    });

                    var fallbackTypeId = normalizedTypes[0].id;
                    var normalizedItems = (list.items || []).map(function(item, idx) {
                        var sourceTypeId = (item && typeof item.type === 'string') ? item.type : '';
                        return {
                            id: generateId(),
                            text: item && typeof item.text === 'string' ? item.text : '',
                            checked: Boolean(item && item.checked),
                            order: (item && typeof item.order === 'number') ? item.order : idx,
                            type: typeIdMap[sourceTypeId] || fallbackTypeId
                        };
                    });

                    return {
                        id: generateId(),
                        name: normalizedName,
                        types: normalizedTypes,
                        items: normalizedItems
                    };
                }

                const raw = e.target && e.target.result;
                if (!raw || typeof raw !== 'string') {
                    showMessage('无法读取文件内容', 'error');
                    return;
                }
                const parsed = JSON.parse(raw);
                const data = parsed && parsed.data;
                if (!data) {
                    showMessage('文件格式无效', 'error');
                    return;
                }
                if (data.lists && Array.isArray(data.lists) && data.lists.length > 0) {
                    if (mode === 'overwrite') {
                        const cur = getCurrentList();
                        if (!cur) return;
                        const first = data.lists[0];
                        var normalized = normalizeImportedList(first, '导入的清单');
                        cur.name = normalized.name;
                        cur.types = normalized.types;
                        cur.items = normalized.items;
                        saveData();
                        renderList();
                        showMessage('已覆盖当前清单，共 ' + cur.items.length + ' 项', 'success');
                    } else {
                        data.lists.forEach(function(list) {
                            state.lists.push(normalizeImportedList(list, '导入的清单'));
                        });
                        state.activeListId = state.lists[state.lists.length - 1].id;
                        saveData();
                        renderList();
                        showMessage('已导入 ' + data.lists.length + ' 份清单', 'success');
                    }
                    return;
                }
                if (data.items && Array.isArray(data.items)) {
                    const listName = (parsed.listName || parsed.name || '导入的清单').trim() || '导入的清单';
                    const newList = normalizeImportedList({
                        name: listName,
                        types: data.types,
                        items: data.items
                    }, listName);
                    if (mode === 'overwrite') {
                        const cur = getCurrentList();
                        if (cur) {
                            cur.name = newList.name;
                            cur.types = newList.types;
                            cur.items = newList.items;
                        }
                    } else {
                        state.lists.push(newList);
                        state.activeListId = newList.id;
                    }
                    saveData();
                    renderList();
                    showMessage('已导入 ' + newList.items.length + ' 项', 'success');
                    return;
                }
                showMessage('文件格式无效，需包含 data.items 或 data.lists', 'error');
            } catch (err) {
                console.error('导入失败:', err);
                showMessage('导入失败：' + (err.message || '文件格式错误'), 'error');
            }
        };
        reader.onerror = function() {
            showMessage('读取文件失败', 'error');
        };
        reader.readAsText(file, 'UTF-8');
    }

    function bindEvents() {
        const listSwitcher = document.getElementById('list-switcher');
        const newListBtn = document.getElementById('new-list-btn');
        const duplicateListBtn = document.getElementById('duplicate-list-btn');
        const renameListBtn = document.getElementById('rename-list-btn');
        const deleteListBtn = document.getElementById('delete-list-btn');
        const newItemInput = document.getElementById('new-item-input');
        const addBtn = document.getElementById('add-btn');
        const resetBtn = document.getElementById('reset-btn');
        const exportBtn = document.getElementById('export-btn');
        const exportAllBtn = document.getElementById('export-all-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');
        const checklistWrapper = document.getElementById('checklist-wrapper');

        const modalNewList = document.getElementById('modal-new-list');
        const newListName = document.getElementById('new-list-name');
        const newListTemplate = document.getElementById('new-list-template');
        const modalNewListCancel = document.getElementById('modal-new-list-cancel');
        const modalNewListConfirm = document.getElementById('modal-new-list-confirm');

        const modalDuplicate = document.getElementById('modal-duplicate');
        const duplicateListName = document.getElementById('duplicate-list-name');
        const modalDuplicateCancel = document.getElementById('modal-duplicate-cancel');
        const modalDuplicateConfirm = document.getElementById('modal-duplicate-confirm');

        if (listSwitcher) {
            listSwitcher.addEventListener('change', function() {
                switchList(listSwitcher.value);
            });
        }

        if (newListBtn) {
            newListBtn.addEventListener('click', function() {
                fillTemplateSelect();
                if (newListName) newListName.value = '';
                if (newListTemplate) newListTemplate.value = '';
                document.querySelectorAll('input[name="new-list-source"]').forEach(function(r) {
                    r.checked = r.value === 'default';
                });
                if (modalNewList) modalNewList.classList.remove('hidden');
            });
        }

        if (modalNewListCancel) {
            modalNewListCancel.addEventListener('click', function() {
                if (modalNewList) modalNewList.classList.add('hidden');
            });
        }
        if (modalNewListConfirm) {
            modalNewListConfirm.addEventListener('click', function() {
                const source = document.querySelector('input[name="new-list-source"]:checked');
                const templateId = (source && source.value === 'template' && newListTemplate) ? newListTemplate.value : '';
                createList(newListName ? newListName.value : '', templateId || undefined);
                if (modalNewList) modalNewList.classList.add('hidden');
            });
        }

        if (duplicateListBtn) {
            duplicateListBtn.addEventListener('click', function() {
                const list = getCurrentList();
                if (!list) return;
                let name = list.name + ' 副本';
                let n = 1;
                while (state.lists.some(function(l) { return l.name === name; })) {
                    name = list.name + ' 副本 ' + (++n);
                }
                if (duplicateListName) duplicateListName.value = name;
                if (modalDuplicate) modalDuplicate.classList.remove('hidden');
            });
        }
        if (modalDuplicateCancel) {
            modalDuplicateCancel.addEventListener('click', function() {
                if (modalDuplicate) modalDuplicate.classList.add('hidden');
            });
        }
        if (modalDuplicateConfirm) {
            modalDuplicateConfirm.addEventListener('click', function() {
                const list = getCurrentList();
                if (list) duplicateList(list.id, duplicateListName ? duplicateListName.value : undefined);
                if (modalDuplicate) modalDuplicate.classList.add('hidden');
            });
        }

        if (renameListBtn) {
            renameListBtn.addEventListener('click', function() {
                const list = getCurrentList();
                if (!list) return;
                const name = prompt('重命名清单', list.name);
                if (name != null) renameList(list.id, name);
            });
        }
        if (deleteListBtn) {
            deleteListBtn.addEventListener('click', function() {
                const list = getCurrentList();
                if (list) deleteList(list.id);
            });
        }

        var manageTypesBtn = document.getElementById('manage-types-btn');
        var modalTypes = document.getElementById('modal-types');
        var modalTypesNewName = document.getElementById('modal-types-new-name');
        var modalTypesAddBtn = document.getElementById('modal-types-add-btn');
        var modalTypesClose = document.getElementById('modal-types-close');
        var modalTypesList = document.getElementById('modal-types-list');

        if (manageTypesBtn) {
            manageTypesBtn.addEventListener('click', function() {
                var list = getCurrentList();
                if (!list) return;
                renderModalTypes();
                if (modalTypesNewName) modalTypesNewName.value = '';
                if (modalTypes) modalTypes.classList.remove('hidden');
                if (modalTypesNewName) modalTypesNewName.focus();
            });
        }
        if (modalTypesClose) {
            modalTypesClose.addEventListener('click', function() {
                if (modalTypes) modalTypes.classList.add('hidden');
            });
        }
        if (modalTypesAddBtn && modalTypesNewName) {
            modalTypesAddBtn.addEventListener('click', function() {
                var list = getCurrentList();
                if (list) addType(list.id, modalTypesNewName.value);
                if (modalTypesNewName) modalTypesNewName.value = '';
                renderModalTypes();
            });
        }
        if (modalTypesList) {
            modalTypesList.addEventListener('click', function(e) {
                var btn = e.target;
                var row = btn && btn.closest && btn.closest('.modal-type-row');
                if (!row) return;
                var typeId = row.getAttribute('data-type-id');
                var list = getCurrentList();
                if (!list) return;
                if (btn.classList && btn.classList.contains('modal-type-rename')) {
                    var name = prompt('重命名类型', row.querySelector('.modal-type-name').textContent);
                    if (name != null) renameType(list.id, typeId, name);
                    renderModalTypes();
                }
                if (btn.classList && btn.classList.contains('modal-type-delete')) {
                    window.DialogService.confirmAction('删除该类型后，其下所有项将归入第一种类型。确定删除？').then(function(confirmed) {
                        if (confirmed) deleteType(list.id, typeId);
                        renderModalTypes();
                    });
                }
            });
        }

        function doAdd() {
            var typeEl = document.querySelector('input[name="new-item-type"]:checked');
            var typeId = typeEl ? typeEl.value : 'item';
            addItem(newItemInput ? newItemInput.value : '', typeId);
            if (newItemInput) {
                newItemInput.value = '';
                newItemInput.focus();
            }
        }
        if (addBtn) addBtn.addEventListener('click', doAdd);
        if (newItemInput) {
            newItemInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    doAdd();
                }
                if (e.key === 'Escape') {
                    newItemInput.value = '';
                    newItemInput.blur();
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                const list = getCurrentList();
                if (list) resetChecked(list.id);
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                exportData('current');
            });
        }
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', function() {
                exportData('all');
            });
        }

        if (importBtn) {
            importBtn.addEventListener('click', function() {
                if (importFile) {
                    importFile.value = '';
                    importFile.click();
                }
            });
        }
        if (importFile) {
            importFile.addEventListener('change', function() {
                const file = importFile.files && importFile.files[0];
                if (!file) return;
                window.DialogService.confirmAction('是否覆盖当前清单？\n点击「确定」覆盖当前清单，点击「取消」则导入为新清单。').then(function(confirmed) {
                    importData(file, confirmed ? 'overwrite' : 'new');
                    importFile.value = '';
                });
            });
        }

        if (checklistWrapper) {
            checklistWrapper.addEventListener('change', function(e) {
                const cb = e.target;
                if (cb && cb.classList && cb.classList.contains('item-checkbox')) {
                    const li = cb.closest('.checklist-item');
                    const listId = li && li.getAttribute('data-list-id');
                    const id = li && li.getAttribute('data-id');
                    if (listId && id) toggleItem(listId, id);
                }
            });
            checklistWrapper.addEventListener('click', function(e) {
                const btn = e.target;
                if (btn && btn.classList && btn.classList.contains('item-delete')) {
                    e.preventDefault();
                    const li = btn.closest('.checklist-item');
                    const listId = li && li.getAttribute('data-list-id');
                    const id = li && li.getAttribute('data-id');
                    if (listId && id) deleteItem(listId, id);
                    return;
                }
                if (btn && btn.classList && btn.classList.contains('item-edit')) {
                    e.preventDefault();
                    const li = btn.closest('.checklist-item');
                    const listId = li && li.getAttribute('data-list-id');
                    const id = li && li.getAttribute('data-id');
                    if (listId && id) startEdit(listId, id);
                    return;
                }
                const textSpan = e.target && e.target.classList && e.target.classList.contains('item-text') ? e.target : null;
                if (textSpan) {
                    const li = textSpan.closest('.checklist-item');
                    const listId = li && li.getAttribute('data-list-id');
                    const id = li && li.getAttribute('data-id');
                    if (listId && id) toggleItem(listId, id);
                }
            });
            checklistWrapper.addEventListener('keydown', function(e) {
                if (!editingItemId) return;
                const input = e.target;
                if (!input || !input.classList || !input.classList.contains('item-edit-input')) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEdit(input.value);
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            });
            checklistWrapper.addEventListener('blur', function(e) {
                if (!editingItemId) return;
                const input = e.target;
                if (!input || !input.classList || !input.classList.contains('item-edit-input')) return;
                setTimeout(function() {
                    if (editingItemId) commitEdit(input.value);
                }, 150);
            }, true);
        }
    }

    function init() {
        loadData();
        fillTemplateSelect();
        renderList();
        bindEvents();
        const newItemInput = document.getElementById('new-item-input');
        if (newItemInput) newItemInput.focus();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
