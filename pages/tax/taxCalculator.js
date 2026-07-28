        /**
         * 个税计算器逻辑核心
         * 基于中国个人所得税法实现累计预扣预缴法计算
         * @namespace TaxCalculator
         * @property {Array} brackets - 综合所得税率表
         * @property {Array} bonusBrackets - 年终奖税率表
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

            // 五险一金比例配置（默认按成都：实际以当地政策为准）
            // 医保：个人 2%，单位比例按页面输入的完整口径计算。
            MEDICAL_PERSONAL_RATE: 0.02,
            MEDICAL_COMPANY_RATE: 0.083,
            // 其他社保合计（养老+失业）：个人 8.4%
            OTHER_SOCIAL_PERSONAL_RATE: 0.084,
            // 其他社保合计（养老+失业）：单位 16.6%
            OTHER_SOCIAL_COMPANY_RATE: 0.166,

            /** 校验个税模型的金额、比例和月份边界，防止非法数值污染全年累计结果。 */
            validateConfig: function(config) {
                if (!config || typeof config !== 'object' || Array.isArray(config)) {
                    return { valid: false, error: '计算参数无效' };
                }
                if (typeof config.isJobChange !== 'boolean') {
                    return { valid: false, error: '换工作状态无效' };
                }

                const maxAmount = Number.MAX_SAFE_INTEGER / 24;
                const amountFields = [
                    ['baseSalary', '基础月薪', false],
                    ['specialDeduction', '专项附加扣除', false],
                    ['socialBase', '社保基数', false],
                    ['fundBase', '公积金基数', true]
                ];
                if (config.isJobChange) {
                    amountFields.push(
                        ['newBaseSalary', '新月薪', true],
                        ['newSocialBase', '新社保基数', true],
                        ['newFundBase', '新公积金基数', true],
                        ['newSpecialDeduction', '新专项扣除', true]
                    );
                }
                for (const [field, label, optional] of amountFields) {
                    const value = config[field];
                    if (optional && (value === '' || value === null || value === undefined)) continue;
                    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maxAmount) {
                        return { valid: false, error: label + '必须是有效的非负金额' };
                    }
                }

                const rateFields = [
                    ['fundRate', '公积金比例', false],
                    ['medicalPersonalRate', '医保个人比例', true],
                    ['medicalCompanyRate', '医保单位比例', true],
                    ['otherSocialPersonalRate', '其他社保个人比例', true]
                ];
                if (config.isJobChange) {
                    rateFields.push(
                        ['newFundRate', '新公积金比例', true],
                        ['newMedicalPersonalRate', '新医保个人比例', true],
                        ['newMedicalCompanyRate', '新医保单位比例', true],
                        ['newOtherSocialPersonalRate', '新其他社保个人比例', true]
                    );
                }
                for (const [field, label, optional] of rateFields) {
                    const value = config[field];
                    if (optional && (value === '' || value === null || value === undefined)) continue;
                    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
                        return { valid: false, error: label + '必须在 0% 到 100% 之间' };
                    }
                }

                const bonusMonth = config.bonusTaxMonth === '' ? null : Number(config.bonusTaxMonth);
                if (bonusMonth !== null && (!Number.isInteger(bonusMonth) || bonusMonth < 1 || bonusMonth > 12)) {
                    return { valid: false, error: '年终奖计税月份无效' };
                }
                const jobChangeMonth = config.jobChangeMonth === '' ? null : Number(config.jobChangeMonth);
                if (config.isJobChange
                    && (jobChangeMonth === null || !Number.isInteger(jobChangeMonth)
                        || jobChangeMonth < 2 || jobChangeMonth > 12)) {
                    return { valid: false, error: '新入职月份必须在 2 月到 12 月之间' };
                }
                if (!config.bonuses || typeof config.bonuses !== 'object' || Array.isArray(config.bonuses)) {
                    return { valid: false, error: '奖金数据无效' };
                }
                for (let month = 1; month <= 12; month += 1) {
                    const bonus = config.bonuses[month] === '' || config.bonuses[month] == null
                        ? 0
                        : config.bonuses[month];
                    if (typeof bonus !== 'number' || !Number.isFinite(bonus)
                        || bonus < 0 || bonus > maxAmount) {
                        return { valid: false, error: month + '月奖金必须是有效的非负金额' };
                    }
                }

                return { valid: true };
            },

            /**
             * 计算单月个税（基于累计预扣预缴法）
             * @param {Object} config - 计算配置
             * @param {number} config.baseSalary - 基础月薪
             * @param {number} config.specialDeduction - 专项附加扣除
             * @param {number} config.socialBase - 社保基数
             * @param {number} config.fundBase - 公积金基数
             * @param {number} config.fundRate - 公积金比例
             * @param {number} config.medicalPersonalRate - 医保个人比例(0-100)
             * @param {number} config.medicalCompanyRate - 医保单位比例(0-100)
             * @param {number} config.otherSocialPersonalRate - 其他社保个人比例(0-100)
             * @param {string} config.bonusTaxMonth - 年终奖计税月份
             * @param {Object} config.bonuses - 各月奖金
             * @param {boolean} config.isJobChange - 是否换工作
             * @param {string} config.jobChangeMonth - 换工作月份
             * @returns {Array<Object>} 每月计税详情数组
             */
            calculate: function(config) {
                const validation = this.validateConfig(config);
                if (!validation.valid) {
                    throw new RangeError(validation.error);
                }
                // 五险一金按分结算，后续计税和汇总共用同一金额口径。
                const roundMoney = amount => Number(amount.toFixed(2));
                const results = [];
                let cumulativeIncome = 0; // 累计收入
                let cumulativeDeduction = 0; // 累计减除费用
                let cumulativeSpecial = 0; // 累计专项扣除
                let cumulativeAdditional = 0; // 累计专项附加扣除
                let cumulativeTaxPaid = 0; // 累计已缴纳税额

                // 1. 五险一金参数 (初始为原公司)
                let currentSocialBase = roundMoney(config.socialBase);
                let currentFundBase = config.fundBase != null && config.fundBase !== ''
                    ? roundMoney(config.fundBase)
                    : roundMoney(config.baseSalary);
                let currentFundRate = config.fundRate;
                let currentMedicalPersonalRate = (config.medicalPersonalRate != null && config.medicalPersonalRate !== '') ? (config.medicalPersonalRate / 100) : this.MEDICAL_PERSONAL_RATE;
                let currentMedicalCompanyRate = (config.medicalCompanyRate != null && config.medicalCompanyRate !== '') ? (config.medicalCompanyRate / 100) : this.MEDICAL_COMPANY_RATE;
                let currentOtherSocialPersonalRate = (config.otherSocialPersonalRate != null && config.otherSocialPersonalRate !== '') ? (config.otherSocialPersonalRate / 100) : this.OTHER_SOCIAL_PERSONAL_RATE;
                let currentSpecialDeduction = roundMoney(config.specialDeduction);
                let currentBaseSalary = roundMoney(config.baseSalary);
                const bonusTaxMonth = Number(config.bonusTaxMonth);
                const jobChangeMonth = Number(config.jobChangeMonth);

                // 2. 遍历12个月
                let prevTaxableIncome = 0; // 上月累计应纳税所得额

                for (let month = 1; month <= 12; month++) {
                    // 换工作逻辑：如果启用了换工作且当前月是换工作月份
                    // 则重置累计值，重新开始计算，并更新参数
                    if (config.isJobChange && jobChangeMonth === month) {
                        cumulativeIncome = 0;
                        cumulativeDeduction = 0;
                        cumulativeSpecial = 0;
                        cumulativeAdditional = 0;
                        cumulativeTaxPaid = 0;
                        prevTaxableIncome = 0;
                        
                        // 更新为新公司参数 (如果未填写则沿用旧参数)
                        if (config.newBaseSalary != null && config.newBaseSalary !== '') currentBaseSalary = roundMoney(config.newBaseSalary);
                        if (config.newSocialBase != null && config.newSocialBase !== '') currentSocialBase = roundMoney(config.newSocialBase);
                        if (config.newFundBase != null && config.newFundBase !== '') currentFundBase = roundMoney(config.newFundBase);
                        if (config.newFundRate != null && config.newFundRate !== '') currentFundRate = config.newFundRate;
                        if (config.newSpecialDeduction != null && config.newSpecialDeduction !== '') currentSpecialDeduction = roundMoney(config.newSpecialDeduction);
                        if (config.newMedicalPersonalRate != null && config.newMedicalPersonalRate !== '') currentMedicalPersonalRate = config.newMedicalPersonalRate / 100;
                        if (config.newMedicalCompanyRate != null && config.newMedicalCompanyRate !== '') currentMedicalCompanyRate = config.newMedicalCompanyRate / 100;
                        if (config.newOtherSocialPersonalRate != null && config.newOtherSocialPersonalRate !== '') currentOtherSocialPersonalRate = config.newOtherSocialPersonalRate / 100;
                    }

                    const medicalPersonal = roundMoney(currentSocialBase * currentMedicalPersonalRate);
                    const medicalCompany = roundMoney(currentSocialBase * currentMedicalCompanyRate);
                    const otherSocialPersonal = roundMoney(currentSocialBase * currentOtherSocialPersonalRate);
                    const otherSocialCompany = roundMoney(currentSocialBase * this.OTHER_SOCIAL_COMPANY_RATE);
                    const fundPersonal = roundMoney(currentFundBase * (currentFundRate / 100));
                    const fundCompany = fundPersonal; // 公积金单位与个人同比例
                    const monthlyInsurance = roundMoney(medicalPersonal + otherSocialPersonal + fundPersonal);

                    const currentBonus = roundMoney(config.bonuses[month] || 0);
                    let bonusForComprehensive = currentBonus; // 并入综合所得
                    let bonusForSeparate = 0; // 单独计税

                    if (bonusTaxMonth === month && currentBonus > 0) {
                        bonusForSeparate = currentBonus;
                        bonusForComprehensive = 0;
                    }

                    const monthIncome = roundMoney(currentBaseSalary + bonusForComprehensive);
                    
                    cumulativeIncome = roundMoney(cumulativeIncome + monthIncome);
                    cumulativeDeduction += 5000;
                    cumulativeSpecial = roundMoney(cumulativeSpecial + monthlyInsurance);
                    cumulativeAdditional = roundMoney(cumulativeAdditional + currentSpecialDeduction);

                    const taxableIncome = roundMoney(Math.max(
                        0,
                        cumulativeIncome - cumulativeDeduction - cumulativeSpecial - cumulativeAdditional
                    ));

                    const taxTotal = this.getTax(taxableIncome);
                    const currentTax = Math.max(0, taxTotal - cumulativeTaxPaid); 
                    
                    const currentTaxFixed = roundMoney(currentTax);
                    cumulativeTaxPaid = roundMoney(cumulativeTaxPaid + currentTaxFixed);

                    let segmentDetails = this.getSegmentDetails(prevTaxableIncome, taxableIncome);
                    const segmentTax = segmentDetails.reduce((sum, segment) => sum + segment.tax, 0);
                    // 所得额回落或前期分角舍入时，区间税额不等于实缴税额，不展示误导性的分档明细。
                    if (Math.abs(segmentTax - currentTaxFixed) > 0.01) segmentDetails = [];
                    prevTaxableIncome = taxableIncome;

                    const actualIncome = roundMoney(monthIncome - monthlyInsurance - currentTaxFixed);

                    results.push({
                        month,
                        income: monthIncome,
                        insurance: monthlyInsurance,
                        medicalPersonal,
                        medicalCompany,
                        otherSocialPersonal,
                        otherSocialCompany,
                        fundPersonal,
                        fundCompany,
                        taxableIncome,
                        tax: currentTaxFixed,
                        actual: actualIncome,
                        rate: this.getRate(taxableIncome),
                        bonusSeparate: bonusForSeparate,
                        segments: segmentDetails,
                        isJobChangeMonth: config.isJobChange && jobChangeMonth === month
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
                            tax: amount * bracket.rate
                        });
                    }
                    
                    if (bracket.limit >= endIncome) break;
                    currentLower = bracket.limit;
                }
                
                return segments;
            },

            // 计算单独计税奖金的税额
            // 根据政策：将奖金除以12得到月均金额，查找对应税率和速算扣除数
            // 应纳税额 = 奖金总额 × 适用税率 - 速算扣除数
            calculateBonusTax: function(bonus) {
                const numericBonus = Number(bonus);
                if (!Number.isFinite(numericBonus) || numericBonus <= 0) return {
                    tax: 0, 
                    actual: 0, 
                    rate: 0, 
                    avgAmount: 0,
                    bracket: null
                };
                
                const amount = Number(numericBonus.toFixed(2));
                // 将奖金除以12，得到月均金额
                const avg = amount / 12;
                
                // 使用年终奖专用税率表（按月换算后的综合所得税率表）
                const bracket = this.bonusBrackets.find(b => avg <= b.limit);
                
                // 计算公式：应纳税额 = 全年一次性奖金 × 适用税率 - 速算扣除数
                const tax = Number(Math.max(0, amount * bracket.rate - bracket.deduction).toFixed(2));
                
                return {
                    tax,
                    actual: Number((amount - tax).toFixed(2)),
                    rate: bracket.rate,
                    avgAmount: avg,
                    bracket
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

        /** 个税页面状态统一使用共享存储键，Node仅加载核心计算时使用同值兜底。 */
        const TAX_STORAGE_KEY = typeof window !== 'undefined' && window.StorageKeys
            ? window.StorageKeys.TAX_CALCULATOR_DATA
            : 'tax_calculator_state';

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
                medicalPersonalRate: TaxCalculator.MEDICAL_PERSONAL_RATE * 100,
                medicalCompanyRate: TaxCalculator.MEDICAL_COMPANY_RATE * 100,
                otherSocialPersonalRate: TaxCalculator.OTHER_SOCIAL_PERSONAL_RATE * 100,
                bonusTaxMonth: '',
                bonuses: {},
                jobChangeMonth: '',
                // 新公司参数
                newBaseSalary: '',
                newSocialBase: '',
                newFundBase: '',
                newFundRate: '',
                newSpecialDeduction: '',
                newMedicalPersonalRate: '',
                newMedicalCompanyRate: '',
                newOtherSocialPersonalRate: ''
            },
            
            isBonusVisible: false,
            isJobChangeVisible: false,

            init: function() {
                this.loadState();
                this.renderBonusInputs();
                this.restoreUI();
                this.initEventListeners();
            },

            initEventListeners: function() {
                const helpModal = document.getElementById('helpModal');
                document.getElementById('help-btn').addEventListener('click', () => this.showHelp());
                document.getElementById('close-help-btn').addEventListener('click', () => this.hideHelp());
                helpModal.addEventListener('click', event => {
                    if (event.target === helpModal) this.hideHelp();
                });
                document.addEventListener('keydown', event => {
                    if (event.key === 'Escape' && helpModal.classList.contains('show')) this.hideHelp();
                });

                document.getElementById('toggleBonusBtn').addEventListener('click', () => this.toggleBonus());
                document.getElementById('toggleJobChangeBtn').addEventListener('click', () => this.toggleJobChange());
                document.getElementById('clear-bonuses-btn').addEventListener('click', () => this.clearBonuses());
                document.getElementById('calculate-tax-btn').addEventListener('click', () => this.calculate());
                document.getElementById('jobChangeMonth').addEventListener('change', () => this.toggleNewCompanyInputs());
                document.getElementById('bonusTaxMonth').addEventListener('change', () => this.saveState());

                [
                    'baseSalary', 'specialDeduction', 'socialBase', 'fundBase', 'fundRate',
                    'medicalPersonalRate', 'medicalCompanyRate', 'otherSocialPersonalRate',
                    'newBaseSalary', 'newSocialBase', 'newFundBase', 'newFundRate',
                    'newSpecialDeduction', 'newMedicalPersonalRate', 'newMedicalCompanyRate',
                    'newOtherSocialPersonalRate'
                ].forEach(id => {
                    document.getElementById(id).addEventListener('input', () => {
                        this.saveState();
                        this.validateInput(id);
                    });
                });

                document.getElementById('bonusInputs').addEventListener('input', event => {
                    if (!event.target.id.startsWith('bonus_m')) return;
                    this.saveState();
                    this.validateInput(event.target.id);
                });
            },

            saveState: function() {
                const getVal = (id) => {
                    return document.getElementById(id).value;
                };
                const getOptionalNumber = (id) => {
                    const value = getVal(id).trim();
                    if (value === '') return '';
                    return Number(value);
                };

                this.state.baseSalary = getOptionalNumber('baseSalary');
                this.state.specialDeduction = getOptionalNumber('specialDeduction');
                this.state.socialBase = getOptionalNumber('socialBase');
                this.state.fundBase = getOptionalNumber('fundBase');
                this.state.fundRate = getOptionalNumber('fundRate');
                this.state.medicalPersonalRate = getOptionalNumber('medicalPersonalRate');
                this.state.medicalCompanyRate = getOptionalNumber('medicalCompanyRate');
                this.state.otherSocialPersonalRate = getOptionalNumber('otherSocialPersonalRate');
                this.state.bonusTaxMonth = getVal('bonusTaxMonth');
                this.state.jobChangeMonth = getVal('jobChangeMonth');

                // 保存新公司参数
                this.state.newBaseSalary = getOptionalNumber('newBaseSalary');
                this.state.newSocialBase = getOptionalNumber('newSocialBase');
                this.state.newFundBase = getOptionalNumber('newFundBase');
                this.state.newFundRate = getOptionalNumber('newFundRate');
                this.state.newSpecialDeduction = getOptionalNumber('newSpecialDeduction');
                this.state.newMedicalPersonalRate = getOptionalNumber('newMedicalPersonalRate');
                this.state.newMedicalCompanyRate = getOptionalNumber('newMedicalCompanyRate');
                this.state.newOtherSocialPersonalRate = getOptionalNumber('newOtherSocialPersonalRate');

                for (let i = 1; i <= 12; i += 1) {
                    this.state.bonuses[i] = getOptionalNumber(`bonus_m${i}`);
                }

                if (!this.persistState(this.state)) {
                    window.CommonUtils.showNotification('输入保存失败，刷新页面后可能无法恢复', 'error');
                }
            },

            /** 优先 StorageService，兼容仅注入 CommonUtils 的测试环境。 */
            persistState: function(state) {
                if (window.StorageService && typeof window.StorageService.setJson === 'function') {
                    return window.StorageService.setJson(TAX_STORAGE_KEY, state).ok;
                }
                return window.CommonUtils.setLocalStorageItem(TAX_STORAGE_KEY, state);
            },

            readPersistedState: function() {
                if (window.StorageService && typeof window.StorageService.getJson === 'function') {
                    return window.StorageService.getJson(TAX_STORAGE_KEY, null);
                }
                return window.CommonUtils.getLocalStorageItem(TAX_STORAGE_KEY, null);
            },

            /**
             * 只恢复白名单字段；缺失字段保持默认，非法值丢弃，避免脏数据污染表单。
             */
            sanitizeRestoredState: function(parsed) {
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

                const maxAmount = Number.MAX_SAFE_INTEGER / 24;
                // undefined = 缺失或非法（不覆盖默认）；'' = 显式留空；number = 合法值。
                const sanitizeOptionalNumber = (value, min, max) => {
                    if (value === undefined) return undefined;
                    if (value === '' || value === null) return '';
                    const number = Number(value);
                    if (!Number.isFinite(number) || number < min || number > max) return undefined;
                    return number;
                };
                const sanitizeMonthOption = (value, minMonth) => {
                    if (value === undefined) return undefined;
                    if (value === '' || value === null) return '';
                    const month = Number(value);
                    if (!Number.isInteger(month) || month < minMonth || month > 12) return undefined;
                    return String(month);
                };

                const next = {};
                const assignIfDefined = (key, value) => {
                    if (value !== undefined) next[key] = value;
                };

                assignIfDefined('baseSalary', sanitizeOptionalNumber(parsed.baseSalary, 0, maxAmount));
                assignIfDefined('specialDeduction', sanitizeOptionalNumber(parsed.specialDeduction, 0, maxAmount));
                assignIfDefined('socialBase', sanitizeOptionalNumber(parsed.socialBase, 0, maxAmount));
                assignIfDefined('fundBase', sanitizeOptionalNumber(parsed.fundBase, 0, maxAmount));
                assignIfDefined('fundRate', sanitizeOptionalNumber(parsed.fundRate, 0, 100));
                assignIfDefined('medicalPersonalRate', sanitizeOptionalNumber(parsed.medicalPersonalRate, 0, 100));
                assignIfDefined('medicalCompanyRate', sanitizeOptionalNumber(parsed.medicalCompanyRate, 0, 100));
                assignIfDefined('otherSocialPersonalRate', sanitizeOptionalNumber(parsed.otherSocialPersonalRate, 0, 100));
                assignIfDefined('bonusTaxMonth', sanitizeMonthOption(parsed.bonusTaxMonth, 1));
                assignIfDefined('jobChangeMonth', sanitizeMonthOption(parsed.jobChangeMonth, 2));
                assignIfDefined('newBaseSalary', sanitizeOptionalNumber(parsed.newBaseSalary, 0, maxAmount));
                assignIfDefined('newSocialBase', sanitizeOptionalNumber(parsed.newSocialBase, 0, maxAmount));
                assignIfDefined('newFundBase', sanitizeOptionalNumber(parsed.newFundBase, 0, maxAmount));
                assignIfDefined('newFundRate', sanitizeOptionalNumber(parsed.newFundRate, 0, 100));
                assignIfDefined('newSpecialDeduction', sanitizeOptionalNumber(parsed.newSpecialDeduction, 0, maxAmount));
                assignIfDefined('newMedicalPersonalRate', sanitizeOptionalNumber(parsed.newMedicalPersonalRate, 0, 100));
                assignIfDefined('newMedicalCompanyRate', sanitizeOptionalNumber(parsed.newMedicalCompanyRate, 0, 100));
                assignIfDefined('newOtherSocialPersonalRate', sanitizeOptionalNumber(parsed.newOtherSocialPersonalRate, 0, 100));

                if (parsed.bonuses && typeof parsed.bonuses === 'object' && !Array.isArray(parsed.bonuses)) {
                    const bonuses = {};
                    for (let month = 1; month <= 12; month += 1) {
                        const bonus = sanitizeOptionalNumber(parsed.bonuses[month], 0, maxAmount);
                        if (bonus !== undefined) bonuses[month] = bonus;
                    }
                    next.bonuses = bonuses;
                }
                return next;
            },

            loadState: function() {
                const parsed = this.readPersistedState();
                const sanitized = this.sanitizeRestoredState(parsed);
                if (!sanitized) return;

                const nextBonuses = sanitized.bonuses
                    ? { ...this.state.bonuses, ...sanitized.bonuses }
                    : this.state.bonuses;
                this.state = { ...this.state, ...sanitized, bonuses: nextBonuses };
            },

            restoreUI: function() {
                const setVal = (id, val) => {
                    document.getElementById(id).value = val == null || typeof val === 'object' ? '' : val;
                };

                setVal('baseSalary', this.state.baseSalary);
                setVal('specialDeduction', this.state.specialDeduction);
                setVal('socialBase', this.state.socialBase);
                setVal('fundBase', this.state.fundBase);
                setVal('fundRate', this.state.fundRate);
                setVal('medicalPersonalRate', this.state.medicalPersonalRate);
                setVal('medicalCompanyRate', this.state.medicalCompanyRate);
                setVal('otherSocialPersonalRate', this.state.otherSocialPersonalRate);
                setVal('bonusTaxMonth', this.state.bonusTaxMonth);
                setVal('jobChangeMonth', this.state.jobChangeMonth);
                this.state.bonusTaxMonth = document.getElementById('bonusTaxMonth').value;
                this.state.jobChangeMonth = document.getElementById('jobChangeMonth').value;
                
                // 恢复新公司参数
                setVal('newBaseSalary', this.state.newBaseSalary);
                setVal('newSocialBase', this.state.newSocialBase);
                setVal('newFundBase', this.state.newFundBase);
                setVal('newFundRate', this.state.newFundRate);
                setVal('newSpecialDeduction', this.state.newSpecialDeduction);
                setVal('newMedicalPersonalRate', this.state.newMedicalPersonalRate);
                setVal('newMedicalCompanyRate', this.state.newMedicalCompanyRate);
                setVal('newOtherSocialPersonalRate', this.state.newOtherSocialPersonalRate);
                
                for (let i = 1; i <= 12; i += 1) {
                    const bonus = this.state.bonuses[i];
                    setVal(`bonus_m${i}`, typeof bonus === 'number' && Number.isFinite(bonus) && bonus !== 0 ? bonus : '');
                }

                const hasBonus = Object.values(this.state.bonuses).some(v => v > 0);
                if (hasBonus) {
                    this.isBonusVisible = true;
                    this.updateBonusUI();
                }

                if (this.state.jobChangeMonth) {
                    this.isJobChangeVisible = true;
                    this.updateJobChangeUI();
                    document.getElementById('newCompanyInputs').style.display = 'block';
                }
            },

            renderBonusInputs: function() {
                const container = document.getElementById('bonusInputs');
                let html = '';
                for (let i = 1; i <= 12; i++) {
                    html += `
                        <div class="bonus-item">
                            <label>${i}月</label>
                            <input type="number" id="bonus_m${i}" class="input-field" placeholder="0" min="0" step="0.01">
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

                section.classList.toggle('show', this.isBonusVisible);
                btnText.textContent = this.isBonusVisible ? '收起奖金设置' : '展开奖金设置';
                arrow.style.transform = this.isBonusVisible ? 'rotate(180deg)' : 'rotate(0deg)';
            },

            updateJobChangeUI: function() {
                const section = document.getElementById('jobChangeSection');
                const btnText = document.getElementById('jobChangeBtnText');
                const arrow = document.getElementById('jobChangeArrow');

                section.classList.toggle('show', this.isJobChangeVisible);
                btnText.textContent = this.isJobChangeVisible ? '收起换工作设置' : '年度中间换工作?';
                arrow.style.transform = this.isJobChangeVisible ? 'rotate(180deg)' : 'rotate(0deg)';
            },

            toggleNewCompanyInputs: function() {
                const month = document.getElementById('jobChangeMonth').value;
                const inputs = document.getElementById('newCompanyInputs');
                this.saveState();
                
                if (month) {
                    inputs.style.display = 'block';
                    inputs.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    inputs.style.display = 'none';
                }
            },

            clearBonuses: function() {
                for (let i = 1; i <= 12; i += 1) {
                    document.getElementById(`bonus_m${i}`).value = '';
                }
                document.getElementById('bonusTaxMonth').value = '';
                this.saveState();
            },

            calculate: function() {
                this.saveState();
                document.getElementById('resultSection').classList.remove('show');

                const optionalNumber = (value) => value === '' || value == null ? undefined : Number(value);
                const config = {
                    baseSalary: optionalNumber(this.state.baseSalary) ?? NaN,
                    specialDeduction: optionalNumber(this.state.specialDeduction) ?? 0,
                    socialBase: optionalNumber(this.state.socialBase) ?? NaN,
                    fundBase: optionalNumber(this.state.fundBase),
                    fundRate: optionalNumber(this.state.fundRate) ?? NaN,
                    medicalPersonalRate: optionalNumber(this.state.medicalPersonalRate),
                    medicalCompanyRate: optionalNumber(this.state.medicalCompanyRate),
                    otherSocialPersonalRate: optionalNumber(this.state.otherSocialPersonalRate),
                    bonusTaxMonth: this.state.bonusTaxMonth,
                    bonuses: this.state.bonuses,
                    isJobChange: !!this.state.jobChangeMonth,
                    jobChangeMonth: this.state.jobChangeMonth,
                    // 新公司配置
                    newBaseSalary: optionalNumber(this.state.newBaseSalary),
                    newSocialBase: optionalNumber(this.state.newSocialBase),
                    newFundBase: optionalNumber(this.state.newFundBase),
                    newFundRate: optionalNumber(this.state.newFundRate),
                    newSpecialDeduction: optionalNumber(this.state.newSpecialDeduction),
                    newMedicalPersonalRate: optionalNumber(this.state.newMedicalPersonalRate),
                    newMedicalCompanyRate: optionalNumber(this.state.newMedicalCompanyRate),
                    newOtherSocialPersonalRate: optionalNumber(this.state.newOtherSocialPersonalRate)
                };

                let monthlyResults;
                try {
                    monthlyResults = TaxCalculator.calculate(config);
                } catch (error) {
                    window.CommonUtils.showNotification(error.message || '计算失败，请检查输入', 'error');
                    return;
                }
                
                let totalIncome = 0;
                let totalTax = 0;
                let totalActual = 0;
                let totalMedicalPersonal = 0, totalMedicalCompany = 0;
                let totalFundPersonal = 0, totalFundCompany = 0;
                let totalOtherSocialPersonal = 0, totalOtherSocialCompany = 0;

                let tableHtml = '';

                monthlyResults.forEach(res => {
                    totalIncome += res.income;
                    totalTax += res.tax;
                    totalActual += res.actual;
                    totalMedicalPersonal += res.medicalPersonal;
                    totalMedicalCompany += res.medicalCompany;
                    totalFundPersonal += res.fundPersonal;
                    totalFundCompany += res.fundCompany;
                    totalOtherSocialPersonal += res.otherSocialPersonal;
                    totalOtherSocialCompany += res.otherSocialCompany;

                    // 判断是否跨档位
                    const isCrossBracket = res.segments.length > 1;
                    let rowClass = isCrossBracket ? 'cross-bracket-row' : '';
                    if (res.isJobChangeMonth) rowClass += ' job-change-row';
                    
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

                        const bracketInfo = bonusRes.bracket;
                        const ratePercent = (bonusRes.rate * 100).toFixed(0);
                        const bracketIndex = TaxCalculator.bonusBrackets.indexOf(bracketInfo);
                        const prevLimit = bracketIndex > 0
                            ? TaxCalculator.bonusBrackets[bracketIndex - 1].limit
                            : 0;
                        const bracketUpper = bracketInfo.limit === Infinity
                            ? '∞'
                            : `¥${this.formatMoney(bracketInfo.limit)}`;
                        const bracketRange = `${prevLimit > 0 ? `¥${this.formatMoney(prevLimit)}-` : ''}${bracketUpper}`;
                        const bonusTaxDetailDisplay = `
                            <div>${this.formatMoney(bonusRes.tax)}</div>
                            <div class="tax-details">
                                <div class="tax-segment">月均 = ¥${this.formatMoney(res.bonusSeparate)} ÷ 12 = ¥${this.formatMoney(bonusRes.avgAmount)}</div>
                                <div class="tax-segment">月均 ¥${this.formatMoney(bonusRes.avgAmount)} 落在 ${bracketRange} 档，适用税率 ${ratePercent}%</div>
                                <div class="tax-segment" style="color:var(--text-sub);font-size:10px;">官方公式：¥${this.formatMoney(res.bonusSeparate)} × ${ratePercent}% - ¥${this.formatMoney(bracketInfo.deduction)} = ¥${this.formatMoney(bonusRes.tax)}</div>
                            </div>
                        `;

                        tableHtml += `
                            <tr class="bonus-row">
                                <td>年终奖</td>
                                <td style="font-weight:600">${this.formatMoney(bonusRes.actual)}</td>
                                <td>${bonusTaxDetailDisplay}</td>
                                <td>${this.formatMoney(res.bonusSeparate)}</td>
                                <td><span class="rate-badge">${ratePercent}%</span></td>
                            </tr>
                        `;
                    }
                });

                const personalTotalYear = totalMedicalPersonal + totalOtherSocialPersonal + totalFundPersonal;
                const companyTotalYear = totalMedicalCompany + totalOtherSocialCompany + totalFundCompany;
                document.getElementById('summaryTotalIncome').textContent = this.formatMoney(totalIncome);
                document.getElementById('summaryTotalTax').textContent = this.formatMoney(totalTax);
                document.getElementById('summaryActualIncome').textContent = this.formatMoney(totalActual);
                
                // 更新五险一金汇总详情
                document.getElementById('summaryInsurance').innerHTML = `
                    <div>${this.formatMoney(personalTotalYear)}</div>
                    <div style="font-size:11px;color:var(--text-sub);margin-top:2px;">
                        (个人扣除合计，含医保/社保/公积金)
                    </div>
                `;

                // 社保公积金明细表：无换工作 2 行（每月、全年合计），有换工作 3 行（原公司单月、新公司单月、全年合计）
                const jobChangeMonthNum = Number(config.jobChangeMonth);
                const detailCells = (r) => {
                    const personalTotal = r.medicalPersonal + r.otherSocialPersonal + r.fundPersonal;
                    const companyTotal = r.medicalCompany + r.otherSocialCompany + r.fundCompany;
                    return `<td>${this.formatMoney(r.medicalPersonal)}</td><td>${this.formatMoney(r.medicalCompany)}</td><td>${this.formatMoney(r.otherSocialPersonal)}</td><td>${this.formatMoney(r.otherSocialCompany)}</td><td>${this.formatMoney(r.fundPersonal)}</td><td>${this.formatMoney(r.fundCompany)}</td><td>${this.formatMoney(personalTotal)}</td><td>${this.formatMoney(companyTotal)}</td>`;
                };
                let detailRows = '';
                if (!config.isJobChange) {
                    detailRows += `<tr><td>每月</td>${detailCells(monthlyResults[0])}</tr>`;
                } else {
                    detailRows += `<tr><td>原公司（单月）</td>${detailCells(monthlyResults[jobChangeMonthNum - 2])}</tr>`;
                    detailRows += `<tr><td>新公司（单月）</td>${detailCells(monthlyResults[jobChangeMonthNum - 1])}</tr>`;
                }
                detailRows += `<tr style="font-weight:600;background:#f1f5f9;"><td>全年合计</td><td>${this.formatMoney(totalMedicalPersonal)}</td><td>${this.formatMoney(totalMedicalCompany)}</td><td>${this.formatMoney(totalOtherSocialPersonal)}</td><td>${this.formatMoney(totalOtherSocialCompany)}</td><td>${this.formatMoney(totalFundPersonal)}</td><td>${this.formatMoney(totalFundCompany)}</td><td>${this.formatMoney(personalTotalYear)}</td><td>${this.formatMoney(companyTotalYear)}</td></tr>`;
                document.getElementById('insuranceDetailBody').innerHTML = detailRows;
                document.getElementById('insuranceDetailSection').style.display = 'block';

                document.getElementById('resultBody').innerHTML = tableHtml;
                
                const resultSection = document.getElementById('resultSection');
                resultSection.classList.add('show');
                
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                document.getElementById('help-btn').setAttribute('aria-expanded', 'true');
                document.getElementById('close-help-btn').focus();
            },
            
            hideHelp: function() {
                document.getElementById('helpModal').classList.remove('show');
                document.getElementById('help-btn').setAttribute('aria-expanded', 'false');
                document.getElementById('help-btn').focus();
            },
            
            validateInput: function(inputId) {
                const input = document.getElementById(inputId);
                const inputGroup = input.closest('.input-group');
                const value = Number(input.value);
                const min = input.min === '' ? -Infinity : Number(input.min);
                const max = input.max === '' ? Infinity : Number(input.max);
                const invalid = input.value !== '' && (
                    !Number.isFinite(value) || value < min || value > max
                );

                if (inputGroup) inputGroup.classList.toggle('error', invalid);
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('DOMContentLoaded', () => {
                app.init();
            });
        }

        if (typeof module === 'object' && module.exports) {
            module.exports = TaxCalculator;
            // Node 测试需要校验表单恢复逻辑，挂到导出对象上但不影响浏览器全局。
            module.exports.app = app;
        }
