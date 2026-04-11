/**
 * 本地存储管理模块
 * 负责训练计划和训练项的持久化存储
 */

class StorageManager {
    constructor() {
        // 使用统一的存储键名管理
        this.STORAGE_KEY = (typeof window !== 'undefined' && window.StorageKeys && window.StorageKeys.REHAB_TRAINER_PLANS) 
            ? window.StorageKeys.REHAB_TRAINER_PLANS 
            : 'rehabTrainer';
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
        try {
            const test = '__storage_test__';
            // 优先使用公共工具库
            if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
                window.CommonUtils.setLocalStorageItem(test, test);
                window.CommonUtils.removeLocalStorageItem(test);
                return true;
            }
            // 降级处理
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取所有数据（使用公共工具库）
     */
    getData() {
        // 优先使用公共工具库
        if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
            return window.CommonUtils.getLocalStorageItem(this.STORAGE_KEY, null);
        }
        // 降级处理：如果公共工具库未加载，使用本地实现
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('读取数据失败:', e);
            return null;
        }
    }

    /**
     * 保存所有数据（使用公共工具库）
     */
    saveData(data) {
        // 优先使用公共工具库
        if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
            return window.CommonUtils.setLocalStorageItem(this.STORAGE_KEY, data);
        }
        // 降级处理：如果公共工具库未加载，使用本地实现
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
     * 导入数据（智能合并：同名覆盖，不同名新增）
     */
    importData(importData, mergeMode = true) {
        try {
            if (!importData || !importData.data) {
                throw new Error('无效的导入数据');
            }

            // 验证数据结构
            if (!importData.data.plans || !Array.isArray(importData.data.plans)) {
                throw new Error('数据格式错误');
            }

            if (mergeMode) {
                // 智能合并模式：同名覆盖，不同名新增
                const currentData = this.getData();
                if (!currentData) {
                    // 如果没有现有数据，直接保存导入的数据
                    return this.saveData(importData.data);
                }

                const existingPlans = currentData.plans || [];
                const importPlans = importData.data.plans;
                const mergedPlans = [...existingPlans];
                let addedCount = 0;
                let updatedCount = 0;

                // 处理每个导入的计划
                importPlans.forEach(importPlan => {
                    // 查找同名计划（优先匹配名称）
                    const existingIndex = mergedPlans.findIndex(p => p.name === importPlan.name);
                    
                    if (existingIndex !== -1) {
                        // 同名计划：覆盖（保留原有ID，更新内容）
                        const existingPlan = mergedPlans[existingIndex];
                        mergedPlans[existingIndex] = {
                            ...importPlan,
                            id: existingPlan.id, // 保留原有ID
                            createdAt: existingPlan.createdAt, // 保留创建时间
                            updatedAt: new Date().toISOString() // 更新修改时间
                        };
                        updatedCount++;
                    } else {
                        // 不同名计划：新增
                        // 如果导入的计划有ID，检查是否已存在
                        if (importPlan.id) {
                            const existingById = mergedPlans.findIndex(p => p.id === importPlan.id);
                            if (existingById !== -1) {
                                // ID已存在，更新
                                mergedPlans[existingById] = {
                                    ...importPlan,
                                    updatedAt: new Date().toISOString()
                                };
                                updatedCount++;
                            } else {
                                // ID不存在，新增
                                if (!importPlan.createdAt) {
                                    importPlan.createdAt = new Date().toISOString();
                                }
                                mergedPlans.push(importPlan);
                                addedCount++;
                            }
                        } else {
                            // 没有ID，直接新增
                            importPlan.id = this.generateId();
                            importPlan.createdAt = new Date().toISOString();
                            mergedPlans.push(importPlan);
                            addedCount++;
                        }
                    }
                });

                // 更新数据
                const mergedData = {
                    ...currentData,
                    plans: mergedPlans,
                    // 如果导入数据有设置，可以选择性更新
                    settings: importData.data.settings || currentData.settings
                };

                // 如果当前没有激活计划，且导入数据有激活计划，则使用导入的激活计划
                if (!mergedData.activePlanId && importData.data.activePlanId) {
                    // 检查导入的激活计划是否在合并后的计划中
                    const activePlanExists = mergedPlans.some(p => p.id === importData.data.activePlanId);
                    if (activePlanExists) {
                        mergedData.activePlanId = importData.data.activePlanId;
                    }
                }

                const result = this.saveData(mergedData);
                
                // 返回合并统计信息
                if (result) {
                    return {
                        success: true,
                        added: addedCount,
                        updated: updatedCount,
                        total: mergedPlans.length
                    };
                }
                return false;
            } else {
                // 完全覆盖模式（保留原有行为）
                return this.saveData(importData.data);
            }
        } catch (e) {
            console.error('导入数据失败:', e);
            return false;
        }
    }

    /**
     * 清除所有数据（使用公共工具库）
     */
    clearAllData() {
        try {
            // 优先使用公共工具库
            if (window.CommonUtils && window.CommonUtils.removeLocalStorageItem) {
                window.CommonUtils.removeLocalStorageItem(this.STORAGE_KEY);
            } else {
                // 降级处理：如果公共工具库未加载，使用本地实现
                localStorage.removeItem(this.STORAGE_KEY);
            }
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
