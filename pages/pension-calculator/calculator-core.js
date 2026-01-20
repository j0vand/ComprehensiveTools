/**
 * 养老金计算器 - 核心计算逻辑模块
 * 包含养老金计算的核心算法和常量定义
 */

// ==========================================
// 常量定义
// ==========================================

// 养老金计算相关常量
const PERSONAL_CONTRIBUTION_RATE = 0.08;  // 个人缴费比例 8%
const BASIC_PENSION_RATE = 0.01;          // 基础养老金系数 1%
const MIN_CONTRIBUTION_RATE = 0.6;         // 最低缴费比例（社平工资的60%）

// 计发月数表 (国发[2005]38号)
const PAYMENT_MONTHS = {
    40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
    45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
    50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
    55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
    60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
    65: 101, 66: 93,  67: 84,  68: 75,  69: 65,
    70: 56
};

/**
 * 获取计发月数
 * @param {number} age - 退休年龄
 * @returns {number} 计发月数
 */
function getPaymentMonths(age) {
    // 边界处理
    if (age < 40) return 233;
    if (age > 70) return 56;
    const floorAge = Math.floor(age);
    // 确保返回有效值
    return PAYMENT_MONTHS[floorAge] || PAYMENT_MONTHS[Math.min(70, Math.max(40, floorAge))] || 139;
}

/**
 * 养老金计算核心函数
 * @param {Object} data - 输入数据
 * @param {Object} retirementInfo - 退休信息
 * @returns {Object} 计算结果
 */
