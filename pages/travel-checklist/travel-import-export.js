/**
 * 出行清单 - 导入导出
 */
(function() {
    'use strict';

    var store = window.TravelChecklistState;

    function showMessage(message, type) {
        store.showMessage(message, type);
    }

    function renderList() {
        window.TravelChecklistRender.renderList();
    }

    function exportData(mode) {
        if (mode === 'all') {
            const payload = { version: store.DATA_VERSION, exportTime: new Date().toISOString(), data: { lists: store.state.lists, activeListId: store.state.activeListId } };
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
            const list = store.getCurrentList();
            if (!list) return;
            const payload = { version: store.DATA_VERSION, listName: list.name, exportTime: new Date().toISOString(), data: { types: store.getListTypes(list), items: list.items } };
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
                        : store.getDefaultTypes();
                    var typeIdMap = {};
                    var normalizedTypes = sourceTypes.map(function(t, idx) {
                        var oldId = (t && typeof t.id === 'string') ? t.id : ('legacy-type-' + idx);
                        var nextId = 'type-' + store.generateId();
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
                            id: store.generateId(),
                            text: item && typeof item.text === 'string' ? item.text : '',
                            checked: Boolean(item && item.checked),
                            order: (item && typeof item.order === 'number') ? item.order : idx,
                            type: typeIdMap[sourceTypeId] || fallbackTypeId
                        };
                    });

                    return {
                        id: store.generateId(),
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
                        const cur = store.getCurrentList();
                        if (!cur) return;
                        const first = data.lists[0];
                        var normalized = normalizeImportedList(first, '导入的清单');
                        cur.name = normalized.name;
                        cur.types = normalized.types;
                        cur.items = normalized.items;
                        store.saveData();
                        renderList();
                        showMessage('已覆盖当前清单，共 ' + cur.items.length + ' 项', 'success');
                    } else {
                        data.lists.forEach(function(list) {
                            store.state.lists.push(normalizeImportedList(list, '导入的清单'));
                        });
                        store.state.activeListId = store.state.lists[store.state.lists.length - 1].id;
                        store.saveData();
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
                        const cur = store.getCurrentList();
                        if (cur) {
                            cur.name = newList.name;
                            cur.types = newList.types;
                            cur.items = newList.items;
                        }
                    } else {
                        store.state.lists.push(newList);
                        store.state.activeListId = newList.id;
                    }
                    store.saveData();
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

    window.TravelChecklistImportExport = {
        exportData: exportData,
        importData: importData
    };
})();
