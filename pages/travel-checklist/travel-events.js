/**
 * 出行清单 - 事件绑定
 */
(function() {
    'use strict';

    var store = window.TravelChecklistState;
    var render = window.TravelChecklistRender;
    var transfer = window.TravelChecklistImportExport;
    var editingItemId = null;

    function startEdit(listId, itemId) {
        const wrapper = document.getElementById('checklist-wrapper');
        if (wrapper && editingItemId) {
            const prevLi = wrapper.querySelector('.checklist-item[data-id="' + editingItemId.itemId + '"]');
            const prevInput = prevLi && prevLi.querySelector('.item-edit-input');
            if (prevInput) {
                store.updateItemTextSilent(editingItemId.listId, editingItemId.itemId, prevInput.value);
            }
            editingItemId = null;
        }
        const list = store.state.lists.find(function(l) { return l.id === listId; });
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

    function commitEdit(value) {
        if (!editingItemId) return;
        store.updateItemText(editingItemId.listId, editingItemId.itemId, value);
        editingItemId = null;
    }

    function cancelEdit() {
        editingItemId = null;
        render.renderList();
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
                render.fillTemplateSelect();
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
                store.createList(newListName ? newListName.value : '', templateId || undefined);
                if (modalNewList) modalNewList.classList.add('hidden');
            });
        }

        if (duplicateListBtn) {
            duplicateListBtn.addEventListener('click', function() {
                const list = store.getCurrentList();
                if (!list) return;
                let name = list.name + ' 副本';
                let n = 1;
                while (store.state.lists.some(function(l) { return l.name === name; })) {
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
                const list = store.getCurrentList();
                if (list) store.duplicateList(list.id, duplicateListName ? duplicateListName.value : undefined);
                if (modalDuplicate) modalDuplicate.classList.add('hidden');
            });
        }

        if (renameListBtn) {
            renameListBtn.addEventListener('click', function() {
                const list = store.getCurrentList();
                if (!list) return;
                const name = prompt('重命名清单', list.name);
                if (name != null) store.renameList(list.id, name);
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
            });
        }
        if (modalTypesAddBtn && modalTypesNewName) {
            modalTypesAddBtn.addEventListener('click', function() {
                var list = store.getCurrentList();
                if (list) store.addType(list.id, modalTypesNewName.value);
                if (modalTypesNewName) modalTypesNewName.value = '';
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
                    var name = prompt('重命名类型', row.querySelector('.modal-type-name').textContent);
                    if (name != null) store.renameType(list.id, typeId, name);
                    render.renderModalTypes();
                }
                if (btn.classList && btn.classList.contains('modal-type-delete')) {
                    window.DialogService.confirmAction('删除该类型后，其下所有项将归入第一种类型。确定删除？').then(function(confirmed) {
                        if (confirmed) store.deleteType(list.id, typeId);
                        render.renderModalTypes();
                    });
                }
            });
        }

        function doAdd() {
            var typeEl = document.querySelector('input[name="new-item-type"]:checked');
            var typeId = typeEl ? typeEl.value : 'item';
            store.addItem(newItemInput ? newItemInput.value : '', typeId);
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
                window.DialogService.confirmAction('是否覆盖当前清单？\n点击「确定」覆盖当前清单，点击「取消」则导入为新清单。').then(function(confirmed) {
                    transfer.importData(file, confirmed ? 'overwrite' : 'new');
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

    window.TravelChecklistEvents = {
        bindEvents: bindEvents
    };
})();
