/**
 * 统一管理 localStorage 键名
 * 避免各模块之间的键名冲突
 */

const STORAGE_KEYS = {
    // 养老金计算器
    PENSION_CALCULATOR: 'pensionCalculator_data',
    
    // 康复训练器
    REHAB_TRAINER_PLANS: 'rehabTrainer',  // 保持与旧版本一致
    REHAB_TRAINER_SETTINGS: 'rehabTrainer_settings',
    
    // 库存管理
    INVENTORY_ITEMS: 'inventory-items',
    INVENTORY_CATEGORIES: 'inventory-categories',
    INVENTORY_BRANDS: 'inventory-brands',
    INVENTORY_SETTINGS: 'inventory-settings',
    INVENTORY_HISTORY: 'inventory-history',
    INVENTORY_SHOPPING_LIST: 'inventory-shopping-list',
    
    // 今日点餐
    MEAL_VIEWER_DATA: 'mealArrangements',  // 保持与旧版本一致
    
    // 个税计算器
    TAX_CALCULATOR_DATA: 'tax_calculator_state',  // 保持与旧版本一致
    
    // 房贷计算器
    MORTGAGE_CALCULATOR_DATA: 'mortgageCalculator_data',
    
    // 理财计算器
    FINANCE_CALCULATOR_DATA: 'financeCalculator_data',
    FINANCE_CALCULATOR_INPUTS: 'financeCalculator_inputs' // 用于保存输入值
};

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.StorageKeys = STORAGE_KEYS;
}