function calculatePension(data, retirementInfo) {
    const { yearsToRetire, retireAge } = retirementInfo;
    
    // 确定实际未来缴费年限
    let futurePaymentYears = yearsToRetire;
    if (data.paymentPlan === 'stop_early') {
        // 如果选择提前停止，未来缴费年限 = 停止年龄 - 当前年龄
        // 注意：Math.min 确保不超过退休时间
        futurePaymentYears = Math.max(0, Math.min(yearsToRetire, data.stopAge - data.currentAge));
    }

    // A. 估算退休时的社会平均工资 (按复利增长)
    // 公式: 当前社平 * (1 + 增长率)^剩余年限
    const futureAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, yearsToRetire);

    // B. 计算累计缴费年限
    const totalYears = data.paidYears + futurePaymentYears;

    // C. 估算个人账户累计储存额
    // 分为两部分：
    
    // 1. 现有余额的复利增值 (一直滚存到退休)
    const balanceFutureValue = data.accountBalance * Math.pow(1 + data.interestRate, yearsToRetire);

    // 2. 未来缴费的本息和
    // 社保缴费是每月进行的，需要按月计算每笔缴费到退休时的复利
    let futureContributionTotal = 0;
    let currentBase = data.salaryBase;
    const initialBase = data.salaryBase;  // 保存初始缴费基数

    // 循环 "未来需要缴费的年份"
    for (let i = 0; i < futurePaymentYears; i++) {
        // 计算当年的社平工资
        const currentYearAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, i);
        // 最低缴费基数（社平工资的60%）
        const minBase = currentYearAvgSalary * MIN_CONTRIBUTION_RATE;
        
        // 根据缴费基数变化方式计算当年的缴费基数
        if (data.baseChangeMode === 'fixed') {
            // 保持不变模式：保持初始基数，但不能低于最低缴费基数
            currentBase = Math.max(initialBase, minBase);
        } else {
            // 跟着工资增长模式：按工资增长率增长，但不能低于最低缴费基数
            const baseAfterGrowth = currentBase * (1 + data.salaryGrowth);
            currentBase = Math.max(baseAfterGrowth, minBase);
        }
        
        // 每年有12个月的缴费
        // 每月缴费额 (个人部分 8%)
        const monthlyContribution = currentBase * PERSONAL_CONTRIBUTION_RATE;
        
        // 计算这一年的12个月缴费到退休时的本息和
        for (let month = 0; month < 12; month++) {
            // 距离退休的年数 = 总距离退休年数 - 当前第几年 - 当前月数/12
            const yearsToCompound = yearsToRetire - i - (month / 12);
            
            if (yearsToCompound > 0) {
                const contributionFutureValue = monthlyContribution * Math.pow(1 + data.interestRate, yearsToCompound);
                futureContributionTotal += contributionFutureValue;
            }
        }
    }

    const totalAccountBalance = balanceFutureValue + futureContributionTotal;

    // D. 计算加权平均缴费指数
    // 如果未来平均缴费指数未填写，需要根据缴费基数计算
    let calculatedFutureAvgIndex = data.futureAvgIndex;
    if (calculatedFutureAvgIndex === null || calculatedFutureAvgIndex === undefined) {
        // 根据缴费基数变化方式计算平均缴费指数
        // 需要重新计算未来各年的缴费指数并求平均
        let totalIndex = 0;
        let tempBase = data.salaryBase;
        const tempInitialBase = data.salaryBase;
        
        for (let i = 0; i < futurePaymentYears; i++) {
            const currentYearAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, i);
            const minBase = currentYearAvgSalary * MIN_CONTRIBUTION_RATE;
            
            if (data.baseChangeMode === 'fixed') {
                tempBase = Math.max(tempInitialBase, minBase);
            } else {
                const baseAfterGrowth = tempBase * (1 + data.salaryGrowth);
                tempBase = Math.max(baseAfterGrowth, minBase);
            }
            
            // 缴费指数 = 缴费基数 / 社平工资
            totalIndex += tempBase / currentYearAvgSalary;
        }
        
        calculatedFutureAvgIndex = futurePaymentYears > 0 ? totalIndex / futurePaymentYears : data.pastAvgIndex;
    }
    
    // 公式：(过去平均缴费指数 × 已缴费年限 + 未来平均缴费指数 × 未来缴费年限) / 总缴费年限
    let weightedAvgIndex;
    if (totalYears > 0) {
        if (data.paidYears > 0 && futurePaymentYears > 0) {
            // 两种情况都有，计算加权平均
            weightedAvgIndex = (data.pastAvgIndex * data.paidYears + calculatedFutureAvgIndex * futurePaymentYears) / totalYears;
        } else if (data.paidYears > 0) {
            // 只有过去缴费，使用过去指数
            weightedAvgIndex = data.pastAvgIndex;
        } else {
            // 只有未来缴费，使用未来指数
            weightedAvgIndex = calculatedFutureAvgIndex;
        }
    } else {
        // 总缴费年限为0，使用过去指数作为默认值
        weightedAvgIndex = data.pastAvgIndex;
    }

    // E. 基础养老金计算
    // 公式：退休时社平工资 × (1 + 平均缴费指数) / 2 × 累计缴费年限 × 1%
    if (!isFinite(futureAvgSalary) || futureAvgSalary <= 0) {
        throw new Error('退休时社会平均工资计算结果无效');
    }
    if (!isFinite(weightedAvgIndex) || weightedAvgIndex < 0) {
        throw new Error('加权平均缴费指数计算结果无效');
    }
    const basicPension = futureAvgSalary * (1 + weightedAvgIndex) / 2 * totalYears * BASIC_PENSION_RATE;
    
    // 检查基础养老金计算结果的有效性
    if (!isFinite(basicPension) || isNaN(basicPension)) {
        throw new Error('基础养老金计算结果无效');
    }

    // F. 个人账户养老金计算
    // 公式：账户余额 / 计发月数
    const paymentMonths = getPaymentMonths(retireAge);
    if (paymentMonths <= 0) {
        throw new Error('计发月数无效，无法计算个人账户养老金');
    }
    const personalPension = totalAccountBalance / paymentMonths;
    
    // 检查计算结果的有效性
    if (!isFinite(personalPension) || isNaN(personalPension)) {
        throw new Error('个人账户养老金计算结果无效');
    }

    // G. 计算年度明细数据
    const yearDetails = calculateYearDetails(data, retirementInfo, futurePaymentYears, futureAvgSalary, weightedAvgIndex);
    
    // H. 使用表格最后一行的数据来确保主计算结果与表格一致
    // 这样用户在表格中选择"持续缴费到退休"时，结果与顶部显示一致
    const lastYearDetail = yearDetails[yearDetails.length - 1];
    const finalTotalPension = lastYearDetail.pensionIfStop;
    const finalAccountBalance = lastYearDetail.accumulatedBalance;
    
    // 重新计算基础养老金和个人账户养老金，使其与表格一致
    const finalBasicPension = futureAvgSalary * (1 + weightedAvgIndex) / 2 * totalYears * BASIC_PENSION_RATE;
    const finalPersonalPension = finalAccountBalance / paymentMonths;

    return {
        totalPension: finalTotalPension,
        basicPension: finalBasicPension,
        personalPension: finalPersonalPension,
        totalAccountBalance: finalAccountBalance,
        totalYears,
        paymentMonths,
        futureAvgSalary,
        weightedAvgIndex,
        balanceFutureValue,
        futureContributionTotal,
        yearDetails,
        futureAvgIndexCalculated: data.futureAvgIndex === null || data.futureAvgIndex === undefined,  // 标记是否自动计算
        baseChangeMode: data.baseChangeMode  // 传递缴费基数变化方式
    };
}

