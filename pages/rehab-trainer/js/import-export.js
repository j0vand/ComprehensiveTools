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
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const fileName = `腰突康复训练_${dateStr}.json`;

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        this.showToast('数据导出成功！');
    };

    RehabTrainerApp.prototype.importData = function(event) {
        const input = event.currentTarget || event.target;
        const file = input.files[0];
        if (!file) return;

        if (this.importInProgress) {
            this.showError('正在导入数据，请稍候');
            input.value = '';
            return;
        }

        if (!file.name.toLowerCase().endsWith('.json')) {
            this.showError('请选择JSON格式的文件');
            input.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            this.showError('导入文件不能超过 2 MiB');
            input.value = '';
            return;
        }

        this.importInProgress = true;
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                const plans = importData && importData.data && importData.data.plans;
                if (!Array.isArray(plans) || plans.length === 0) {
                    throw new Error('导入内容必须包含训练计划');
                }
                const confirmed = await window.DialogService.confirmAction(
                    `即将导入 ${plans.length} 个训练计划。计划会作为独立副本新增，文件中的训练设置也会同步更新。确定继续吗？`
                );
                if (!confirmed) return;

                const result = storage.importData(importData);

                if (result && result.success) {
                    const message = `数据导入成功！新增 ${result.added} 个独立计划`;
                    this.showToast(message);
                    this.loadPlans();
                } else {
                    throw new Error('数据保存失败，原有计划未改变');
                }
            } catch (error) {
                console.error('导入错误:', error);
                this.showError('导入失败：' + error.message);
            } finally {
                this.importInProgress = false;
                input.value = '';
            }
        };

        reader.onerror = () => {
            this.showError('文件读取失败');
            this.importInProgress = false;
            input.value = '';
        };

        try {
            reader.readAsText(file);
        } catch (error) {
            this.importInProgress = false;
            input.value = '';
            this.showError('文件读取失败：' + error.message);
        }
    };
})();
