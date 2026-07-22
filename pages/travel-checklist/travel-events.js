/**
 * 出行清单 - 事件绑定
 */
(function() {
    'use strict';

    var store = window.TravelChecklistState;
    var render = window.TravelChecklistRender;
    var transfer = window.TravelChecklistImportExport;
    var editingItem = null;

    function startEdit(listId, itemId) {
        const wrapper = document.getElementById('checklist-wrapper');
        if (editingItem) {
            const previous = editingItem;
            editingItem = null;
            if (!store.updateItemText(previous.listId, previous.itemId, previous.input.value, false)) return;
            render.renderList();
        }
        const list = store.state.lists.find(function(l) { return l.id === listId; });
        const item = list && list.items.find(function(i) { return i.id === itemId; });
        if (!item || !wrapper) return;
        const li = wrapper.querySelector('.checklist-item[data-id="' + itemId + '"]');
        if (!li) return;
        const textSpan = li.querySelector('.item-text');
        const editInput = li.querySelector('.item-edit-input');
        if (!textSpan || !editInput) return;
        editingItem = { listId: listId, itemId: itemId, input: editInput };
        textSpan.classList.add('inline-edit');
        editInput.classList.add('show');
        editInput.value = item.text;
        editInput.focus();
        editInput.select();
    }

    function commitEdit() {
        if (!editingItem) return;
        const current = editingItem;
        editingItem = null;
        store.updateItemText(current.listId, current.itemId, current.input.value);
    }

    function cancelEdit() {
        editingItem = null;
        render.renderList();
    }

    /**
     * 清单和类型共用文本对话框；校验失败会保留输入并重新聚焦，Esc负责取消和恢复焦点。
     */
    async function renameWithDialog(message, currentValue, save) {
        let value = currentValue;
        while (true) {
            const nextValue = await window.DialogService.promptAction(message, {
                defaultValue: value,
                confirmText: '保存'
            });
            if (nextValue === null) return false;
            if (save(nextValue)) return true;
            value = nextValue;
        }
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
                store.switchList(listSwitcher.value);
            });
        }

        if (newListBtn) {
            newListBtn.addEventListener('click', function() {
                if (newListName) newListName.value = '';
                if (newListTemplate) newListTemplate.value = '';
                document.querySelectorAll('input[name="new-list-source"]').forEach(function(r) {
                    r.checked = r.value === 'default';
                });
                if (modalNewList) modalNewList.classList.remove('hidden');
                if (newListName) newListName.focus();
            });
        }

        if (modalNewListCancel) {
            modalNewListCancel.addEventListener('click', function() {
                if (modalNewList) modalNewList.classList.add('hidden');
                if (newListBtn) newListBtn.focus();
            });
        }
        if (modalNewListConfirm) {
            modalNewListConfirm.addEventListener('click', function() {
                const source = document.querySelector('input[name="new-list-source"]:checked');
                const useTemplate = source && source.value === 'template';
                if (useTemplate && (!newListTemplate || !newListTemplate.value)) {
                    store.showMessage('请选择模板', 'warning');
                    if (newListTemplate) newListTemplate.focus();
                    return;
                }
                const templateId = useTemplate ? newListTemplate.value : '';
                if (store.createList(newListName ? newListName.value : '', templateId)) {
                    if (modalNewList) modalNewList.classList.add('hidden');
                    if (newItemInput) newItemInput.focus();
                } else if (newListName) {
                    newListName.focus();
                }
            });
        }

        if (duplicateListBtn) {
            duplicateListBtn.addEventListener('click', function() {
                const list = store.getCurrentList();
                if (!list) return;
                let n = 1;
                let suffix = ' 副本';
                let name = list.name.slice(0, store.LIMITS.listName - suffix.length) + suffix;
                while (store.state.lists.some(function(l) {
                    return l.name.toLocaleLowerCase('zh-CN') === name.toLocaleLowerCase('zh-CN');
                })) {
                    suffix = ' 副本 ' + (++n);
                    name = list.name.slice(0, store.LIMITS.listName - suffix.length) + suffix;
                }
                if (duplicateListName) duplicateListName.value = name;
                if (modalDuplicate) modalDuplicate.classList.remove('hidden');
                if (duplicateListName) {
                    duplicateListName.focus();
                    duplicateListName.select();
                }
            });
        }
        if (modalDuplicateCancel) {
            modalDuplicateCancel.addEventListener('click', function() {
                if (modalDuplicate) modalDuplicate.classList.add('hidden');
                if (duplicateListBtn) duplicateListBtn.focus();
            });
        }
        if (modalDuplicateConfirm) {
            modalDuplicateConfirm.addEventListener('click', function() {
                const list = store.getCurrentList();
                if (list && store.duplicateList(list.id, duplicateListName ? duplicateListName.value : '')) {
                    if (modalDuplicate) modalDuplicate.classList.add('hidden');
                    if (newItemInput) newItemInput.focus();
                } else if (duplicateListName) {
                    duplicateListName.focus();
                }
            });
        }

        if (renameListBtn) {
            renameListBtn.addEventListener('click', async function() {
                const list = store.getCurrentList();
                if (!list) return;
                await renameWithDialog('重命名清单', list.name, function(name) {
                    return store.renameList(list.id, name);
                });
            });
        }
        if (deleteListBtn) {
            deleteListBtn.addEventListener('click', function() {
                const list = store.getCurrentList();
                if (list) store.deleteList(list.id);
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
                var list = store.getCurrentList();
                if (!list) return;
                render.renderModalTypes();
                if (modalTypesNewName) modalTypesNewName.value = '';
                if (modalTypes) modalTypes.classList.remove('hidden');
                if (modalTypesNewName) modalTypesNewName.focus();
            });
        }
        if (modalTypesClose) {
            modalTypesClose.addEventListener('click', function() {
                if (modalTypes) modalTypes.classList.add('hidden');
                if (manageTypesBtn) manageTypesBtn.focus();
            });
        }
        if (modalTypesAddBtn && modalTypesNewName) {
            modalTypesAddBtn.addEventListener('click', function() {
                var list = store.getCurrentList();
                if (list && store.addType(list.id, modalTypesNewName.value)) {
                    modalTypesNewName.value = '';
                } else {
                    modalTypesNewName.focus();
                }
                render.renderModalTypes();
            });
        }
        if (modalTypesList) {
            modalTypesList.addEventListener('click', function(e) {
                var btn = e.target;
                var row = btn && btn.closest && btn.closest('.modal-type-row');
                if (!row) return;
                var typeId = row.getAttribute('data-type-id');
                var list = store.getCurrentList();
                if (!list) return;
                if (btn.classList && btn.classList.contains('modal-type-rename')) {
                    var currentName = row.querySelector('.modal-type-name').textContent;
                    renameWithDialog('重命名类型', currentName, function(name) {
                        return store.renameType(list.id, typeId, name);
                    }).then(function() {
                        render.renderModalTypes();
                    });
                }
                if (btn.classList && btn.classList.contains('modal-type-delete')) {
                    window.DialogService.confirmAction('删除该类型后，其下所有项将归入第一种类型。确定删除？').then(function(confirmed) {
                        if (confirmed) store.deleteType(list.id, typeId);
                        render.renderModalTypes();
                    });
                }
            });
        }

        if (modalNewList) {
            modalNewList.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    modalNewList.classList.add('hidden');
                    if (newListBtn) newListBtn.focus();
                } else if (e.key === 'Enter' && e.target === newListName) {
                    e.preventDefault();
                    if (modalNewListConfirm) modalNewListConfirm.click();
                }
            });
        }
        if (modalDuplicate) {
            modalDuplicate.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    modalDuplicate.classList.add('hidden');
                    if (duplicateListBtn) duplicateListBtn.focus();
                } else if (e.key === 'Enter' && e.target === duplicateListName) {
                    e.preventDefault();
                    if (modalDuplicateConfirm) modalDuplicateConfirm.click();
                }
            });
        }
        if (modalTypes) {
            modalTypes.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    modalTypes.classList.add('hidden');
                    if (manageTypesBtn) manageTypesBtn.focus();
                } else if (e.key === 'Enter' && e.target === modalTypesNewName) {
                    e.preventDefault();
                    if (modalTypesAddBtn) modalTypesAddBtn.click();
                }
            });
        }

        function doAdd() {
            var typeEl = document.querySelector('input[name="new-item-type"]:checked');
            var typeId = typeEl ? typeEl.value : 'item';
            const added = store.addItem(newItemInput ? newItemInput.value : '', typeId);
            if (newItemInput) {
                if (added) newItemInput.value = '';
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
                const list = store.getCurrentList();
                if (list) store.resetChecked(list.id);
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                transfer.exportData('current');
            });
        }
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', function() {
                transfer.exportData('all');
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
                const targetListId = store.state.activeListId;
                window.DialogService.confirmAction('请选择导入方式', {
                    confirmText: '覆盖当前清单',
                    cancelText: '导入为新清单',
                    escapeValue: null
                }).then(function(overwrite) {
                    importFile.value = '';
                    if (overwrite === null) return;
                    transfer.importData(file, overwrite ? 'overwrite' : 'new', targetListId);
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
                    if (listId && id) store.toggleItem(listId, id);
                }
            });
            checklistWrapper.addEventListener('click', function(e) {
                const btn = e.target;
                if (btn && btn.classList && btn.classList.contains('item-delete')) {
                    e.preventDefault();
                    const li = btn.closest('.checklist-item');
                    const listId = li && li.getAttribute('data-list-id');
                    const id = li && li.getAttribute('data-id');
                    if (listId && id) store.deleteItem(listId, id);
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
                    if (listId && id) store.toggleItem(listId, id);
                }
            });
            checklistWrapper.addEventListener('keydown', function(e) {
                if (!editingItem) return;
                const input = e.target;
                if (!input || !input.classList || !input.classList.contains('item-edit-input')) return;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commitEdit();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            });
            checklistWrapper.addEventListener('blur', function(e) {
                if (!editingItem) return;
                const input = e.target;
                if (!input || !input.classList || !input.classList.contains('item-edit-input')) return;
                const blurredItem = editingItem;
                setTimeout(function() {
                    if (editingItem === blurredItem) commitEdit();
                }, 150);
            }, true);
        }
    }

    window.TravelChecklistEvents = {
        bindEvents: bindEvents
    };
})();
