/**
 * 数据导出导入模块
 * 负责将库存数据导出为 Excel 文件，以及从 Excel 文件导入数据
 * 依赖 SheetJS (xlsx) 库
 */

class ExportManager {
    constructor() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.xlsx, .xls, .csv';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    /**
     * 导出数据为 Excel
     */
    exportToExcel() {
        try {
            const items = InventoryData.getAllItems();
            
            // 准备导出数据，展平结构
            const exportData = [];
            
            items.forEach(item => {
                // 如果商品没有批次，创建一个基本记录
                if (!item.batches || item.batches.length === 0) {
                    exportData.push({
                        'ID': item.id,
                        '商品名称': item.name,
                        '分类': item.category,
                        '品牌': item.brand,
                        '规格': item.spec,
                        '存放位置': item.storage,
                        '备注': item.remark,
                        '总数量': item.quantity,
                        '批次购买日期': '',
                        '批次过期日期': '',
                        '批次数量': 0,
                        '批次单价': 0,
                        '批次总价': 0
                    });
                } else {
                    // 为每个批次创建一行
                    item.batches.forEach(batch => {
                        exportData.push({
                            'ID': item.id,
                            '商品名称': item.name,
                            '分类': item.category,
                            '品牌': item.brand,
                            '规格': item.spec,
                            '存放位置': item.storage,
                            '备注': item.remark,
                            '总数量': item.quantity,
                            '批次购买日期': Utils.formatDate(batch.purchaseDate),
                            '批次过期日期': batch.expiryDate ? Utils.formatDate(batch.expiryDate) : '',
                            '批次数量': batch.quantity,
                            '批次单价': batch.price || 0,
                            '批次总价': (batch.quantity * (batch.price || 0))
                        });
                    });
                }
            });

            // 创建工作簿
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);

            // 设置列宽
            const colWidths = [
                { wch: 20 }, // ID
                { wch: 20 }, // 商品名称
                { wch: 10 }, // 分类
                { wch: 10 }, // 品牌
                { wch: 10 }, // 规格
                { wch: 15 }, // 存放位置
                { wch: 20 }, // 备注
                { wch: 8 },  // 总数量
                { wch: 12 }, // 批次购买日期
                { wch: 12 }, // 批次过期日期
                { wch: 8 },  // 批次数量
                { wch: 8 },  // 批次单价
                { wch: 10 }  // 批次总价
            ];
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, "库存数据");

            // 导出文件
            const fileName = `库存导出_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification('导出成功', 'success');

        } catch (error) {
            console.error('导出失败:', error);
            Utils.showNotification('导出失败: ' + error.message, 'error');
        }
    }

    /**
     * 触发导入文件选择
     */
    triggerImport() {
        this.fileInput.click();
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 读取第一个工作表
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // 转换为 JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                this.processImportData(jsonData);
                
                // 重置 input 以便允许重复选择同一文件
                this.fileInput.value = '';
                
            } catch (error) {
                console.error('导入读取失败:', error);
                Utils.showNotification('文件读取失败: ' + error.message, 'error');
            }
        };
        
        reader.readAsArrayBuffer(file);
    }

    /**
     * 处理导入的数据
     */
    processImportData(data) {
        if (!data || data.length === 0) {
            Utils.showNotification('文件中没有数据', 'warning');
            return;
        }

        let successCount = 0;
        let failCount = 0;
        
        // 用于临时存储按 ID 分组的数据，以便重构批次结构
        const itemsMap = new Map();

        data.forEach(row => {
            try {
                const id = row['ID'] || Utils.generateUUID();
                const name = row['商品名称'];
                
                if (!name) {
                    failCount++; // 必须有名称
                    return;
                }

                if (!itemsMap.has(id)) {
                    // 初始化商品对象
                    itemsMap.set(id, {
                        id: id,
                        name: name,
                        category: row['分类'] || '其他',
                        brand: row['品牌'] || '',
                        spec: row['规格'] || '',
                        storage: row['存放位置'] || '',
                        remark: row['备注'] || '',
                        batches: []
                    });
                }

                // 添加批次
                const quantity = parseInt(row['批次数量']) || 0;
                // 如果是新导入的行且有数量，则视为有效批次
                if (quantity > 0 || row['批次购买日期']) {
                    itemsMap.get(id).batches.push({
                        id: Utils.generateUUID(),
                        quantity: quantity,
                        price: parseFloat(row['批次单价']) || 0,
                        purchaseDate: this.parseExcelDate(row['批次购买日期']),
                        expiryDate: row['批次过期日期'] ? this.parseExcelDate(row['批次过期日期']) : null
                    });
                }

            } catch (err) {
                console.warn('行数据处理失败:', row, err);
                failCount++;
            }
        });

        // 将整理好的数据存入 InventoryData
        itemsMap.forEach(item => {
            // 计算总数量
            item.quantity = item.batches.reduce((sum, b) => sum + b.quantity, 0);
            
            // 如果ID已存在，更新；否则添加
            const existing = InventoryData.getItem(item.id);
            if (existing) {
                InventoryData.updateItem(item.id, item);
            } else {
                InventoryData.addItem(item);
            }
            successCount++;
        });

        Utils.showNotification(`导入完成: 成功 ${successCount} 个商品，忽略/失败 ${failCount} 行`, 'success');
        
        // 刷新 UI
        if (window.InventoryUI) window.InventoryUI.refreshData();
    }

    /**
     * 解析 Excel 日期
     * Excel 日期可能是字符串或数字（天数）
     */
    parseExcelDate(dateVal) {
        if (!dateVal) return new Date().toISOString();
        
        if (dateVal instanceof Date) return dateVal.toISOString();
        
        // 尝试作为字符串解析
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) return d.toISOString();
        
        return new Date().toISOString();
    }
}

// 导出实例
window.ExportManager = new ExportManager();

