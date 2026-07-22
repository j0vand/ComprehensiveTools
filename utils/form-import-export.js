(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FormImportExport = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const SCHEMA = 'comprehensive-tools.form.v1';
    const DEFAULT_FILENAME = 'calculator-form';
    // 导入文件上限用于在 FileReader 分配内存前拦截异常大文件。
    const MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024;

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
            throw new Error('导入文件缺少表单数据');
        }
        const controls = getControls(root);
        const checkedRadioGroups = new Set();

        // 完整预校验后才修改 DOM，失败路径不触发页面联动。
        controls.forEach(control => {
            const key = getControlKey(control);
            if (!key) return;
            if (!Object.prototype.hasOwnProperty.call(fields, key)) {
                if (control.required) throw new Error('导入文件缺少必填项');
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
                if (!hasTarget) throw new Error('导入文件包含无效选项');
                return;
            }
            if (control.type === 'checkbox') {
                const value = fields[key];
                if (value !== true && value !== false && value !== 'true' && value !== 'false') {
                    throw new Error('导入文件包含无效选项');
                }
                return;
            }

            const nextValue = fields[key] == null ? '' : String(fields[key]);
            if (String(control.tagName).toUpperCase() === 'SELECT') {
                const hasOption = Array.from(control.options || [])
                    .some(option => String(option.value) === nextValue);
                if (!hasOption) throw new Error('导入文件包含无效选项');
                return;
            }
            if (control.type !== 'number') {
                if (control.required && nextValue === '') throw new Error('导入文件缺少必填项');
                return;
            }
            if (nextValue !== '' && (nextValue.trim() === '' || !Number.isFinite(Number(nextValue)))) {
                throw new Error('导入文件包含无效数值');
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
            if (invalid) throw new Error('导入数值为空、格式错误或不符合步长/范围');
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

    function sanitizeFilename(name, fallback = DEFAULT_FILENAME) {
        const cleaned = String(name || '')
            .trim()
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        return cleaned || fallback;
    }

    function timestamp() {
        const date = new Date();
        const pad = value => String(value).padStart(2, '0');
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join('');
    }

    function createExportPayload(options) {
        const root = options.root || document;
        const formData = collectFormData(root);

        return {
            schema: SCHEMA,
            pageId: options.pageId || '',
            pageName: options.pageName || document.title || '',
            exportedAt: new Date().toISOString(),
            fields: formData.fields,
            activeState: options.activeState || {}
        };
    }

    function parseImportedText(text, expectedPageId) {
        const parsed = JSON.parse(text);
        if (!isPlainObject(parsed)) {
            throw new Error('导入文件不是有效的配置对象');
        }
        if (parsed.schema !== SCHEMA) {
            throw new Error('导入文件版本不兼容');
        }
        if (!isPlainObject(parsed.fields)) {
            throw new Error('导入文件缺少表单数据');
        }
        for (const value of Object.values(parsed.fields)) {
            const type = typeof value;
            if (value !== null && type !== 'string' && type !== 'number' && type !== 'boolean') {
                throw new Error('导入文件包含不支持的表单值');
            }
            if (type === 'number' && !Number.isFinite(value)) {
                throw new Error('导入文件包含无效数值');
            }
        }
        if (parsed.activeState !== undefined && !isPlainObject(parsed.activeState)) {
            throw new Error('导入文件的页面状态无效');
        }
        if (expectedPageId !== undefined && parsed.pageId !== expectedPageId) {
            throw new Error('导入文件不属于当前页面');
        }
        return parsed;
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
        if (window.CommonUtils && typeof window.CommonUtils.showNotification === 'function') {
            window.CommonUtils.showNotification(message, type || 'info');
            return;
        }
        if (window.DialogService && typeof window.DialogService.showToast === 'function') {
            window.DialogService.showToast(message, type || 'info');
            return;
        }
        console.error(message);
    }

    function downloadJson(payload, filename) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function createToolbar(options) {
        const toolbar = document.createElement('div');
        toolbar.className = 'form-transfer-toolbar';
        toolbar.setAttribute('aria-label', `${options.pageName || '表单配置'}导入导出`);
        toolbar.innerHTML = `
            <div class="form-transfer-actions">
                <button type="button" class="form-transfer-btn" data-action="import">导入</button>
                <button type="button" class="form-transfer-btn" data-action="export">导出</button>
            </div>
            <input type="file" accept="application/json,.json" class="form-transfer-file" hidden>
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
            }
            .form-transfer-btn {
                min-height: 30px;
                padding: 0 10px;
                border: 1px solid transparent;
                border-radius: 8px;
                background: color-mix(in srgb, var(--primary-color, var(--primary, #2563eb)) 7%, transparent);
                color: var(--primary-color, var(--primary, #2563eb));
                font-size: 13px;
                font-weight: 600;
                line-height: 1;
                cursor: pointer;
                transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
            }
            .form-transfer-btn:hover {
                background: color-mix(in srgb, var(--primary-color, var(--primary, #2563eb)) 13%, transparent);
            }
            .form-transfer-btn:active {
                transform: translateY(1px);
            }
            .form-transfer-toolbar-inline .form-transfer-btn {
                min-height: 36px;
                padding: 0 12px;
                border: 0;
                border-radius: 8px;
                background: color-mix(in srgb, var(--primary-color, var(--primary, #2563eb)) 8%, transparent);
                color: var(--primary-color, var(--primary, #2563eb));
                font-size: 14px;
                box-shadow: none;
            }
            .form-transfer-toolbar-inline .form-transfer-btn:hover {
                background: color-mix(in srgb, var(--primary-color, var(--primary, #2563eb)) 15%, transparent);
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
            }
        `;
        document.head.appendChild(style);
    }

    function init(options) {
        const config = Object.assign({
            pageId: '',
            rootSelector: 'body',
            insertAfterSelector: 'header',
            inlineAfterSelector: '',
            filenamePrefix: 'calculator-form',
            activeButtonGroups: [],
            afterImport: null
        }, options || {});

        const formRoot = document.querySelector(config.rootSelector) || document.body;
        const mountAfter = document.querySelector(config.insertAfterSelector);
        const inlineAfter = config.inlineAfterSelector ? document.querySelector(config.inlineAfterSelector) : null;
        ensureToolbarStyles();
        const toolbar = createToolbar(config);

        if (inlineAfter && inlineAfter.parentNode) {
            toolbar.classList.add('form-transfer-toolbar-inline');
            inlineAfter.insertAdjacentElement('afterend', toolbar);
        } else if (mountAfter && mountAfter.parentNode) {
            mountAfter.insertAdjacentElement('afterend', toolbar);
        } else {
            formRoot.insertAdjacentElement('afterbegin', toolbar);
        }

        const fileInput = toolbar.querySelector('.form-transfer-file');
        const importButton = toolbar.querySelector('[data-action="import"]');
        const exportButton = toolbar.querySelector('[data-action="export"]');

        importButton.addEventListener('click', () => fileInput.click());

        exportButton.addEventListener('click', async () => {
            const defaultName = `${config.filenamePrefix || DEFAULT_FILENAME}-${timestamp()}`;
            const inputName = window.DialogService && typeof window.DialogService.promptAction === 'function'
                ? await window.DialogService.promptAction('请输入导出文件名', {
                    defaultValue: defaultName,
                    confirmText: '导出'
                })
                : defaultName;
            if (inputName === null) return;

            const filename = sanitizeFilename(inputName, defaultName);
            const payload = createExportPayload({
                pageId: config.pageId,
                pageName: config.pageName,
                root: formRoot,
                activeState: collectActiveState(config.activeButtonGroups)
            });
            downloadJson(payload, filename);
            notify('导出成功', 'success');
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (file.size > MAX_IMPORT_FILE_SIZE) {
                notify('导入文件不能超过 2 MiB', 'error');
                fileInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = parseImportedText(String(reader.result || ''), config.pageId);
                    const result = applyFormData(formRoot, data);
                    applyActiveState(config.activeButtonGroups, data.activeState || {});
                    if (typeof config.afterImport === 'function') {
                        config.afterImport(data, result);
                    }
                    notify(`导入成功，已覆盖 ${result.appliedCount} 个输入项`, 'success');
                } catch (error) {
                    notify(error.message || '导入失败，请检查文件格式', 'error');
                } finally {
                    fileInput.value = '';
                }
            };
            reader.onerror = () => {
                notify('读取文件失败，请重试', 'error');
                fileInput.value = '';
            };
            reader.readAsText(file, 'utf-8');
        });

        return toolbar;
    }

    return {
        SCHEMA,
        collectFormData,
        applyFormData,
        sanitizeFilename,
        createExportPayload,
        parseImportedText,
        init
    };
});
