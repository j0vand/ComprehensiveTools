(function (global) {
    'use strict';

    function createDialogService(env) {
        const runtime = env || {};
        const doc = runtime.document || global.document;
        const setTimer = runtime.setTimeout || global.setTimeout;
        const nativeAlert = runtime.alert || global.alert;
        const nativeConfirm = runtime.confirm || global.confirm;
        let toastRegion = null;

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
            region.appendChild(toast);

            if (typeof setTimer === 'function' && duration >= 0) {
                setTimer(function () {
                    toast.remove();
                }, duration);
            }

            return toast;
        }

        function closeDialog(backdrop, resolve, value) {
            backdrop.remove();
            resolve(value);
        }

        function confirmAction(message, options) {
            if (!canUseDom()) {
                const result = typeof nativeConfirm === 'function' ? nativeConfirm(String(message)) : false;
                return Promise.resolve(Boolean(result));
            }

            return new Promise(function (resolve) {
                const labels = options || {};
                const backdrop = doc.createElement('div');
                backdrop.className = 'tool-dialog-backdrop';

                const dialog = doc.createElement('div');
                dialog.className = 'tool-dialog';
                dialog.setAttribute('role', 'dialog');
                dialog.setAttribute('aria-modal', 'true');

                const content = doc.createElement('div');
                content.textContent = String(message);

                const actions = doc.createElement('div');
                actions.className = 'tool-dialog-actions';

                const cancelButton = doc.createElement('button');
                cancelButton.type = 'button';
                cancelButton.className = 'tool-button tool-button-secondary';
                cancelButton.textContent = labels.cancelText || '取消';
                cancelButton.addEventListener('click', function () {
                    closeDialog(backdrop, resolve, false);
                });

                const confirmButton = doc.createElement('button');
                confirmButton.type = 'button';
                confirmButton.className = 'tool-button tool-button-primary';
                confirmButton.textContent = labels.confirmText || '确定';
                confirmButton.addEventListener('click', function () {
                    closeDialog(backdrop, resolve, true);
                });

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

        function showError(errorOrMessage) {
            const message = errorOrMessage instanceof Error ? errorOrMessage.message : String(errorOrMessage);
            return showToast(message, 'error', { duration: 5000 });
        }

        return {
            showToast,
            confirmAction,
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
