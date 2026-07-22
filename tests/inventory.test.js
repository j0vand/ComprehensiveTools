const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const dataSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/inventory/js/data.js'),
    'utf8'
);
const exportSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/inventory/js/export.js'),
    'utf8'
);
const uiSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/inventory/js/ui.js'),
    'utf8'
);
const mainSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/inventory/js/main.js'),
    'utf8'
);
const utilsSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/inventory/js/utils.js'),
    'utf8'
);

const storageKeys = {
    items: 'inventory-items',
    categories: 'inventory-categories',
    brands: 'inventory-brands',
    settings: 'inventory-settings',
    history: 'inventory-history',
    shoppingList: 'inventory-shopping-list'
};

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function fixedDateClass(iso) {
    const NativeDate = Date;
    const timestamp = new NativeDate(iso).getTime();

    return class FixedDate extends NativeDate {
        constructor(...args) {
            super(...(args.length === 0 ? [timestamp] : args));
        }

        static now() {
            return timestamp;
        }
    };
}

function inventoryHarness(initial = {}, options = {}) {
    const stored = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
    const notifications = [];
    const writes = [];
    const events = [];
    let uuid = 0;

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        Date: options.Date || Date,
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
        dispatchEvent(event) {
            events.push(event);
            return true;
        },
        Utils: {
            getLocalStorageItem(key, fallback) {
                return stored.has(key) ? clone(stored.get(key)) : clone(fallback);
            },
            setLocalStorageItem(key, value) {
                writes.push({ key, value: clone(value) });
                if (options.failWrite && options.failWrite(key, value, writes.length)) {
                    return false;
                }
                stored.set(key, clone(value));
                return true;
            },
            generateUUID() {
                uuid += 1;
                return `generated-${uuid}`;
            },
            deepClone: clone,
            matchByPinyin(query, value) {
                return String(value).toLowerCase().includes(String(query).toLowerCase());
            },
            daysBetween(first, second) {
                const a = new Date(first);
                const b = new Date(second);
                return Math.floor((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
                    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
            },
            getItemStatus(quantity, threshold) {
                if (quantity <= 0) return 'out-stock';
                if (quantity <= threshold) return 'low-stock';
                return 'in-stock';
            },
            showNotification(message, type) {
                notifications.push({ message, type });
            }
        }
    };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    vm.runInContext(dataSource, context, { filename: 'data.js' });

    return {
        context,
        manager: sandbox.InventoryData,
        notifications,
        stored,
        writes,
        events
    };
}

function validCategories(names = ['其他']) {
    return names.map((name, index) => ({ id: `category-${index}`, name, count: 0 }));
}

test('inventory initialization tolerates malformed persisted structures', () => {
    const { manager } = inventoryHarness({
        [storageKeys.items]: { broken: true },
        [storageKeys.categories]: 'broken',
        [storageKeys.brands]: ['有效品牌', 3, null, '有效品牌'],
        [storageKeys.settings]: [],
        [storageKeys.history]: { broken: true },
        [storageKeys.shoppingList]: 'broken'
    });

    assert.deepEqual(manager.getAllItems(), []);
    assert.equal(manager.getAllCategories().some(category => category.name === '其他'), true);
    assert.deepEqual(manager.getAllBrands(), ['有效品牌']);
    assert.deepEqual(manager.getHistory(), []);
    assert.deepEqual(manager.getShoppingList(), []);
    assert.equal(manager.settings.pageSize, 12);
});

test('inventory load normalizes batches and derives quantity and weighted price', () => {
    const { manager } = inventoryHarness({
        [storageKeys.items]: [
            {
                id: 'kept-id',
                name: '精华',
                price: 99,
                batches: [
                    { id: 'batch-a', quantity: '2', price: '10', purchaseDate: '2026-07-20' },
                    { id: 'batch-b', quantity: -5, price: Infinity, purchaseDate: 'bad-date' },
                    { id: 'batch-c', quantity: 3, price: 20, purchaseDate: '2026-07-21' },
                    null
                ]
            },
            {
                id: 'fallback-id',
                name: '空瓶',
                price: '7.5',
                batches: [{ quantity: 0, price: 100, purchaseDate: '2026-07-20' }]
            }
        ],
        [storageKeys.categories]: validCategories()
    });

    const item = manager.getItem('kept-id');
    assert.equal(item.id, 'kept-id');
    assert.equal(item.quantity, 5);
    assert.equal(item.price, 16);
    assert.equal(item.batches.every(batch => Number.isFinite(batch.quantity) && batch.quantity >= 0), true);
    assert.equal(item.batches.every(batch => Number.isFinite(batch.price) && batch.price >= 0), true);

    const fallback = manager.getItem('fallback-id');
    assert.equal(fallback.quantity, 0);
    assert.equal(fallback.price, 7.5);
});

test('inventory only accepts strict numeric values and never exposes overflowed totals', () => {
    const { manager } = inventoryHarness({
        [storageKeys.items]: [{
            id: 'strict-numbers',
            name: '严格数值',
            batches: [
                { id: 'boolean', quantity: true, price: '2', purchaseDate: '2026-07-20' },
                { id: 'array', quantity: '2', price: [], purchaseDate: '2026-07-20' },
                { id: 'product-overflow', quantity: 1e308, price: 1e308, purchaseDate: '2026-07-20' },
                { id: 'sum-a', quantity: 1e308, price: 0, purchaseDate: '2026-07-20' },
                { id: 'sum-b', quantity: 1e308, price: 0, purchaseDate: '2026-07-20' }
            ]
        }],
        [storageKeys.categories]: validCategories()
    });

    const item = manager.getItem('strict-numbers');
    assert.equal(item.batches.find(batch => batch.id === 'boolean').quantity, 0);
    assert.equal(item.batches.find(batch => batch.id === 'array').price, 0);
    assert.equal(Number.isFinite(item.quantity) && item.quantity >= 0, true);
    assert.equal(Number.isFinite(item.price) && item.price >= 0, true);
    assert.equal(item.batches.every(batch =>
        Number.isFinite(batch.quantity) && batch.quantity >= 0 &&
        Number.isFinite(batch.price) && batch.price >= 0 &&
        Number.isFinite(batch.quantity * batch.price)
    ), true);
    assert.equal(Number.isFinite(manager.getInventoryStats().totalValue), true);
});

test('inventory persists calendar dates separately from timestamps and uses the local default day', () => {
    const DateClass = fixedDateClass('2026-07-22T00:30:00');
    const { manager } = inventoryHarness({
        [storageKeys.items]: [{
            id: 'calendar-item',
            name: '日历日期',
            purchaseDate: undefined,
            expiryDate: '2026-08-03',
            quantity: 1,
            price: 2,
            createdAt: '2026-07-21T16:30:00.000Z'
        }],
        [storageKeys.categories]: validCategories()
    }, { Date: DateClass });

    const item = manager.getItem('calendar-item');
    assert.equal(item.batches[0].purchaseDate, '2026-07-22');
    assert.equal(item.batches[0].expiryDate, '2026-08-03');
    assert.match(item.createdAt, /^2026-07-21T16:30:00\.000Z$/);
    assert.match(item.updatedAt, /T/);
});

test('inventory filters use inclusive price, date, expired, and expiring boundaries', () => {
    const DateClass = fixedDateClass('2026-07-22T10:00:00');
    const { manager } = inventoryHarness({
        [storageKeys.items]: [
            {
                id: 'soon', name: '即将过期', price: 0,
                batches: [{ quantity: 2, price: 10, purchaseDate: '2026-07-22T18:00:00+08:00', expiryDate: '2026-07-23' }]
            },
            {
                id: 'expired', name: '已过期', price: 0,
                batches: [{ quantity: 1, price: 20, purchaseDate: '2026-07-20', expiryDate: '2026-07-21' }]
            },
            {
                id: 'later', name: '高价', price: 0,
                batches: [{ quantity: 1, price: 30, purchaseDate: '2026-07-22', expiryDate: null }]
            }
        ],
        [storageKeys.categories]: validCategories(),
        [storageKeys.settings]: { showExpired: false, expiryWarningDays: 30 }
    }, { Date: DateClass });

    assert.deepEqual(
        manager.searchItems('', {
            minPrice: 10,
            maxPrice: 20,
            fromDate: '2026-07-22',
            toDate: '2026-07-22'
        }).map(item => item.id),
        ['soon']
    );
    assert.deepEqual(manager.searchItems('', { expiringSoon: true }).map(item => item.id), ['soon']);
    assert.deepEqual(manager.searchItems('', { expired: true }).map(item => item.id), ['expired']);
    assert.deepEqual(
        manager.searchItems('', { expiringSoon: true, expired: true }).map(item => item.id).sort(),
        ['expired', 'soon']
    );
});

test('inventory mutation rolls memory and persisted state back when a write fails', () => {
    let failItems = false;
    const initialItems = [{
        id: 'item-1',
        name: '面霜',
        batches: [{ id: 'batch-1', quantity: 2, price: 10, purchaseDate: '2026-07-20' }]
    }];
    const { manager, stored, notifications } = inventoryHarness({
        [storageKeys.items]: initialItems,
        [storageKeys.categories]: validCategories(),
        [storageKeys.history]: []
    }, {
        failWrite(key) {
            return failItems && key === storageKeys.items;
        }
    });
    failItems = true;

    assert.equal(manager.adjustQuantity('item-1', 1, null, '测试失败'), false);
    assert.equal(manager.getItem('item-1').quantity, 2);
    assert.equal(manager.getHistory().length, 0);
    assert.equal(stored.get(storageKeys.items)[0].batches[0].quantity, 2);
    assert.equal(notifications.at(-1).type, 'error');
});

test('inventory mutation does not disguise a business exception as a storage failure', () => {
    const initialItems = [{
        id: 'item-1',
        name: '面霜',
        batches: [{ id: 'batch-1', quantity: 2, price: 10, purchaseDate: '2026-07-20' }]
    }];
    const { manager, stored, notifications, writes } = inventoryHarness({
        [storageKeys.items]: initialItems,
        [storageKeys.categories]: validCategories()
    });

    const saved = manager._persistMutation(['items'], () => {
        manager.items.push({ id: 'temporary', name: '临时商品', batches: [] });
        throw new Error('business callback failed');
    });

    assert.equal(saved, false);
    assert.equal(manager.getItem('temporary'), null);
    assert.equal(stored.get(storageKeys.items).length, 1);
    assert.equal(writes.length, 0);
    assert.equal(notifications.at(-1).message, '操作失败，变更已撤销');
});

test('inventory reloads actual persisted state when a compensating write also fails', () => {
    const initialItems = [{
        id: 'item-1',
        name: '面霜',
        batches: [{ id: 'batch-1', quantity: 2, price: 10, purchaseDate: '2026-07-20' }]
    }];
    const { manager, stored, notifications } = inventoryHarness({
        [storageKeys.items]: initialItems,
        [storageKeys.categories]: validCategories(),
        [storageKeys.history]: []
    }, {
        failWrite(key, value, writeNumber) {
            return (writeNumber === 2 && key === storageKeys.history) ||
                (writeNumber === 3 && key === storageKeys.items);
        }
    });

    assert.equal(manager.adjustQuantity('item-1', 1, null, '补偿失败'), false);
    assert.equal(stored.get(storageKeys.items)[0].batches[0].quantity, 3);
    assert.equal(manager.getItem('item-1').quantity, 3);
    assert.equal(manager.getHistory().length, 0);
    assert.match(notifications.at(-1).message, /部分|实际存储/);
});

test('deleting a category always moves its products to 其他', () => {
    const { manager } = inventoryHarness({
        [storageKeys.items]: [{
            id: 'item-1', name: '口红', category: '彩妆',
            batches: [{ quantity: 1, price: 10, purchaseDate: '2026-07-20' }]
        }],
        [storageKeys.categories]: validCategories(['彩妆', '护肤'])
    });

    assert.equal(manager.deleteCategory('category-0'), true);
    assert.equal(manager.getItem('item-1').category, '其他');
    assert.equal(manager.getAllCategories().some(category => category.name === '其他'), true);
});

test('deleting a category ignores an explicit replacement and still uses 其他', () => {
    const { manager } = inventoryHarness({
        [storageKeys.items]: [{
            id: 'item-1', name: '口红', category: '彩妆',
            batches: [{ quantity: 1, price: 10, purchaseDate: '2026-07-20' }]
        }],
        [storageKeys.categories]: validCategories(['彩妆', '护肤', '其他'])
    });

    assert.equal(manager.deleteCategory('category-0', 'category-1'), true);
    assert.equal(manager.getItem('item-1').category, '其他');
});

test('inventory statistics keep __proto__ as an ordinary user category', () => {
    const { manager } = inventoryHarness({
        [storageKeys.items]: [{
            id: 'item-1', name: '特殊分类商品', category: '__proto__',
            batches: [{ quantity: 2, price: 3, purchaseDate: '2026-07-20' }]
        }],
        [storageKeys.categories]: validCategories(['__proto__', '其他'])
    });

    const stats = manager.getInventoryStats();
    assert.equal(Object.keys(stats.categoryStats).includes('__proto__'), true);
    assert.equal(stats.categoryStats.__proto__.quantity, 2);
    assert.equal(stats.categoryStats.__proto__.value, 6);
});

test('inventory date and grouping utilities preserve local calendar days and special user keys', () => {
    const toasts = [];
    const sandbox = {
        window: {},
        console,
        Date,
        Intl,
        document: { getElementById() { return null; } },
        DialogService: {
            showToast(message, type) { toasts.push({ message, type }); }
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(utilsSource, sandbox, { filename: 'utils.js' });

    const localStart = new Date(2026, 6, 21, 0, 0, 0, 0);
    assert.equal(sandbox.Utils.daysBetween(localStart, '2026-07-22'), 1);
    assert.match(sandbox.Utils.formatDate('2026-07-22'), /2026.*07.*22/);
    const grouped = sandbox.Utils.groupBy(['__proto__', 'normal'], value => value);
    assert.equal(Object.keys(grouped).includes('__proto__'), true);
    assert.equal(Array.from(grouped.__proto__).join(','), '__proto__');
    assert.doesNotThrow(() => sandbox.Utils.showNotification('保存完成', 'success'));
    assert.deepEqual(toasts, [{ message: '保存完成', type: 'success' }]);
});

test('inventory card rendering keeps malicious persisted text and IDs out of HTML markup', () => {
    const attackId = 'item\" autofocus onfocus=globalThis.pwned=true';
    const attackText = '<img src=x onerror=globalThis.pwned=true>';
    const { manager } = inventoryHarness({
        [storageKeys.items]: [
            {
                id: attackId,
                name: attackText,
                category: '<svg onload=globalThis.pwned=true>',
                batches: [{ id: 'batch-1', quantity: 1, price: 2, purchaseDate: '2026-07-20' }]
            },
            {
                id: attackId,
                name: '重复 ID 商品',
                batches: [{ id: 'batch-2', quantity: 1, price: 3, purchaseDate: '2026-07-20' }]
            }
        ],
        [storageKeys.categories]: validCategories()
    });
    const items = manager.getAllItems();
    assert.equal(new Set(items.map(item => item.id)).size, 2);

    function element() {
        return {
            className: '',
            dataset: {},
            style: {},
            children: [],
            textContent: '',
            classList: { values: [], add(value) { this.values.push(value); } },
            appendChild(child) { this.children.push(child); return child; },
            addEventListener() {}
        };
    }
    const fields = new Map([
        ['.card-title', element()],
        ['.status-badge', element()],
        ['.card-category-text', element()],
        ['.card-specs', element()],
        ['.card-info', element()],
        ['.card-quantity', element()],
        ['.card-quantity-fill', element()],
        ['.card-price-value', element()],
        ['.card-batch-count', element()]
    ]);
    const card = element();
    card.querySelector = selector => fields.get(selector);
    card.querySelectorAll = () => [];
    let fixedMarkup = '';
    Object.defineProperty(card, 'innerHTML', {
        set(value) { fixedMarkup = value; },
        get() { return fixedMarkup; }
    });
    const sandbox = {
        console,
        window: {},
        document: {
            addEventListener() {},
            createElement() { return card; },
            createTextNode(text) { return { textContent: text }; }
        },
        InventoryData: {
            settings: { lowStockThreshold: 3, expiryWarningDays: 30 }
        },
        Utils: {
            getItemStatus() { return 'low-stock'; },
            getStatusText() { return '低库存'; },
            formatPrice(value) { return `¥${value}`; },
            daysBetween() { return 0; }
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(`${uiSource}\n;globalThis.TestUIManager = UIManager;`, sandbox);
    const ui = Object.create(sandbox.TestUIManager.prototype);
    const rendered = ui.createItemCard(items[0]);

    assert.equal(rendered.dataset.id, attackId);
    assert.equal(rendered.innerHTML.includes(attackId), false);
    assert.equal(rendered.innerHTML.includes(attackText), false);
    assert.equal(fields.get('.card-title').textContent, attackText);
    assert.equal(fields.get('.card-category-text').textContent, '<svg onload=globalThis.pwned=true>');
});

test('successful inventory transactions emit one change event with affected fields', () => {
    const { manager, events } = inventoryHarness({
        [storageKeys.items]: [{
            id: 'item-1', name: '面霜',
            batches: [{ id: 'batch-1', quantity: 2, price: 10, purchaseDate: '2026-07-20' }]
        }],
        [storageKeys.categories]: validCategories(),
        [storageKeys.history]: []
    });

    assert.equal(manager.adjustQuantity('item-1', 1, null, '刷新统计'), true);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'inventory-data-changed');
    assert.equal(Array.from(events[0].detail.fields).join(','), 'items,history');
});

test('inventory main refreshes summary and chart from change events without changing save return values', () => {
    const listeners = new Map();
    let domReady;
    let chartUpdates = 0;
    let summaryUpdates = 0;
    const saveItems = () => false;
    const sandbox = {
        console,
        setTimeout() {},
        document: {
            addEventListener(type, listener) {
                if (type === 'DOMContentLoaded') domReady = listener;
            },
            getElementById() { return null; },
            querySelector() { return null; }
        },
        InventoryData: { saveItems },
        ChartsManager: { updateChart() { chartUpdates++; } },
        InventoryUI: { renderSummary() { summaryUpdates++; } },
        Utils: { showNotification() {} },
        addEventListener(type, listener) {
            listeners.set(type, listener);
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(mainSource, sandbox, { filename: 'main.js' });
    domReady();

    assert.equal(sandbox.InventoryData.saveItems, saveItems);
    assert.equal(sandbox.InventoryData.saveItems(), false);
    listeners.get('inventory-data-changed')();
    assert.equal(chartUpdates, 1);
    assert.equal(summaryUpdates, 1);
});

test('inventory refresh does not announce success when default-category repair cannot be saved', () => {
    const { context, manager, notifications } = inventoryHarness({
        [storageKeys.categories]: validCategories(['护肤'])
    }, {
        failWrite(key) {
            return key === storageKeys.categories;
        }
    });
    const loaded = manager.loadAllData();
    assert.equal(loaded, false);

    context.document = { addEventListener() {} };
    vm.runInContext(`${uiSource}\n;globalThis.TestUIManager = UIManager;`, context);
    const ui = Object.create(context.TestUIManager.prototype);
    ui.renderContent = () => {};
    ui.renderCategoryFilter = () => {};
    ui.renderBrandFilter = () => {};
    const beforeRefresh = notifications.length;
    ui.refreshData();

    assert.equal(notifications.slice(beforeRefresh).some(entry => entry.type === 'success'), false);
});

test('inventory UI passes every advanced filter to the data manager', () => {
    let receivedFilters;
    const sandbox = {
        console,
        window: {},
        document: { addEventListener() {} },
        Utils: {},
        InventoryData: {
            searchItems(query, filters) {
                receivedFilters = filters;
                return [];
            },
            sortItems(items) {
                return items;
            }
        }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(`${uiSource}\n;globalThis.TestUIManager = UIManager;`, sandbox);
    const ui = Object.create(sandbox.TestUIManager.prototype);
    ui.filters = {
        category: '', brand: '', name: '', storage: '', status: 'all',
        minPrice: 10, maxPrice: 20, fromDate: '2026-07-01', toDate: '2026-07-31',
        expired: true, expiringSoon: true
    };
    ui.currentSort = 'name';
    ui.pagination = { currentPage: 1, pageSize: 12, totalPages: 1 };
    ui.elements = { emptyState: { style: {} } };
    ui.renderItems = () => {};
    ui.renderPagination = () => {};
    ui.renderSummary = () => {};

    ui.renderContent();

    assert.equal(receivedFilters.minPrice, 10);
    assert.equal(receivedFilters.maxPrice, 20);
    assert.equal(receivedFilters.fromDate, '2026-07-01');
    assert.equal(receivedFilters.toDate, '2026-07-31');
    assert.equal(receivedFilters.expired, true);
    assert.equal(receivedFilters.expiringSoon, true);
});

test('Excel import is idempotent, preserves safe IDs, parses serial dates, and adds categories', () => {
    const { context, manager, notifications } = inventoryHarness({
        [storageKeys.items]: [],
        [storageKeys.categories]: validCategories(),
        [storageKeys.brands]: [],
        [storageKeys.history]: []
    });
    const fileInput = {
        style: {},
        addEventListener() {},
        click() {}
    };
    context.document = {
        body: { appendChild() {} },
        createElement() {
            return fileInput;
        }
    };
    vm.runInContext(exportSource, context, { filename: 'export.js' });
    const rows = [
        {
            ID: 'imported-id', 商品名称: '防晒', 分类: '防晒用品', 品牌: '品牌A',
            批次数量: 2, 批次单价: 10, 批次购买日期: 45292
        },
        {
            ID: 'imported-id', 商品名称: '防晒', 分类: '防晒用品', 品牌: '品牌A',
            批次数量: 3, 批次单价: 20, 批次购买日期: '2024-01-02'
        },
        null,
        { ID: 'bad-row', 商品名称: '', 批次数量: -1 }
    ];

    context.ExportManager.processImportData(rows);
    context.ExportManager.processImportData(rows);

    const items = manager.getAllItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'imported-id');
    assert.equal(items[0].quantity, 5);
    assert.equal(items[0].price, 16);
    assert.equal(items[0].batches[0].purchaseDate, '2024-01-01');
    assert.equal(manager.getAllCategories().some(category => category.name === '防晒用品'), true);
    assert.match(notifications.at(-1).message, /忽略\/失败 2 行/);
});

test('Excel serial dates handle early 1900 dates and the 1904 workbook epoch', () => {
    const { context } = inventoryHarness({
        [storageKeys.categories]: validCategories()
    });
    const fileInput = { style: {}, addEventListener() {}, click() {} };
    context.document = {
        body: { appendChild() {} },
        createElement() { return fileInput; }
    };
    vm.runInContext(exportSource, context, { filename: 'export.js' });

    assert.equal(context.ExportManager.parseExcelDate(1), '1900-01-01');
    assert.equal(context.ExportManager.parseExcelDate(59), '1900-02-28');
    assert.equal(context.ExportManager.parseExcelDate(60), null);
    assert.equal(context.ExportManager.parseExcelDate(0, null, { date1904: true }), '1904-01-01');
    assert.equal(context.ExportManager.parseExcelDate(1, null, { date1904: true }), '1904-01-02');
});

if (!process.env.INVENTORY_TIMEZONE_CHILD) {
    test('inventory calendar behavior passes in UTC and an American timezone', () => {
        for (const timezone of ['UTC', 'America/Los_Angeles']) {
            const childEnv = { ...process.env, TZ: timezone, INVENTORY_TIMEZONE_CHILD: '1' };
            delete childEnv.NODE_TEST_CONTEXT;
            const result = spawnSync(process.execPath, ['--test', __filename], {
                encoding: 'utf8',
                env: childEnv
            });
            assert.equal(result.status, 0, `${timezone}\n${result.stdout}\n${result.stderr}`);
            assert.match(result.stdout, /pass 19/);
        }
    });
}
