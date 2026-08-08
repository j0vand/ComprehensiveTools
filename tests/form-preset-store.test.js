const test = require('node:test');
const assert = require('node:assert/strict');

const FormImportExport = require('../utils/form-import-export.js');

test('normalizeStore 将旧版单份草稿迁移为方案容器', () => {
    const legacy = { salary: '12000', city: 'chengdu' };
    const store = FormImportExport.normalizeStore(legacy);

    assert.equal(store.version, 1);
    assert.deepEqual(store.draft, legacy);
    assert.equal(store.activePresetId, null);
    assert.deepEqual(store.presets, []);
});

test('normalizeStore 识别已是方案容器的数据', () => {
    const existing = {
        version: 1,
        draft: { fields: { age: '30' } },
        activePresetId: 'p1',
        presets: [{ id: 'p1', name: '方案一', updatedAt: '2026-01-01T00:00:00.000Z', data: { fields: { age: '30' } } }]
    };

    assert.deepEqual(FormImportExport.normalizeStore(existing), existing);
});

test('writeDraft 保留已有方案列表并更新草稿', () => {
    const memory = new Map();
    const storage = {
        getJson(key, fallback) {
            return memory.has(key) ? memory.get(key) : fallback;
        },
        setJson(key, value) {
            memory.set(key, value);
            return { ok: true };
        }
    };

    memory.set('demo', {
        version: 1,
        draft: { a: 1 },
        activePresetId: 'p1',
        presets: [{ id: 'p1', name: 'A', updatedAt: 't', data: { a: 1 } }]
    });

    const result = FormImportExport.writeDraft('demo', { a: 2 }, storage);
    assert.equal(result.ok, true);
    assert.deepEqual(memory.get('demo').draft, { a: 2 });
    assert.equal(memory.get('demo').presets.length, 1);
    assert.equal(memory.get('demo').activePresetId, 'p1');
});

test('saveAsPreset 新建方案并设为当前', () => {
    const store = FormImportExport.normalizeStore({ x: 1 });
    const next = FormImportExport.saveAsPreset(store, { x: 2 }, '家庭方案', () => 'id-1');

    assert.equal(next.activePresetId, 'id-1');
    assert.equal(next.presets.length, 1);
    assert.equal(next.presets[0].name, '家庭方案');
    assert.deepEqual(next.presets[0].data, { x: 2 });
    assert.deepEqual(next.draft, { x: 2 });
});

test('saveCurrentPreset 覆盖当前方案；无当前方案时返回需另存为', () => {
    let store = FormImportExport.normalizeStore({ x: 1 });
    const unnamed = FormImportExport.saveCurrentPreset(store, { x: 9 });
    assert.equal(unnamed.ok, false);
    assert.equal(unnamed.reason, 'needs-name');

    store = FormImportExport.saveAsPreset(store, { x: 1 }, '初版', () => 'id-1');
    const saved = FormImportExport.saveCurrentPreset(store, { x: 3 });
    assert.equal(saved.ok, true);
    assert.deepEqual(saved.store.presets[0].data, { x: 3 });
    assert.deepEqual(saved.store.draft, { x: 3 });
});

test('loadPreset / renamePreset / deletePreset 维护当前方案指针', () => {
    let store = FormImportExport.normalizeStore(null);
    store = FormImportExport.saveAsPreset(store, { n: 1 }, '一', () => 'a');
    store = FormImportExport.saveAsPreset(store, { n: 2 }, '二', () => 'b');

    const loaded = FormImportExport.loadPreset(store, 'a');
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.store.draft, { n: 1 });
    assert.equal(loaded.store.activePresetId, 'a');

    store = FormImportExport.renamePreset(loaded.store, 'a', '方案甲');
    assert.equal(store.presets.find(item => item.id === 'a').name, '方案甲');

    store = FormImportExport.deletePreset(store, 'a');
    assert.equal(store.activePresetId, null);
    assert.equal(store.presets.length, 1);
    assert.deepEqual(store.draft, { n: 1 });
});

test('sanitizePresetName 清理空名与危险字符', () => {
    assert.equal(FormImportExport.sanitizePresetName('  家庭/成都:A  '), '家庭_成都_A');
    assert.equal(FormImportExport.sanitizePresetName('   '), '');
});

test('clearDraft 只清空草稿与当前指针，保留已命名方案', () => {
    const memory = new Map();
    const storage = {
        getJson(key, fallback) {
            return memory.has(key) ? memory.get(key) : fallback;
        },
        setJson(key, value) {
            memory.set(key, value);
            return { ok: true };
        }
    };

    memory.set('demo', {
        version: 1,
        draft: { a: 1 },
        activePresetId: 'p1',
        presets: [
            { id: 'p1', name: 'A', updatedAt: '2026-01-01T00:00:00.000Z', data: { a: 1 } },
            { id: 'p2', name: 'B', updatedAt: '2026-01-02T00:00:00.000Z', data: { a: 2 } }
        ]
    });

    const result = FormImportExport.clearDraft('demo', storage);
    assert.equal(result.ok, true);
    const store = memory.get('demo');
    assert.equal(store.draft, null);
    assert.equal(store.activePresetId, null);
    assert.equal(store.presets.length, 2);
    assert.equal(store.presets[0].name, 'A');
    assert.equal(store.presets[1].name, 'B');
});

test('理财式草稿：空字符串字段可完整往返', () => {
    // 与 finance collectDraft/applyDraft 约定一致：始终保存 value，空串也写入。
    function collectDraft(controls, calculatorType) {
        const inputData = {};
        controls.forEach(item => {
            if (!item.id) return;
            inputData[item.id] = item.value;
        });
        if (calculatorType) inputData.calculatorType = calculatorType;
        return inputData;
    }

    function applyDraft(savedData, controls) {
        if (!savedData || typeof savedData !== 'object' || Array.isArray(savedData)) return;
        controls.forEach(control => {
            if (!Object.prototype.hasOwnProperty.call(savedData, control.id)) return;
            const value = savedData[control.id];
            if (value === undefined || value === null) return;
            control.value = String(value);
        });
    }

    const controls = [
        { id: 'compoundPrincipal', value: '10000' },
        { id: 'compoundRate', value: '5' }
    ];
    const first = collectDraft(controls, 'compound');
    assert.equal(first.compoundPrincipal, '10000');

    controls[0].value = '';
    const cleared = collectDraft(controls, 'loan');
    assert.equal(cleared.compoundPrincipal, '');
    assert.equal(cleared.calculatorType, 'loan');

    controls[0].value = '999';
    applyDraft(cleared, controls);
    assert.equal(controls[0].value, '');
});
