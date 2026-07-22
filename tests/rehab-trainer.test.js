const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const storageSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/rehab-trainer/js/storage.js'),
    'utf8'
);
const timerSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/rehab-trainer/js/timer.js'),
    'utf8'
);
const transferSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/rehab-trainer/js/import-export.js'),
    'utf8'
);
const wakeLockSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/rehab-trainer/js/screen-wake-lock.js'),
    'utf8'
);
const mainSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/rehab-trainer/js/main.js'),
    'utf8'
);
const silentConsole = { log() {}, warn() {}, error() {} };

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createStorageHarness(initialData) {
    let saved = clone(initialData);
    let failWrites = false;
    const context = {
        console: silentConsole,
        localStorage: {
            getItem() {
                return saved == null ? null : JSON.stringify(saved);
            },
            setItem(key, value) {
                if (failWrites) throw new Error('quota exceeded');
                if (key === 'rehab-test') saved = JSON.parse(value);
            },
            removeItem() {}
        },
        window: {
            StorageKeys: { REHAB_TRAINER_PLANS: 'rehab-test' },
            CommonUtils: {
                getLocalStorageItem(key, fallback) {
                    return key === 'rehab-test' && saved != null ? clone(saved) : fallback;
                },
                setLocalStorageItem(key, value) {
                    if (key !== 'rehab-test') return true;
                    if (failWrites) return false;
                    saved = clone(value);
                    return true;
                },
                removeLocalStorageItem() {
                    return true;
                }
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(storageSource, context);
    const StorageManager = vm.runInContext('StorageManager', context);

    return {
        manager: new StorageManager(),
        getSaved: function() { return clone(saved); },
        failWrites: function(value) { failWrites = value; }
    };
}

function baseRehabData() {
    return {
        plans: [{
            id: 'local-plan',
            name: '同名计划',
            exercises: [{
                id: 'local-exercise',
                name: '本地动作',
                type: 'duration',
                duration: 30,
                sets: 2,
                setRest: 20,
                description: ''
            }]
        }],
        activePlanId: 'local-plan',
        settings: {
            voiceRate: 1,
            voiceVolume: 1,
            prepareTime: 10,
            transitionInterval: 5,
            countdownStart: 10
        }
    };
}

function importedPlan(name, id, exerciseId) {
    return {
        id,
        name,
        exercises: [{
            id: exerciseId,
            name: '导入动作',
            type: 'reps',
            reps: 12,
            sets: 3,
            setRest: 30,
            description: '说明'
        }]
    };
}

test('rehab import keeps same-name plans independent and rebuilds every imported id', () => {
    const harness = createStorageHarness(baseRehabData());
    const result = harness.manager.importData({
        version: '1.0',
        data: {
            plans: [
                importedPlan('同名计划', 'external-plan-1', 'external-exercise-1'),
                importedPlan('同名计划', 'external-plan-2', 'external-exercise-2')
            ],
            settings: { voiceRate: 1, voiceVolume: 1, prepareTime: 10 }
        }
    });

    assert.equal(result.success, true);
    const plans = harness.getSaved().plans;
    assert.equal(plans.length, 3);
    assert.equal(plans.filter(function(plan) { return plan.name === '同名计划'; }).length, 3);

    const ids = plans.flatMap(function(plan) {
        return [plan.id].concat(plan.exercises.map(function(exercise) { return exercise.id; }));
    });
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.some(function(id) { return id.startsWith('external-'); }), false);
});

test('rehab import rejects malformed, oversized, and out-of-range object graphs', () => {
    const cases = [
        { version: '1.0', data: { plans: 'bad' } },
        { version: '1.0', data: { plans: [importedPlan('x'.repeat(101), 'p', 'e')] } },
        { version: '1.0', data: { plans: [Object.assign(importedPlan('计划', 'p', 'e'), { exercises: Array.from({ length: 201 }, function(_, i) { return importedPlan('x', 'p', 'e' + i).exercises[0]; }) })] } },
        { version: '1.0', data: { plans: [{ id: 'p', name: '计划', exercises: [{ id: 'e', name: '动作', type: 'duration', duration: Infinity, sets: 1, setRest: 0, description: '' }] }] } },
        { version: '1.0', data: { plans: [{ id: 'p', name: '计划', exercises: [{ id: 'e', name: '动作', type: 'unknown', reps: 1, sets: 1, setRest: 0, description: '' }] }] } }
    ];

    cases.forEach(function(payload) {
        const harness = createStorageHarness(baseRehabData());
        assert.throws(function() {
            harness.manager.importData(payload);
        }, /导入|计划|动作|格式|范围/);
        assert.deepEqual(harness.getSaved(), baseRehabData());
    });
});

test('rehab storage does not mutate caller or persisted plans when a write fails', () => {
    const harness = createStorageHarness(baseRehabData());
    const before = harness.getSaved();
    const plan = { name: '不会保存' };
    harness.failWrites(true);

    assert.equal(harness.manager.savePlan(plan), false);
    assert.deepEqual(plan, { name: '不会保存' });
    assert.deepEqual(harness.getSaved(), before);
});

test('cross-plan exercise move is one atomic write', () => {
    const initial = baseRehabData();
    initial.plans.push({ id: 'target-plan', name: '目标', exercises: [] });
    const harness = createStorageHarness(initial);

    assert.equal(typeof harness.manager.moveExercise, 'function');
    harness.failWrites(true);
    assert.equal(harness.manager.moveExercise('local-plan', 'target-plan', 'local-exercise'), false);
    assert.deepEqual(harness.getSaved(), initial);

    harness.failWrites(false);
    assert.equal(harness.manager.moveExercise('local-plan', 'target-plan', 'local-exercise'), true);
    const saved = harness.getSaved();
    assert.equal(saved.plans[0].exercises.length, 0);
    assert.deepEqual(saved.plans[1].exercises.map(function(item) { return item.id; }), ['local-exercise']);
});

test('sample exercises are added with one atomic write', () => {
    const harness = createStorageHarness(baseRehabData());
    const before = harness.getSaved();
    const samples = [
        { name: '动作一', type: 'reps', reps: 10, sets: 1, setRest: 0, description: '' },
        { name: '动作二', type: 'duration', duration: 20, sets: 1, setRest: 0, description: '' }
    ];

    assert.equal(typeof harness.manager.addExercises, 'function');
    harness.failWrites(true);
    assert.equal(harness.manager.addExercises('local-plan', samples), false);
    assert.deepEqual(harness.getSaved(), before);

    harness.failWrites(false);
    assert.equal(harness.manager.addExercises('local-plan', samples), true);
    assert.equal(harness.getSaved().plans[0].exercises.length, 3);
    assert.deepEqual(samples.map(function(item) { return Object.keys(item).sort(); }), [
        ['description', 'name', 'reps', 'setRest', 'sets', 'type'],
        ['description', 'duration', 'name', 'setRest', 'sets', 'type']
    ]);
});

function createTimerHarness() {
    let intervalCount = 0;
    const context = {
        console: silentConsole,
        Date,
        Math,
        setInterval() {
            intervalCount += 1;
            return intervalCount;
        },
        clearInterval() {}
    };
    vm.createContext(context);
    vm.runInContext(timerSource, context);
    const TrainingTimer = vm.runInContext('TrainingTimer', context);
    return {
        timer: new TrainingTimer(),
        getIntervalCount: function() { return intervalCount; }
    };
}

test('training timer rejects invalid exercise and timing values before starting an interval', () => {
    const invalidStarts = [
        [[{ name: '动作', type: 'duration', duration: NaN, sets: 1, setRest: 0 }], 10, 5, 10],
        [[{ name: '动作', type: 'duration', duration: Infinity, sets: 1, setRest: 0 }], 10, 5, 10],
        [[{ name: '动作', type: 'reps', reps: 0, sets: 1, setRest: 0 }], 10, 5, 10],
        [[{ name: '动作', type: 'reps', reps: 10, sets: Infinity, setRest: 0 }], 10, 5, 10],
        [[{ name: '动作', type: 'duration', duration: 30, sets: 1, setRest: -1 }], 10, 5, 10],
        [[{ name: '动作', type: 'duration', duration: 30, sets: 1, setRest: 0 }], Infinity, 5, 10]
    ];

    invalidStarts.forEach(function(args) {
        const harness = createTimerHarness();
        assert.equal(harness.timer.start.apply(harness.timer, args), false);
        assert.equal(harness.timer.state, harness.timer.STATE.IDLE);
        assert.equal(harness.getIntervalCount(), 0);
    });
});

function createTransferHarness() {
    const timers = [];
    const revoked = [];
    const errors = [];
    const toasts = [];
    let readerCount = 0;

    function RehabTrainerApp() {}
    class FakeFileReader {
        constructor() {
            readerCount += 1;
        }
    }
    const context = {
        console,
        Date,
        Blob: class FakeBlob {},
        FileReader: FakeFileReader,
        RehabTrainerApp,
        storage: {
            exportData() {
                return { version: '1.0', data: { plans: [] } };
            }
        },
        document: {
            createElement() {
                return { click() {}, href: '', download: '' };
            },
            getElementById() {
                return { click() {} };
            }
        },
        URL: {
            createObjectURL() { return 'blob:rehab'; },
            revokeObjectURL(url) { revoked.push(url); }
        },
        setTimeout(callback) {
            timers.push(callback);
            return timers.length;
        },
        window: {}
    };
    vm.createContext(context);
    vm.runInContext(transferSource, context);
    const app = new RehabTrainerApp();
    app.showError = function(message) { errors.push(message); };
    app.showToast = function(message) { toasts.push(message); };
    return { app, timers, revoked, errors, toasts, getReaderCount: function() { return readerCount; } };
}

test('rehab import rejects files over 2 MiB before creating a reader', () => {
    const harness = createTransferHarness();
    const target = {
        files: [{ name: 'backup.json', size: 2 * 1024 * 1024 + 1 }],
        value: 'selected.json'
    };

    harness.app.importData({ target });
    assert.equal(harness.getReaderCount(), 0);
    assert.equal(target.value, '');
    assert.match(harness.errors[0], /2 MiB/);
});

test('rehab export revokes its blob url on a later task', () => {
    const harness = createTransferHarness();

    harness.app.exportData();
    assert.deepEqual(harness.revoked, []);
    assert.equal(harness.timers.length, 1);
    harness.timers[0]();
    assert.deepEqual(harness.revoked, ['blob:rehab']);
    assert.equal(harness.toasts.length, 1);
});

test('rehab renderers never interpolate plan or exercise fields into innerHTML', () => {
    const assignments = mainSource.match(/\.innerHTML\s*=\s*(?:`[\s\S]*?`|'[^']*'|"[^"]*")/g) || [];
    assignments.forEach(function(assignment) {
        assert.doesNotMatch(assignment, /\$\{\s*(?:plan|exercise)\./);
    });
    assert.match(mainSource, /name\.textContent = exercise\.name/);
    assert.match(mainSource, /description\.textContent = exercise\.description/);
    assert.match(mainSource, /planName\.textContent = plan\.name/);
});

test('rehab page code does not invoke native blocking dialogs', () => {
    assert.doesNotMatch(mainSource, /\b(?:alert|prompt|confirm)\s*\(/);
});

test('skip confirmation does not skip a later exercise after timer progress changes', async () => {
    let resolveConfirmation;
    let skipCount = 0;
    const exercises = [{ id: 'first' }, { id: 'second' }];
    const trainingTimer = {
        currentExerciseIndex: 0,
        state: 'training',
        exercises: exercises,
        getCurrentExercise() {
            return this.exercises[this.currentExerciseIndex] || null;
        },
        skip() {
            skipCount += 1;
        }
    };
    const context = {
        console: silentConsole,
        document: {
            readyState: 'loading',
            addEventListener() {}
        },
        window: {
            DialogService: {
                confirmAction() {
                    return new Promise(function(resolve) {
                        resolveConfirmation = resolve;
                    });
                }
            }
        },
        trainingTimer: trainingTimer
    };
    vm.createContext(context);
    vm.runInContext(mainSource, context);
    const RehabTrainerApp = vm.runInContext('RehabTrainerApp', context);
    const app = Object.create(RehabTrainerApp.prototype);
    const messages = [];
    app.showToast = function(message) { messages.push(message); };

    const pending = app.skipExercise();
    trainingTimer.currentExerciseIndex = 1;
    resolveConfirmation(true);
    await pending;

    assert.equal(skipCount, 0);
    assert.match(messages[0], /进度已变化/);
});

function createWakeLockHarness(request) {
    const context = {
        console: silentConsole,
        navigator: { wakeLock: { request } }
    };
    vm.createContext(context);
    vm.runInContext(wakeLockSource, context);
    const ScreenWakeLock = vm.runInContext('ScreenWakeLock', context);
    return new ScreenWakeLock();
}

function fakeLock() {
    const listeners = {};
    return {
        released: false,
        addEventListener(name, callback) {
            listeners[name] = callback;
        },
        async release() {
            this.released = true;
            if (listeners.release) listeners.release();
        },
        fireRelease() {
            if (listeners.release) listeners.release();
        }
    };
}

test('wake lock can be reacquired after browser release and explicit release wins a pending request', async () => {
    const locks = [];
    const manager = createWakeLockHarness(async function() {
        const lock = fakeLock();
        locks.push(lock);
        return lock;
    });

    assert.equal(await manager.request(), true);
    assert.equal(manager.active, true);
    locks[0].fireRelease();
    assert.equal(manager.active, false);
    assert.equal(await manager.request(), true);
    assert.equal(manager.active, true);
    await manager.release();
    assert.equal(manager.active, false);

    let resolveRequest;
    const lateLock = fakeLock();
    const pendingManager = createWakeLockHarness(function() {
        return new Promise(function(resolve) { resolveRequest = resolve; });
    });
    const pending = pendingManager.request();
    await pendingManager.release();
    resolveRequest(lateLock);
    assert.equal(await pending, false);
    assert.equal(lateLock.released, true);
    assert.equal(pendingManager.active, false);
});

test('wake lock retries a request queued while an obsolete lock is being released', async () => {
    let resolveFirstRequest;
    let resolveStaleRelease;
    let requestCount = 0;
    const staleLock = fakeLock();
    staleLock.release = function() {
        this.released = true;
        return new Promise(function(resolve) {
            resolveStaleRelease = resolve;
        });
    };
    const replacementLock = fakeLock();
    const manager = createWakeLockHarness(function() {
        requestCount += 1;
        if (requestCount === 1) {
            return new Promise(function(resolve) {
                resolveFirstRequest = resolve;
            });
        }
        return Promise.resolve(replacementLock);
    });

    const obsoleteRequest = manager.request();
    await manager.release();
    resolveFirstRequest(staleLock);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(typeof resolveStaleRelease, 'function');

    assert.equal(await manager.request(), false);
    resolveStaleRelease();
    assert.equal(await obsoleteRequest, false);
    await new Promise(function(resolve) { setImmediate(resolve); });

    assert.equal(requestCount, 2);
    assert.equal(manager.active, true);
    assert.equal(staleLock.released, true);
    assert.equal(replacementLock.released, false);
});
