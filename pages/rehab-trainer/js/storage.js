/**
 * 本地存储管理模块
 * 负责训练计划和训练项的持久化存储
 */

// 导入上限用于阻止异常对象图耗尽页面内存，同时覆盖正常的专业训练计划规模。
const REHAB_IMPORT_LIMITS = Object.freeze({
    plans: 100,
    exercisesPerPlan: 200,
    exercisesTotal: 1000,
    planName: 100,
    exerciseName: 100,
    description: 2000,
    duration: 86400,
    reps: 10000,
    sets: 100,
    setRest: 86400
});

class StorageManager {
    constructor() {
        this.STORAGE_KEY = window.StorageKeys.REHAB_TRAINER_PLANS;
        this.init();
    }

    /**
     * 初始化存储
     */
    init() {
        if (!this.isLocalStorageAvailable()) {
            console.warn('localStorage不可用，数据将无法保存');
            return;
        }

        // 如果没有数据，初始化空结构
        const existingData = this.getData();
        if (!existingData) {
            const initialData = {
                plans: [],
                activePlanId: null,
                settings: {
                    voiceRate: 1.0,
                    voiceVolume: 1.0,
                    prepareTime: 10,
                    transitionInterval: 5,  // 休息结束到训练开始之间的准备间隔（秒）
                    countdownStart: 10      // 倒计时开始秒数
                }
            };
            this.saveData(initialData);
        }
    }

    /**
     * 检查localStorage是否可用
     */
    isLocalStorageAvailable() {
        const test = '__storage_test__';
        if (!this.writeJson(test, test)) return false;
        return this.removeKey(test);
    }

    /** 优先 StorageService，测试环境可回退 CommonUtils。 */
    readJson(key, fallback) {
        if (window.StorageService && typeof window.StorageService.getJson === 'function') {
            return window.StorageService.getJson(key, fallback);
        }
        return window.CommonUtils.getLocalStorageItem(key, fallback);
    }

    writeJson(key, value) {
        if (window.StorageService && typeof window.StorageService.setJson === 'function') {
            return window.StorageService.setJson(key, value).ok;
        }
        return window.CommonUtils.setLocalStorageItem(key, value);
    }

    removeKey(key) {
        if (window.StorageService && typeof window.StorageService.remove === 'function') {
            return window.StorageService.remove(key).ok;
        }
        return window.CommonUtils.removeLocalStorageItem(key);
    }

