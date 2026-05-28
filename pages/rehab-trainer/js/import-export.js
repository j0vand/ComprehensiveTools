/**
 * 康复训练 - 导入导出
 */
(function() {
    'use strict';

    RehabTrainerApp.prototype.exportData = function() {
        const exportData = storage.exportData();

        if (!exportData) {
            this.showError('没有可导出的数据');
            return;
        }

        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const fileName = `腰突康复训练_${dateStr}.json`;

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();

        URL.revokeObjectURL(url);

        this.showToast('数据导出成功！');
    };

    RehabTrainerApp.prototype.triggerImport = function() {
        document.getElementById('importFile').click();
    };

    RehabTrainerApp.prototype.importData = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            this.showError('请选择JSON格式的文件');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);

                if (!importData || !importData.data || !importData.data.plans) {
                    throw new Error('数据格式不正确');
                }

                const currentPlans = storage.getAllPlans();
                const importPlans = importData.data.plans;
                const planCount = importPlans.length;

                const existingPlanNames = currentPlans.map(p => p.name);
                const importPlanNames = importPlans.map(p => p.name);
                const duplicateNames = importPlanNames.filter(name => existingPlanNames.includes(name));
                const newPlanNames = importPlanNames.filter(name => !existingPlanNames.includes(name));

                let confirmMessage = `即将导入 ${planCount} 个训练计划。\n\n`;

                if (duplicateNames.length > 0) {
                    confirmMessage += `⚠️ 以下 ${duplicateNames.length} 个计划已存在，将被覆盖：\n`;
                    duplicateNames.forEach(name => {
                        confirmMessage += `  • ${name}\n`;
                    });
                    confirmMessage += '\n';
                }

                if (newPlanNames.length > 0) {
                    confirmMessage += `✅ 以下 ${newPlanNames.length} 个计划将新增：\n`;
                    newPlanNames.forEach(name => {
                        confirmMessage += `  • ${name}\n`;
                    });
                    confirmMessage += '\n';
                }

                confirmMessage += '确定要继续吗？';

                const confirm = window.confirm(confirmMessage);

                if (!confirm) {
                    return;
                }

                const result = storage.importData(importData, true);

                if (result && result.success) {
                    let message = '数据导入成功！';
                    if (result.added > 0 || result.updated > 0) {
                        message += `\n新增 ${result.added} 个计划，更新 ${result.updated} 个计划`;
                    }
                    this.showToast(message);
                    this.loadPlans();
                } else {
                    throw new Error('导入失败');
                }
            } catch (error) {
                console.error('导入错误:', error);
                this.showError('导入失败：' + error.message);
            } finally {
                event.target.value = '';
            }
        };

        reader.onerror = () => {
            this.showError('文件读取失败');
            event.target.value = '';
        };

        reader.readAsText(file);
    };
})();
