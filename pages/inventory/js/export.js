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
                            '批次购买日期': batch.purchaseDate,
                            '批次过期日期': batch.expiryDate || '',
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
            const now = new Date();
            const fileName = `库存导出_${calendarDateFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate())}.xlsx`;
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
                
                this.processImportData(jsonData, {
                    date1904: Boolean(workbook.Workbook?.WBProps?.date1904)
                });
                
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
    processImportData(data, dateOptions = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            Utils.showNotification('文件中没有数据', 'warning');
            return { success: false, successCount: 0, failCount: 0 };
        }

        let failCount = 0;
        const itemsMap = new Map();

        data.forEach(row => {
            try {
                if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('行不是对象');
                const name = typeof row['商品名称'] === 'string' ? row['商品名称'].trim() : '';
                if (!name) throw new Error('商品名称无效');

                const rawId = row['ID'];
                const id = (typeof rawId === 'string' || typeof rawId === 'number') ? String(rawId).trim() : '';
                if (id.length > 128 || /[\u0000-\u001f\u007f]/.test(id)) throw new Error('ID 无效');
                const category = typeof row['分类'] === 'string' && row['分类'].trim() ? row['分类'].trim() : '其他';
                const brand = typeof row['品牌'] === 'string' ? row['品牌'].trim() : '';
                const spec = typeof row['规格'] === 'string' ? row['规格'].trim() : '';
                const storage = typeof row['存放位置'] === 'string' ? row['存放位置'].trim() : '';
                const remark = typeof row['备注'] === 'string' ? row['备注'].trim() : '';
                const groupKey = id ? `id:${id}` :
                    `item:${[name, category, brand, spec, storage].map(value => value.toLocaleLowerCase()).join('\u0000')}`;

                const quantityValue = row['批次数量'];
                const priceValue = row['批次单价'];
                const quantity = quantityValue === undefined || quantityValue === '' ? 0 : inventoryNumber(quantityValue);
                const price = priceValue === undefined || priceValue === '' ? 0 : inventoryNumber(priceValue);
                if (quantity === null || quantity < 0 || price === null || price < 0 ||
                    !Number.isFinite(quantity * price)) {
                    throw new Error('批次数值无效');
                }
                const purchaseDate = row['批次购买日期'] === undefined || row['批次购买日期'] === '' ?
                    null : this.parseExcelDate(row['批次购买日期'], null, dateOptions);
                const expiryDate = row['批次过期日期'] === undefined || row['批次过期日期'] === '' ?
                    null : this.parseExcelDate(row['批次过期日期'], null, dateOptions);
                if (row['批次购买日期'] && !purchaseDate) throw new Error('购买日期无效');
                if (row['批次过期日期'] && !expiryDate) throw new Error('过期日期无效');

                if (!itemsMap.has(groupKey)) {
                    itemsMap.set(groupKey, {
                        id,
                        name,
                        category,
                        brand,
                        spec,
                        storage,
                        remark,
                        batches: [],
                        batchSignatures: new Set()
                    });
                }
                const item = itemsMap.get(groupKey);
                const identity = [name, category, brand, spec, storage].join('\u0000');
                const itemIdentity = [item.name, item.category, item.brand, item.spec, item.storage].join('\u0000');
                if (identity !== itemIdentity) throw new Error('同一 ID 对应不同商品');

                if (quantity > 0 || purchaseDate || expiryDate || price > 0) {
                    const signature = [quantity, price, purchaseDate || '', expiryDate || ''].join('|');
                    if (!item.batchSignatures.has(signature)) {
                        item.batchSignatures.add(signature);
                        item.batches.push({
                            id: Utils.generateUUID(),
                            quantity,
                            price,
                            purchaseDate: purchaseDate || localCalendarDate(),
                            expiryDate
                        });
                    }
                }
            } catch (err) {
                console.warn('行数据处理失败:', row, err);
                failCount++;
            }
        });

        const items = [...itemsMap.values()].map(item => {
            const { batchSignatures, ...importedItem } = item;
            return importedItem;
        });
        const result = InventoryData.importItems(items);
        if (!result.success) {
            Utils.showNotification('导入失败，原库存未发生变化', 'error');
            return { success: false, successCount: 0, failCount };
        }

        Utils.showNotification(`导入完成: 成功 ${result.count} 个商品，忽略/失败 ${failCount} 行`, 'success');
        if (window.InventoryUI) window.InventoryUI.refreshData();
        return { success: true, successCount: result.count, failCount };
    }

    /**
     * 解析 Excel 日期
     * Excel 日期可能是字符串或数字（天数）
     */
    parseExcelDate(dateVal, fallback = null, options = {}) {
        if (dateVal === undefined || dateVal === null || dateVal === '') return fallback;
        if (dateVal instanceof Date) return localCalendarDate(dateVal) || fallback;

        const numericValue = typeof dateVal === 'number' ? inventoryNumber(dateVal) :
            (typeof dateVal === 'string' && /^\d+(?:\.\d+)?$/.test(dateVal.trim()) ? inventoryNumber(dateVal) : null);
        if (numericValue !== null && numericValue >= 0) {
            const serialDay = Math.floor(numericValue);
            if (!options.date1904 && serialDay === 60) return fallback;
            const epoch = options.date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
            const elapsedDays = options.date1904 ? serialDay : (serialDay < 60 ? serialDay : serialDay - 1);
            const date = new Date(epoch + elapsedDays * 86400000);
            return Number.isFinite(date.getTime()) ? calendarDateFromParts(
                date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()
            ) : fallback;
        }

        if (typeof dateVal === 'string') {
            const match = dateVal.trim().match(/^(\d{4})(?:-|\/|年)(\d{1,2})(?:-|\/|月)(\d{1,2})(?:日)?$/);
            if (match) {
                return calendarDateFromParts(Number(match[1]), Number(match[2]), Number(match[3])) || fallback;
            }
        }

        return fallback;
    }
}

// 导出实例
window.ExportManager = new ExportManager();
