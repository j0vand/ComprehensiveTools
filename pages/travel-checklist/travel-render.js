/**
 * 出行清单 - 渲染
 */
(function() {
    'use strict';

    var store = window.TravelChecklistState;
    // 入场动画只在条目首次出现时播放，重建列表时不再整体重播。
    const revealedItemIds = new Set();

    function findElement(rootEl, predicate) {
        const queue = [rootEl];
        while (queue.length) {
            const node = queue.shift();
            const children = node && node.children ? node.children : [];
            for (let index = 0; index < children.length; index += 1) {
                const child = children[index];
                if (predicate(child)) return child;
                queue.push(child);
            }
        }
        return null;
    }

    function hasClass(node, className) {
        return Boolean(node && node.classList && node.classList.contains(className));
    }

    /**
     * 重建列表会销毁旧节点，先把用户正在操作的控件记下来，重建后再把焦点还回去。
     */
    function captureFocusedControl() {
        const active = document.activeElement;
        if (!active || typeof active.closest !== 'function' || !active.classList) return null;
        const li = active.closest('.checklist-item');
        const itemId = li && typeof li.getAttribute === 'function' ? li.getAttribute('data-id') : null;
        if (!itemId) return null;
        if (active.classList.contains('item-checkbox')) return { itemId: itemId, kind: 'checkbox' };
        if (active.classList.contains('item-edit-input')) return { itemId: itemId, kind: 'edit' };
        return null;
    }

    function restoreFocusedControl(focusInfo, containers) {
        let li = null;
        for (let index = 0; index < containers.length && !li; index += 1) {
            li = findElement(containers[index], function(node) {
                return hasClass(node, 'checklist-item') && node.getAttribute('data-id') === focusInfo.itemId;
            });
        }
        if (!li) return;

        if (focusInfo.kind === 'edit') {
            const textSpan = findElement(li, function(node) { return hasClass(node, 'item-text'); });
            const editInput = findElement(li, function(node) { return hasClass(node, 'item-edit-input'); });
            if (!textSpan || !editInput || typeof editInput.focus !== 'function') return;
            textSpan.classList.add('inline-edit');
            editInput.classList.add('show');
            editInput.focus();
            if (typeof editInput.select === 'function') editInput.select();
            return;
        }

        const checkbox = findElement(li, function(node) { return hasClass(node, 'item-checkbox'); });
        if (checkbox && typeof checkbox.focus === 'function') checkbox.focus();
    }

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
        var selectedType = container.querySelector('input[name="new-item-type"]:checked');
        var selectedTypeId = selectedType && types.some(function(t) { return t.id === selectedType.value; })
            ? selectedType.value
            : null;
        container.innerHTML = '';
        types.forEach(function(t, index) {
            var label = document.createElement('label');
            label.className = 'type-option';
            var radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'new-item-type';
            radio.value = t.id;
            radio.checked = selectedTypeId ? t.id === selectedTypeId : index === 0;
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
            const isFirstReveal = !revealedItemIds.has(item.id);
            if (isFirstReveal) revealedItemIds.add(item.id);
            li.className = 'checklist-item' + (isDone ? ' checked' : '') + (isFirstReveal ? '' : ' item-settled');
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
            typeTag.className = 'item-type-tag';
            typeTag.textContent = store.getTypeName(list, item.type);

            const textSpan = document.createElement('span');
            textSpan.className = 'item-text';
            textSpan.textContent = item.text;

            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.className = 'item-edit-input';
            editInput.value = item.text;
            editInput.maxLength = store.LIMITS.itemText;
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

        function buildSubsections(containerEl, itemsByStatus, isDone) {
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
                blockItems.forEach(function(item) { ul.appendChild(makeItemNode(item, isDone)); });
                subsection.appendChild(h3);
                subsection.appendChild(ul);
                containerEl.appendChild(subsection);
            });
        }

        const focusInfo = captureFocusedControl();
        buildSubsections(pendingContainer, pending, false);
        buildSubsections(doneContainer, done, true);
        if (focusInfo) restoreFocusedControl(focusInfo, [pendingContainer, doneContainer]);

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
        renderModalTypes: renderModalTypes,
        fillTemplateSelect: fillTemplateSelect,
        renderList: renderList
    };
})();