/**
 * 计算年度明细数据
 * @param {Object} data - 输入数据
 * @param {Object} retirementInfo - 退休信息
 * @param {number} futurePaymentYears - 未来缴费年限
 * @param {number} futureAvgSalary - 未来平均工资
 * @param {number} weightedAvgIndex - 加权平均缴费指数
 * @returns {Array} 年度明细数组
 */
function calculateYearDetails(data, retirementInfo, futurePaymentYears, futureAvgSalary, weightedAvgIndex) {
    // 如果未来平均缴费指数未填写，需要先计算
    let calculatedFutureAvgIndex = data.futureAvgIndex;
    if (calculatedFutureAvgIndex === null || calculatedFutureAvgIndex === undefined) {
        // 根据缴费基数变化方式计算平均缴费指数
        let totalIndex = 0;
        let tempBase = data.salaryBase;
        const tempInitialBase = data.salaryBase;
        
        for (let i = 0; i < futurePaymentYears; i++) {
            const currentYearAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, i);
            const minBase = currentYearAvgSalary * MIN_CONTRIBUTION_RATE;
            
            if (data.baseChangeMode === 'fixed') {
                tempBase = Math.max(tempInitialBase, minBase);
            } else {
                const baseAfterGrowth = tempBase * (1 + data.salaryGrowth);
                tempBase = Math.max(baseAfterGrowth, minBase);
            }
            
            // 缴费指数 = 缴费基数 / 社平工资
            totalIndex += tempBase / currentYearAvgSalary;
        }
        
        calculatedFutureAvgIndex = futurePaymentYears > 0 ? totalIndex / futurePaymentYears : data.pastAvgIndex;
    }
    const { yearsToRetire, retireAge } = retirementInfo;
    const currentYear = new Date().getFullYear();
    const details = [];
    
    let currentBase = data.salaryBase;
    const initialBase = data.salaryBase;  // 保存初始缴费基数
    let accumulatedBalance = data.accountBalance; // 从现有余额开始
    let accumulatedYears = data.paidYears; // 从已缴费年限开始
    
    // 计算每年如果停止缴费的情况
    for (let i = 0; i <= futurePaymentYears; i++) {
        const year = currentYear + i;
        const age = data.currentAge + i;
        const yearsToRetireFromHere = retireAge - age;
        
        // 计算当年的社平工资
        const currentYearAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, i);
        // 最低缴费基数（社平工资的60%）
        const minBase = currentYearAvgSalary * MIN_CONTRIBUTION_RATE;
        
        // 根据缴费基数变化方式计算当年的缴费基数
        let baseBeforeMinCheck; // 检查最低下限之前的基数
        if (data.baseChangeMode === 'fixed') {
            // 保持不变模式：保持初始基数，但不能低于最低缴费基数
            baseBeforeMinCheck = initialBase;
            currentBase = Math.max(initialBase, minBase);
        } else {
            // 跟着工资增长模式：按工资增长率增长，但不能低于最低缴费基数
            if (i === 0) {
                baseBeforeMinCheck = data.salaryBase;
                currentBase = Math.max(data.salaryBase, minBase);
            } else if (i <= futurePaymentYears) {
                const baseAfterGrowth = currentBase * (1 + data.salaryGrowth);
                baseBeforeMinCheck = baseAfterGrowth;
                currentBase = Math.max(baseAfterGrowth, minBase);
            } else {
                // 已经停止缴费，不再计算
                baseBeforeMinCheck = currentBase;
                currentBase = currentBase; // 保持不变
            }
        }
        
        // 当前年的缴费基数
        const yearBase = currentBase;
        // 判断是否因60%下限而提高（如果检查后的基数大于检查前的基数，说明被提高了）
        const isRaisedByMinBase = currentBase > baseBeforeMinCheck * 1.001; // 考虑浮点数误差
        
        // 如果这一年继续缴费
        let yearContribution = 0;
        let yearEndBalance = accumulatedBalance;
        
        if (i < futurePaymentYears && yearsToRetireFromHere > 0) {
            // 计算这一年的12个月缴费
            const monthlyContribution = yearBase * PERSONAL_CONTRIBUTION_RATE;
            yearContribution = monthlyContribution * 12;
            
            // 更新累计余额（现有余额继续复利 + 当年缴费）
            // 注意：当年缴费是逐月进行的，所以需要按月计算复利
            let balanceAfterYear = accumulatedBalance;
            for (let month = 0; month < 12; month++) {
                // 每月先复利，再加当月缴费
                balanceAfterYear = balanceAfterYear * Math.pow(1 + data.interestRate, 1/12) + monthlyContribution;
            }
            yearEndBalance = balanceAfterYear;
            accumulatedBalance = yearEndBalance;
            accumulatedYears += 1;
        } else {
            // 不再缴费，只计算现有余额的复利
            yearEndBalance = accumulatedBalance * Math.pow(1 + data.interestRate, 1);
        }
        
        // 计算如果从这一年开始停止缴费，到退休时的账户余额
        // 使用年初余额（即上一年的年末余额，如果i=0则是初始余额）
        let balanceAtStartOfYear;
        if (i === 0) {
            balanceAtStartOfYear = data.accountBalance;
        } else {
            balanceAtStartOfYear = details[i-1].accumulatedBalance;
        }
        const balanceAtRetirement = balanceAtStartOfYear * Math.pow(1 + data.interestRate, Math.max(0, yearsToRetireFromHere));
        
        // 计算如果从这一年开始停止缴费的养老金
        let pensionIfStop = 0;
        // 如果停止缴费，使用的累计年限应该是到上一年的年限
        // 特殊情况：如果是退休年（yearsToRetireFromHere == 0），使用完整的累计年限
        const yearsIfStop = i === 0 ? data.paidYears : 
            (yearsToRetireFromHere === 0 ? accumulatedYears : 
            (i <= futurePaymentYears ? data.paidYears + i - 1 : accumulatedYears));
        
        // 退休年（yearsToRetireFromHere == 0）也需要计算，显示持续缴费到退休的最终结果
        if (yearsToRetireFromHere >= 0 && yearsIfStop > 0) {
            // 计算加权平均缴费指数
            let avgIndexToHere;
            if (i === 0) {
                // 如果第一年就停止，只用过去的指数
                avgIndexToHere = data.pastAvgIndex;
            } else if (i <= futurePaymentYears) {
                // 重新计算到上一年的加权平均
                // 计算到上一年的平均缴费指数
                let calculatedFutureAvgIndexToHere = calculatedFutureAvgIndex;
                if (i > 1) {
                    let totalIndex = 0;
                    let tempBase = data.salaryBase;
                    const tempInitialBase = data.salaryBase;
                    
                    for (let j = 0; j < i - 1; j++) {
                        const yearAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, j);
                        const minBase = yearAvgSalary * MIN_CONTRIBUTION_RATE;
                        
                        if (data.baseChangeMode === 'fixed') {
                            tempBase = Math.max(tempInitialBase, minBase);
                        } else {
                            const baseAfterGrowth = tempBase * (1 + data.salaryGrowth);
                            tempBase = Math.max(baseAfterGrowth, minBase);
                        }
                        
                        totalIndex += tempBase / yearAvgSalary;
                    }
                    
                    calculatedFutureAvgIndexToHere = (i - 1) > 0 ? totalIndex / (i - 1) : data.pastAvgIndex;
                }
                
                if (data.paidYears > 0 && i > 1) {
                    avgIndexToHere = (data.pastAvgIndex * data.paidYears + calculatedFutureAvgIndexToHere * (i - 1)) / (data.paidYears + i - 1);
                } else if (data.paidYears > 0) {
                    avgIndexToHere = data.pastAvgIndex;
                } else {
                    avgIndexToHere = calculatedFutureAvgIndexToHere;
                }
            } else {
                avgIndexToHere = weightedAvgIndex;
            }
            
            // 退休时的社平工资（固定值，因为退休年份是固定的）
            // 所有行都使用相同的退休时社平工资
            const futureAvgSalaryAtStop = futureAvgSalary;
            
            // 基础养老金
            const basicPensionAtStop = futureAvgSalaryAtStop * (1 + avgIndexToHere) / 2 * yearsIfStop * BASIC_PENSION_RATE;
            
            // 个人账户养老金
            // 退休年时使用退休年年初的账户余额（即上一年年末余额，不再复利）
            // 因为退休时就开始领取养老金，不会再整年复利
            const paymentMonthsAtStop = getPaymentMonths(retireAge);
            const balanceForPension = yearsToRetireFromHere === 0 ? accumulatedBalance : balanceAtRetirement;
            const personalPensionAtStop = balanceForPension / paymentMonthsAtStop;
            
            pensionIfStop = basicPensionAtStop + personalPensionAtStop;
        }
        
        details.push({
            year,
            age,
            yearBase,
            yearContribution,
            accumulatedBalance: yearEndBalance,
            accumulatedYears,
            balanceAtRetirement,
            pensionIfStop,
            yearsToRetire: yearsToRetireFromHere,
            currentYearAvgSalary,  // 添加当年社平工资，用于显示
            minBase,  // 添加最低缴费基数，用于显示
            isRaisedByMinBase  // 标记是否因60%下限而提高
        });
    }
    
    return details;
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
    window.PensionCalculatorCore = {
        calculatePension,
        calculateYearDetails,
        getPaymentMonths,
        PERSONAL_CONTRIBUTION_RATE,
        BASIC_PENSION_RATE,
        MIN_CONTRIBUTION_RATE
    };
}
