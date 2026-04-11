        function switchCalculator(type) {
            // 隐藏所有计算器
            document.querySelectorAll('.calculator-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // 显示选中的计算器
            document.getElementById(type).classList.add('active');
            
            // 更新按钮状态
            document.querySelectorAll('.type-button').forEach(button => {
                button.classList.remove('active');
                if (button.getAttribute('data-calc-type') === type) {
                    button.classList.add('active');
                }
            });
        }

        function formatMoney(number) {
            return new Intl.NumberFormat('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(number);
        }
        
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

        // 复利计算
        function calculateCompound() {
            const principal = getElementValue('compoundPrincipal', 'float', 0);
            const rate = getElementValue('compoundRate', 'float', 0);
            const years = getElementValue('compoundYears', 'float', 0);
            
            // 验证输入
            if (principal <= 0 || years <= 0) {
                showToast('请输入有效的本金和投资年限', 'error');
                return;
            }
            
            // 计算最终金额，使用精确的指数计算
            const annualRate = rate / 100;
            const total = parseFloat((principal * Math.pow(1 + annualRate, years)).toFixed(2));
            const interest = parseFloat((total - principal).toFixed(2));
            
            // 更新总体结果
            document.getElementById('compoundResult').style.display = 'block';
            document.getElementById('compoundPrincipalResult').textContent = formatMoney(principal) + '元';
            document.getElementById('compoundInterestResult').textContent = formatMoney(interest) + '元';
            document.getElementById('compoundTotalResult').textContent = formatMoney(total) + '元';
            
            // 生成年度明细
            const tbody = document.getElementById('yearlyTable').querySelector('tbody');
            tbody.innerHTML = '';
            
            let currentPrincipal = principal;
            for (let year = 1; year <= years; year++) {
                const yearStartAmount = currentPrincipal;
                const yearlyInterest = parseFloat((yearStartAmount * annualRate).toFixed(2));
                currentPrincipal = parseFloat((yearStartAmount + yearlyInterest).toFixed(2));
                const cumulativeRate = parseFloat(((currentPrincipal / principal - 1) * 100).toFixed(2));
                
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${year}</td>
                    <td>${formatMoney(yearStartAmount)}元</td>
                    <td>${formatMoney(yearlyInterest)}元</td>
                    <td>${formatMoney(currentPrincipal)}元</td>
                    <td>${cumulativeRate}%</td>
                `;
            }
        }

        // 贷款计算
        function calculateLoan() {
            const amount = getElementValue('loanAmount', 'float', 0);
            const rate = getElementValue('loanRate', 'float', 0);
            const years = getElementValue('loanYears', 'float', 0);

            const monthlyRate = rate / 100 / 12;
            const totalMonths = years * 12;
            
            const monthlyPayment = amount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) 
                                / (Math.pow(1 + monthlyRate, totalMonths) - 1);
            const totalPayment = monthlyPayment * totalMonths;
            const totalInterest = totalPayment - amount;

            // 更新总体结果
            document.getElementById('loanResult').style.display = 'block';
            document.getElementById('monthlyPaymentResult').textContent = formatMoney(monthlyPayment) + '元';
            document.getElementById('totalPaymentResult').textContent = formatMoney(totalPayment) + '元';
            document.getElementById('totalInterestResult').textContent = formatMoney(totalInterest) + '元';

            // 生成还款计划明细
            const tbody = document.getElementById('loanTable').getElementsByTagName('tbody')[0];
            tbody.innerHTML = '';
            
            let remainingPrincipal = amount;
            for (let month = 1; month <= totalMonths; month++) {
                const monthlyInterest = remainingPrincipal * monthlyRate;
                const monthlyPrincipal = monthlyPayment - monthlyInterest;
                remainingPrincipal -= monthlyPrincipal;

                if (month % 12 === 1 || month === totalMonths) { // 只显示每年第一个月和最后一个月
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>第${month}期</td>
                        <td>${formatMoney(monthlyPayment)}元</td>
                        <td>${formatMoney(monthlyPrincipal)}元</td>
                        <td>${formatMoney(monthlyInterest)}元</td>
                        <td>${formatMoney(Math.max(0, remainingPrincipal))}元</td>
                    `;
                }
            }
        }

        // 定投收益计算
        function calculateInvestment() {
            const amount = getElementValue('investmentAmount', 'float', 0);
            const period = document.getElementById('investmentPeriod').value;
            const rate = getElementValue('investmentRate', 'float', 0);
            const years = getElementValue('investmentYears', 'float', 0);

            // 计算不同周期的参数
            const periodsPerYear = {
                'week': 52,
                'month': 12,
                'quarter': 4,
                'year': 1
            }[period];

            const periodRate = rate / 100 / periodsPerYear;
            const totalPeriods = years * periodsPerYear;
            
            // 生成所有投资期间的数据
            let periodData = [];
            let currentAmount = 0;
            let totalInvestment = 0;
            
            for (let p = 1; p <= totalPeriods; p++) {
                const periodStartAmount = currentAmount;
                totalInvestment += amount;
                
                currentAmount = (currentAmount + amount) * (1 + periodRate);
                const periodInterest = currentAmount - periodStartAmount - amount;
                const totalReturn = ((currentAmount - totalInvestment) / totalInvestment * 100);
                
                periodData.push({
                    period: p,
                    startAmount: periodStartAmount,
                    investment: amount,
                    interest: periodInterest,
                    endAmount: currentAmount,
                    totalReturn: totalReturn
                });
            }

            // 更新总体结果
            document.getElementById('investmentResult').style.display = 'block';
            document.getElementById('totalInvestmentResult').textContent = formatMoney(totalInvestment) + '元';
            document.getElementById('investmentInterestResult').textContent = formatMoney(currentAmount - totalInvestment) + '元';
            document.getElementById('investmentTotalResult').textContent = formatMoney(currentAmount) + '元';

            // 保存数据用于切换视图
            window.investmentData = {
                periodData: periodData,
                periodsPerYear: periodsPerYear,
                period: period
            };

            // 默认显示年度视图
            switchInvestmentView('year');
        }

        // 切换投资明细视图
        function switchInvestmentView(viewType) {
            if (!window.investmentData) return;

            // 更新按钮状态
            document.querySelectorAll('.period-button[data-view-type="investment"]').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-period') === viewType) {
                    btn.classList.add('active');
                }
            });

            const { periodData, periodsPerYear, period } = window.investmentData;
            const tbody = document.getElementById('investmentTable').getElementsByTagName('tbody')[0];
            tbody.innerHTML = '';

            let displayData = [];
            
            if (viewType === 'year') {
                // 按年汇总数据
                for (let year = 0; year < periodData.length / periodsPerYear; year++) {
                    const yearStart = year * periodsPerYear;
                    const yearEnd = Math.min((year + 1) * periodsPerYear, periodData.length);
                    const yearData = periodData.slice(yearStart, yearEnd);
                    
                    const startAmount = yearData[0].startAmount;
                    const investment = yearData.reduce((sum, d) => sum + d.investment, 0);
                    const interest = yearData.reduce((sum, d) => sum + d.interest, 0);
                    const endAmount = yearData[yearData.length - 1].endAmount;
                    const totalReturn = yearData[yearData.length - 1].totalReturn;

                    displayData.push({
                        label: `第${year + 1}年`,
                        startAmount,
                        investment,
                        interest,
                        endAmount,
                        totalReturn
                    });
                }
            } else if (viewType === 'quarter') {
                // 按季度汇总数据
                const periodsPerQuarter = periodsPerYear / 4;
                for (let q = 0; q < periodData.length / periodsPerQuarter; q++) {
                    const quarterStart = q * periodsPerQuarter;
                    const quarterEnd = Math.min((q + 1) * periodsPerQuarter, periodData.length);
                    const quarterData = periodData.slice(quarterStart, quarterEnd);
                    
                    const year = Math.floor(q / 4) + 1;
                    const quarter = (q % 4) + 1;
                    const startAmount = quarterData[0].startAmount;
                    const investment = quarterData.reduce((sum, d) => sum + d.investment, 0);
                    const interest = quarterData.reduce((sum, d) => sum + d.interest, 0);
                    const endAmount = quarterData[quarterData.length - 1].endAmount;
                    const totalReturn = quarterData[quarterData.length - 1].totalReturn;

                    displayData.push({
                        label: `第${year}年Q${quarter}`,
                        startAmount,
                        investment,
                        interest,
                        endAmount,
                        totalReturn
                    });
                }
            } else if (viewType === 'month') {
                // 显示月度数据（仅当期数不太多时）
                if (periodData.length <= 120) { // 最多显示10年的月度数据
                    periodData.forEach((data, index) => {
                        const year = Math.floor(index / 12) + 1;
                        const month = (index % 12) + 1;
                        displayData.push({
                            label: `第${year}年${month}月`,
                            startAmount: data.startAmount,
                            investment: data.investment,
                            interest: data.interest,
                            endAmount: data.endAmount,
                            totalReturn: data.totalReturn
                        });
                    });
                } else {
                    showToast('数据过多，请选择年度或季度视图', 'warning');
                    return;
                }
            }

            // 渲染数据
            displayData.forEach(data => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${data.label}</td>
                    <td>${formatMoney(data.startAmount)}元</td>
                    <td>${formatMoney(data.investment)}元</td>
                    <td>${formatMoney(data.interest)}元</td>
                    <td>${formatMoney(data.endAmount)}元</td>
                    <td>${data.totalReturn.toFixed(2)}%</td>
                `;
            });
        }

        // 修复目标规划计算功能
        function calculateTarget() {
            const target = getElementValue('targetAmount', 'float', 0);
            const period = document.getElementById('targetPeriod').value;
            const duration = getElementValue('targetDuration', 'float', 0);
            const rate = getElementValue('targetRate', 'float', 0);
            
            // 验证输入
            if (target <= 0 || duration <= 0) {
                showToast('请输入有效的目标金额和时间', 'error');
                return;
            }

            // 计算不同周期的参数
            const periodsPerYear = {
                'day': 365,
                'week': 52,
                'month': 12,
                'quarter': 4,
                'year': 1
            }[period];

            // 转换年化利率为相应周期的利率
            const periodRate = Math.pow(1 + rate / 100, 1 / periodsPerYear) - 1;
            const totalPeriods = Math.floor(duration);
            
            // 使用更准确的财务公式计算每期所需投入
            // PMT = FV * r / ((1 + r)^n - 1)，其中FV是未来值，r是周期利率，n是周期数
            let periodRequired = 0;
            if (periodRate > 0) {
                periodRequired = target * periodRate / (Math.pow(1 + periodRate, totalPeriods) - 1);
            } else {
                periodRequired = target / totalPeriods; // 如果利率为0，简单平均
            }
            
            // 避免精度问题
            periodRequired = parseFloat(periodRequired.toFixed(2));
            const totalRequired = periodRequired * totalPeriods;
            const totalInterest = target - totalRequired;

            // 生成每期计划明细
            let periodData = [];
            let currentAmount = 0;
            let totalInvestment = 0;
            
            for (let p = 1; p <= totalPeriods; p++) {
                const periodStartAmount = currentAmount;
                totalInvestment += periodRequired;
                
                const periodInterest = parseFloat((currentAmount * periodRate).toFixed(2));
                currentAmount = parseFloat((currentAmount + periodRequired + periodInterest).toFixed(2));
                
                const progress = parseFloat((currentAmount / target * 100).toFixed(2));
                const remainingToTarget = Math.max(0, parseFloat((target - currentAmount).toFixed(2)));
                
                periodData.push({
                    period: p,
                    startAmount: periodStartAmount,
                    investment: periodRequired,
                    interest: periodInterest,
                    endAmount: currentAmount,
                    progress: progress,
                    remaining: remainingToTarget
                });
            }

            // 更新总体结果
            document.getElementById('targetResult').style.display = 'block';
            document.getElementById('periodRequiredResult').textContent = `${formatMoney(periodRequired)}元/${period}`;
            document.getElementById('totalRequiredResult').textContent = formatMoney(totalRequired) + '元';
            document.getElementById('targetInterestResult').textContent = formatMoney(totalInterest) + '元';

            // 保存数据用于切换视图
            window.targetData = {
                periodData: periodData,
                periodsPerYear: periodsPerYear,
                period: period,
                target: target
            };

            // 默认显示年度视图
            switchTargetView('year');
        }

        // 切换目标规划明细视图
        function switchTargetView(viewType) {
            if (!window.targetData) return;

            // 更新按钮状态
            document.querySelectorAll('.period-button[data-view-type="target"]').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-period') === viewType) {
                    btn.classList.add('active');
                }
            });

            const { periodData, periodsPerYear, period, target } = window.targetData;
            const tbody = document.getElementById('targetTable').getElementsByTagName('tbody')[0];
            tbody.innerHTML = '';

            let displayData = [];
            const periodsPerView = {
                'year': periodsPerYear,
                'quarter': periodsPerYear / 4,
                'month': periodsPerYear / 12,
                'week': periodsPerYear / 52
            }[viewType];

            // 根据视图类型聚合数据
            if (periodData.length > periodsPerView) {
                for (let i = 0; i < periodData.length / periodsPerView; i++) {
                    const periodStart = i * periodsPerView;
                    const periodEnd = Math.min((i + 1) * periodsPerView, periodData.length);
                    const periodSlice = periodData.slice(periodStart, periodEnd);
                    
                    const startAmount = periodSlice[0].startAmount;
                    const investment = periodSlice.reduce((sum, d) => sum + d.investment, 0);
                    const interest = periodSlice.reduce((sum, d) => sum + d.interest, 0);
                    const endAmount = periodSlice[periodSlice.length - 1].endAmount;
                    const progress = (endAmount / target * 100);
                    const remaining = Math.max(0, target - endAmount);

                    let label = '';
                    switch(viewType) {
                        case 'year':
                            label = `第${i + 1}年`;
                            break;
                        case 'quarter':
                            label = `第${Math.floor(i/4) + 1}年Q${(i%4) + 1}`;
                            break;
                        case 'month':
                            label = `第${Math.floor(i/12) + 1}年${(i%12) + 1}月`;
                            break;
                        case 'week':
                            label = `第${Math.floor(i/52) + 1}年第${(i%52) + 1}周`;
                            break;
                    }

                    displayData.push({
                        label,
                        startAmount,
                        investment,
                        interest,
                        endAmount,
                        progress,
                        remaining
                    });
                }
            } else {
                // 如果周期数较少，直接显示原始数据
                displayData = periodData.map((data, index) => ({
                    label: `第${index + 1}${period}`,
                    ...data
                }));
            }

            // 渲染数据
            displayData.forEach(data => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${data.label}</td>
                    <td>${formatMoney(data.startAmount)}元</td>
                    <td>${formatMoney(data.investment)}元</td>
                    <td>${formatMoney(data.interest)}元</td>
                    <td>${formatMoney(data.endAmount)}元</td>
                    <td>${data.progress.toFixed(2)}%</td>
                    <td>${formatMoney(data.remaining)}元</td>
                `;
            });
        }

        // 添加信用卡免息期计算
        function calculateCreditCard() {
            const amount = getElementValue('creditAmount', 'float', 0);
            const periods = getElementValue('creditPeriods', 'int', 0);
            const interestRate = getElementValue('creditRate', 'float', 0);
            
            // 验证输入
            if (amount <= 0 || periods <= 0) {
                showToast('请输入有效的消费金额和免息期数', 'error');
                return;
            }
            
            if (interestRate <= 0) {
                showToast('请输入有效的年化收益率', 'error');
                return;
            }
            
            // 计算每期应还金额（等额分期）
            const monthlyPayment = amount / periods;
            
            // 计算总收益
            // 假设资金在免息期内持续产生收益
            // 每期还款后，剩余本金减少，收益也相应减少
            let totalInterest = 0;
            let remainingPrincipal = amount;
            const monthlyRate = interestRate / 100 / 12; // 月利率
            const daysPerPeriod = 30; // 假设每期30天
            
            // 生成还款计划明细
            const schedule = [];
            let cumulativeInterest = 0;
            
            for (let i = 1; i <= periods; i++) {
                const periodStartPrincipal = remainingPrincipal;
                const periodPayment = monthlyPayment;
                
                // 计算当期收益（基于剩余本金和月利率）
                // 假设资金在整个免息期内平均使用
                const periodInterest = periodStartPrincipal * monthlyRate * (daysPerPeriod / 30);
                cumulativeInterest += periodInterest;
                
                remainingPrincipal -= periodPayment;
                
                // 计算资金使用率（剩余本金/原始金额）
                const usageRate = (periodStartPrincipal / amount * 100).toFixed(2);
                
                schedule.push({
                    period: i,
                    startPrincipal: periodStartPrincipal,
                    payment: periodPayment,
                    remainingPrincipal: Math.max(0, remainingPrincipal),
                    periodInterest: periodInterest,
                    cumulativeInterest: cumulativeInterest,
                    usageRate: usageRate
                });
            }
            
            totalInterest = cumulativeInterest;
            
            // 计算有效年化收益率
            // 总收益 / 原始金额 / (期数/12) * 100
            const effectiveRate = (totalInterest / amount / (periods / 12) * 100).toFixed(2);
            
            // 更新总体结果
            document.getElementById('creditResult').style.display = 'block';
            document.getElementById('creditMonthlyPayment').textContent = formatMoney(monthlyPayment) + '元';
            document.getElementById('creditTotalInterest').textContent = formatMoney(totalInterest) + '元';
            document.getElementById('creditEffectiveRate').textContent = effectiveRate + '%';
            
            // 更新还款计划表格
            const tbody = document.getElementById('creditTable').getElementsByTagName('tbody')[0];
            tbody.innerHTML = '';
            
            schedule.forEach(item => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>第${item.period}期</td>
                    <td>${formatMoney(item.startPrincipal)}元</td>
                    <td>${formatMoney(item.payment)}元</td>
                    <td>${formatMoney(item.remainingPrincipal)}元</td>
                    <td>${formatMoney(item.periodInterest)}元</td>
                    <td>${formatMoney(item.cumulativeInterest)}元</td>
                    <td>${item.usageRate}%</td>
                `;
            });
        }

        // 更新周期单位显示
        function updatePeriodInput() {
            const period = document.getElementById('targetPeriod').value;
            const unitMap = {
                'day': '天',
                'week': '周',
                'month': '月',
                'quarter': '季度',
                'year': '年'
            };
            document.getElementById('periodUnit').textContent = unitMap[period];
        }

        // 保存输入值到localStorage（使用统一的存储键名和函数）
        function saveInputs() {
            const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.FINANCE_CALCULATOR_INPUTS) || 'financeCalculator_inputs';
            const inputs = document.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                input.addEventListener('change', function() {
                    const inputData = {};
                    document.querySelectorAll('input[type="number"]').forEach(inp => {
                        if (inp.value) {
                            inputData[inp.id] = inp.value;
                        }
                    });
                    if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
                        window.CommonUtils.setLocalStorageItem(STORAGE_KEY, inputData);
                    } else {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputData));
                    }
                });
            });
        }

        // 从localStorage加载输入值（使用统一的存储键名和函数）
        function loadInputs() {
            const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.FINANCE_CALCULATOR_INPUTS) || 'financeCalculator_inputs';
            let savedData;
            if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
                savedData = window.CommonUtils.getLocalStorageItem(STORAGE_KEY, {});
            } else {
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    savedData = saved ? JSON.parse(saved) : {};
                } catch (e) {
                    savedData = {};
                }
            }
            const inputs = document.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                if (savedData[input.id]) {
                    input.value = savedData[input.id];
                }
            });
        }

        // 初始化事件监听器
        document.addEventListener('DOMContentLoaded', function() {
            // 计算器类型切换按钮
            document.querySelectorAll('.type-button').forEach(btn => {
                btn.addEventListener('click', function() {
                    const type = this.getAttribute('data-calc-type');
                    switchCalculator(type);
                });
            });

            // 计算按钮
            const calculateCompoundBtn = document.getElementById('calculate-compound-btn');
            if (calculateCompoundBtn) {
                calculateCompoundBtn.addEventListener('click', calculateCompound);
            }

            const calculateLoanBtn = document.getElementById('calculate-loan-btn');
            if (calculateLoanBtn) {
                calculateLoanBtn.addEventListener('click', calculateLoan);
            }

            const calculateInvestmentBtn = document.getElementById('calculate-investment-btn');
            if (calculateInvestmentBtn) {
                calculateInvestmentBtn.addEventListener('click', calculateInvestment);
            }

            const calculateTargetBtn = document.getElementById('calculate-target-btn');
            if (calculateTargetBtn) {
                calculateTargetBtn.addEventListener('click', calculateTarget);
            }

            const calculateCreditCardBtn = document.getElementById('calculate-credit-card-btn');
            if (calculateCreditCardBtn) {
                calculateCreditCardBtn.addEventListener('click', calculateCreditCard);
            }

            // 投资明细视图切换按钮
            document.querySelectorAll('.period-button[data-view-type="investment"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const period = this.getAttribute('data-period');
                    switchInvestmentView(period);
                });
            });

            // 目标规划明细视图切换按钮
            document.querySelectorAll('.period-button[data-view-type="target"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    const period = this.getAttribute('data-period');
                    switchTargetView(period);
                });
            });

            // 目标规划周期选择器变化事件
            const targetPeriodSelect = document.getElementById('targetPeriod');
            if (targetPeriodSelect) {
                targetPeriodSelect.addEventListener('change', updatePeriodInput);
            }

            // 页面加载时初始化
            loadInputs();
            saveInputs();
        });

        // 添加表格横向滚动处理
        function handleTableScroll() {
            const tableWrappers = document.querySelectorAll('.table-wrapper');
            tableWrappers.forEach(wrapper => {
                const hint = wrapper.previousElementSibling;
                if (wrapper.scrollWidth > wrapper.clientWidth) {
                    hint.style.display = 'block';
                } else {
                    hint.style.display = 'none';
                }
            });
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

        // 页面加载和窗口调整时检查表格是否需要滚动（resize 使用节流）
        window.addEventListener('load', handleTableScroll);
        window.addEventListener('resize', throttle(handleTableScroll, 100));
