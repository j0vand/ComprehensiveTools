(function (global) {
    'use strict';

    function createDialogService(env) {
        const runtime = env || {};
        const doc = runtime.document || global.document;
        const setTimer = runtime.setTimeout || global.setTimeout;
        const nativeAlert = runtime.alert || global.alert;
        const nativeConfirm = runtime.confirm || global.confirm;
        const nativePrompt = runtime.prompt || global.prompt;
        let toastRegion = null;
        // 同一时刻只保留一个 modal 对话框，避免快速连点叠层。
        let activeModalFinish = null;

        function canUseDom() {
            return Boolean(doc && doc.body && typeof doc.createElement === 'function');
        }

        function getToastRegion() {
            if (toastRegion && toastRegion.parentNode) {
                return toastRegion;
            }

            toastRegion = doc.createElement('div');
            toastRegion.className = 'tool-toast-region';
            toastRegion.setAttribute('aria-live', 'polite');
            doc.body.appendChild(toastRegion);
            return toastRegion;
        }

        function normalizeType(type) {
            return ['success', 'warning', 'error', 'info'].includes(type) ? type : 'info';
        }

        function showToast(message, type, options) {
            const normalizedType = normalizeType(type);
            const duration = options && Number.isFinite(options.duration) ? options.duration : 3000;

            if (!canUseDom()) {
                if (typeof nativeAlert === 'function') {
                    nativeAlert(String(message));
                }
                return null;
            }

            const region = getToastRegion();
            const toast = doc.createElement('div');
            toast.className = 'tool-toast';
            toast.dataset.type = normalizedType;
            toast.textContent = String(message);
            const urgent = normalizedType === 'error' || normalizedType === 'warning';
            toast.setAttribute('role', urgent ? 'alert' : 'status');
            toast.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
            toast.setAttribute('aria-atomic', 'true');
            region.appendChild(toast);

            if (typeof setTimer === 'function' && duration >= 0) {
                setTimer(function () {
                    toast.remove();
                }, duration);
            }

            return toast;
        }

        function dismissActiveModal() {
            if (typeof activeModalFinish === 'function') {
                const finishPrevious = activeModalFinish;
                activeModalFinish = null;
                finishPrevious(false);
            }
        }

        function confirmAction(message, options) {
            if (!canUseDom()) {
                const result = typeof nativeConfirm === 'function' ? nativeConfirm(String(message)) : false;
                return Promise.resolve(Boolean(result));
            }

            return new Promise(function (resolve) {
                dismissActiveModal();

                const labels = options || {};
                const previousFocus = doc.activeElement;
                const backdrop = doc.createElement('div');
                backdrop.className = 'tool-dialog-backdrop';

                const dialog = doc.createElement('div');
                dialog.className = 'tool-dialog';
                dialog.setAttribute('role', 'dialog');
                dialog.setAttribute('aria-modal', 'true');
                dialog.setAttribute('aria-label', String(message));

                const content = doc.createElement('div');
                content.className = 'tool-dialog-message';
                content.textContent = String(message);

                const actions = doc.createElement('div');
                actions.className = 'tool-dialog-actions';

                const cancelButton = doc.createElement('button');
                cancelButton.type = 'button';
                cancelButton.className = 'tool-button tool-button-secondary';
                cancelButton.textContent = labels.cancelText || '取消';

                const confirmButton = doc.createElement('button');
                confirmButton.type = 'button';
                confirmButton.className = 'tool-button tool-button-primary';
                confirmButton.textContent = labels.confirmText || '确定';

                let settled = false;

                // 对话框只能结束一次，同时负责移除监听并把焦点交还给原触发控件。
                function finish(value) {
                    if (settled) return;
                    settled = true;
                    if (activeModalFinish === finish) {
                        activeModalFinish = null;
                    }

                    if (typeof dialog.removeEventListener === 'function') {
                        dialog.removeEventListener('keydown', onKeydown);
                    }
                    if (typeof cancelButton.removeEventListener === 'function') {
                        cancelButton.removeEventListener('click', onCancel);
                    }
                    if (typeof confirmButton.removeEventListener === 'function') {
                        confirmButton.removeEventListener('click', onConfirm);
                    }

                    backdrop.remove();
                    if (previousFocus && typeof previousFocus.focus === 'function') {
                        previousFocus.focus();
                    }
                    // 默认分支仍返回布尔值；escapeValue 可保留调用方需要的三态语义。
                    resolve(value);
                }

                function onCancel() {
                    finish(false);
                }

                function onConfirm() {
                    finish(true);
                }

                function onKeydown(event) {
                    if (event.key === 'Escape') {
                        if (typeof event.preventDefault === 'function') event.preventDefault();
                        finish(Object.prototype.hasOwnProperty.call(labels, 'escapeValue')
                            ? labels.escapeValue
                            : false);
                        return;
                    }

                    if (event.key !== 'Tab') return;
                    const focused = doc.activeElement || event.target;
                    if (event.shiftKey && focused === cancelButton) {
                        if (typeof event.preventDefault === 'function') event.preventDefault();
                        confirmButton.focus();
                    } else if (!event.shiftKey && focused === confirmButton) {
                        if (typeof event.preventDefault === 'function') event.preventDefault();
                        cancelButton.focus();
                    }
                }

                activeModalFinish = finish;
                cancelButton.addEventListener('click', onCancel);
                confirmButton.addEventListener('click', onConfirm);
                dialog.addEventListener('keydown', onKeydown);

                actions.appendChild(cancelButton);
                actions.appendChild(confirmButton);
                dialog.appendChild(content);
                dialog.appendChild(actions);
                backdrop.appendChild(dialog);
                doc.body.appendChild(backdrop);

                if (typeof confirmButton.focus === 'function') {
                    confirmButton.focus();
                }
            });
        }

        /**
         * 收集一段短文本；DOM 可用时负责焦点约束和取消语义，无 DOM 时降级到原生输入框。
         */
        function promptAction(message, options) {
            const labels = options || {};
            const defaultValue = labels.defaultValue === undefined ? '' : String(labels.defaultValue);

            if (!canUseDom()) {
                const result = typeof nativePrompt === 'function'
                    ? nativePrompt(String(message), defaultValue)
                    : null;
                return Promise.resolve(result === null ? null : String(result));
            }

            return new Promise(function (resolve) {
                dismissActiveModal();

                const previousFocus = doc.activeElement;
                const backdrop = doc.createElement('div');
                backdrop.className = 'tool-dialog-backdrop';

                const dialog = doc.createElement('div');
                dialog.className = 'tool-dialog';
                dialog.setAttribute('role', 'dialog');
                dialog.setAttribute('aria-modal', 'true');
                dialog.setAttribute('aria-label', String(message));

                const content = doc.createElement('div');
                content.className = 'tool-dialog-message';
                content.textContent = String(message);

                const input = doc.createElement('input');
                input.type = 'text';
                input.className = 'tool-field tool-dialog-input';
                input.value = defaultValue;
                input.setAttribute('aria-label', String(message));

                const actions = doc.createElement('div');
                actions.className = 'tool-dialog-actions';

                const cancelButton = doc.createElement('button');
                cancelButton.type = 'button';
                cancelButton.className = 'tool-button tool-button-secondary';
                cancelButton.textContent = labels.cancelText || '取消';

                const confirmButton = doc.createElement('button');
                confirmButton.type = 'button';
                confirmButton.className = 'tool-button tool-button-primary';
                confirmButton.textContent = labels.confirmText || '确定';

                let settled = false;

                function finish(value) {
                    if (settled) return;
                    settled = true;
                    if (activeModalFinish === finish) {
                        activeModalFinish = null;
                    }

                    dialog.removeEventListener('keydown', onKeydown);
                    cancelButton.removeEventListener('click', onCancel);
                    confirmButton.removeEventListener('click', onConfirm);
                    backdrop.remove();
                    if (previousFocus && typeof previousFocus.focus === 'function') {
                        previousFocus.focus();
                    }
                    // prompt 被顶替或取消时统一返回 null。
                    resolve(value === undefined ? null : value);
                }

                function onCancel() {
                    finish(null);
                }

                function onConfirm() {
                    finish(input.value);
                }

                function onKeydown(event) {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        finish(null);
                        return;
                    }
                    if (event.key === 'Enter' && event.target === input) {
                        event.preventDefault();
                        finish(input.value);
                        return;
                    }
                    if (event.key !== 'Tab') return;

                    const focused = doc.activeElement || event.target;
                    if (event.shiftKey && focused === input) {
                        event.preventDefault();
                        confirmButton.focus();
                    } else if (!event.shiftKey && focused === confirmButton) {
                        event.preventDefault();
                        input.focus();
                    }
                }

                activeModalFinish = finish;
                cancelButton.addEventListener('click', onCancel);
                confirmButton.addEventListener('click', onConfirm);
                dialog.addEventListener('keydown', onKeydown);

                actions.appendChild(cancelButton);
                actions.appendChild(confirmButton);
                dialog.appendChild(content);
                dialog.appendChild(input);
                dialog.appendChild(actions);
                backdrop.appendChild(dialog);
                doc.body.appendChild(backdrop);

                input.focus();
                if (typeof input.select === 'function') {
                    input.select();
                }
            });
        }

        function showError(errorOrMessage) {
            const message = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
            return showToast(message, 'error', { duration: 5000 });
        }

        return {
            showToast,
            confirmAction,
            promptAction,
            showError
        };
    }

    const api = {
        createDialogService,
        ...createDialogService()
    };

    global.DialogService = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
