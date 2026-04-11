/**
 * 图表管理模块
 * 负责使用 Chart.js 渲染库存统计图表
 */

class ChartsManager {
    constructor() {
        this.chartInstance = null;
        this.ctx = document.getElementById('inventorySummaryChart');
    }

    /**
     * 初始化或更新图表
     */
    updateChart() {
        if (!this.ctx || typeof Chart === 'undefined') return;

        const stats = InventoryData.getInventoryStats();
        
        // 准备数据：按分类统计库存价值
        const categories = Object.keys(stats.categoryStats);
        const values = categories.map(cat => stats.categoryStats[cat].value); // 使用库存价值
        const quantities = categories.map(cat => stats.categoryStats[cat].quantity); // 使用库存数量
        
        // 如果没有数据，不显示图表
        if (categories.length === 0) {
            if (this.chartInstance) {
                this.chartInstance.destroy();
                this.chartInstance = null;
            }
            return;
        }

        // 销毁旧图表
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // 获取当前主题颜色
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#e0e0e0' : '#212121';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        // 创建新图表
        this.chartInstance = new Chart(this.ctx, {
            type: 'bar', // 柱状图
            data: {
                labels: categories,
                datasets: [
                    {
                        label: '库存数量',
                        data: quantities,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: '库存价值 (¥)',
                        data: values,
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor
                        }
                    },
                    title: {
                        display: false,
                        text: '分类库存统计'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '数量',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '价值',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: gridColor
                        }
                    }
                }
            }
        });
    }

    /**
     * 更新图表主题
     */
    updateTheme() {
        this.updateChart();
    }
}

// 导出实例
window.ChartsManager = new ChartsManager();

// 监听主题切换，更新图表
window.updateChartsTheme = () => {
    if (window.ChartsManager) {
        window.ChartsManager.updateTheme();
    }
};

