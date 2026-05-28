const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function withSilentWarn(callback) {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        return callback();
    } finally {
        console.warn = originalWarn;
    }
}

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
        clear() {
            data.clear();
        }
    };
}

test('safeParseJson returns parsed JSON for valid input', () => {
    const { safeParseJson } = require('../utils/storage-service.js');
    assert.deepEqual(safeParseJson('{"name":"工具"}', {}), { name: '工具' });
});

test('safeParseJson returns fallback for invalid input', () => {
    const { safeParseJson } = require('../utils/storage-service.js');
    withSilentWarn(() => {
        assert.deepEqual(safeParseJson('{bad json', { ok: false }), { ok: false });
    });
});

test('getJson reads JSON and falls back for missing or broken values', () => {
    const storage = createMemoryStorage();
    const service = require('../utils/storage-service.js').createStorageService(storage);

    assert.deepEqual(service.getJson('missing', []), []);

    storage.setItem('broken', '{bad');
    withSilentWarn(() => {
        assert.deepEqual(service.getJson('broken', { fallback: true }), { fallback: true });
    });

    storage.setItem('valid', '{"count":2}');
    assert.deepEqual(service.getJson('valid', null), { count: 2 });
});

test('setJson and remove return structured results', () => {
    const storage = createMemoryStorage();
    const service = require('../utils/storage-service.js').createStorageService(storage);

    assert.deepEqual(service.setJson('sample', { saved: true }), { ok: true });
    assert.equal(storage.getItem('sample'), '{"saved":true}');

    assert.deepEqual(service.remove('sample'), { ok: true });
    assert.equal(storage.getItem('sample'), null);
});

test('setJson reports quota exceeded errors', () => {
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const storage = {
        getItem() { return null; },
        setItem() { throw quotaError; },
        removeItem() {}
    };
    const service = require('../utils/storage-service.js').createStorageService(storage);

    const result = withSilentWarn(() => service.setJson('sample', { too: 'large' }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'quota-exceeded');
    assert.equal(service.isQuotaExceeded(quotaError), true);
});

test('browser initialization falls back when localStorage access throws', () => {
    const source = fs.readFileSync(path.join(__dirname, '../utils/storage-service.js'), 'utf8');
    const context = {
        console: { warn() {} }
    };

    vm.createContext(context);
    vm.runInContext(`
        Object.defineProperty(globalThis, 'localStorage', {
            get() {
                throw new Error('Blocked');
            }
        });
    `, context);
    vm.runInContext(source, context);

    assert.equal(typeof context.StorageService.getJson, 'function');
    assert.deepEqual(context.StorageService.getJson('missing', { fallback: true }), { fallback: true });
    assert.equal(context.StorageService.setJson('sample', { value: 1 }).ok, true);
    assert.equal(context.StorageService.getJson('sample', null).value, 1);
    assert.equal(context.StorageService.remove('sample').ok, true);
    assert.equal(context.StorageService.getJson('sample', { removed: true }).removed, true);
});
