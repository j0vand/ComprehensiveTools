/**
 * 本地存储管理模块
 * 负责训练计划和训练项的持久化存储
 */

class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'rehabTrainer';
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
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            const initialData = {
                plans: [],
                activePlanId: null,
                settings: {
                    voiceRate: 1.0,
                    voiceVolume: 1.0,
                    prepareTime: 10
                }
            };
            this.saveData(initialData);
        }
    }

    /**
     * 检查localStorage是否可用
     */
    isLocalStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取所有数据
     */
    getData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('读取数据失败:', e);
            return null;
        }
    }

    /**
     * 保存所有数据
     */
    saveData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
            return false;
        }
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ==================== 训练计划管理 ====================

    /**
     * 获取所有训练计划
     */
    getAllPlans() {
        const data = this.getData();
        return data ? data.plans : [];
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
            plan.id = this.generateId();
            plan.createdAt = new Date().toISOString();
            plan.exercises = [];
            data.plans.push(plan);
            
            // 如果是第一个计划，自动设为激活
            if (data.plans.length === 1) {
                data.activePlanId = plan.id;
            }
        } else {
            // 更新现有计划
            const index = data.plans.findIndex(p => p.id === plan.id);
            if (index !== -1) {
                // 保留exercises数组
                plan.exercises = data.plans[index].exercises;
                plan.updatedAt = new Date().toISOString();
                data.plans[index] = plan;
            }
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
        return this.getPlanById(data.activePlanId);
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

        exercise.id = this.generateId();
        exercise.createdAt = new Date().toISOString();
        
        if (!plan.exercises) {
            plan.exercises = [];
        }
        
        plan.exercises.push(exercise);
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

        // 根据新的ID顺序重新排列
        const reordered = exerciseIds.map(id => 
            plan.exercises.find(e => e.id === id)
        ).filter(e => e !== undefined);

        plan.exercises = reordered;
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

    /**
     * 更新设置
     */
    updateSettings(settings) {
        const data = this.getData();
        if (!data) return false;

        data.settings = {
            ...data.settings,
            ...settings
        };

        return this.saveData(data);
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
     * 导入数据
     */
    importData(importData) {
        try {
            if (!importData || !importData.data) {
                throw new Error('无效的导入数据');
            }

            // 验证数据结构
            if (!importData.data.plans || !Array.isArray(importData.data.plans)) {
                throw new Error('数据格式错误');
            }

            return this.saveData(importData.data);
        } catch (e) {
            console.error('导入数据失败:', e);
            return false;
        }
    }

    /**
     * 清除所有数据
     */
    clearAllData() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            this.init();
            return true;
        } catch (e) {
            console.error('清除数据失败:', e);
            return false;
        }
    }
}

// 创建全局实例
const storage = new StorageManager();
