/**
 * 应用主入口
 * 负责初始化全局事件和协调各模块
 */

document.addEventListener('DOMContentLoaded', () => {
    // 绑定顶部导航按钮事件
    const statsButton = document.getElementById('statsButton');
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    
    // 统计按钮：显示图表模态框（目前设计是在侧边栏显示，点击此按钮可能用于在移动端显示或打开全屏统计）
    // 这里我们可以复用之前的 ChartManager，或者如果用户希望弹窗显示详细统计，可以在这里处理
    // 假设 inventoryManager.html 中的 statsButton 是为了打开统计模态框
    if (statsButton) {
        statsButton.addEventListener('click', () => {
            // 这里可以简单地调用 ChartManager.updateChart() 来刷新侧边栏图表
            // 或者弹出一个包含详细统计的模态框
            // 暂时实现为：在移动端滚动到统计区域，或在桌面端刷新数据
            if (window.innerWidth <= 992) {
                const statsSection = document.querySelector('.sidebar-section:last-child');
                if (statsSection) statsSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                if (window.ChartsManager) window.ChartsManager.updateChart();
                Utils.showNotification('统计数据已刷新', 'info');
            }
        });
    }

    // 导出按钮
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            if (window.ExportManager) {
                window.ExportManager.exportToExcel();
            } else {
                Utils.showNotification('导出模块未加载', 'error');
            }
        });
    }

    // 导入按钮
    if (importButton) {
        importButton.addEventListener('click', () => {
            if (window.ExportManager) {
                window.ExportManager.triggerImport();
            } else {
                Utils.showNotification('导入模块未加载', 'error');
            }
        });
    }

    // 分类管理按钮 (在侧边栏中)
    const manageCategoryButton = document.getElementById('manageCategoryButton');
    if (manageCategoryButton) {
        manageCategoryButton.addEventListener('click', () => {
             if (window.ModalsManager) {
                 window.ModalsManager.openCategoryManagerModal();
             } else {
                 console.error('ModalsManager is not initialized');
             }
        });
    }

    // 初始化图表
    if (window.ChartsManager) {
        // 稍微延迟以确保DOM完全就绪且数据已加载
        setTimeout(() => {
            window.ChartsManager.updateChart();
        }, 500);
    }
    
    // 监听数据变化事件，以便刷新图表
    // 这里我们简单地通过 hook DataManager 的方法来实现，或者在 UI 刷新时顺便刷新图表
    // 在 js/ui.js 的 refreshData 和 renderContent 中可以添加更新图表的调用
    // 为了解耦，我们可以在 ui.js 中触发自定义事件，或者在 ui.js 中显式调用
    // 目前 ui.js 没有显式调用 ChartsManager，我们通过覆盖 InventoryData 的 save 方法来自动更新图表
    
    const originalSaveItems = InventoryData.saveItems.bind(InventoryData);
    InventoryData.saveItems = function() {
        originalSaveItems();
        if (window.ChartsManager) window.ChartsManager.updateChart();
        if (window.InventoryUI) window.InventoryUI.renderSummary(); // 确保摘要也更新
    };

    console.log('Inventory Management System Initialized');
});

