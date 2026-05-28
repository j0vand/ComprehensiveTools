/**
 * 出行清单 - 状态与数据操作
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

    const TEMPLATES = [
        { id: 'short', name: '短途 1～2 天', extra: [{ text: '充电宝', type: 'item' }, { text: '常用药', type: 'item' }] },
        { id: 'weekend', name: '周末出游', extra: [{ text: '换洗衣物', type: 'item' }, { text: '洗漱用品', type: 'item' }, { text: '充电宝', type: 'item' }] },
        { id: 'long', name: '长途', extra: [{ text: '换洗衣物', type: 'item' }, { text: '洗漱用品', type: 'item' }, { text: '充电宝', type: 'item' }, { text: '常用药', type: 'item' }, { text: '行程单', type: 'task' }] },
        { id: 'business', name: '商务出差', extra: [{ text: '电脑', type: 'item' }, { text: '名片', type: 'item' }, { text: '行程单', type: 'task' }] }
    ];

    let state = { lists: [], activeListId: null };

    function getDefaultTypes() {
        return [{ id: 'item', name: '物品' }, { id: 'task', name: '事项' }];
    }

    function generateId() {
        return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    }

    function showMessage(message, type) {
        window.DialogService.showToast(message, type, {
            duration: type === 'error' ? 5000 : 3000
        });
    }

    function renderList() {
        if (window.TravelChecklistRender) {
            window.TravelChecklistRender.renderList();
        }
    }

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
                tpl.extra.forEach(function(item) {
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

    function migrateIncompleteDefaultList() {
        if (state.lists.length !== 1) return;
        var list = state.lists[0];
        if (list.items.length !== 1 || !list.items[0] || list.items[0].text !== '身份证') return;
        list.name = '我的清单';
        list.items = buildInitialItems();
        saveData();
    }

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

    function getCurrentList() {
        if (!state.activeListId) return null;
        return state.lists.find(function(l) { return l.id === state.activeListId; }) || null;
    }

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

    function getListTypes(list) {
        return (list && list.types && list.types.length >= 2) ? list.types : getDefaultTypes();
    }

    function getTypeName(list, typeId) {
        var types = getListTypes(list);
        var t = types.find(function(x) { return x.id === typeId; });
        return t ? t.name : (typeId || '物品');
    }

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
    }

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

    window.TravelChecklistState = {
        DATA_VERSION: DATA_VERSION,
        STORAGE_KEY: STORAGE_KEY,
        TEMPLATES: TEMPLATES,
        state: state,
        showMessage: showMessage,
        getDefaultTypes: getDefaultTypes,
        generateId: generateId,
        buildInitialItems: buildInitialItems,
        loadData: loadData,
        saveData: saveData,
        getCurrentList: getCurrentList,
        nextOrder: nextOrder,
        switchList: switchList,
        createList: createList,
        duplicateList: duplicateList,
        renameList: renameList,
        deleteList: deleteList,
        getListTypes: getListTypes,
        getTypeName: getTypeName,
        addType: addType,
        renameType: renameType,
        deleteType: deleteType,
        addItem: addItem,
        deleteItem: deleteItem,
        updateItemText: updateItemText,
        updateItemTextSilent: updateItemTextSilent,
        toggleItem: toggleItem,
        resetChecked: resetChecked
    };
})();
