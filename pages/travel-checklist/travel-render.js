/**
 * 出行清单 - 渲染
 */
(function() {
    'use strict';

    var store = window.TravelChecklistState;

    function renderListSwitcher() {
        const el = document.getElementById('list-switcher');
        if (!el) return;
        const cur = store.state.activeListId;
        el.innerHTML = '';
        store.state.lists.forEach(function(list) {
            const opt = document.createElement('option');
            opt.value = list.id;
            opt.textContent = list.name;
            if (list.id === cur) opt.selected = true;
            el.appendChild(opt);
        });
    }

    function renderTypeOptions() {
        var container = document.getElementById('type-options-container');
        if (!container) return;
        var list = store.getCurrentList();
        var types = store.getListTypes(list);
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

    function renderPendingDone() {
        const list = store.getCurrentList();
        const pendingContainer = document.getElementById('pending-subsections');
        const doneContainer = document.getElementById('done-subsections');
        const progressText = document.getElementById('progress-text');
        const allDoneEl = document.getElementById('progress-all-done');

        if (!list || !pendingContainer || !doneContainer) return;

        const types = store.getListTypes(list);
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
            typeTag.textContent = store.getTypeName(list, item.type);

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

    function renderModalTypes() {
        var list = store.getCurrentList();
        var types = store.getListTypes(list);
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

    function fillTemplateSelect() {
        const sel = document.getElementById('new-list-template');
        if (!sel) return;
        sel.innerHTML = '<option value="">请选择模板</option>';
        store.TEMPLATES.forEach(function(t) {
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

    window.TravelChecklistRender = {
        renderListSwitcher: renderListSwitcher,
        renderTypeOptions: renderTypeOptions,
        renderPendingDone: renderPendingDone,
        renderModalTypes: renderModalTypes,
        fillTemplateSelect: fillTemplateSelect,
        renderList: renderList
    };
})();
