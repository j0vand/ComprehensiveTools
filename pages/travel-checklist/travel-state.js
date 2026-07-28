/**
 * 出行清单 - 状态与数据操作
 */
(function() {
    'use strict';

    const DATA_VERSION = 1;
    // 页面、存储与导入共用这些业务上限，避免接收无法正常编辑或展示的数据。
    const TRAVEL_LIMITS = Object.freeze({
        listName: 50,
        typeName: 20,
        itemText: 200,
        lists: 100,
        typesPerList: 50,
        itemsPerList: 1000,
        itemsTotal: 5000
    });
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

    function copyState() {
        return JSON.parse(JSON.stringify(state));
    }

    function normalizeLabel(value, label, maxLength) {
        if (typeof value !== 'string') {
            showMessage(label + '格式不正确', 'warning');
            return null;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            showMessage('请输入' + label, 'warning');
            return null;
        }
        if (trimmed.length > maxLength || /[\u0000-\u001f\u007f]/.test(trimmed)) {
            showMessage(label + '不合法或过长', 'warning');
            return null;
        }
        return trimmed;
    }

    function sameName(left, right) {
        return left.toLocaleLowerCase('zh-CN') === right.toLocaleLowerCase('zh-CN');
    }

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
                type: item.type
            };
        });
        if (templateId) {
            const tpl = TEMPLATES.find(function(t) { return t.id === templateId; });
            if (tpl) {
                tpl.extra.forEach(function(item) {
                    items.push({
                        id: generateId(),
                        text: item.text,
                        checked: false,
                        order: items.length,
                        type: item.type
                    });
                });
            }
        }
        return items;
    }

    /**
     * 本地存储只接受当前版本的完整状态；任一业务约束被破坏时整份数据作废。
     */
    function isValidStoredState(data) {
        if (!data || !Array.isArray(data.lists)
            || data.lists.length === 0
            || data.lists.length > TRAVEL_LIMITS.lists
            || typeof data.activeListId !== 'string') {
            return false;
        }

        const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
        const validId = function(value) {
            return typeof value === 'string' && idPattern.test(value);
        };
        const validLabel = function(value, maxLength) {
            return typeof value === 'string'
                && value === value.trim()
                && value.length > 0
                && value.length <= maxLength
                && !/[\u0000-\u001f\u007f]/.test(value);
        };
        const listIds = new Set();
        const listNames = new Set();
        let itemTotal = 0;

        for (const list of data.lists) {
            if (!list || Array.isArray(list) || !validId(list.id)
                || listIds.has(list.id) || !validLabel(list.name, TRAVEL_LIMITS.listName)
                || !Array.isArray(list.types) || list.types.length < 2
                || list.types.length > TRAVEL_LIMITS.typesPerList
                || !Array.isArray(list.items) || list.items.length > TRAVEL_LIMITS.itemsPerList) {
                return false;
            }

            const foldedListName = list.name.toLocaleLowerCase('zh-CN');
            if (listNames.has(foldedListName)) return false;
            listIds.add(list.id);
            listNames.add(foldedListName);
            itemTotal += list.items.length;
            if (itemTotal > TRAVEL_LIMITS.itemsTotal) return false;

            const typeIds = new Set();
            const typeNames = new Set();
            for (const type of list.types) {
                if (!type || Array.isArray(type) || !validId(type.id)
                    || typeIds.has(type.id) || !validLabel(type.name, TRAVEL_LIMITS.typeName)) {
                    return false;
                }
                const foldedTypeName = type.name.toLocaleLowerCase('zh-CN');
                if (typeNames.has(foldedTypeName)) return false;
                typeIds.add(type.id);
                typeNames.add(foldedTypeName);
            }

            const itemIds = new Set();
            const itemTexts = new Set();
            const orders = new Set();
            for (const item of list.items) {
                if (!item || Array.isArray(item) || !validId(item.id)
                    || itemIds.has(item.id) || !validLabel(item.text, TRAVEL_LIMITS.itemText)
                    || typeof item.checked !== 'boolean' || !Number.isSafeInteger(item.order)
                    || item.order < 0 || orders.has(item.order) || !typeIds.has(item.type)) {
                    return false;
                }
                const foldedItemText = item.text.toLocaleLowerCase('zh-CN');
                if (itemTexts.has(foldedItemText)) return false;
                itemIds.add(item.id);
                itemTexts.add(foldedItemText);
                orders.add(item.order);
            }
        }

        return validId(data.activeListId) && listIds.has(data.activeListId);
    }

    /**
     * 将旧版仅含 items 的存储结构迁移为当前 lists 结构，合法数据才保留。
     */
    function migrateLegacyData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data) || Array.isArray(data.lists)) {
            return null;
        }
        if (!Array.isArray(data.items) || data.items.length === 0) return null;

        const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
        const types = Array.isArray(data.types) && data.types.length >= 2
            ? data.types.map(function(type) {
                return { id: type.id, name: type.name };
            })
            : getDefaultTypes();
        const typeIds = new Set(types.map(function(type) { return type.id; }));
        const itemIds = new Set();
        const itemTexts = new Set();
        const orders = new Set();
        const items = [];

        for (const item of data.items) {
            if (!item || Array.isArray(item) || typeof item.id !== 'string' || !idPattern.test(item.id)
                || itemIds.has(item.id) || typeof item.text !== 'string'
                || item.text !== item.text.trim() || item.text.length === 0
                || item.text.length > TRAVEL_LIMITS.itemText
                || /[\u0000-\u001f\u007f]/.test(item.text)
                || typeof item.checked !== 'boolean' || !Number.isSafeInteger(item.order)
                || item.order < 0 || orders.has(item.order)) {
                return null;
            }
            const foldedText = item.text.toLocaleLowerCase('zh-CN');
            if (itemTexts.has(foldedText)) return null;
            if (typeof item.type !== 'string' || !typeIds.has(item.type)) return null;
            itemIds.add(item.id);
            itemTexts.add(foldedText);
            orders.add(item.order);
            items.push({
                id: item.id,
                text: item.text,
                checked: item.checked,
                order: item.order,
                type: item.type
            });
        }

        items.sort(function(left, right) { return left.order - right.order; });
        items.forEach(function(item, index) { item.order = index; });

        const list = {
            id: generateId(),
            name: '我的清单',
            types: types,
            items: items
        };
        return { lists: [list], activeListId: list.id };
    }

    function readTravelPayload() {
        if (window.StorageService && typeof window.StorageService.getJson === 'function') {
            return window.StorageService.getJson(STORAGE_KEY, null);
        }
        return window.CommonUtils.getLocalStorageItem(STORAGE_KEY, null);
    }

    function writeTravelPayload(payload) {
        if (window.StorageService && typeof window.StorageService.setJson === 'function') {
            return window.StorageService.setJson(STORAGE_KEY, payload).ok;
        }
        return window.CommonUtils.setLocalStorageItem(STORAGE_KEY, payload);
    }

    function loadData() {
        const raw = readTravelPayload();
        if (raw && raw.version === DATA_VERSION) {
            if (isValidStoredState(raw.data)) {
                state.lists = raw.data.lists;
                state.activeListId = raw.data.activeListId;
                return;
            }
            const migrated = migrateLegacyData(raw.data);
            if (migrated && isValidStoredState(migrated)) {
                state.lists = migrated.lists;
                state.activeListId = migrated.activeListId;
                return;
            }
        }
        state.lists = [{ id: generateId(), name: '我的清单', types: getDefaultTypes(), items: buildInitialItems() }];
        state.activeListId = state.lists[0].id;
    }

    /**
     * 状态修改先持久化候选快照再替换内存；写入失败时重绘旧状态，禁止界面假成功。
     */
    function commitState(nextState) {
        if (!isValidStoredState(nextState)) {
            renderList();
            showMessage('数据状态无效，本次修改已撤销', 'error');
            return false;
        }
        const payload = {
            version: DATA_VERSION,
            data: { lists: nextState.lists, activeListId: nextState.activeListId }
        };
        if (!writeTravelPayload(payload)) {
            renderList();
            showMessage('保存失败，本次修改已撤销', 'error');
            return false;
        }
        state.lists = nextState.lists;
        state.activeListId = nextState.activeListId;
        return true;
    }

    function getCurrentList() {
        if (!state.activeListId) return null;
        return state.lists.find(function(l) { return l.id === state.activeListId; }) || null;
    }

    function getItemCount() {
        return state.lists.reduce(function(total, list) { return total + list.items.length; }, 0);
    }

    function switchList(id) {
        if (!state.lists.some(function(l) { return l.id === id; })) return false;
        if (state.activeListId === id) return true;
        const nextState = copyState();
        nextState.activeListId = id;
        if (!commitState(nextState)) return false;
        renderList();
        return true;
    }

    function createList(name, templateId) {
        const trimmed = normalizeLabel(name, '清单名称', TRAVEL_LIMITS.listName);
        if (!trimmed) return false;
        if (state.lists.length >= TRAVEL_LIMITS.lists) {
            showMessage('清单数量已达上限', 'warning');
            return false;
        }
        if (state.lists.some(function(list) { return sameName(list.name, trimmed); })) {
            showMessage('已存在同名清单', 'warning');
            return false;
        }
        if (templateId && !TEMPLATES.some(function(template) { return template.id === templateId; })) {
            showMessage('所选模板无效', 'warning');
            return false;
        }
        const items = buildInitialItems(templateId);
        if (getItemCount() + items.length > TRAVEL_LIMITS.itemsTotal) {
            showMessage('项目总数已达上限', 'warning');
            return false;
        }
        const list = {
            id: generateId(),
            name: trimmed,
            types: getDefaultTypes(),
            items: items
        };
        const nextState = copyState();
        nextState.lists.push(list);
        nextState.activeListId = list.id;
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已创建清单', 'success');
        return true;
    }

    function duplicateList(listId, newName) {
        const src = state.lists.find(function(l) { return l.id === listId; });
        if (!src) return false;
        const name = normalizeLabel(newName, '清单名称', TRAVEL_LIMITS.listName);
        if (!name) return false;
        if (state.lists.length >= TRAVEL_LIMITS.lists) {
            showMessage('清单数量已达上限', 'warning');
            return false;
        }
        if (getItemCount() + src.items.length > TRAVEL_LIMITS.itemsTotal) {
            showMessage('项目总数已达上限', 'warning');
            return false;
        }
        if (state.lists.some(function(list) { return sameName(list.name, name); })) {
            showMessage('已存在同名清单', 'warning');
            return false;
        }
        const typeIdMap = {};
        const copiedTypes = src.types.map(function(type) {
            const id = 'type-' + generateId();
            typeIdMap[type.id] = id;
            return { id: id, name: type.name };
        });
        const newList = {
            id: generateId(),
            name: name,
            types: copiedTypes,
            items: src.items.map(function(item) {
                return {
                    id: generateId(),
                    text: item.text,
                    checked: false,
                    order: item.order,
                    type: typeIdMap[item.type]
                };
            })
        };
        const nextState = copyState();
        nextState.lists.push(newList);
        nextState.activeListId = newList.id;
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已复制清单', 'success');
        return true;
    }

    function renameList(listId, name) {
        const trimmed = normalizeLabel(name, '清单名称', TRAVEL_LIMITS.listName);
        if (!trimmed) return false;
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return false;
        if (list.name === trimmed) return true;
        if (state.lists.some(function(item) { return item.id !== listId && sameName(item.name, trimmed); })) {
            showMessage('已存在同名清单', 'warning');
            return false;
        }
        const nextState = copyState();
        nextState.lists.find(function(item) { return item.id === listId; }).name = trimmed;
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已重命名', 'success');
        return true;
    }

    function deleteList(listId) {
        if (state.lists.length <= 1) {
            showMessage('至少保留一份清单', 'warning');
            return Promise.resolve(false);
        }
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return Promise.resolve(false);
        return window.DialogService.confirmAction('确定删除清单「' + list.name + '」？').then(function(confirmed) {
            if (!confirmed) return false;
            const nextState = copyState();
            nextState.lists = nextState.lists.filter(function(item) { return item.id !== listId; });
            if (nextState.activeListId === listId) {
                nextState.activeListId = nextState.lists[0].id;
            }
            if (!commitState(nextState)) return false;
            renderList();
            showMessage('已删除', 'success');
            return true;
        });
    }

    function getListTypes(list) {
        return list ? list.types : [];
    }

    function getTypeName(list, typeId) {
        var types = getListTypes(list);
        var t = types.find(function(x) { return x.id === typeId; });
        return t ? t.name : '物品';
    }

    function addType(listId, name) {
        var list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return false;
        var trimmed = normalizeLabel(name, '类型名称', TRAVEL_LIMITS.typeName);
        if (!trimmed) return false;
        if (list.types.length >= TRAVEL_LIMITS.typesPerList) {
            showMessage('类型数量已达上限', 'warning');
            return false;
        }
        if (list.types.some(function(t) { return sameName(t.name, trimmed); })) {
            showMessage('已存在同名类型', 'warning');
            return false;
        }
        const nextState = copyState();
        const nextList = nextState.lists.find(function(item) { return item.id === listId; });
        nextList.types.push({ id: 'type-' + generateId(), name: trimmed });
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已添加类型', 'success');
        return true;
    }

    function renameType(listId, typeId, name) {
        var list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return false;
        var trimmed = normalizeLabel(name, '类型名称', TRAVEL_LIMITS.typeName);
        if (!trimmed) return false;
        var t = list.types.find(function(x) { return x.id === typeId; });
        if (!t) return false;
        if (t.name === trimmed) return true;
        if (list.types.some(function(type) { return type.id !== typeId && sameName(type.name, trimmed); })) {
            showMessage('已存在同名类型', 'warning');
            return false;
        }
        const nextState = copyState();
        const nextList = nextState.lists.find(function(item) { return item.id === listId; });
        nextList.types.find(function(type) { return type.id === typeId; }).name = trimmed;
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已重命名', 'success');
        return true;
    }

    function deleteType(listId, typeId) {
        var list = state.lists.find(function(l) { return l.id === listId; });
        if (!list || list.types.length <= 2) {
            showMessage('至少保留两种类型', 'warning');
            return false;
        }
        var firstId = list.types[0].id;
        if (typeId === firstId) {
            showMessage('不能删除第一种类型', 'warning');
            return false;
        }
        if (!list.types.some(function(type) { return type.id === typeId; })) return false;
        const nextState = copyState();
        const nextList = nextState.lists.find(function(item) { return item.id === listId; });
        nextList.items.forEach(function(item) { if (item.type === typeId) item.type = firstId; });
        nextList.types = nextList.types.filter(function(type) { return type.id !== typeId; });
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已删除类型，相关项已归入第一种类型', 'success');
        return true;
    }

    function addItem(text, typeId) {
        const list = getCurrentList();
        if (!list) return false;
        const trimmed = normalizeLabel(text, '内容', TRAVEL_LIMITS.itemText);
        if (!trimmed) return false;
        if (list.items.length >= TRAVEL_LIMITS.itemsPerList) {
            showMessage('当前清单项目数量已达上限', 'warning');
            return false;
        }
        if (getItemCount() >= TRAVEL_LIMITS.itemsTotal) {
            showMessage('项目总数已达上限', 'warning');
            return false;
        }
        if (list.items.some(function(item) { return sameName(item.text, trimmed); })) {
            showMessage('当前清单已存在相同内容', 'warning');
            return false;
        }
        var validType = list.types.some(function(t) { return t.id === typeId; }) ? typeId : list.types[0].id;
        const nextState = copyState();
        const nextList = nextState.lists.find(function(item) { return item.id === list.id; });
        const order = nextList.items.length
            ? Math.max.apply(null, nextList.items.map(function(item) { return item.order; })) + 1
            : 0;
        nextList.items.push({
            id: generateId(),
            text: trimmed,
            checked: false,
            order: order,
            type: validType
        });
        if (!commitState(nextState)) return false;
        renderList();
        showMessage('已添加', 'success');
        return true;
    }

    function deleteItem(listId, itemId) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return Promise.resolve(false);
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return Promise.resolve(false);
        return window.DialogService.confirmAction('确定删除「' + item.text + '」？').then(function(confirmed) {
            if (!confirmed) return false;
            const nextState = copyState();
            const nextList = nextState.lists.find(function(entry) { return entry.id === listId; });
            nextList.items = nextList.items.filter(function(entry) { return entry.id !== itemId; });
            if (!commitState(nextState)) return false;
            renderList();
            showMessage('已删除', 'success');
            return true;
        });
    }

    /**
     * 编辑项目正文与失焦静默提交共用同一事务，仅控制成功后是否立即重绘。
     */
    function updateItemText(listId, itemId, text, shouldRender = true) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return false;
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return false;
        const trimmed = normalizeLabel(text, '内容', TRAVEL_LIMITS.itemText);
        if (!trimmed) {
            renderList();
            return false;
        }
        if (list.items.some(function(entry) { return entry.id !== itemId && sameName(entry.text, trimmed); })) {
            showMessage('当前清单已存在相同内容', 'warning');
            renderList();
            return false;
        }
        if (item.text === trimmed) return true;
        const nextState = copyState();
        const nextList = nextState.lists.find(function(entry) { return entry.id === listId; });
        nextList.items.find(function(entry) { return entry.id === itemId; }).text = trimmed;
        if (!commitState(nextState)) return false;
        if (shouldRender) renderList();
        return true;
    }

    function toggleItem(listId, itemId) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return false;
        const item = list.items.find(function(i) { return i.id === itemId; });
        if (!item) return false;
        const nextState = copyState();
        const nextList = nextState.lists.find(function(entry) { return entry.id === listId; });
        const nextItem = nextList.items.find(function(entry) { return entry.id === itemId; });
        nextItem.checked = !nextItem.checked;
        if (!commitState(nextState)) return false;
        renderList();
        return true;
    }

    function resetChecked(listId) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list) return Promise.resolve(false);
        return window.DialogService.confirmAction('将取消所有勾选，列表不变。确定吗？').then(function(confirmed) {
            if (!confirmed) return false;
            const nextState = copyState();
            const nextList = nextState.lists.find(function(entry) { return entry.id === listId; });
            nextList.items.forEach(function(item) { item.checked = false; });
            if (!commitState(nextState)) return false;
            renderList();
            showMessage('已重置勾选，可重新逐项确认', 'success');
            return true;
        });
    }

    function reorderItems(listId, itemIds) {
        const list = state.lists.find(function(l) { return l.id === listId; });
        if (!list || !Array.isArray(itemIds) || itemIds.length !== list.items.length) return false;
        const existingIds = new Set(list.items.map(function(item) { return item.id; }));
        if (itemIds.length !== new Set(itemIds).size
            || itemIds.some(function(id) { return !existingIds.has(id); })) {
            return false;
        }
        const nextState = copyState();
        const nextList = nextState.lists.find(function(entry) { return entry.id === listId; });
        const itemMap = Object.create(null);
        nextList.items.forEach(function(item) { itemMap[item.id] = item; });
        nextList.items = itemIds.map(function(id, index) {
            const item = itemMap[id];
            item.order = index;
            return item;
        });
        if (!commitState(nextState)) return false;
        renderList();
        return true;
    }

    window.TravelChecklistState = {
        DATA_VERSION: DATA_VERSION,
        LIMITS: TRAVEL_LIMITS,
        TEMPLATES: TEMPLATES,
        state: state,
        showMessage: showMessage,
        generateId: generateId,
        loadData: loadData,
        commitState: commitState,
        getCurrentList: getCurrentList,
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
        toggleItem: toggleItem,
        resetChecked: resetChecked,
        reorderItems: reorderItems
    };
})();
