(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FormImportExport = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const STORE_VERSION = 1;

    /**
     * 仅接受 JSON 表单协议中的普通键值对象，数组等复合结构由导入边界拒绝。
     */
    function isPlainObject(value) {
        if (value === null || typeof value !== 'object') return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    function getControlKey(control) {
        if (!control || control.disabled || control.readOnly) return '';
        if (control.type === 'file' || control.type === 'button' || control.type === 'submit' || control.type === 'reset') return '';
        if (control.type === 'radio') return control.name || control.id || '';
        return control.id || control.name || '';
    }

    function getControls(root) {
        if (!root || !root.querySelectorAll) return [];
        return Array.from(root.querySelectorAll('input, select, textarea'))
            .filter(control => getControlKey(control));
    }

    function collectFormData(root) {
        const fields = {};

        getControls(root).forEach(control => {
            const key = getControlKey(control);
            if (!key) return;

            if (control.type === 'radio') {
                if (control.checked) fields[key] = control.value;
                return;
            }

            if (control.type === 'checkbox') {
                fields[key] = Boolean(control.checked);
                return;
            }

            fields[key] = control.value;
        });

        return { fields };
    }

    function dispatchControlEvents(control) {
        if (!control || typeof control.dispatchEvent !== 'function') return;
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function applyFormData(root, data) {
        const fields = data && data.fields ? data.fields : data || {};
        if (!isPlainObject(fields)) {
            throw new Error('缺少有效的表单数据');
        }
        const controls = getControls(root);
        const checkedRadioGroups = new Set();

        // 完整预校验后才修改 DOM，失败路径不触发页面联动。
        controls.forEach(control => {
            const key = getControlKey(control);
            if (!key) return;
            if (!Object.prototype.hasOwnProperty.call(fields, key)) {
                if (control.required) throw new Error('缺少必填项');
                return;
            }

            if (control.type === 'radio') {
                if (checkedRadioGroups.has(key)) return;
                checkedRadioGroups.add(key);
                const hasTarget = controls.some(item =>
                    item.type === 'radio'
                    && getControlKey(item) === key
                    && String(item.value) === String(fields[key])
                );
                if (!hasTarget) throw new Error('包含无效选项');
                return;
            }
            if (control.type === 'checkbox') {
                // 无效布尔值跳过该控件，不阻断其余字段导入。
                return;
            }

            const nextValue = fields[key] == null ? '' : String(fields[key]);
            if (String(control.tagName).toUpperCase() === 'SELECT') {
                const hasOption = Array.from(control.options || [])
                    .some(option => String(option.value) === nextValue);
                if (!hasOption) throw new Error('包含无效选项');
                return;
            }
            if (control.type !== 'number') {
                if (control.required && nextValue === '') throw new Error('缺少必填项');
                return;
            }
            if (nextValue !== '' && (nextValue.trim() === '' || !Number.isFinite(Number(nextValue)))) {
                throw new Error('包含无效数值');
            }

            const previousValue = control.value;
            control.value = nextValue;
            const number = Number(control.value);
            const min = control.min === '' || control.min === undefined ? -Infinity : Number(control.min);
            const max = control.max === '' || control.max === undefined ? Infinity : Number(control.max);
            const invalid = control.value === ''
                ? control.required || nextValue !== ''
                : !Number.isFinite(number)
                    || number < min
                    || number > max
                    || Boolean(control.validity && control.validity.stepMismatch);
            control.value = previousValue;
            if (invalid) throw new Error('数值为空、格式错误或不符合步长/范围');
        });

        let appliedCount = 0;

        // 选项联动可能写入建议值，显式导入的普通字段最后覆盖它们。
        const restoredRadioGroups = new Set();
        controls.forEach(control => {
            const key = getControlKey(control);
            if (!key || !Object.prototype.hasOwnProperty.call(fields, key)) return;

            if (control.type === 'radio') {
                if (restoredRadioGroups.has(key)) return;
                restoredRadioGroups.add(key);

                const group = controls.filter(item => item.type === 'radio' && getControlKey(item) === key);
                const target = group.find(item => String(item.value) === String(fields[key]));
                if (!target) return;

                const changed = group.some(item => item.checked !== (item === target));
                group.forEach(item => {
                    item.checked = item === target;
                });
                appliedCount += 1;
                if (changed) dispatchControlEvents(target);
                return;
            }

            if (control.type === 'checkbox') {
                const fieldValue = fields[key];
                if (fieldValue !== true && fieldValue !== false && fieldValue !== 'true' && fieldValue !== 'false') {
                    return;
                }
                const nextChecked = fieldValue === true || fieldValue === 'true';
                const changed = control.checked !== nextChecked;
                control.checked = nextChecked;
                appliedCount += 1;
                if (changed) dispatchControlEvents(control);
            }
        });

        const changedControls = [];
        controls.forEach(control => {
            if (control.type === 'radio' || control.type === 'checkbox') return;
            const key = getControlKey(control);
            if (!key || !Object.prototype.hasOwnProperty.call(fields, key)) return;
            const nextValue = fields[key] == null ? '' : String(fields[key]);
            const changed = control.value !== nextValue;
            control.value = nextValue;
            appliedCount += 1;
            if (changed) changedControls.push(control);
        });
        changedControls.forEach(dispatchControlEvents);

        return { appliedCount };
    }

    function emptyStore() {
        return {
            version: STORE_VERSION,
            draft: null,
            activePresetId: null,
            presets: []
        };
    }

    function isPresetStore(value) {
        return isPlainObject(value)
            && value.version === STORE_VERSION
            && Array.isArray(value.presets);
    }

    function cloneJson(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function normalizeStore(raw) {
        if (raw == null) return emptyStore();
        if (!isPlainObject(raw)) return emptyStore();
        if (isPresetStore(raw)) {
            return {
                version: STORE_VERSION,
                draft: raw.draft == null ? null : cloneJson(raw.draft),
                activePresetId: typeof raw.activePresetId === 'string' ? raw.activePresetId : null,
                presets: (raw.presets || []).filter(item =>
                    isPlainObject(item)
                    && typeof item.id === 'string'
                    && typeof item.name === 'string'
                ).map(item => ({
                    id: item.id,
                    name: item.name,
                    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
                    data: cloneJson(item.data)
                }))
            };
        }
        return {
            version: STORE_VERSION,
            draft: cloneJson(raw),
            activePresetId: null,
            presets: []
        };
    }

    function getStorage(storage) {
        if (storage && typeof storage.getJson === 'function') {
            return storage;
        }
        const globalObject = typeof window !== 'undefined'
            ? window
            : (typeof globalThis !== 'undefined' ? globalThis : null);
        if (globalObject && globalObject.StorageService) {
            return globalObject.StorageService;
        }
        return null;
    }

    function readStore(storageKey, storage) {
        const backend = getStorage(storage);
        if (!backend || !storageKey || typeof backend.getJson !== 'function') return emptyStore();
        return normalizeStore(backend.getJson(storageKey, null));
    }

    function persistStore(storageKey, store, storage) {
        const backend = getStorage(storage);
        if (!backend || !storageKey || typeof backend.setJson !== 'function') {
            return { ok: false, reason: 'unavailable' };
        }
        return backend.setJson(storageKey, normalizeStore(store));
    }

    function writeDraft(storageKey, draft, storage) {
        const store = readStore(storageKey, storage);
        store.draft = cloneJson(draft);
        return persistStore(storageKey, store, storage);
    }

    /**
     * 清空当前草稿并取消「当前方案」指针，保留已命名方案列表。
     * 页面「重置」应调用本方法，避免 remove(key) 删光全部方案。
     */
    function clearDraft(storageKey, storage) {
        const store = readStore(storageKey, storage);
        store.draft = null;
        store.activePresetId = null;
        return persistStore(storageKey, store, storage);
    }

    function createPresetId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function sanitizePresetName(name) {
        return String(name || '')
            .trim()
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .replace(/_+/g, '_')
            .trim();
    }

    function saveAsPreset(store, draft, name, idFactory) {
        const cleanedName = sanitizePresetName(name);
        if (!cleanedName) {
            throw new Error('方案名称不能为空');
        }
        const next = normalizeStore(store);
        const id = typeof idFactory === 'function' ? idFactory() : createPresetId();
        const preset = {
            id,
            name: cleanedName,
            updatedAt: new Date().toISOString(),
            data: cloneJson(draft)
        };
        const existingIndex = next.presets.findIndex(item => item.name === cleanedName);
        if (existingIndex >= 0) {
            next.presets[existingIndex] = preset;
        } else {
            next.presets.push(preset);
        }
        next.activePresetId = id;
        next.draft = cloneJson(draft);
        return next;
    }

    function saveCurrentPreset(store, draft) {
        const next = normalizeStore(store);
        if (!next.activePresetId) {
            return { ok: false, reason: 'needs-name', store: next };
        }
        const index = next.presets.findIndex(item => item.id === next.activePresetId);
        if (index < 0) {
            return { ok: false, reason: 'needs-name', store: next };
        }
        next.presets[index] = {
            ...next.presets[index],
            updatedAt: new Date().toISOString(),
            data: cloneJson(draft)
        };
        next.draft = cloneJson(draft);
        return { ok: true, store: next };
    }

    function loadPreset(store, presetId) {
        const next = normalizeStore(store);
        const preset = next.presets.find(item => item.id === presetId);
        if (!preset) {
            return { ok: false, reason: 'not-found', store: next };
        }
        next.activePresetId = preset.id;
        next.draft = cloneJson(preset.data);
        return { ok: true, store: next, draft: next.draft };
    }

    function renamePreset(store, presetId, name) {
        const cleanedName = sanitizePresetName(name);
        if (!cleanedName) {
            throw new Error('方案名称不能为空');
        }
        const next = normalizeStore(store);
        const index = next.presets.findIndex(item => item.id === presetId);
        if (index < 0) return next;
        const conflict = next.presets.some(item => item.id !== presetId && item.name === cleanedName);
        if (conflict) {
            throw new Error('已存在同名方案');
        }
        next.presets[index] = {
            ...next.presets[index],
            name: cleanedName,
            updatedAt: new Date().toISOString()
        };
        return next;
    }

    function deletePreset(store, presetId) {
        const next = normalizeStore(store);
        next.presets = next.presets.filter(item => item.id !== presetId);
        if (next.activePresetId === presetId) {
            next.activePresetId = null;
        }
        return next;
    }

    function collectActiveState(groups) {
        const state = {};
        (groups || []).forEach(group => {
            const active = document.querySelector(`${group.selector}.active`);
            if (!active) return;
            const key = group.key || group.attribute || group.selector;
            state[key] = active.getAttribute(group.attribute);
        });
        return state;
    }

    function applyActiveState(groups, state) {
        (groups || []).forEach(group => {
            const key = group.key || group.attribute || group.selector;
            const value = state && state[key];
            if (!value) return;

            const buttons = Array.from(document.querySelectorAll(group.selector));
            const target = buttons.find(button => button.getAttribute(group.attribute) === value);
            if (target) target.click();
        });
    }

    function notify(message, type) {
        if (typeof window !== 'undefined' && window.CommonUtils && typeof window.CommonUtils.showNotification === 'function') {
            window.CommonUtils.showNotification(message, type || 'info');
            return;
        }
        if (typeof window !== 'undefined' && window.DialogService && typeof window.DialogService.showToast === 'function') {
            window.DialogService.showToast(message, type || 'info');
            return;
        }
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(message);
        }
    }

    function getActivePresetName(store) {
        if (!store || !store.activePresetId) return '未命名草稿';
        const preset = (store.presets || []).find(item => item.id === store.activePresetId);
        return preset ? preset.name : '未命名草稿';
    }

    function createToolbar(pageName) {
        const toolbar = document.createElement('div');
        toolbar.className = 'form-transfer-toolbar';
        toolbar.setAttribute('aria-label', `${pageName || '表单'}方案管理`);
        toolbar.innerHTML = `
            <div class="form-transfer-actions">
                <span class="form-preset-label" data-role="current-preset">当前：未命名草稿</span>
                <button type="button" class="form-transfer-btn" data-action="save">保存</button>
                <button type="button" class="form-transfer-btn" data-action="save-as">另存为</button>
                <button type="button" class="form-transfer-btn" data-action="manage">加载</button>
            </div>
        `;
        return toolbar;
    }

    function ensureToolbarStyles() {
        if (document.getElementById('form-transfer-toolbar-style')) return;

        const style = document.createElement('style');
        style.id = 'form-transfer-toolbar-style';
        style.textContent = `
            .form-transfer-toolbar {
                max-width: 800px;
                margin: -4px auto 12px;
                padding: 0 16px;
                display: flex;
                align-items: center;
                justify-content: flex-end;
                background: transparent;
                border: 0;
                box-shadow: none;
            }
            .form-transfer-toolbar-inline {
                display: inline-flex;
                width: auto;
                max-width: none;
                margin: 0 0 0 10px;
                padding: 0;
                vertical-align: middle;
            }
            .form-transfer-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .form-preset-label {
                font-size: 12px;
                font-weight: 600;
                color: var(--text-muted, #5f7470);
                max-width: 12em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .form-transfer-btn {
                min-height: 30px;
                padding: 0 10px;
                border: 1px solid transparent;
                border-radius: 8px;
                background: color-mix(in srgb, var(--primary-color, var(--primary, #0f9f8f)) 7%, transparent);
                color: var(--primary-color, var(--primary, #0f9f8f));
                font-size: 13px;
                font-weight: 600;
                line-height: 1;
                cursor: pointer;
                transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
            }
            .form-transfer-btn:hover {
                background: color-mix(in srgb, var(--primary-color, var(--primary, #0f9f8f)) 13%, transparent);
            }
            .form-transfer-btn:active {
                transform: translateY(1px);
            }
            .form-transfer-toolbar-inline .form-transfer-btn {
                min-height: 36px;
                padding: 0 12px;
                border: 0;
                border-radius: 8px;
                background: color-mix(in srgb, var(--primary-color, var(--primary, #0f9f8f)) 8%, transparent);
                color: var(--primary-color, var(--primary, #0f9f8f));
                font-size: 14px;
                box-shadow: none;
            }
            .form-transfer-toolbar-inline .form-preset-label {
                color: inherit;
                opacity: 0.88;
            }
            .form-transfer-toolbar-inline .form-transfer-btn:hover {
                background: color-mix(in srgb, var(--primary-color, var(--primary, #0f9f8f)) 15%, transparent);
            }
            /* 深色顶栏内：白底半透明按钮，避免青绿叠青绿看不见 */
            .form-transfer-toolbar--on-dark .form-preset-label,
            .header .form-transfer-toolbar-inline .form-preset-label,
            .tool-page-header .form-transfer-toolbar-inline .form-preset-label {
                color: rgba(255, 255, 255, 0.92);
                opacity: 1;
            }
            .form-transfer-toolbar--on-dark .form-transfer-btn,
            .header .form-transfer-toolbar-inline .form-transfer-btn,
            .tool-page-header .form-transfer-toolbar-inline .form-transfer-btn {
                background: rgba(255, 255, 255, 0.18) !important;
                color: #ffffff !important;
                border: 1px solid rgba(255, 255, 255, 0.35) !important;
            }
            .form-transfer-toolbar--on-dark .form-transfer-btn:hover,
            .header .form-transfer-toolbar-inline .form-transfer-btn:hover,
            .tool-page-header .form-transfer-toolbar-inline .form-transfer-btn:hover {
                background: rgba(255, 255, 255, 0.28) !important;
            }
            .form-preset-backdrop {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                background: rgba(20, 51, 45, 0.35);
            }
            .form-preset-dialog {
                width: min(420px, 100%);
                max-height: min(70vh, 520px);
                overflow: auto;
                background: #fff;
                border-radius: 14px;
                box-shadow: 0 20px 48px rgba(20, 51, 45, 0.2);
                padding: 18px 18px 14px;
            }
            .form-preset-dialog h3 {
                margin: 0 0 12px;
                font-size: 1.05rem;
            }
            .form-preset-empty {
                color: var(--text-muted, #5f7470);
                font-size: 14px;
                padding: 12px 0 8px;
            }
            .form-preset-list {
                list-style: none;
                margin: 0;
                padding: 0;
                display: grid;
                gap: 8px;
            }
            .form-preset-item {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 8px;
                align-items: center;
                padding: 10px 12px;
                border: 1px solid var(--border-soft, #c9ddd7);
                border-radius: 10px;
            }
            .form-preset-item strong {
                display: block;
                font-size: 14px;
            }
            .form-preset-item small {
                color: var(--text-muted, #5f7470);
                font-size: 12px;
            }
            .form-preset-item-actions {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .form-preset-item-actions button {
                min-height: 30px;
                padding: 0 8px;
                border: 0;
                border-radius: 8px;
                background: color-mix(in srgb, var(--primary-color, #0f9f8f) 10%, transparent);
                color: var(--primary-color, #0f9f8f);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
            }
            .form-preset-item-actions button[data-action="delete"] {
                background: color-mix(in srgb, #e85d75 12%, transparent);
                color: #c23b55;
            }
            .form-preset-dialog-footer {
                display: flex;
                justify-content: flex-end;
                margin-top: 12px;
            }
            .form-preset-dialog-footer button {
                min-height: 34px;
                padding: 0 14px;
                border: 0;
                border-radius: 8px;
                background: #e8f0ee;
                color: #14332d;
                font-weight: 600;
                cursor: pointer;
            }
            @media (max-width: 640px) {
                .form-transfer-toolbar {
                    margin-top: 0;
                    margin-bottom: 10px;
                    padding: 0 16px;
                }
                .form-transfer-toolbar-inline {
                    margin: 0 0 0 8px;
                    padding: 0;
                }
                .form-transfer-actions {
                    gap: 6px;
                }
                .form-transfer-btn {
                    min-height: 28px;
                    padding: 0 9px;
                    font-size: 12px;
                }
                .form-transfer-toolbar-inline .form-transfer-btn {
                    min-height: 34px;
                    padding: 0 11px;
                    font-size: 13px;
                }
                .form-preset-label {
                    max-width: 8em;
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function formatUpdatedAt(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const pad = part => String(part).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function openManageDialog(config, refreshLabel) {
        const store = readStore(config.storageKey);
        const backdrop = document.createElement('div');
        backdrop.className = 'form-preset-backdrop';
        backdrop.setAttribute('role', 'presentation');

        const dialog = document.createElement('div');
        dialog.className = 'form-preset-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', '加载方案');

        const title = document.createElement('h3');
        title.textContent = '加载方案';
        dialog.appendChild(title);

        function close() {
            backdrop.remove();
        }

        if (!store.presets.length) {
            const empty = document.createElement('p');
            empty.className = 'form-preset-empty';
            empty.textContent = '还没有已保存的方案，可先使用「另存为」。';
            dialog.appendChild(empty);
        } else {
            const list = document.createElement('ul');
            list.className = 'form-preset-list';

            store.presets
                .slice()
                .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
                .forEach(preset => {
                    const item = document.createElement('li');
                    item.className = 'form-preset-item';

                    const meta = document.createElement('div');
                    meta.innerHTML = `<strong></strong><small></small>`;
                    meta.querySelector('strong').textContent = preset.name;
                    meta.querySelector('small').textContent = formatUpdatedAt(preset.updatedAt)
                        + (store.activePresetId === preset.id ? ' · 当前' : '');

                    const actions = document.createElement('div');
                    actions.className = 'form-preset-item-actions';

                    const loadBtn = document.createElement('button');
                    loadBtn.type = 'button';
                    loadBtn.textContent = '加载';
                    loadBtn.addEventListener('click', () => {
                        const result = loadPreset(readStore(config.storageKey), preset.id);
                        if (!result.ok) {
                            notify('方案不存在或已删除', 'error');
                            return;
                        }
                        // 先应用到 UI，成功后再落盘，避免存储已切换而表单未更新。
                        try {
                            config.applySnapshot(result.draft);
                            if (typeof config.afterLoad === 'function') {
                                config.afterLoad(result.draft);
                            }
                        } catch (error) {
                            notify(error.message || '加载失败', 'error');
                            return;
                        }
                        const persisted = persistStore(config.storageKey, result.store);
                        if (!persisted.ok) {
                            notify('表单已更新，但无法写入本地存储', 'error');
                            return;
                        }
                        refreshLabel();
                        notify(`已加载「${preset.name}」`, 'success');
                        close();
                    });

                    const renameBtn = document.createElement('button');
                    renameBtn.type = 'button';
                    renameBtn.textContent = '重命名';
                    renameBtn.addEventListener('click', async () => {
                        const inputName = window.DialogService && typeof window.DialogService.promptAction === 'function'
                            ? await window.DialogService.promptAction('重命名方案', {
                                defaultValue: preset.name,
                                confirmText: '保存'
                            })
                            : window.prompt('重命名方案', preset.name);
                        if (inputName === null) return;
                        try {
                            const next = renamePreset(readStore(config.storageKey), preset.id, inputName);
                            const persisted = persistStore(config.storageKey, next);
                            if (!persisted.ok) {
                                notify('重命名失败，无法写入本地存储', 'error');
                                return;
                            }
                            refreshLabel();
                            notify('已重命名', 'success');
                            close();
                            openManageDialog(config, refreshLabel);
                        } catch (error) {
                            notify(error.message || '重命名失败', 'error');
                        }
                    });

                    const deleteBtn = document.createElement('button');
                    deleteBtn.type = 'button';
                    deleteBtn.dataset.action = 'delete';
                    deleteBtn.textContent = '删除';
                    deleteBtn.addEventListener('click', async () => {
                        const confirmed = window.DialogService && typeof window.DialogService.confirmAction === 'function'
                            ? await window.DialogService.confirmAction(`确定删除方案「${preset.name}」？`, {
                                confirmText: '删除'
                            })
                            : window.confirm(`确定删除方案「${preset.name}」？`);
                        if (!confirmed) return;
                        const next = deletePreset(readStore(config.storageKey), preset.id);
                        const persisted = persistStore(config.storageKey, next);
                        if (!persisted.ok) {
                            notify('删除失败，无法写入本地存储', 'error');
                            return;
                        }
                        refreshLabel();
                        notify('已删除方案', 'success');
                        close();
                        openManageDialog(config, refreshLabel);
                    });

                    actions.appendChild(loadBtn);
                    actions.appendChild(renameBtn);
                    actions.appendChild(deleteBtn);
                    item.appendChild(meta);
                    item.appendChild(actions);
                    list.appendChild(item);
                });

            dialog.appendChild(list);
        }

        const footer = document.createElement('div');
        footer.className = 'form-preset-dialog-footer';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '关闭';
        closeBtn.addEventListener('click', close);
        footer.appendChild(closeBtn);
        dialog.appendChild(footer);

        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) close();
        });
        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);
        closeBtn.focus();
    }

    function init(options) {
        const config = Object.assign({
            pageId: '',
            pageName: '',
            storageKey: '',
            rootSelector: 'body',
            insertAfterSelector: 'header',
            inlineAfterSelector: '',
            activeButtonGroups: [],
            collectSnapshot: null,
            applySnapshot: null,
            restoreOnInit: false,
            afterLoad: null
        }, options || {});

        if (!config.storageKey) {
            console.warn('FormImportExport.init 需要 storageKey');
        }

        const formRoot = document.querySelector(config.rootSelector) || document.body;
        const mountAfter = document.querySelector(config.insertAfterSelector);
        const inlineAfter = config.inlineAfterSelector ? document.querySelector(config.inlineAfterSelector) : null;
        ensureToolbarStyles();
        const toolbar = createToolbar(config.pageName);

        if (inlineAfter && inlineAfter.parentNode) {
            toolbar.classList.add('form-transfer-toolbar-inline');
            const darkHost = inlineAfter.closest('.tool-page-header, .header');
            if (darkHost) {
                toolbar.classList.add('form-transfer-toolbar--on-dark');
            }
            inlineAfter.insertAdjacentElement('afterend', toolbar);
        } else if (mountAfter && mountAfter.parentNode) {
            mountAfter.insertAdjacentElement('afterend', toolbar);
        } else {
            formRoot.insertAdjacentElement('afterbegin', toolbar);
        }

        const labelEl = toolbar.querySelector('[data-role="current-preset"]');

        function refreshLabel() {
            const store = readStore(config.storageKey);
            if (labelEl) {
                labelEl.textContent = `当前：${getActivePresetName(store)}`;
                labelEl.title = getActivePresetName(store);
            }
        }

        function defaultCollect() {
            const formData = collectFormData(formRoot);
            return {
                fields: formData.fields,
                activeState: collectActiveState(config.activeButtonGroups)
            };
        }

        function defaultApply(snapshot) {
            const data = snapshot && snapshot.fields ? snapshot : { fields: snapshot || {} };
            applyFormData(formRoot, data);
            applyActiveState(config.activeButtonGroups, snapshot && snapshot.activeState ? snapshot.activeState : {});
        }

        config.collectSnapshot = typeof config.collectSnapshot === 'function'
            ? config.collectSnapshot
            : defaultCollect;
        config.applySnapshot = typeof config.applySnapshot === 'function'
            ? config.applySnapshot
            : defaultApply;

        if (config.restoreOnInit) {
            const store = readStore(config.storageKey);
            if (store.draft != null) {
                try {
                    config.applySnapshot(store.draft);
                } catch (error) {
                    console.warn('恢复草稿失败，保留页面当前值:', error);
                }
            }
        }

        refreshLabel();

        async function handleSaveAs() {
            const draft = config.collectSnapshot();
            const inputName = window.DialogService && typeof window.DialogService.promptAction === 'function'
                ? await window.DialogService.promptAction('另存为方案', {
                    defaultValue: '',
                    confirmText: '保存'
                })
                : window.prompt('另存为方案', '');
            if (inputName === null) return;
            try {
                const next = saveAsPreset(readStore(config.storageKey), draft, inputName);
                const persisted = persistStore(config.storageKey, next);
                if (!persisted.ok) {
                    notify('保存失败，无法写入本地存储', 'error');
                    return;
                }
                refreshLabel();
                notify(`已另存为「${getActivePresetName(next)}」`, 'success');
            } catch (error) {
                notify(error.message || '另存为失败', 'error');
            }
        }

        toolbar.querySelector('[data-action="save"]').addEventListener('click', async () => {
            const draft = config.collectSnapshot();
            const saved = saveCurrentPreset(readStore(config.storageKey), draft);
            if (!saved.ok && saved.reason === 'needs-name') {
                await handleSaveAs();
                return;
            }
            const persisted = persistStore(config.storageKey, saved.store);
            if (!persisted.ok) {
                notify('保存失败，无法写入本地存储', 'error');
                return;
            }
            refreshLabel();
            notify(`已保存「${getActivePresetName(saved.store)}」`, 'success');
        });

        toolbar.querySelector('[data-action="save-as"]').addEventListener('click', handleSaveAs);
        toolbar.querySelector('[data-action="manage"]').addEventListener('click', () => {
            openManageDialog(config, refreshLabel);
        });

        return {
            toolbar,
            refreshLabel,
            collectSnapshot: config.collectSnapshot,
            applySnapshot: config.applySnapshot
        };
    }

    return {
        STORE_VERSION,
        collectFormData,
        applyFormData,
        collectActiveState,
        applyActiveState,
        normalizeStore,
        readStore,
        writeDraft,
        clearDraft,
        persistStore,
        saveAsPreset,
        saveCurrentPreset,
        loadPreset,
        renamePreset,
        deletePreset,
        sanitizePresetName,
        createPresetId,
        getActivePresetName,
        init
    };
});
