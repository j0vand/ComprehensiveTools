         * 个税计算器逻辑核心
         * 保持原逻辑不变
         */
        const TaxCalculator = {
            // 2024年个人所得税税率表（综合所得 - 年度）
            brackets: [
                { limit: 36000, rate: 0.03, deduction: 0 },
                { limit: 144000, rate: 0.1, deduction: 2520 },
                { limit: 300000, rate: 0.2, deduction: 16920 },
                { limit: 420000, rate: 0.25, deduction: 31920 },
                { limit: 660000, rate: 0.3, deduction: 52920 },
                { limit: 960000, rate: 0.35, deduction: 85920 },
                { limit: Infinity, rate: 0.45, deduction: 181920 }
            ],

            // 年终奖单独计税税率表（按月换算后的综合所得税率表）
            // 注意：这里的limit是月均金额的上限，不是年度金额
            bonusBrackets: [
                { limit: 3000, rate: 0.03, deduction: 0 },
                { limit: 12000, rate: 0.1, deduction: 210 },
                { limit: 25000, rate: 0.2, deduction: 1410 },
                { limit: 35000, rate: 0.25, deduction: 2660 },
                { limit: 55000, rate: 0.3, deduction: 4410 },
                { limit: 80000, rate: 0.35, deduction: 7160 },
                { limit: Infinity, rate: 0.45, deduction: 15160 }
            ],

            // 社保比例配置 (仅供参考，实际各地区不同)
            SOCIAL_RATE: 0.105,

            // 计算单月个税（基于累计预扣预缴法）
            calculate: function(config) {
                const results = [];
                let cumulativeIncome = 0; // 累计收入
                let cumulativeDeduction = 0; // 累计减除费用
                let cumulativeSpecial = 0; // 累计专项扣除
                let cumulativeAdditional = 0; // 累计专项附加扣除
                let cumulativeTaxPaid = 0; // 累计已缴纳税额

                // 1. 计算五险一金 (初始状态)
                // 计算社保和公积金详情 (用于汇总显示)
                let currentSocialBase = config.socialBase;
                let currentFundBase = config.fundBase || config.baseSalary;
                let currentFundRate = config.fundRate;
                let currentSpecialDeduction = config.specialDeduction;
                let currentBaseSalary = config.baseSalary;

                // 2. 遍历12个月
                let prevTaxableIncome = 0; // 上月累计应纳税所得额

                for (let month = 1; month <= 12; month++) {
                    // 换工作逻辑：如果启用了换工作且当前月是换工作月份
                    // 则重置累计值，重新开始计算，并更新参数
                    if (config.isJobChange && config.jobChangeMonth == month) {
                        cumulativeIncome = 0;
                        cumulativeDeduction = 0;
                        cumulativeSpecial = 0;
                        cumulativeAdditional = 0;
                        cumulativeTaxPaid = 0;
                        prevTaxableIncome = 0;
                        
                        // 更新为新公司参数 (如果未填写则沿用旧参数)
                        if (config.newBaseSalary) currentBaseSalary = config.newBaseSalary;
                        if (config.newSocialBase) currentSocialBase = config.newSocialBase;
                        if (config.newFundBase) currentFundBase = config.newFundBase;
                        if (config.newFundRate) currentFundRate = config.newFundRate;
                        if (config.newSpecialDeduction) currentSpecialDeduction = config.newSpecialDeduction;
                    }

                    // 计算当月五险一金
                    const socialDetail = currentSocialBase * this.SOCIAL_RATE;
                    const fundDetail = currentFundBase * (currentFundRate / 100);
                    const monthlyInsurance = socialDetail + fundDetail;

                    const isBonusTaxMonth = config.bonusTaxMonth == month;
                    
                    let currentBonus = parseFloat(config.bonuses[month] || 0);
                    let bonusForComprehensive = currentBonus; // 并入综合所得
                    let bonusForSeparate = 0; // 单独计税

                    if (isBonusTaxMonth && currentBonus > 0) {
                        bonusForSeparate = currentBonus;
                        bonusForComprehensive = 0;
                    }

                    const monthIncome = currentBaseSalary + bonusForComprehensive;
                    
                    cumulativeIncome += monthIncome;
                    cumulativeDeduction += 5000;
                    cumulativeSpecial += monthlyInsurance;
                    cumulativeAdditional += currentSpecialDeduction;

                    const taxableIncome = Math.max(0, cumulativeIncome - cumulativeDeduction - cumulativeSpecial - cumulativeAdditional);

                    // 计算跨档位详情
                    const segmentDetails = this.getSegmentDetails(prevTaxableIncome, taxableIncome);
                    
                    // 更新上月累计值，供下月使用
                    prevTaxableIncome = taxableIncome;

                    const taxTotal = this.getTax(taxableIncome);
                    const currentTax = Math.max(0, taxTotal - cumulativeTaxPaid); 
                    
                    // 修正浮点数精度问题
                    const currentTaxFixed = Number(currentTax.toFixed(2));
                    cumulativeTaxPaid += currentTaxFixed; // 使用修正后的当月税额累加

                    const actualIncome = monthIncome - monthlyInsurance - currentTaxFixed;

                    results.push({
                        month,
                        income: monthIncome,
                        insurance: monthlyInsurance,
                        socialDetail: socialDetail, // 社保部分
                        fundDetail: fundDetail,     // 公积金部分
                        taxableIncome,
                        tax: currentTaxFixed,
                        actual: Number(actualIncome.toFixed(2)), // 实际到手也保留两位
                        rate: this.getRate(taxableIncome),
                        isBonusMonth: isBonusTaxMonth,
                        bonusSeparate: bonusForSeparate,
                        segments: segmentDetails, // 纳税分段详情
                        isJobChangeMonth: config.isJobChange && config.jobChangeMonth == month // 标记换工作月份
                    });
                }
                return results;
            },

            // 计算区间内的纳税分段详情
            getSegmentDetails: function(startIncome, endIncome) {
                if (endIncome <= startIncome) return [];
                
                const segments = [];
                let currentLower = 0;

                for (const bracket of this.brackets) {
                    // 当前档位的区间 [currentLower, bracket.limit]
                    // 纳税区间的交集 [startIncome, endIncome]
                    
                    // 计算重叠部分的下限和上限
                    const overlapStart = Math.max(startIncome, currentLower);
                    const overlapEnd = Math.min(endIncome, bracket.limit);
                    
                    if (overlapEnd > overlapStart) {
                        const amount = overlapEnd - overlapStart;
                        segments.push({
                            rate: bracket.rate,
                            amount: amount,
                            tax: amount * bracket.rate
                        });
                    }
                    
                    if (bracket.limit >= endIncome) break;
                    currentLower = bracket.limit;
                }
                
                return segments;
            },

            // 计算年终奖的分段详情（用于显示各档位税额）
            // 按照分段累进方式计算，展示各档位的税额分解
            // 注意：虽然官方公式是总额×税率-速算扣除数，但这里按分段累进方式展示各档位税额
            getBonusSegmentDetails: function(bonus) {
                if (bonus <= 0) return [];
                
                const avg = bonus / 12; // 月均金额
                const segments = [];
                let currentLower = 0;
                
                // 按照月均金额的档位，将奖金总额分段计算
                // 每个档位的年度上限 = 月均上限 × 12
                for (const bracket of this.bonusBrackets) {
                    // 当前档位的月均上限
                    const monthlyUpper = bracket.limit;
                    // 当前档位的年度上限（月均上限 × 12）
                    const annualUpper = monthlyUpper * 12;
                    
                    // 计算当前档位应该计算的金额
                    const segmentStart = Math.max(currentLower, 0);
                    const segmentEnd = Math.min(annualUpper, bonus);
                    
                    if (segmentEnd > segmentStart) {
                        const segmentAmount = segmentEnd - segmentStart;
                        const segmentTax = segmentAmount * bracket.rate;
                        
                        segments.push({
                            rate: bracket.rate,
                            amount: segmentAmount,
                            tax: segmentTax
                        });
                    }
                    
                    // 如果奖金总额已经在这个档位内，停止计算
                    if (bonus <= annualUpper) break;
                    
                    currentLower = annualUpper;
                }
                
                return segments;
            },

            // 计算单独计税奖金的税额
            // 根据政策：将奖金除以12得到月均金额，查找对应税率和速算扣除数
            // 应纳税额 = 奖金总额 × 适用税率 - 速算扣除数
            calculateBonusTax: function(bonus) {
                if (bonus <= 0) return { 
                    tax: 0, 
                    actual: 0, 
                    rate: 0, 
                    avgAmount: 0,
                    bracket: null,
                    segments: []
                };
                
                // 将奖金除以12，得到月均金额
                const avg = bonus / 12;
                
                // 使用年终奖专用税率表（按月换算后的综合所得税率表）
                const bracket = this.bonusBrackets.find(b => avg <= b.limit);
                
                // 计算公式：应纳税额 = 全年一次性奖金 × 适用税率 - 速算扣除数
                const tax = bonus * bracket.rate - bracket.deduction;
                
                // 计算分段详情（用于显示各档位税额）
                const segments = this.getBonusSegmentDetails(bonus);
                
                return {
                    tax: Math.max(0, tax),
                    actual: bonus - tax,
                    rate: bracket.rate,
                    avgAmount: avg, // 月均金额
                    bracket: bracket, // 档位信息
                    segments: segments // 分段详情
                };
            },

            getTax: function(income) {
                if (income <= 0) return 0;
                const bracket = this.brackets.find(b => income <= b.limit);
                return income * bracket.rate - bracket.deduction;
            },

            getRate: function(income) {
                if (income <= 0) return 0;
                const bracket = this.brackets.find(b => income <= b.limit);
                return bracket.rate;
            }
        };

        /**
         * 应用逻辑与UI控制
         */
        const app = {
            state: {
                baseSalary: '',
                specialDeduction: 1500,
                socialBase: 5000,
                fundBase: '',
                fundRate: 5,
                bonusTaxMonth: '',
                bonuses: {},
                jobChangeMonth: '',
                // 新公司参数
                newBaseSalary: '',
                newSocialBase: '',
                newFundBase: '',
                newFundRate: '',
                newSpecialDeduction: ''
            },
            
            isBonusVisible: false,
            isJobChangeVisible: false, // 新增：控制换工作区域显示

            init: function() {
                this.loadState();
                this.renderBonusInputs();
                this.restoreUI();
                this.initEventListeners();
            },

            initEventListeners: function() {
                // 帮助按钮
                const helpBtn = document.getElementById('help-btn');
                if (helpBtn) {
                    helpBtn.addEventListener('click', () => this.showHelp());
                }

                // 关闭帮助按钮
                const closeHelpBtn = document.getElementById('close-help-btn');
                if (closeHelpBtn) {
                    closeHelpBtn.addEventListener('click', () => this.hideHelp());
                }

                // 帮助弹窗背景点击关闭
                const helpModal = document.getElementById('helpModal');
                if (helpModal) {
                    helpModal.addEventListener('click', (e) => {
                        if (e.target === helpModal) {
                            this.hideHelp();
                        }
                    });
                }

                // 切换奖金设置
                const toggleBonusBtn = document.getElementById('toggleBonusBtn');
                if (toggleBonusBtn) {
                    toggleBonusBtn.addEventListener('click', () => this.toggleBonus());
                }

                // 切换换工作设置
                const toggleJobChangeBtn = document.getElementById('toggleJobChangeBtn');
                if (toggleJobChangeBtn) {
                    toggleJobChangeBtn.addEventListener('click', () => this.toggleJobChange());
                }

                // 清空奖金按钮
                const clearBonusesBtn = document.getElementById('clear-bonuses-btn');
                if (clearBonusesBtn) {
                    clearBonusesBtn.addEventListener('click', () => this.clearBonuses());
                }

                // 计算按钮
                const calculateBtn = document.getElementById('calculate-tax-btn');
                if (calculateBtn) {
                    calculateBtn.addEventListener('click', () => this.calculate());
                }

                // 换工作月份选择器变化事件
                const jobChangeMonthSelect = document.getElementById('jobChangeMonth');
                if (jobChangeMonthSelect) {
                    jobChangeMonthSelect.addEventListener('change', () => {
                        this.toggleNewCompanyInputs();
                        this.saveState();
                    });
                }

                // 年终奖单独计税月份选择器变化事件
                const bonusTaxMonthSelect = document.getElementById('bonusTaxMonth');
                if (bonusTaxMonthSelect) {
                    bonusTaxMonthSelect.addEventListener('change', () => this.saveState());
                }

                // 新公司相关输入框变化事件（添加验证）
                const newCompanyInputs = ['newBaseSalary', 'newSocialBase', 'newFundBase', 'newFundRate', 'newSpecialDeduction'];
                newCompanyInputs.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.addEventListener('input', () => {
                            this.saveState();
                            this.validateInput(id);
                        });
                    }
                });

                // 基础输入框变化事件（需要保存状态和验证）
                const baseSalaryInput = document.getElementById('baseSalary');
                if (baseSalaryInput) {
                    baseSalaryInput.addEventListener('input', () => {
                        this.saveState();
                        this.validateInput('baseSalary');
                    });
                }

                const specialDeductionInput = document.getElementById('specialDeduction');
                if (specialDeductionInput) {
                    specialDeductionInput.addEventListener('input', () => {
                        this.saveState();
                        this.validateInput('specialDeduction');
                    });
                }

                // 其他基础输入框变化事件（添加验证）
                const basicInputs = ['socialBase', 'fundBase', 'fundRate'];
                basicInputs.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) {
                        input.addEventListener('input', () => {
                            this.saveState();
                            this.validateInput(id);
                        });
                    }
                });

                // 奖金输入框变化事件（动态生成，使用事件委托，添加验证）
                const bonusInputsContainer = document.getElementById('bonusInputs');
                if (bonusInputsContainer) {
                    bonusInputsContainer.addEventListener('input', (e) => {
                        if (e.target && e.target.id && e.target.id.startsWith('bonus_m')) {
                            this.saveState();
                            this.validateInput(e.target.id);
                        }
                    });
                }
            },

            saveState: function() {
                // 获取元素值的辅助函数（正确处理0值）
                const getElementVal = (id, type = 'float', defaultValue = 0) => {
                    if (window.CommonUtils && window.CommonUtils.getElementValue) {
                        return window.CommonUtils.getElementValue(id, type, defaultValue);
                    }
                    // 降级处理
                    const el = document.getElementById(id);
                    if (!el) return defaultValue;

                    const value = el.value.trim();
                    if (value === '') return defaultValue;

                    const parsedValue = type === 'int' ? parseInt(value) : parseFloat(value);
                    return isNaN(parsedValue) ? defaultValue : parsedValue;
                };

                const getVal = (id) => {
                    const el = document.getElementById(id);
                    return el ? el.value : '';
                };

                this.state.baseSalary = getElementVal('baseSalary', 'float', 0);
                this.state.specialDeduction = getElementVal('specialDeduction', 'float', 0);
                this.state.socialBase = getElementVal('socialBase', 'float', 0);
                this.state.fundBase = getElementVal('fundBase', 'float', 0);
                this.state.fundRate = getElementVal('fundRate', 'float', 0);
                this.state.bonusTaxMonth = getVal('bonusTaxMonth');
                this.state.jobChangeMonth = getVal('jobChangeMonth');

                // 保存新公司参数
                this.state.newBaseSalary = getElementVal('newBaseSalary', 'float', 0);
                this.state.newSocialBase = getElementVal('newSocialBase', 'float', 0);
                this.state.newFundBase = getElementVal('newFundBase', 'float', 0);
                this.state.newFundRate = getElementVal('newFundRate', 'float', 0);
                this.state.newSpecialDeduction = getElementVal('newSpecialDeduction', 'float', 0);

                for(let i=1; i<=12; i++) {
                    this.state.bonuses[i] = getElementVal(`bonus_m${i}`, 'float', 0);
                }

                // 使用统一的存储键名和函数
                const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.TAX_CALCULATOR_DATA) || 'tax_calculator_state';
                if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
                    window.CommonUtils.setLocalStorageItem(STORAGE_KEY, this.state);
                } else {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
                }
            },

            loadState: function() {
                // 使用统一的存储键名和函数
                const STORAGE_KEY = (window.StorageKeys && window.StorageKeys.TAX_CALCULATOR_DATA) || 'tax_calculator_state';
                let parsed = null;
                
                if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
                    // 公共工具库已经返回解析后的对象，直接使用
                    parsed = window.CommonUtils.getLocalStorageItem(STORAGE_KEY, null);
                } else {
                    // 降级处理：使用原生 localStorage
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) {
                        try {
                            parsed = JSON.parse(saved);
                        } catch (e) {
                            console.error('Failed to parse saved state', e);
                        }
                    }
                }
                
                if (parsed) {
                    this.state = { ...this.state, ...parsed };
                }
            },

            restoreUI: function() {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if(el) el.value = val;
                };

                setVal('baseSalary', this.state.baseSalary || '');
                setVal('specialDeduction', this.state.specialDeduction);
                setVal('socialBase', this.state.socialBase);
                setVal('fundBase', this.state.fundBase);
                setVal('fundRate', this.state.fundRate);
                setVal('bonusTaxMonth', this.state.bonusTaxMonth);
                setVal('jobChangeMonth', this.state.jobChangeMonth); 
                
                // 恢复新公司参数
                setVal('newBaseSalary', this.state.newBaseSalary);
                setVal('newSocialBase', this.state.newSocialBase);
                setVal('newFundBase', this.state.newFundBase);
                setVal('newFundRate', this.state.newFundRate);
                setVal('newSpecialDeduction', this.state.newSpecialDeduction);
                
                for(let i=1; i<=12; i++) {
                    if(this.state.bonuses[i]) {
                        setVal(`bonus_m${i}`, this.state.bonuses[i]);
                    }
                }

                const hasBonus = Object.values(this.state.bonuses).some(v => v > 0);
                if (hasBonus) {
                    this.isBonusVisible = true;
                    this.updateBonusUI();
                }

                if (this.state.jobChangeMonth) {
                    this.isJobChangeVisible = true;
                    this.updateJobChangeUI();
                    this.toggleNewCompanyInputs(); // 确保新公司输入框显示状态正确
                }
            },

            renderBonusInputs: function() {
                const container = document.getElementById('bonusInputs');
                let html = '';
                for (let i = 1; i <= 12; i++) {
                    html += `
                        <div class="bonus-item">
                            <label>${i}月</label>
                            <input type="number" id="bonus_m${i}" class="input-field" placeholder="0">
                        </div>
                    `;
                }
                container.innerHTML = html;
            },

            toggleBonus: function() {
                this.isBonusVisible = !this.isBonusVisible;
                this.updateBonusUI();
            },
            
            toggleJobChange: function() {
                this.isJobChangeVisible = !this.isJobChangeVisible;
                this.updateJobChangeUI();
            },

            updateBonusUI: function() {
                const section = document.getElementById('bonusSection');
                const btnText = document.getElementById('bonusBtnText');
                const arrow = document.getElementById('bonusArrow');

                if (this.isBonusVisible) {
                    section.classList.add('show');
                    btnText.textContent = '收起奖金设置';
                    arrow.style.transform = 'rotate(180deg)';
                } else {
                    section.classList.remove('show');
                    btnText.textContent = '展开奖金设置';
                    arrow.style.transform = 'rotate(0deg)';
                }
            },

            updateJobChangeUI: function() {
                const section = document.getElementById('jobChangeSection');
                const btnText = document.getElementById('jobChangeBtnText');
                const arrow = document.getElementById('jobChangeArrow');

                if (this.isJobChangeVisible) {
                    section.classList.add('show');
                    btnText.textContent = '收起换工作设置';
                    arrow.style.transform = 'rotate(180deg)';
                } else {
                    section.classList.remove('show');
                    btnText.textContent = '年度中间换工作?';
                    arrow.style.transform = 'rotate(0deg)';
                }
            },

            toggleNewCompanyInputs: function() {
                const month = document.getElementById('jobChangeMonth').value;
                const inputs = document.getElementById('newCompanyInputs');
                this.saveState();
                
                if (month) {
                    inputs.style.display = 'block';
                    // 自动滚动到底部
                    setTimeout(() => {
                       inputs.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                } else {
                    inputs.style.display = 'none';
                }
            },

            clearBonuses: function() {
                for(let i=1; i<=12; i++) {
                    const el = document.getElementById(`bonus_m${i}`);
                    if(el) el.value = '';
                    this.state.bonuses[i] = 0;
                }
                const elMonth = document.getElementById('bonusTaxMonth');
                if(elMonth) elMonth.value = '';
                this.state.bonusTaxMonth = '';
                this.saveState();
            },

            calculate: function() {
                if (!this.state.baseSalary && this.state.baseSalary !== 0) {
                    this.showToast('请输入基础月薪', 'error');
                    document.getElementById('baseSalary').focus();
                    return;
                }

                const config = {
                    baseSalary: Number(this.state.baseSalary),
                    specialDeduction: Number(this.state.specialDeduction),
                    socialBase: Number(this.state.socialBase),
                    fundBase: Number(this.state.fundBase) || Number(this.state.baseSalary),
                    fundRate: Number(this.state.fundRate),
                    bonusTaxMonth: this.state.bonusTaxMonth,
                    bonuses: this.state.bonuses,
                    isJobChange: !!this.state.jobChangeMonth,
                    jobChangeMonth: this.state.jobChangeMonth,
                    // 新公司配置
                    newBaseSalary: Number(this.state.newBaseSalary),
                    newSocialBase: Number(this.state.newSocialBase),
                    newFundBase: Number(this.state.newFundBase),
                    newFundRate: Number(this.state.newFundRate),
                    newSpecialDeduction: Number(this.state.newSpecialDeduction)
                };

                const monthlyResults = TaxCalculator.calculate(config);
                
                let totalIncome = 0;
                let totalTax = 0;
                let totalActual = 0;
                let totalInsurance = 0;
                let totalSocial = 0; // 社保总计
                let totalFund = 0;   // 公积金总计

                let tableHtml = '';

                monthlyResults.forEach(res => {
                    totalIncome += Number(res.income.toFixed(2));
                    totalTax += Number(res.tax.toFixed(2));
                    totalActual += Number(res.actual.toFixed(2));
                    totalInsurance += Number(res.insurance.toFixed(2));
                    totalSocial += Number(res.socialDetail.toFixed(2));
                    totalFund += Number(res.fundDetail.toFixed(2));

                    // 判断是否跨档位
                    const isCrossBracket = res.segments && res.segments.length > 1;
                    let rowClass = isCrossBracket ? 'cross-bracket-row' : '';
                    if (res.isJobChangeMonth) rowClass += ' job-change-row'; // 标记换工作行
                    
                    // 构建税率显示
                    let rateDisplay = '';
                    let taxDetailDisplay = '';
                    
                    if (isCrossBracket) {
                        // 跨档位显示
                        const rates = res.segments.map(s => (s.rate * 100).toFixed(0) + '%');
                        rateDisplay = `<span class="rate-badge">${rates.join(' ➔ ')}</span>`;
                        
                        const details = res.segments.map(s => 
                            `<div class="tax-segment">${(s.rate*100).toFixed(0)}%档: ¥${this.formatMoney(s.tax)}</div>`
                        ).join('');
                        
                        taxDetailDisplay = `
                            <div>${this.formatMoney(res.tax)}</div>
                            <div class="tax-details">${details}</div>
                        `;
                    } else {
                        // 普通显示
                        rateDisplay = (res.rate * 100).toFixed(0) + '%';
                        taxDetailDisplay = this.formatMoney(res.tax);
                    }
                    
                    // 换工作提示
                    let monthLabel = `${res.month}月`;
                    if (res.isJobChangeMonth) {
                        monthLabel += `<div class="job-change-badge">新入职</div>`;
                    }

                    tableHtml += `
                        <tr class="${rowClass}">
                            <td>${monthLabel}</td>
                            <td style="font-weight:600;color:var(--primary-dark)">${this.formatMoney(res.actual)}</td>
                            <td>${taxDetailDisplay}</td>
                            <td>${this.formatMoney(res.taxableIncome)}</td>
                            <td>${rateDisplay}</td>
                        </tr>
                    `;

                    if (res.bonusSeparate > 0) {
                        const bonusRes = TaxCalculator.calculateBonusTax(res.bonusSeparate);
                        totalIncome += res.bonusSeparate;
                        totalTax += bonusRes.tax;
                        totalActual += bonusRes.actual;

                        // 构建年终奖档位详情显示（格式与月度跨档位显示保持一致）
                        let bonusTaxDetailDisplay = '';
                        let bonusRateDisplay = '';
                        let bonusRowClass = 'bonus-row';
                        let isBonusCrossBracket = false;
                        
                        if (bonusRes.bracket && bonusRes.segments && bonusRes.segments.length > 0) {
                            const bracketInfo = bonusRes.bracket;
                            const segments = bonusRes.segments;
                            
                            // 判断是否跨档位（有多个分段）
                            isBonusCrossBracket = segments.length > 1;
                            
                            // 构建详细的计算过程说明
                            const ratePercent = (bonusRes.rate * 100).toFixed(0);
                            const bracketIndex = TaxCalculator.bonusBrackets.findIndex(b => b === bracketInfo);
                            const prevLimit = bracketIndex > 0 
                                ? TaxCalculator.bonusBrackets[bracketIndex - 1].limit 
                                : 0;
                            
                            // 构建档位范围显示
                            let bracketRange = '';
                            if (prevLimit > 0) {
                                bracketRange = `¥${this.formatMoney(prevLimit)}-`;
                            }
                            if (bracketInfo.limit === Infinity) {
                                bracketRange += '∞';
                            } else {
                                bracketRange += `¥${this.formatMoney(bracketInfo.limit)}`;
                            }
                            
                            // 计算过程说明
                            let calculationSteps = `
                                <div class="tax-segment" style="color:var(--primary-dark);font-weight:600;">步骤1: 计算月均金额</div>
                                <div class="tax-segment">月均 = ¥${this.formatMoney(res.bonusSeparate)} ÷ 12 = ¥${this.formatMoney(bonusRes.avgAmount)}</div>
                                <div class="tax-segment" style="color:var(--primary-dark);font-weight:600;margin-top:6px;">步骤2: 查找税率和速算扣除数</div>
                                <div class="tax-segment">月均¥${this.formatMoney(bonusRes.avgAmount)}落在${bracketRange}档位</div>
                                <div class="tax-segment">适用税率: ${ratePercent}%，速算扣除数: ¥${this.formatMoney(bracketInfo.deduction)}</div>
                                <div class="tax-segment" style="color:var(--primary-dark);font-weight:600;margin-top:6px;">步骤3: 计算各档位税额</div>
                            `;
                            
                            if (isBonusCrossBracket) {
                                // 跨档位显示：显示各个档位的税额
                                bonusRowClass += ' cross-bracket-row';
                                const rates = segments.map(s => (s.rate * 100).toFixed(0) + '%');
                                bonusRateDisplay = `<span class="rate-badge">${rates.join(' ➔ ')}</span>`;
                                
                                const details = segments.map(s => 
                                    `<div class="tax-segment">${(s.rate*100).toFixed(0)}%档(¥${this.formatMoney(s.amount)}): ¥${this.formatMoney(s.tax)}</div>`
                                ).join('');
                                
                                // 计算总额验证
                                const totalSegmentTax = segments.reduce((sum, s) => sum + s.tax, 0);
                                const verification = Math.abs(totalSegmentTax - bonusRes.tax) < 0.01 
                                    ? '' 
                                    : `<div class="tax-segment" style="color:var(--text-sub);font-size:10px;">* 分段合计: ¥${this.formatMoney(totalSegmentTax)}，速算公式: ¥${this.formatMoney(bonusRes.tax)}</div>`;
                                
                                bonusTaxDetailDisplay = `
                                    <div>${this.formatMoney(bonusRes.tax)}</div>
                                    <div class="tax-details">
                                        ${calculationSteps}
                                        ${details}
                                        <div class="tax-segment" style="color:var(--primary-dark);font-weight:600;margin-top:6px;">合计税额: ¥${this.formatMoney(bonusRes.tax)}</div>
                                        ${verification}
                                    </div>
                                `;
                            } else {
                                // 单档位显示
                                bonusRateDisplay = `<span class="rate-badge">${ratePercent}%</span>`;
                                
                                bonusTaxDetailDisplay = `
                                    <div>${this.formatMoney(bonusRes.tax)}</div>
                                    <div class="tax-details">
                                        ${calculationSteps}
                                        <div class="tax-segment">${ratePercent}%档: ¥${this.formatMoney(bonusRes.tax)}</div>
                                        <div class="tax-segment" style="color:var(--text-sub);font-size:10px;">计算: ¥${this.formatMoney(res.bonusSeparate)} × ${ratePercent}% - ¥${this.formatMoney(bracketInfo.deduction)} = ¥${this.formatMoney(bonusRes.tax)}</div>
                                    </div>
                                `;
                            }
                        } else {
                            bonusRateDisplay = (bonusRes.rate * 100).toFixed(0) + '%';
                            bonusTaxDetailDisplay = this.formatMoney(bonusRes.tax);
                        }

                        tableHtml += `
                            <tr class="${bonusRowClass}">
                                <td>年终奖</td>
                                <td style="font-weight:600">${this.formatMoney(bonusRes.actual)}</td>
                                <td>${bonusTaxDetailDisplay}</td>
                                <td>${this.formatMoney(res.bonusSeparate)}</td>
                                <td>${bonusRateDisplay}</td>
                            </tr>
                        `;
                    }
                });

                document.getElementById('summaryTotalIncome').textContent = this.formatMoney(totalIncome);
                document.getElementById('summaryTotalTax').textContent = this.formatMoney(totalTax);
                document.getElementById('summaryActualIncome').textContent = this.formatMoney(totalActual);
                
                // 更新五险一金汇总详情
                document.getElementById('summaryInsurance').innerHTML = `
                    <div>${this.formatMoney(totalInsurance)}</div>
                    <div style="font-size:11px;color:var(--text-sub);margin-top:2px;">
                        (社保 ${this.formatMoney(totalSocial)} + 公积金 ${this.formatMoney(totalFund)})
                    </div>
                `;
                
                document.getElementById('resultBody').innerHTML = tableHtml;
                
                const resultSection = document.getElementById('resultSection');
                resultSection.classList.add('show');
                
                // 平滑滚动到结果区域
                setTimeout(() => {
                    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            },

            formatMoney: function(num) {
                // 如果是整数（小数部分为0），则不显示小数
                if (Number.isInteger(num)) {
                    return num.toLocaleString('zh-CN');
                }
                // 否则保留两位小数
                return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            },

            showHelp: function() {
                document.getElementById('helpModal').classList.add('show');
            },
            
            hideHelp: function() {
                document.getElementById('helpModal').classList.remove('show');
            },
            
            showToast: function(message, type = 'info') {
                // 移除已存在的toast
                const existingToast = document.querySelector('.toast');
                if (existingToast) {
                    existingToast.remove();
                }
                
                // 创建新的toast
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                
                // 3秒后自动移除
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(20px)';
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }, 3000);
            },
            
            validateInput: function(inputId) {
                const input = document.getElementById(inputId);
                const inputGroup = input.closest('.input-group');
                const value = parseFloat(input.value);
                
                if (input.value && (isNaN(value) || value < 0)) {
                    inputGroup.classList.add('error');
                    return false;
                } else {
                    inputGroup.classList.remove('error');
                    return true;
                }
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            app.init();
