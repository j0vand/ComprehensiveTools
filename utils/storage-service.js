(function (global) {
    'use strict';

    function safeParseJson(raw, fallback) {
        if (raw === null || raw === undefined || raw === '') {
            return fallback;
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            if (global.console && typeof global.console.warn === 'function') {
                global.console.warn('Failed to parse stored JSON:', error);
            }
            return fallback;
        }
    }

    function isQuotaExceeded(error) {
        return Boolean(error && (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            error.code === 22 ||
            error.code === 1014
        ));
    }

    function createStorageService(storage) {
        function getJson(key, fallback) {
            if (!storage) return fallback;
            try {
                return safeParseJson(storage.getItem(key), fallback);
            } catch (error) {
                if (global.console && typeof global.console.warn === 'function') {
                    global.console.warn(`Failed to read storage key ${key}:`, error);
                }
                return fallback;
            }
        }

        function setJson(key, value) {
            if (!storage) return { ok: false, reason: 'unavailable' };
            try {
                storage.setItem(key, JSON.stringify(value));
                return { ok: true };
            } catch (error) {
                if (global.console && typeof global.console.warn === 'function') {
                    global.console.warn(`Failed to write storage key ${key}:`, error);
                }
                return {
                    ok: false,
                    reason: isQuotaExceeded(error) ? 'quota-exceeded' : 'write-failed',
                    error
                };
            }
        }

        function remove(key) {
            if (!storage) return { ok: false, reason: 'unavailable' };
            try {
                storage.removeItem(key);
                return { ok: true };
            } catch (error) {
                if (global.console && typeof global.console.warn === 'function') {
                    global.console.warn(`Failed to remove storage key ${key}:`, error);
                }
                return { ok: false, reason: 'remove-failed', error };
            }
        }

        return {
            getJson,
            setJson,
            remove,
            safeParseJson,
            isQuotaExceeded
        };
    }

    function getDefaultStorage() {
        try {
            return global.localStorage || null;
        } catch (error) {
            if (global.console && typeof global.console.warn === 'function') {
                global.console.warn('localStorage is not available:', error);
            }
            return null;
        }
    }

    const api = {
        createStorageService,
        safeParseJson,
        isQuotaExceeded,
        ...createStorageService(getDefaultStorage())
    };

    global.StorageService = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