    /**
     * 获取所有数据（使用公共工具库）
     */
    getData() {
        const data = this.readJson(this.STORAGE_KEY, null);

        if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.plans)) return null;

        const entityIds = new Set();
        const claimId = id => {
            if (entityIds.has(id)) return false;
            entityIds.add(id);
            return true;
        };
        const validPlans = data.plans.length <= REHAB_IMPORT_LIMITS.plans && data.plans.every(plan => (
            plan
            && typeof plan === 'object'
            && !Array.isArray(plan)
            && typeof plan.id === 'string' && plan.id.trim() && plan.id.length <= 128 && claimId(plan.id)
            && typeof plan.name === 'string' && plan.name.trim() && plan.name.length <= REHAB_IMPORT_LIMITS.planName
            && Array.isArray(plan.exercises)
            && plan.exercises.length <= REHAB_IMPORT_LIMITS.exercisesPerPlan
            && plan.exercises.every(exercise => (
                exercise
                && typeof exercise === 'object'
                && !Array.isArray(exercise)
                && typeof exercise.id === 'string' && exercise.id.trim()
                && exercise.id.length <= 128 && claimId(exercise.id)
                && typeof exercise.name === 'string' && exercise.name.trim()
                && exercise.name.length <= REHAB_IMPORT_LIMITS.exerciseName
                && typeof exercise.description === 'string'
                && exercise.description.length <= REHAB_IMPORT_LIMITS.description
                && (exercise.type === 'duration' || exercise.type === 'reps')
                && Number.isSafeInteger(exercise.sets) && exercise.sets >= 1 && exercise.sets <= REHAB_IMPORT_LIMITS.sets
                && Number.isSafeInteger(exercise.setRest) && exercise.setRest >= 0 && exercise.setRest <= REHAB_IMPORT_LIMITS.setRest
                && (exercise.type === 'duration'
                    ? Number.isSafeInteger(exercise.duration) && exercise.duration >= 1 && exercise.duration <= REHAB_IMPORT_LIMITS.duration
                    : Number.isSafeInteger(exercise.reps) && exercise.reps >= 1 && exercise.reps <= REHAB_IMPORT_LIMITS.reps)
            ))
        ));
        const exerciseTotal = validPlans
            ? data.plans.reduce((total, plan) => total + plan.exercises.length, 0)
            : 0;
        const settings = data.settings;
        const validSettings = settings
            && typeof settings === 'object'
            && !Array.isArray(settings)
            && Number.isFinite(settings.voiceRate) && settings.voiceRate >= 0.1 && settings.voiceRate <= 10
            && Number.isFinite(settings.voiceVolume) && settings.voiceVolume >= 0 && settings.voiceVolume <= 1
            && Number.isSafeInteger(settings.prepareTime) && settings.prepareTime >= 0 && settings.prepareTime <= 300
            && Number.isSafeInteger(settings.transitionInterval) && settings.transitionInterval >= 0 && settings.transitionInterval <= 60
            && Number.isSafeInteger(settings.countdownStart) && settings.countdownStart >= 1 && settings.countdownStart <= 60;
        const validActivePlan = data.activePlanId === null || (
            typeof data.activePlanId === 'string'
            && data.plans.some(plan => plan.id === data.activePlanId)
        );

        return validPlans
            && exerciseTotal <= REHAB_IMPORT_LIMITS.exercisesTotal
            && validSettings
            && validActivePlan
            ? data
            : null;
    }

    /**
     * 保存所有数据（使用公共工具库）
     */
    saveData(data) {
        return this.writeJson(this.STORAGE_KEY, data);
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    }

    /**
     * 为导入实体生成不与本地及本批数据冲突的ID，外部ID只参与格式校验，绝不沿用。
     */
    generateUniqueId(usedIds) {
        let id = this.generateId();
        while (usedIds.has(id)) {
            id = this.generateId();
        }
        usedIds.add(id);
        return id;
    }

    /**
     * 严格校验导入对象并重建可持久化的数据，失败时在写入发生前终止。
     */
    normalizeImport(importData, currentData) {
        const isPlainObject = value => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
            return Object.prototype.toString.call(value) === '[object Object]';
        };
        const assertObject = (value, label) => {
            if (!isPlainObject(value)) throw new Error(`${label}格式不正确`);
        };
        const assertKeys = (value, allowed, label) => {
            Object.keys(value).forEach(key => {
                if (key === '__proto__' || key === 'prototype' || key === 'constructor' || !allowed.includes(key)) {
                    throw new Error(`${label}包含不允许的字段：${key}`);
                }
            });
        };
        const readString = (value, label, maxLength, allowEmpty = false) => {
            if (typeof value !== 'string') throw new Error(`${label}必须是字符串`);
            const normalized = allowEmpty ? value : value.trim();
            if ((!allowEmpty && !normalized) || normalized.length > maxLength) {
                throw new Error(`${label}长度超出范围`);
            }
            return normalized;
        };
        const readInteger = (value, label, minimum, maximum) => {
            if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
                throw new Error(`${label}数值超出范围`);
            }
            return value;
        };
        const validateOptionalMetadata = (value, label) => {
            if (value !== undefined) readString(value, label, 64, false);
        };

        assertObject(importData, '导入数据');
        assertKeys(importData, ['version', 'exportTime', 'description', 'data'], '导入数据');
        if (importData.version !== '1.0') throw new Error('不支持的导入版本');
        validateOptionalMetadata(importData.exportTime, '导出时间');
        if (importData.description !== undefined) readString(importData.description, '文件说明', 500, true);

        assertObject(importData.data, '导入内容');
        assertKeys(importData.data, ['plans', 'activePlanId', 'settings'], '导入内容');
        if (!Array.isArray(importData.data.plans) || importData.data.plans.length === 0) {
            throw new Error('导入内容必须包含训练计划');
        }
        if (importData.data.plans.length > REHAB_IMPORT_LIMITS.plans) {
            throw new Error(`训练计划不能超过${REHAB_IMPORT_LIMITS.plans}个`);
        }
        if (importData.data.activePlanId !== undefined && importData.data.activePlanId !== null) {
            readString(importData.data.activePlanId, '当前计划ID', 128);
        }

        const usedIds = new Set();
        (currentData.plans || []).forEach(plan => {
            if (typeof plan.id === 'string') usedIds.add(plan.id);
            (plan.exercises || []).forEach(exercise => {
                if (typeof exercise.id === 'string') usedIds.add(exercise.id);
            });
        });

        let exerciseTotal = 0;
        const now = new Date().toISOString();
        const plans = importData.data.plans.map((plan, planIndex) => {
            const label = `第${planIndex + 1}个计划`;
            assertObject(plan, label);
            assertKeys(plan, ['id', 'name', 'createdAt', 'updatedAt', 'exercises'], label);
            if (plan.id !== undefined) readString(plan.id, `${label}ID`, 128);
            validateOptionalMetadata(plan.createdAt, `${label}创建时间`);
            validateOptionalMetadata(plan.updatedAt, `${label}更新时间`);
            if (!Array.isArray(plan.exercises)) throw new Error(`${label}动作列表格式不正确`);
            if (plan.exercises.length > REHAB_IMPORT_LIMITS.exercisesPerPlan) {
                throw new Error(`每个计划的动作不能超过${REHAB_IMPORT_LIMITS.exercisesPerPlan}个`);
            }
            exerciseTotal += plan.exercises.length;
            if (exerciseTotal > REHAB_IMPORT_LIMITS.exercisesTotal) {
                throw new Error(`导入动作总数不能超过${REHAB_IMPORT_LIMITS.exercisesTotal}个`);
            }

            const exercises = plan.exercises.map((exercise, exerciseIndex) => {
                const exerciseLabel = `${label}的第${exerciseIndex + 1}个动作`;
                assertObject(exercise, exerciseLabel);
                assertKeys(exercise, [
                    'id', 'name', 'type', 'duration', 'reps', 'sets', 'setRest',
                    'description', 'createdAt', 'updatedAt'
                ], exerciseLabel);
                if (exercise.id !== undefined) readString(exercise.id, `${exerciseLabel}ID`, 128);
                validateOptionalMetadata(exercise.createdAt, `${exerciseLabel}创建时间`);
                validateOptionalMetadata(exercise.updatedAt, `${exerciseLabel}更新时间`);
                if (exercise.type !== 'duration' && exercise.type !== 'reps') {
                    throw new Error(`${exerciseLabel}类型不正确`);
                }

                const normalized = {
                    id: this.generateUniqueId(usedIds),
                    name: readString(exercise.name, `${exerciseLabel}名称`, REHAB_IMPORT_LIMITS.exerciseName),
                    type: exercise.type,
                    sets: readInteger(exercise.sets, `${exerciseLabel}组数`, 1, REHAB_IMPORT_LIMITS.sets),
                    setRest: readInteger(exercise.setRest, `${exerciseLabel}休息时间`, 0, REHAB_IMPORT_LIMITS.setRest),
                    description: exercise.description === undefined
                        ? ''
                        : readString(exercise.description, `${exerciseLabel}说明`, REHAB_IMPORT_LIMITS.description, true),
                    createdAt: now
                };
                if (exercise.type === 'duration') {
                    normalized.duration = readInteger(exercise.duration, `${exerciseLabel}持续时间`, 1, REHAB_IMPORT_LIMITS.duration);
                } else {
                    normalized.reps = readInteger(exercise.reps, `${exerciseLabel}次数`, 1, REHAB_IMPORT_LIMITS.reps);
                }
                return normalized;
            });

            return {
                id: this.generateUniqueId(usedIds),
                name: readString(plan.name, `${label}名称`, REHAB_IMPORT_LIMITS.planName),
                createdAt: now,
                exercises
            };
        });

        let settings = currentData.settings;
        if (importData.data.settings !== undefined) {
            assertObject(importData.data.settings, '训练设置');
            assertKeys(importData.data.settings, [
                'voiceRate', 'voiceVolume', 'prepareTime', 'transitionInterval', 'countdownStart'
            ], '训练设置');
            settings = { ...currentData.settings };
            const importedSettings = importData.data.settings;
            if (importedSettings.voiceRate !== undefined) {
                if (!Number.isFinite(importedSettings.voiceRate) || importedSettings.voiceRate < 0.1 || importedSettings.voiceRate > 10) {
                    throw new Error('语速数值超出范围');
                }
                settings.voiceRate = importedSettings.voiceRate;
            }
            if (importedSettings.voiceVolume !== undefined) {
                if (!Number.isFinite(importedSettings.voiceVolume) || importedSettings.voiceVolume < 0 || importedSettings.voiceVolume > 1) {
                    throw new Error('音量数值超出范围');
                }
                settings.voiceVolume = importedSettings.voiceVolume;
            }
            if (importedSettings.prepareTime !== undefined) {
                settings.prepareTime = readInteger(importedSettings.prepareTime, '准备时间', 0, 300);
            }
            if (importedSettings.transitionInterval !== undefined) {
                settings.transitionInterval = readInteger(importedSettings.transitionInterval, '准备间隔', 0, 60);
            }
            if (importedSettings.countdownStart !== undefined) {
                settings.countdownStart = readInteger(importedSettings.countdownStart, '倒计时起点', 1, 60);
            }
        }

        return { plans, settings };
    }

    // ==================== 训练计划管理 ====================

    /**
     * 获取所有训练计划
     */
    getAllPlans() {
        const data = this.getData();
        return data && Array.isArray(data.plans) ? data.plans : [];
    }

    /**
     * 获取计划通过ID
     */
    getPlanById(planId) {
        const plans = this.getAllPlans();
        return plans.find(plan => plan.id === planId);
    }

    /**
     * 保存训练计划（新建或更新）
     */
    savePlan(plan) {
        const data = this.getData();
        if (!data) return false;

        // 如果没有ID，说明是新建
        if (!plan.id) {
            if (data.plans.length >= REHAB_IMPORT_LIMITS.plans) return false;
            const savedPlan = {
                ...plan,
                id: this.generateId(),
                createdAt: new Date().toISOString(),
                exercises: []
            };
            data.plans.push(savedPlan);
            
            // 如果是第一个计划，自动设为激活
            if (data.plans.length === 1) {
                data.activePlanId = savedPlan.id;
            }
        } else {
            // 更新现有计划
            const index = data.plans.findIndex(p => p.id === plan.id);
            if (index !== -1) {
                // 保留exercises数组
                data.plans[index] = {
                    ...plan,
                    exercises: data.plans[index].exercises,
                    updatedAt: new Date().toISOString()
                };
            } else return false;
        }

        return this.saveData(data);
    }

    /**
     * 删除训练计划
     */
    deletePlan(planId) {
        const data = this.getData();
        if (!data) return false;

        const index = data.plans.findIndex(p => p.id === planId);
        if (index === -1) return false;

        data.plans.splice(index, 1);

        // 如果删除的是当前激活的计划，重置激活计划
        if (data.activePlanId === planId) {
            data.activePlanId = data.plans.length > 0 ? data.plans[0].id : null;
        }

        return this.saveData(data);
    }

    /**
     * 设置当前激活的计划
     */
    setActivePlan(planId) {
        const data = this.getData();
        if (!data) return false;

        const plan = data.plans.find(p => p.id === planId);
        if (!plan) return false;

        data.activePlanId = planId;
        return this.saveData(data);
    }

    /**
     * 获取当前激活的计划
     */
    getActivePlan() {
        const data = this.getData();
        if (!data || !data.activePlanId) return null;
        return data.plans.find(plan => plan.id === data.activePlanId) || null;
    }

    // ==================== 训练项管理 ====================

    /**
     * 获取计划的所有训练项
     */
    getExercises(planId) {
        const plan = this.getPlanById(planId);
        return plan ? plan.exercises : [];
    }

    /**
     * 添加训练项到计划
     */
    addExercise(planId, exercise) {
        const data = this.getData();
        if (!data) return false;

        const plan = data.plans.find(p => p.id === planId);
        if (!plan) return false;
        const exerciseTotal = data.plans.reduce((total, item) => total + item.exercises.length, 0);
        if (plan.exercises.length >= REHAB_IMPORT_LIMITS.exercisesPerPlan
            || exerciseTotal >= REHAB_IMPORT_LIMITS.exercisesTotal) return false;

        plan.exercises.push({
            ...exercise,
            id: this.generateId(),
            createdAt: new Date().toISOString()
        });
        return this.saveData(data);
    }

    /**
     * 示例动作作为一个业务批次一次性写入，任一存储失败都不会留下半套示例。
     */
    addExercises(planId, exercises) {
        if (!Array.isArray(exercises) || exercises.length === 0) return false;
        const data = this.getData();
        if (!data) return false;
        const plan = data.plans.find(item => item.id === planId);
        if (!plan) return false;
        const exerciseTotal = data.plans.reduce((total, item) => total + item.exercises.length, 0);
        if (plan.exercises.length + exercises.length > REHAB_IMPORT_LIMITS.exercisesPerPlan
            || exerciseTotal + exercises.length > REHAB_IMPORT_LIMITS.exercisesTotal) return false;
        const createdAt = new Date().toISOString();
        exercises.forEach(exercise => {
            plan.exercises.push({
                ...exercise,
                id: this.generateId(),
                createdAt
            });
        });
        return this.saveData(data);
    }

    /**
     * 更新训练项
     */
    updateExercise(planId, exerciseId, updates) {
        const data = this.getData();
        if (!data) return false;

        const plan = data.plans.find(p => p.id === planId);
        if (!plan || !plan.exercises) return false;

        const index = plan.exercises.findIndex(e => e.id === exerciseId);
        if (index === -1) return false;

        plan.exercises[index] = {
            ...plan.exercises[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        if (plan.exercises[index].type === 'duration') {
            delete plan.exercises[index].reps;
        } else if (plan.exercises[index].type === 'reps') {
            delete plan.exercises[index].duration;
        }

        return this.saveData(data);
    }

    /**
     * 删除训练项
     */
    deleteExercise(planId, exerciseId) {
        const data = this.getData();
        if (!data) return false;

        const plan = data.plans.find(p => p.id === planId);
        if (!plan || !plan.exercises) return false;

        const index = plan.exercises.findIndex(e => e.id === exerciseId);
        if (index === -1) return false;

        plan.exercises.splice(index, 1);
        return this.saveData(data);
    }

    /**
     * 重新排序训练项
     */
    reorderExercises(planId, exerciseIds) {
        const data = this.getData();
        if (!data) return false;

        const plan = data.plans.find(p => p.id === planId);
        if (!plan || !plan.exercises) return false;

        if (!Array.isArray(exerciseIds) || exerciseIds.length !== plan.exercises.length) return false;
        if (new Set(exerciseIds).size !== exerciseIds.length) return false;
        if (exerciseIds.some(id => !plan.exercises.some(exercise => exercise.id === id))) return false;

        // 根据新的ID顺序重新排列
        const reordered = exerciseIds.map(id => 
            plan.exercises.find(e => e.id === id)
        );

        plan.exercises = reordered;
        return this.saveData(data);
    }

    /**
     * 跨计划移动由一次localStorage写入提交，失败时源计划和目标计划都保持原状。
     */
    moveExercise(sourcePlanId, targetPlanId, exerciseId) {
        if (sourcePlanId === targetPlanId) return false;
        const data = this.getData();
        if (!data) return false;
        const sourcePlan = data.plans.find(plan => plan.id === sourcePlanId);
        const targetPlan = data.plans.find(plan => plan.id === targetPlanId);
        if (!sourcePlan || !targetPlan || !Array.isArray(sourcePlan.exercises)) return false;
        if (targetPlan.exercises.length >= REHAB_IMPORT_LIMITS.exercisesPerPlan) return false;
        const index = sourcePlan.exercises.findIndex(exercise => exercise.id === exerciseId);
        if (index === -1) return false;
        const [exercise] = sourcePlan.exercises.splice(index, 1);
        targetPlan.exercises.push(exercise);
        return this.saveData(data);
    }

    // ==================== 设置管理 ====================

    /**
     * 获取设置
     */
    getSettings() {
        const data = this.getData();
        return data ? data.settings : null;
    }

    // ==================== 数据导入导出 ====================

    /**
     * 导出所有数据
     */
    exportData() {
        const data = this.getData();
        if (!data) return null;

        return {
            version: '1.0',
            exportTime: new Date().toISOString(),
            data: data
        };
    }

    /**
     * 导入计划始终追加为独立副本；名称只作展示，不再作为覆盖或折叠依据。
     */
    importData(importData) {
        const currentData = this.getData();
        if (!currentData || !Array.isArray(currentData.plans)) {
            throw new Error('本地训练数据格式不正确');
        }
        const normalized = this.normalizeImport(importData, currentData);
        const exerciseTotal = currentData.plans.reduce((total, plan) => total + plan.exercises.length, 0)
            + normalized.plans.reduce((total, plan) => total + plan.exercises.length, 0);
        if (currentData.plans.length + normalized.plans.length > REHAB_IMPORT_LIMITS.plans) {
            throw new Error(`训练计划总数不能超过${REHAB_IMPORT_LIMITS.plans}个`);
        }
        if (exerciseTotal > REHAB_IMPORT_LIMITS.exercisesTotal) {
            throw new Error(`训练动作总数不能超过${REHAB_IMPORT_LIMITS.exercisesTotal}个`);
        }
        const nextData = {
            ...currentData,
            plans: currentData.plans.concat(normalized.plans),
            settings: normalized.settings
        };
        if (!nextData.activePlanId && normalized.plans.length > 0) {
            nextData.activePlanId = normalized.plans[0].id;
        }
        if (!this.saveData(nextData)) return false;
        return {
            success: true,
            added: normalized.plans.length,
            updated: 0,
            total: nextData.plans.length
        };
    }

}

// 创建全局实例
const storage = new StorageManager();
