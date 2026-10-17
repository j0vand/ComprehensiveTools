const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const stateSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/travel-checklist/travel-state.js'),
    'utf8'
);
const transferSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/travel-checklist/travel-import-export.js'),
    'utf8'
);
const renderSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/travel-checklist/travel-render.js'),
    'utf8'
);

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createTravelHarness(initialPayload) {
    const storage = new Map();
    if (initialPayload != null) storage.set('travel-test', JSON.stringify(initialPayload));
    let failWrites = false;
    let readerCount = 0;
    let renderCount = 0;
    const messages = [];
    const timers = [];
    const revoked = [];

    function readStored(key, fallback) {
        if (!storage.has(key)) return fallback;
        return clone(JSON.parse(storage.get(key)));
    }

    function writeStored(key, value) {
        storage.set(key, JSON.stringify(value));
    }

    // 浏览器 FileReader 是异步的：结果只会在 microtask 之后交付。
    class FakeFileReader {
        constructor() {
            readerCount += 1;
        }

        readAsText(file) {
            queueMicrotask(() => {
                if (typeof this.onload === 'function') {
                    this.onload({ target: { result: file.text } });
                }
            });
        }
    }

    const context = {
        console,
        Blob: class FakeBlob {},
        FileReader: FakeFileReader,
        URL: {
            createObjectURL() { return 'blob:test'; },
            revokeObjectURL(url) { revoked.push(url); }
        },
        document: {
            createElement() {
                return {
                    click() {},
                    href: '',
                    download: ''
                };
            }
        },
        localStorage: {
            setItem(key, value) {
                if (failWrites) throw new Error('quota exceeded');
                storage.set(key, String(value));
            },
            getItem(key) {
                return storage.has(key) ? storage.get(key) : null;
            }
        },
        setTimeout(callback) {
            timers.push(callback);
            return timers.length;
        },
        window: {
            StorageKeys: { TRAVEL_CHECKLIST: 'travel-test' },
            StorageService: {
                getJson(key, fallback) {
                    return readStored(key, fallback);
                },
                setJson(key, value) {
                    if (failWrites) return { ok: false, reason: 'write-failed' };
                    writeStored(key, value);
                    return { ok: true };
                }
            },
            CommonUtils: {
                getLocalStorageItem(key, fallback) {
                    return readStored(key, fallback);
                },
                setLocalStorageItem(key, value) {
                    if (failWrites) return false;
                    writeStored(key, value);
                    return true;
                }
            },
            DialogService: {
                showToast(message, type) {
                    messages.push({ message, type });
                },
                confirmAction() {
                    return Promise.resolve(true);
                }
            },
            TravelChecklistRender: {
                renderList() {
                    renderCount += 1;
                }
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(stateSource, context);
    context.window.TravelChecklistState.loadData();
    vm.runInContext(transferSource, context);

    return {
        context,
        store: context.window.TravelChecklistState,
        transfer: context.window.TravelChecklistImportExport,
        messages,
        timers,
        revoked,
        failWrites(value) { failWrites = value; },
        getSaved() { return readStored('travel-test', null); },
        getStoredJson(key) { return readStored(key, null); },
        getStorageKeys() { return Array.from(storage.keys()); },
        getReaderCount() { return readerCount; },
        getRenderCount() { return renderCount; }
    };
}

function currentPayload(items) {
    return {
        version: 1,
        data: {
            lists: [{
                id: 'list-1',
                name: '我的清单',
                types: [{ id: 'item', name: '物品' }, { id: 'task', name: '事项' }, { id: 'other', name: '其他' }],
                items: items || [{ id: 'item-1', text: '身份证', checked: false, order: 0, type: 'item' }]
            }],
            activeListId: 'list-1'
        }
    };
}

test('travel mutations keep memory and UI on the persisted snapshot when storage fails', async () => {
    const harness = createTravelHarness(currentPayload());
    const before = clone(harness.store.state);
    harness.failWrites(true);

    assert.equal(harness.store.createList('新清单'), false);
    assert.deepEqual(clone(harness.store.state), before);

    assert.equal(harness.store.renameList('list-1', '改名'), false);
    assert.deepEqual(clone(harness.store.state), before);

    assert.equal(harness.store.addType('list-1', '票据'), false);
    assert.deepEqual(clone(harness.store.state), before);

    assert.equal(harness.store.addItem('护照', 'item'), false);
    assert.deepEqual(clone(harness.store.state), before);

    assert.equal(harness.store.toggleItem('list-1', 'item-1'), false);
    assert.deepEqual(clone(harness.store.state), before);

    assert.equal(await harness.store.deleteItem('list-1', 'item-1'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.messages.some(function(entry) {
        return entry.type === 'error' && /保存失败|撤销/.test(entry.message);
    }), true);
    assert.ok(harness.getRenderCount() > 0);
});

test('every remaining travel mutation also rolls back on persistence failure', async () => {
    const payload = currentPayload([
        { id: 'item-1', text: '身份证', checked: true, order: 0, type: 'item' },
        { id: 'item-2', text: '护照', checked: false, order: 1, type: 'other' }
    ]);
    payload.data.lists.push({
        id: 'list-2',
        name: '备用清单',
        types: [{ id: 'item-2-type', name: '物品' }, { id: 'task-2-type', name: '事项' }],
        items: []
    });
    const harness = createTravelHarness(payload);
    const before = clone(harness.store.state);
    harness.failWrites(true);

    assert.equal(harness.store.duplicateList('list-1', '复制清单'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.store.renameType('list-1', 'other', '其他物品'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.store.deleteType('list-1', 'other'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.store.updateItemText('list-1', 'item-1', '证件'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(await harness.store.resetChecked('list-1'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.store.reorderItems('list-1', ['item-2', 'item-1']), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.store.switchList('list-2'), false);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(await harness.store.deleteList('list-2'), false);
    assert.deepEqual(clone(harness.store.state), before);
});

test('travel list and type names reject blanks, overlong values, and case-insensitive duplicates', () => {
    const harness = createTravelHarness(currentPayload());
    const store = harness.store;

    assert.equal(store.createList('  '), false);
    assert.equal(store.createList('x'.repeat(51)), false);
    assert.equal(store.createList(' 我的清单 '), false);
    assert.equal(store.createList('Trip'), true);
    assert.equal(store.createList(' trip '), false);

    const current = store.getCurrentList();
    assert.equal(store.addType(current.id, '票据'), true);
    assert.equal(store.addType(current.id, ' 票据 '), false);
    assert.equal(store.addType(current.id, 'x'.repeat(21)), false);
});

test('travel legacy migration preserves a legitimate one-item identity-card list', () => {
    const harness = createTravelHarness({
        version: 1,
        data: {
            items: [{ id: 'identity', text: '身份证', checked: true, order: 0, type: 'item' }]
        }
    });

    const list = harness.store.getCurrentList();
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].text, '身份证');
    assert.equal(list.items[0].checked, true);
});

function validImportPayload() {
    return {
        version: 1,
        data: {
            lists: [{
                id: 'external-list',
                name: '外部清单',
                types: [{ id: 'external-type-1', name: '物品' }, { id: 'external-type-2', name: '事项' }],
                items: [
                    { id: 'external-item-1', text: '护照', checked: false, order: 0, type: 'external-type-1' },
                    { id: 'external-item-2', text: '值机', checked: true, order: 1, type: 'external-type-2' }
                ]
            }],
            activeListId: 'external-list'
        }
    };
}

test('travel import rejects the 2 MiB limit synchronously before reading', () => {
    const harness = createTravelHarness(currentPayload());

    // 超限走同步拒绝：不创建 reader，也不进入异步读取。
    assert.equal(harness.transfer.importData({ size: 2 * 1024 * 1024 + 1, text: '{}' }, 'new'), false);
    assert.equal(harness.getReaderCount(), 0);
    assert.equal(harness.messages.at(-1).type, 'error');
    assert.match(harness.messages.at(-1).message, /2 MiB/);
});

test('travel import resolves false for invalid JSON through the asynchronous reader', async () => {
    const harness = createTravelHarness(currentPayload());
    const before = clone(harness.store.state);

    const result = harness.transfer.importData({ size: 512, text: '{ not json' }, 'new');
    assert.equal(typeof result.then, 'function');
    assert.equal(await result, false);

    assert.equal(harness.getReaderCount(), 1);
    assert.deepEqual(clone(harness.store.state), before);
    assert.equal(harness.messages.at(-1).type, 'error');
    assert.match(harness.messages.at(-1).message, /导入失败/);
});

test('travel import strictly validates schema and rejects prototype-pollution keys', () => {
    const harness = createTravelHarness(currentPayload());
    assert.equal(typeof harness.transfer.parseImportedText, 'function');

    const badTexts = [
        JSON.stringify({ data: validImportPayload().data }),
        JSON.stringify({ version: 1, data: { lists: [{ id: 'x', name: 'x'.repeat(51), types: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], items: [] }] } }),
        JSON.stringify({ version: 1, data: { lists: [{ id: 'x', name: 'x', types: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], items: [{ id: 'i', text: 'x', checked: 'yes', order: 0, type: 'a' }] }] } }),
        '{"version":1,"data":{"lists":[{"id":"x","name":"x","types":[{"id":"a","name":"a"},{"id":"b","name":"b"}],"items":[],"__proto__":{"polluted":true}}]}}'
    ];

    badTexts.forEach(function(text) {
        assert.throws(function() {
            harness.transfer.parseImportedText(text);
        }, /导入|格式|版本|名称|字段|布尔/);
    });
    assert.equal({}.polluted, undefined);
});

test('travel import rejects item text duplicates after trimming and case folding', () => {
    const harness = createTravelHarness(currentPayload());
    const payload = validImportPayload();
    payload.data.lists[0].items[1].text = ' 护照 ';

    assert.throws(function() {
        harness.transfer.parseImportedText(JSON.stringify(payload));
    }, /相同内容/);
});

test('travel import rebuilds globally unique ids and rolls back when persistence fails', async () => {
    const harness = createTravelHarness(currentPayload());
    const payload = validImportPayload();
    const sourceIds = new Set(['external-list', 'external-type-1', 'external-type-2', 'external-item-1', 'external-item-2']);

    assert.equal(await harness.transfer.importData({ size: 1024, text: JSON.stringify(payload) }, 'new'), true);
    const imported = harness.store.getCurrentList();
    const ids = [imported.id]
        .concat(imported.types.map(function(type) { return type.id; }))
        .concat(imported.items.map(function(item) { return item.id; }));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.some(function(id) { return sourceIds.has(id); }), false);

    const beforeFailure = clone(harness.store.state);
    harness.failWrites(true);
    const secondPayload = validImportPayload();
    secondPayload.data.lists[0].name = '另一个外部清单';
    assert.equal(await harness.transfer.importData({ size: 1024, text: JSON.stringify(secondPayload) }, 'new'), false);
    assert.deepEqual(clone(harness.store.state), beforeFailure);
});

test('travel export revokes the blob url on a later task', () => {
    const harness = createTravelHarness(currentPayload());

    harness.transfer.exportData('current');
    assert.deepEqual(harness.revoked, []);
    assert.equal(harness.timers.length, 1);
    harness.timers[0]();
    assert.deepEqual(harness.revoked, ['blob:test']);
});

test('travel keeps legitimate list items when stored data has a duplicate text', () => {
    // 旧版没有重名校验，完全可能存下同一清单内的重复文案；
    // 新版校验会拒绝它，但绝不能因此把整份清单重置为默认 5 项。
    const harness = createTravelHarness({
        version: 1,
        data: {
            lists: [{
                id: 'list-1',
                name: '我的清单',
                types: [{ id: 'item', name: '物品' }, { id: 'task', name: '事项' }, { id: 'other', name: '其他' }],
                items: [
                    { id: 'i-1', text: '护照', checked: false, order: 0, type: 'item' },
                    { id: 'i-2', text: '护照', checked: true, order: 1, type: 'item' },
                    { id: 'i-3', text: '签证', checked: false, order: 2, type: 'item' }
                ]
            }],
            activeListId: 'list-1'
        }
    });

    const saved = harness.getSaved();
    const texts = saved.data.lists.flatMap(list => list.items.map(item => item.text));

    assert.ok(texts.includes('护照'), `用户数据必须保留，实际：${texts.join('/')}`);
    assert.ok(texts.includes('签证'), `用户数据必须保留，实际：${texts.join('/')}`);
    // 默认种子清单是 身份证/手机/充电器/钥匙/证件，出现它说明被整份重置了
    assert.equal(texts.includes('充电器'), false, '不得重置为默认清单');
    assert.equal(saved.data.lists[0].name, '我的清单');
});

test('travel backs up unrecognized stored data before resetting', () => {
    const harness = createTravelHarness({
        version: 1,
        data: { lists: [{ id: 'broken-list' }], activeListId: 'broken-list' }
    });

    const backupKeys = harness.getStorageKeys()
        .filter(key => String(key).startsWith('travelChecklist_data_backup_'));
    assert.ok(backupKeys.length > 0, '原始内容必须先写入备份键');
    assert.deepEqual(
        harness.getStoredJson(backupKeys[0]).data,
        { lists: [{ id: 'broken-list' }], activeListId: 'broken-list' },
        '备份内容必须与原始 payload 一致'
    );
    assert.ok(
        harness.messages.some(item => String(item.message).includes('已备份')),
        '必须提示用户数据已备份并重置'
    );

    // 仍然给出可用的默认清单
    const saved = harness.getSaved();
    assert.equal(saved.data.lists.length, 1);
    assert.ok(saved.data.lists[0].items.length > 0);
});
