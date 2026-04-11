        let currentLoanType = 'commercial';
        let chart = null;
        
        // 使用公共工具库的通知函数
        function showToast(message, type = 'info') {
            if (window.CommonUtils && window.CommonUtils.showNotification) {
                window.CommonUtils.showNotification(message, type, 3000);
            } else {
                // 降级处理
                alert(message);
            }
        }

        /**
         * 获取输入框的值，正确处理0值和空值
         * @param {string} id - 元素ID
         * @param {string} type - 值类型：'int' 或 'float'
         * @param {*} defaultValue - 默认值
         * @returns {*} 解析后的值或默认值
         */
        function getElementValue(id, type = 'float', defaultValue = 0) {
            if (window.CommonUtils && window.CommonUtils.getElementValue) {
                return window.CommonUtils.getElementValue(id, type, defaultValue);
            }
            // 降级处理
            const element = document.getElementById(id);
            if (!element) return defaultValue;
            const value = element.value.trim();
            if (value === '') return defaultValue;
            const parsedValue = type === 'int' ? parseInt(value) : parseFloat(value);
            return isNaN(parsedValue) ? defaultValue : parsedValue;
        }

        // 使用统一的存储键名
        const STORAGE_KEY = (typeof window !== 'undefined' && window.StorageKeys)
            ? window.StorageKeys.MORTGAGE_CALCULATOR_DATA
            : 'mortgageCalculator_data';

        /**
         * 保存表单数据到 localStorage
         */
        function saveFormData() {
            const formData = {
                loanType: currentLoanType,
                commercialAmount: document.getElementById('commercialAmount')?.value || '',
                commercialYears: document.getElementById('commercialYears')?.value || '',
                commercialRate: document.getElementById('commercialRate')?.value || '',
                fundAmount: document.getElementById('fundAmount')?.value || '',
                fundYears: document.getElementById('fundYears')?.value || '',
                fundRate: document.getElementById('fundRate')?.value || '',
                combinedCommercialAmount: document.getElementById('combinedCommercialAmount')?.value || '',
                combinedCommercialRate: document.getElementById('combinedCommercialRate')?.value || '',
                combinedFundAmount: document.getElementById('combinedFundAmount')?.value || '',
                combinedFundRate: document.getElementById('combinedFundRate')?.value || '',
                combinedYears: document.getElementById('combinedYears')?.value || '',
                repaymentMethod: document.getElementById('repaymentMethod')?.value || 'equal'
            };

            if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
                window.CommonUtils.setLocalStorageItem(STORAGE_KEY, formData);
            } else {
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
                } catch (e) {
                    console.warn('无法保存数据到 localStorage:', e);
                }
            }
        }

        /**
         * 从 localStorage 恢复表单数据
         */
        function restoreFormData() {
            let formData;
            if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
                formData = window.CommonUtils.getLocalStorageItem(STORAGE_KEY, null);
                if (!formData) return;
            } else {
                try {
                    const savedData = localStorage.getItem(STORAGE_KEY);
                    if (!savedData) return;
                    formData = JSON.parse(savedData);
                } catch (e) {
                    console.warn('无法从 localStorage 恢复数据:', e);
                    return;
                }
            }

            // 恢复贷款类型
            if (formData.loanType) {
                currentLoanType = formData.loanType;
                switchLoanType(currentLoanType);
            }

            // 恢复所有输入框的值
            const fields = [
                'commercialAmount', 'commercialYears', 'commercialRate',
                'fundAmount', 'fundYears', 'fundRate',
                'combinedCommercialAmount', 'combinedCommercialRate',
                'combinedFundAmount', 'combinedFundRate', 'combinedYears'
            ];

            fields.forEach(field => {
                const el = document.getElementById(field);
                if (el && formData[field] !== undefined && formData[field] !== '') {
                    el.value = formData[field];
                }
            });

            // 恢复还款方式
            const repaymentMethodEl = document.getElementById('repaymentMethod');
            if (repaymentMethodEl && formData.repaymentMethod) {
                repaymentMethodEl.value = formData.repaymentMethod;
            }
        }

        // 统一函数名，供按钮调用
        function calculateMortgage() {
            calculate();
        }

        // 切换贷款类型
        function switchLoanType(type) {
            currentLoanType = type;
            document.querySelectorAll('.loan-type-button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-loan-type') === type) {
                    btn.classList.add('active');
                }
            });

            // 隐藏所有输入区域
            document.querySelectorAll('#commercial-inputs, #fund-inputs, #combined-inputs').forEach(div => {
                div.style.display = 'none';
            });

            // 显示选中的输入区域
            document.getElementById(type + '-inputs').style.display = 'block';
        }

        // 切换标签页
        function switchTab(tab) {
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-tab') === tab) {
                    btn.classList.add('active');
                }
            });

            document.getElementById('schedule-tab').style.display = tab === 'schedule' ? 'block' : 'none';
            document.getElementById('chart-tab').style.display = tab === 'chart' ? 'block' : 'none';

            if (tab === 'chart' && chart) {
                chart.resize();
            }
        }

        // 初始化事件监听器
        document.addEventListener('DOMContentLoaded', function() {
            // 恢复保存的表单数据
            restoreFormData();

            // 贷款类型切换按钮
            document.querySelectorAll('.loan-type-button').forEach(btn => {
                btn.addEventListener('click', function() {
                    const type = this.getAttribute('data-loan-type');
                    switchLoanType(type);
                    saveFormData();
                });
            });

            // 计算按钮
            const calculateBtn = document.getElementById('calculate-mortgage-btn');
            if (calculateBtn) {
                calculateBtn.addEventListener('click', calculateMortgage);
            }

            // 标签页切换按钮
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.addEventListener('click', function() {
                    const tab = this.getAttribute('data-tab');
                    switchTab(tab);
                });
            });

            // 监听所有输入框的变化，自动保存
            const inputFields = document.querySelectorAll('input[type="number"], select');
            inputFields.forEach(field => {
                field.addEventListener('change', saveFormData);
            });
        });

        // 格式化金额
        function formatMoney(amount, decimals = 2) {
            return amount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }

        // 修正月利率转换函数
        function calculateMonthlyRate(yearRate) {
            // 修正为正确的复利转换公式，而不是简单的除以12
            return Math.pow(1 + yearRate / 100, 1/12) - 1;
        }

        // 修改计算函数
        function calculate() {
            // 修复：从select元素获取还款方式
            const repaymentMethodSelect = document.getElementById('repaymentMethod');
            const paymentMethod = repaymentMethodSelect ? repaymentMethodSelect.value : 'equal';
            let loanType = currentLoanType;
            
            // 验证输入
            let isValid = true;
            let errorMessage = '';
            
            if (loanType === 'commercial') {
                const amount = getElementValue('commercialAmount', 'float', 0);
                const years = getElementValue('commercialYears', 'int', 0);
                const rate = getElementValue('commercialRate', 'float', 0);
                if (amount <= 0 || years <= 0 || rate <= 0) {
                    isValid = false;
                    errorMessage = '请输入有效的贷款金额、年限和利率';
                }
            } else if (loanType === 'fund') {
                const amount = getElementValue('fundAmount', 'float', 0);
                const years = getElementValue('fundYears', 'int', 0);
                const rate = getElementValue('fundRate', 'float', 0);
                if (amount <= 0 || years <= 0 || rate <= 0) {
                    isValid = false;
                    errorMessage = '请输入有效的贷款金额、年限和利率';
                }
            } else if (loanType === 'combined') {
                const commercialAmount = getElementValue('combinedCommercialAmount', 'float', 0);
                const fundAmount = getElementValue('combinedFundAmount', 'float', 0);
                const years = getElementValue('combinedYears', 'int', 0);
                const commercialRate = getElementValue('combinedCommercialRate', 'float', 0);
                const fundRate = getElementValue('combinedFundRate', 'float', 0);
                if ((commercialAmount <= 0 && fundAmount <= 0) || years <= 0 || commercialRate <= 0 || fundRate <= 0) {
                    isValid = false;
                    errorMessage = '请输入有效的贷款金额、年限和利率';
                }
            }
            
            if (!isValid) {
                showToast(errorMessage, 'error');
                return;
            }
            
            // 显示结果区域
            const resultCard = document.querySelector('.result-card');
            if (resultCard) {
                resultCard.style.display = 'block';
            }
            
            // 根据贷款类型获取输入参数
            let loanAmount = 0;
            let years = 0;
            let commercialRate = 0;
            let fundRate = 0;
            let commercialAmount = 0;
            let fundAmount = 0;
            
            if (loanType === 'commercial') {
                commercialAmount = getElementValue('commercialAmount', 'float', 0) * 10000;
                years = getElementValue('commercialYears', 'int', 30);
                commercialRate = getElementValue('commercialRate', 'float', 4.9);
                loanAmount = commercialAmount;
            } else if (loanType === 'fund') {
                fundAmount = getElementValue('fundAmount', 'float', 0) * 10000;
                years = getElementValue('fundYears', 'int', 30);
                fundRate = getElementValue('fundRate', 'float', 3.25);
                loanAmount = fundAmount;
            } else if (loanType === 'combined') {
                commercialAmount = getElementValue('combinedCommercialAmount', 'float', 0) * 10000;
                fundAmount = getElementValue('combinedFundAmount', 'float', 0) * 10000;
                years = getElementValue('combinedYears', 'int', 30);
                commercialRate = getElementValue('combinedCommercialRate', 'float', 4.9);
                fundRate = getElementValue('combinedFundRate', 'float', 3.25);
                loanAmount = commercialAmount + fundAmount;
            }
            
            // 注意：displayLoanType 和 displayPaymentMethod 元素不存在，已移除相关代码
            // 还款方式信息已通过select元素显示，无需额外显示
            
            // 计算月供和还款总额
            let schedule = [];
            let totalInterest = 0;
            let totalPayment = 0;
            let monthlyPayment = 0;
            const months = years * 12;
            
            if (loanType === 'combined') {
                // 分开计算商业贷款和公积金贷款
                const commercialMonthlyRate = calculateMonthlyRate(commercialRate);
                const fundMonthlyRate = calculateMonthlyRate(fundRate);
                
                let commercialSchedule = calculateSchedule(commercialAmount, commercialMonthlyRate, months, paymentMethod);
                let fundSchedule = calculateSchedule(fundAmount, fundMonthlyRate, months, paymentMethod);
                
                // 合并两种贷款的还款计划
                for (let i = 0; i < months; i++) {
                    const commercial = commercialSchedule[i];
                    const fund = fundSchedule[i];
                    
                    schedule.push({
                        month: i + 1,
                        payment: commercial.payment + fund.payment,
                        principal: commercial.principal + fund.principal,
                        interest: commercial.interest + fund.interest,
                        remaining: commercial.remaining + fund.remaining
                    });
                    
                    totalInterest += commercial.interest + fund.interest;
                    totalPayment += commercial.payment + fund.payment;
                    
                    if (i === 0) {
                        monthlyPayment = commercial.payment + fund.payment;
                    }
                }
            } else {
                // 单一类型贷款计算
                const rate = loanType === 'commercial' ? commercialRate : fundRate;
                const monthlyRate = calculateMonthlyRate(rate);
                
                schedule = calculateSchedule(loanAmount, monthlyRate, months, paymentMethod);
                totalInterest = schedule.reduce((sum, item) => sum + item.interest, 0);
                totalPayment = schedule.reduce((sum, item) => sum + item.payment, 0);
                monthlyPayment = schedule[0].payment;
            }
            
            // 更新结果摘要
            document.getElementById('totalLoan').textContent = formatMoney(loanAmount / 10000) + '万元';
            document.getElementById('totalInterest').textContent = formatMoney(totalInterest / 10000) + '万元';
            document.getElementById('totalPayment').textContent = formatMoney(totalPayment / 10000) + '万元';
            document.getElementById('firstPayment').textContent = formatMoney(monthlyPayment) + '元';
            
            // 更新还款计划表格
            const tbody = document.getElementById('repaymentSchedule');
            tbody.innerHTML = '';
            
            // 为了减少渲染压力，只显示部分数据
            const displaySchedule = getDisplaySchedule(schedule);
            
            displaySchedule.forEach(item => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${item.month}</td>
                    <td>${formatMoney(item.payment)}</td>
                    <td>${formatMoney(item.principal)}</td>
                    <td>${formatMoney(item.interest)}</td>
                    <td>${formatMoney(Math.max(0, item.remaining))}</td>
                `;
            });
            
            // 更新图表
            updateChart(schedule);
        }
        
        // 提取计算还款计划的逻辑到单独的函数
        function calculateSchedule(loanAmount, monthlyRate, months, paymentMethod) {
            const schedule = [];
            let remainingPrincipal = loanAmount;
            let monthlyPayment = 0;
            
            if (paymentMethod === 'equal') {
                // 等额本息
                monthlyPayment = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
                
                for (let i = 1; i <= months; i++) {
                    const interest = remainingPrincipal * monthlyRate;
                    const principal = monthlyPayment - interest;
                    // 使用toFixed避免浮点数精度问题
                    remainingPrincipal = Math.max(0, parseFloat((remainingPrincipal - principal).toFixed(2)));
                    
                    schedule.push({
                        month: i,
                        payment: monthlyPayment,
                        principal: principal,
                        interest: interest,
                        remaining: remainingPrincipal
                    });
                }
            } else {
                // 等额本金
                const monthlyPrincipal = loanAmount / months;
                
                for (let i = 1; i <= months; i++) {
                    const interest = remainingPrincipal * monthlyRate;
                    const payment = monthlyPrincipal + interest;
                    // 使用toFixed避免浮点数精度问题
                    remainingPrincipal = Math.max(0, parseFloat((remainingPrincipal - monthlyPrincipal).toFixed(2)));
                    
                    schedule.push({
                        month: i,
                        payment: payment,
                        principal: monthlyPrincipal,
                        interest: interest,
                        remaining: remainingPrincipal
                    });
                    
                    if (i === 1) {
                        monthlyPayment = payment;
                    }
                }
            }
            
            return schedule;
        }
        
        // 获取展示用的还款计划（减少数据量）
        function getDisplaySchedule(schedule) {
            const displaySchedule = [];
            const totalMonths = schedule.length;
            
            // 始终显示第一年的每月数据
            for (let i = 0; i < Math.min(12, totalMonths); i++) {
                displaySchedule.push(schedule[i]);
            }
            
            // 后续每年选择性显示
            if (totalMonths > 12) {
                // 每年的第一个月
                for (let i = 12; i < totalMonths; i += 12) {
                    displaySchedule.push(schedule[i]);
                }
                
                // 始终显示最后一期
                if (displaySchedule[displaySchedule.length - 1].month !== totalMonths) {
                    displaySchedule.push(schedule[totalMonths - 1]);
                }
            }
            
            return displaySchedule;
        }

        // 更新图表
        function updateChart(schedule) {
            const chartContainer = document.getElementById('paymentChart');
            if (!chart) {
                chart = echarts.init(chartContainer);
            }

            const months = schedule.map(item => item.month);
            const payments = schedule.map(item => item.payment);
            const principals = schedule.map(item => item.principal);
            const interests = schedule.map(item => item.interest);

            const option = {
                title: {
                    text: '还款构成分析',
                    left: 'center',
                    textStyle: {
                        fontSize: 14
                    }
                },
                legend: {
                    data: ['月供', '本金', '利息'],
                    top: 25,
                    textStyle: {
                        fontSize: 12
                    }
                },
                grid: {
                    left: '8%',
                    right: '4%',
                    bottom: '12%',
                    top: '20%',
                    containLabel: true
                },
                tooltip: {
                    trigger: 'axis',
                    confine: true, // 确保提示框在图表区域内
                    formatter: function(params) {
                        return params[0].axisValue + '期<br/>' +
                            params.map(item => {
                                return item.seriesName + ': ' + formatMoney(item.value) + '元';
                            }).join('<br/>');
                    }
                },
                xAxis: {
                    type: 'category',
                    boundaryGap: false,
                    data: months,
                    name: '期数'
                },
                yAxis: {
                    type: 'value',
                    name: '金额（元）'
                },
                series: [
                    {
                        name: '月供',
                        type: 'line',
                        data: payments
                    },
                    {
                        name: '本金',
                        type: 'line',
                        data: principals
                    },
                    {
                        name: '利息',
                        type: 'line',
                        data: interests
                    }
                ]
            };

            chart.setOption(option);
        }

        // 节流函数（用于 resize 事件）
        function throttle(func, limit = 100) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => { inThrottle = false; }, limit);
                }
            };
        }

        // 监听窗口大小变化，调整图表大小（使用节流优化性能）
        window.addEventListener('resize', throttle(function() {
            if (chart) {
                chart.resize();
            }
        }, 100));
