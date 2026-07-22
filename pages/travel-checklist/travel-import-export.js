/**
 * 出行清单 - 导入导出
 */
(function() {
    'use strict';

    const store = window.TravelChecklistState;
    // 浏览器在读取前执行文件大小检查，避免超大JSON占用主线程和内存。
    const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

    function showMessage(message, type) {
        store.showMessage(message, type);
    }

    function downloadJson(payload, fileName) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        // 延迟释放，确保浏览器已经接管本次下载。
        setTimeout(function() {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function exportData(mode) {
        const now = new Date();
        const localDate = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-');
        if (mode === 'all') {
            const payload = {
                version: store.DATA_VERSION,
                exportTime: now.toISOString(),
                data: { lists: store.state.lists, activeListId: store.state.activeListId }
            };
            downloadJson(payload, '出行清单_全部_' + localDate + '.json');
            showMessage('已导出全部清单', 'success');
            return true;
        }

        const list = store.getCurrentList();
        if (!list) return false;
        const payload = {
            version: store.DATA_VERSION,
            listName: list.name,
            exportTime: now.toISOString(),
            data: { types: store.getListTypes(list), items: list.items }
        };
        const safeName = list.name.replace(/[/\\?%*:|"<>]/g, '_');
        downloadJson(payload, '出行清单_' + safeName + '_' + localDate + '.json');
        showMessage('导出成功', 'success');
        return true;
    }

    /**
     * 严格验证导入结构并重建所有实体ID；返回值尚未写入状态，可安全整体提交或丢弃。
     */
    function parseImportedText(text) {
        if (typeof text !== 'string' || !text) throw new Error('导入文件内容为空');

        const assertObject = function(value, label) {
            if (!value || typeof value !== 'object' || Array.isArray(value)
                || Object.prototype.toString.call(value) !== '[object Object]') {
                throw new Error(label + '格式不正确');
            }
        };
        const assertKeys = function(value, allowed, label) {
            Object.keys(value).forEach(function(key) {
                if (!allowed.includes(key)) {
                    throw new Error(label + '包含不允许的字段：' + key);
                }
            });
        };
        const readString = function(value, label, maxLength) {
            if (typeof value !== 'string') throw new Error(label + '必须是字符串');
            const trimmed = value.trim();
            if (!trimmed || trimmed.length > maxLength || /[\u0000-\u001f\u007f]/.test(trimmed)) {
                throw new Error(label + '不合法或长度超出范围');
            }
            return trimmed;
        };
        const readId = function(value, label) {
            if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
                throw new Error(label + '不合法');
            }
            return value;
        };
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (error) {
            throw new Error('导入文件不是有效的JSON');
        }

        assertObject(parsed, '导入文件');
        assertKeys(parsed, ['version', 'exportTime', 'listName', 'data'], '导入文件');
        if (parsed.version !== store.DATA_VERSION) throw new Error('导入文件版本不受支持');
        if (parsed.exportTime !== undefined) readString(parsed.exportTime, '导出时间', 64);
        assertObject(parsed.data, '导入数据');

        let sourceLists;
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'lists')) {
            assertKeys(parsed.data, ['lists', 'activeListId'], '导入数据');
            if (!Array.isArray(parsed.data.lists) || parsed.data.lists.length === 0) {
                throw new Error('导入数据必须包含清单');
            }
            if (parsed.data.lists.length > store.LIMITS.lists) {
                throw new Error('导入清单数量超出范围');
            }
            if (parsed.data.activeListId !== undefined && parsed.data.activeListId !== null) {
                readId(parsed.data.activeListId, '当前清单ID');
            }
            sourceLists = parsed.data.lists;
        } else if (Object.prototype.hasOwnProperty.call(parsed.data, 'items')) {
            assertKeys(parsed.data, ['types', 'items'], '导入数据');
            const listName = readString(parsed.listName, '清单名称', store.LIMITS.listName);
            sourceLists = [{ id: 'single-list', name: listName, types: parsed.data.types, items: parsed.data.items }];
        } else {
            throw new Error('导入数据格式无效');
        }

        const usedIds = new Set();
        store.state.lists.forEach(function(list) {
            if (typeof list.id === 'string') usedIds.add(list.id);
            list.types.forEach(function(type) {
                if (typeof type.id === 'string') usedIds.add(type.id);
            });
            list.items.forEach(function(item) {
                if (typeof item.id === 'string') usedIds.add(item.id);
            });
        });
        const nextId = function(prefix) {
            let id = prefix + '-' + store.generateId();
            while (usedIds.has(id)) id = prefix + '-' + store.generateId();
            usedIds.add(id);
            return id;
        };

        let itemTotal = 0;
        const importedNames = new Set();
        const lists = sourceLists.map(function(sourceList, listIndex) {
            const label = '第' + (listIndex + 1) + '份清单';
            assertObject(sourceList, label);
            assertKeys(sourceList, ['id', 'name', 'types', 'items'], label);
            readId(sourceList.id, label + 'ID');
            const name = readString(sourceList.name, label + '名称', store.LIMITS.listName);
            const foldedName = name.toLocaleLowerCase('zh-CN');
            if (importedNames.has(foldedName)) {
                throw new Error('导入文件包含同名清单');
            }
            importedNames.add(foldedName);

            if (!Array.isArray(sourceList.types)
                || sourceList.types.length < 2
                || sourceList.types.length > store.LIMITS.typesPerList) {
                throw new Error(label + '类型数量超出范围');
            }
            if (!Array.isArray(sourceList.items) || sourceList.items.length > store.LIMITS.itemsPerList) {
                throw new Error(label + '项目数量超出范围');
            }
            itemTotal += sourceList.items.length;
            if (itemTotal > store.LIMITS.itemsTotal) throw new Error('导入项目总数超出范围');

            const sourceTypeIds = new Set();
            const typeNames = new Set();
            const typeIdMap = Object.create(null);
            const types = sourceList.types.map(function(sourceType, typeIndex) {
                const typeLabel = label + '的第' + (typeIndex + 1) + '个类型';
                assertObject(sourceType, typeLabel);
                assertKeys(sourceType, ['id', 'name'], typeLabel);
                const sourceId = readId(sourceType.id, typeLabel + 'ID');
                const typeName = readString(sourceType.name, typeLabel + '名称', store.LIMITS.typeName);
                if (sourceTypeIds.has(sourceId)) throw new Error(label + '包含重复类型ID');
                const foldedTypeName = typeName.toLocaleLowerCase('zh-CN');
                if (typeNames.has(foldedTypeName)) {
                    throw new Error(label + '包含同名类型');
                }
                sourceTypeIds.add(sourceId);
                typeNames.add(foldedTypeName);
                const id = nextId('type');
                typeIdMap[sourceId] = id;
                return { id: id, name: typeName };
            });

            const sourceItemIds = new Set();
            const itemTexts = new Set();
            const orders = new Set();
            const items = sourceList.items.map(function(sourceItem, itemIndex) {
                const itemLabel = label + '的第' + (itemIndex + 1) + '个项目';
                assertObject(sourceItem, itemLabel);
                assertKeys(sourceItem, ['id', 'text', 'checked', 'order', 'type'], itemLabel);
                const sourceId = readId(sourceItem.id, itemLabel + 'ID');
                if (sourceItemIds.has(sourceId)) throw new Error(label + '包含重复项目ID');
                sourceItemIds.add(sourceId);
                if (typeof sourceItem.checked !== 'boolean') throw new Error(itemLabel + '勾选值必须是布尔值');
                if (!Number.isSafeInteger(sourceItem.order)
                    || sourceItem.order < 0
                    || orders.has(sourceItem.order)) {
                    throw new Error(itemLabel + '排序数值超出范围');
                }
                orders.add(sourceItem.order);
                const sourceTypeId = readId(sourceItem.type, itemLabel + '类型ID');
                if (!Object.prototype.hasOwnProperty.call(typeIdMap, sourceTypeId)) {
                    throw new Error(itemLabel + '引用了不存在的类型');
                }
                const text = readString(sourceItem.text, itemLabel + '内容', store.LIMITS.itemText);
                const foldedText = text.toLocaleLowerCase('zh-CN');
                if (itemTexts.has(foldedText)) {
                    throw new Error(label + '包含相同内容');
                }
                itemTexts.add(foldedText);
                return {
                    id: nextId('item'),
                    text: text,
                    checked: sourceItem.checked,
                    order: sourceItem.order,
                    type: typeIdMap[sourceTypeId]
                };
            }).sort(function(left, right) {
                return left.order - right.order;
            }).map(function(item, index) {
                item.order = index;
                return item;
            });

            return { id: nextId('list'), name: name, types: types, items: items };
        });

        return { lists: lists };
    }

    function hasNameConflict(lists, ignoredListId) {
        return lists.some(function(imported) {
            return store.state.lists.some(function(existing) {
                return existing.id !== ignoredListId
                    && existing.name.toLocaleLowerCase('zh-CN') === imported.name.toLocaleLowerCase('zh-CN');
            });
        });
    }

    /**
     * 导入只通过状态层事务提交，覆盖或新增失败时不会替换当前内存对象。
     */
    function applyImport(parsedImport, mode, targetListId) {
        if (mode !== 'overwrite' && mode !== 'new') throw new Error('导入模式无效');
        const nextState = JSON.parse(JSON.stringify(store.state));
        if (mode === 'overwrite') {
            if (parsedImport.lists.length !== 1) {
                throw new Error('包含多份清单的文件只能导入为新清单');
            }
            const targetIndex = nextState.lists.findIndex(function(list) {
                return list.id === targetListId;
            });
            if (targetIndex === -1) throw new Error('原清单已不存在，无法覆盖');
            if (hasNameConflict([parsedImport.lists[0]], targetListId)) {
                throw new Error('已存在同名清单');
            }
            nextState.lists[targetIndex] = parsedImport.lists[0];
            if (nextState.activeListId === targetListId) {
                nextState.activeListId = parsedImport.lists[0].id;
            }
        } else {
            if (nextState.lists.length + parsedImport.lists.length > store.LIMITS.lists) {
                throw new Error('清单总数超出范围');
            }
            if (hasNameConflict(parsedImport.lists, null)) throw new Error('已存在同名清单');
            nextState.lists = nextState.lists.concat(parsedImport.lists);
            nextState.activeListId = parsedImport.lists[parsedImport.lists.length - 1].id;
        }

        const totalItems = nextState.lists.reduce(function(total, list) {
            return total + list.items.length;
        }, 0);
        if (totalItems > store.LIMITS.itemsTotal) throw new Error('项目总数超出范围');
        if (!store.commitState(nextState)) return false;
        window.TravelChecklistRender.renderList();
        showMessage(
            mode === 'overwrite'
                ? '已覆盖原清单，共 ' + parsedImport.lists[0].items.length + ' 项'
                : '已导入 ' + parsedImport.lists.length + ' 份清单',
            'success'
        );
        return true;
    }

    function importData(file, mode, targetListId) {
        if (!file) return false;
        if (Number.isFinite(file.size) && file.size > MAX_IMPORT_BYTES) {
            showMessage('导入文件不能超过 2 MiB', 'error');
            return false;
        }

        let importSucceeded = true;
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const parsedImport = parseImportedText(event.target && event.target.result);
                importSucceeded = applyImport(parsedImport, mode, targetListId);
            } catch (error) {
                console.error('导入失败:', error);
                showMessage('导入失败：' + (error.message || '文件格式错误'), 'error');
                importSucceeded = false;
            }
        };
        reader.onerror = function() {
            showMessage('读取文件失败', 'error');
            importSucceeded = false;
        };
        reader.readAsText(file, 'UTF-8');
        return importSucceeded;
    }

    window.TravelChecklistImportExport = {
        exportData: exportData,
        parseImportedText: parseImportedText,
        importData: importData
    };
})();
