/**
 * 养老金计算器 - 核心计算逻辑模块
 * 当前账户余额按“当前年龄对应年份年初”口径输入，缴费在年末计入。
 */

/** 个人账户每月缴费比例，当前模型按8%估算。 */
const PERSONAL_CONTRIBUTION_RATE = 0.08;
/** 基础养老金每缴费一年对应的计发比例。 */
const BASIC_PENSION_RATE = 0.01;
/** 缴费基数不得低于当年社会平均工资的60%。 */
const MIN_CONTRIBUTION_RATE = 0.6;
/** 缴费基数不得高于当年社会平均工资的300%。 */
const MAX_CONTRIBUTION_RATE = 3;

/** 个人账户养老金计发月数，依据国发[2005]38号。 */
const PAYMENT_MONTHS = {
    40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
    45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
    50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
    55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
    60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
    65: 101, 66: 93, 67: 84, 68: 75, 69: 65,
    70: 56
};

/**
 * 获取退休年龄对应的个人账户养老金计发月数。
 * 超出表格范围时使用最近边界，核心调用方仍应先校验退休年龄。
 * @param {number} age 退休年龄
 * @returns {number} 计发月数
 */
function getPaymentMonths(age) {
    if (!Number.isFinite(age)) throw new RangeError('退休年龄必须是有效数值');
    if (age < 40) return PAYMENT_MONTHS[40];
    if (age > 70) return PAYMENT_MONTHS[70];
    return PAYMENT_MONTHS[Math.floor(age)];
}

/**
 * 获取退休年份适用的最低缴费年限。
 * 2030年起每年提高半年，2039年达到20年后不再增加。
 * @param {number} retireYear 退休年份
 * @returns {number} 最低缴费年限
 */
function getMinimumContributionYears(retireYear) {
    if (!Number.isInteger(retireYear)) throw new RangeError('退休年份必须是整数');
    if (retireYear <= 2029) return 15;
    return Math.min(20, 15 + (retireYear - 2029) * 0.5);
}

/**
 * 生成从当前年龄年初到退休年龄年初的唯一年度轨迹。
 * 每行“如现在停止”取该行年初状态；“按计划年末”才包含该年利息和缴费。
 * @param {Object} data 表单输入
 * @param {Object} retirementInfo 退休年龄、剩余年限和退休年份
 * @returns {Array<Object>} 年度轨迹
 */
function calculateYearDetails(data, retirementInfo) {
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || !retirementInfo || typeof retirementInfo !== 'object' || Array.isArray(retirementInfo)) {
        throw new TypeError('养老金计算参数无效');
    }

    const { retireAge, yearsToRetire, retireYear } = retirementInfo;
    if (!Number.isInteger(data.currentAge) || data.currentAge < 18
        || !Number.isInteger(retireAge) || retireAge < 40 || retireAge > 70
        || data.currentAge >= retireAge
        || !Number.isInteger(yearsToRetire) || yearsToRetire !== retireAge - data.currentAge
        || !Number.isInteger(retireYear)) {
        throw new RangeError('当前年龄、退休年龄、剩余年限或退休年份无效');
    }
    if (!Number.isFinite(data.paidYears) || data.paidYears < 0 || data.paidYears > 60
        || !Number.isInteger(data.paidYears * 2)) {
        throw new RangeError('已缴费年限必须在0至60年之间，并按0.5年填写');
    }
    if (!Number.isFinite(data.avgSalary) || data.avgSalary <= 0
        || !Number.isFinite(data.accountBalance) || data.accountBalance < 0
        || !Number.isFinite(data.salaryBase) || data.salaryBase <= 0
        || !Number.isFinite(data.pastAvgIndex) || data.pastAvgIndex < 0) {
        throw new RangeError('工资、账户余额或缴费指数无效');
    }
    if (!Number.isFinite(data.salaryGrowth) || data.salaryGrowth < 0 || data.salaryGrowth > 0.2
        || !Number.isFinite(data.socAvgGrowth) || data.socAvgGrowth < 0 || data.socAvgGrowth > 0.2
        || !Number.isFinite(data.interestRate) || data.interestRate < 0 || data.interestRate > 0.1) {
        throw new RangeError('增长率或个人账户记账利率超出允许范围');
    }
    if (!['follow_salary', 'fixed'].includes(data.baseChangeMode)
        || !['continuous', 'stop_early'].includes(data.paymentPlan)) {
        throw new RangeError('缴费基数变化方式或缴费规划无效');
    }
    if (data.paymentPlan === 'stop_early' && (
        !Number.isInteger(data.stopAge)
        || data.stopAge < data.currentAge
        || data.stopAge > retireAge
    )) {
        throw new RangeError('停止缴费年龄必须在当前年龄至退休年龄之间');
    }
    if (data.futureAvgIndex !== null && data.futureAvgIndex !== undefined && (
        !Number.isFinite(data.futureAvgIndex) ||
        data.futureAvgIndex < MIN_CONTRIBUTION_RATE ||
        data.futureAvgIndex > MAX_CONTRIBUTION_RATE
    )) {
        throw new RangeError('未来平均缴费指数必须在0.6至3之间');
    }

    const currentYear = retireYear - yearsToRetire;
    const minimumContributionYears = getMinimumContributionYears(retireYear);
    const futureAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, yearsToRetire);
    const paymentMonths = getPaymentMonths(retireAge);
    const details = [];

    let accumulatedBalance = data.accountBalance;
    let accumulatedYears = data.paidYears;
    let accumulatedIndex = data.pastAvgIndex * data.paidYears;

    for (let i = 0; i <= yearsToRetire; i++) {
        const age = data.currentAge + i;
        const yearsToRetireFromHere = yearsToRetire - i;
        const isRetirementYear = i === yearsToRetire;
        const isContributionYear = !isRetirementYear && (
            data.paymentPlan !== 'stop_early' || age < data.stopAge
        );
        const currentYearAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, i);
        const minBase = currentYearAvgSalary * MIN_CONTRIBUTION_RATE;
        const maxBase = currentYearAvgSalary * MAX_CONTRIBUTION_RATE;
        const baseBeforeClamp = data.baseChangeMode === 'fixed'
            ? data.salaryBase
            : data.salaryBase * Math.pow(1 + data.salaryGrowth, i);
        const clampedBase = Math.min(maxBase, Math.max(minBase, baseBeforeClamp));
        const yearBase = isContributionYear ? clampedBase : null;
        const yearContribution = isContributionYear
            ? yearBase * PERSONAL_CONTRIBUTION_RATE * 12
            : null;
        const weightedAvgIndex = accumulatedYears > 0
            ? accumulatedIndex / accumulatedYears
            : 0;
        const balanceAtRetirement = accumulatedBalance * Math.pow(
            1 + data.interestRate,
            yearsToRetireFromHere
        );
        const eligible = accumulatedYears >= minimumContributionYears;
        const eligibilityGap = Math.max(0, minimumContributionYears - accumulatedYears);
        const basicPensionIfStop = eligible
            ? futureAvgSalary * (1 + weightedAvgIndex) / 2 * accumulatedYears * BASIC_PENSION_RATE
            : null;
        const personalPensionIfStop = eligible
            ? balanceAtRetirement / paymentMonths
            : null;
        const pensionIfStop = eligible
            ? basicPensionIfStop + personalPensionIfStop
            : null;

        const yearEndBalance = isRetirementYear
            ? accumulatedBalance
            : accumulatedBalance * (1 + data.interestRate) + (yearContribution || 0);

        details.push({
            year: currentYear + i,
            age,
            isRetirementYear,
            isContributionYear,
            yearBase,
            yearContribution,
            accumulatedBalance: yearEndBalance,
            accumulatedYears,
            weightedAvgIndex,
            balanceAtRetirement,
            basicPensionIfStop,
            personalPensionIfStop,
            pensionIfStop,
            currentYearAvgSalary,
            minBase,
            maxBase,
            isRaisedByMinBase: isContributionYear && baseBeforeClamp < minBase,
            isLoweredByMaxBase: isContributionYear && baseBeforeClamp > maxBase,
            minimumContributionYears,
            eligible,
            eligibilityGap
        });

        if (isContributionYear) {
            const contributionIndex = data.futureAvgIndex === null || data.futureAvgIndex === undefined
                ? yearBase / currentYearAvgSalary
                : data.futureAvgIndex;
            accumulatedIndex += contributionIndex;
            accumulatedYears += 1;
        }
        accumulatedBalance = yearEndBalance;
    }

    return details;
}

/**
 * 从年度轨迹退休行派生养老金汇总，避免余额、年限和缴费指数出现第二套口径。
 * 未达到退休年份最低缴费年限时仅返回账户余额，待遇金额统一为null。
 * @param {Object} data 表单输入
 * @param {Object} retirementInfo 退休年龄、剩余年限和退休年份
 * @returns {Object} 养老金估算结果
 */
function calculatePension(data, retirementInfo) {
    const yearDetails = calculateYearDetails(data, retirementInfo);
    const retirementRow = yearDetails[yearDetails.length - 1];
    const balanceFutureValue = data.accountBalance * Math.pow(
        1 + data.interestRate,
        retirementInfo.yearsToRetire
    );

    return {
        totalPension: retirementRow.pensionIfStop,
        basicPension: retirementRow.basicPensionIfStop,
        personalPension: retirementRow.personalPensionIfStop,
        totalAccountBalance: retirementRow.accumulatedBalance,
        totalYears: retirementRow.accumulatedYears,
        paymentMonths: getPaymentMonths(retirementInfo.retireAge),
        futureAvgSalary: retirementRow.currentYearAvgSalary,
        currentAvgSalary: data.avgSalary,
        weightedAvgIndex: retirementRow.weightedAvgIndex,
        balanceFutureValue,
        futureContributionTotal: Math.max(0, retirementRow.accumulatedBalance - balanceFutureValue),
        yearDetails,
        futureAvgIndexCalculated: data.futureAvgIndex === null || data.futureAvgIndex === undefined,
        baseChangeMode: data.baseChangeMode,
        minimumContributionYears: retirementRow.minimumContributionYears,
        eligible: retirementRow.eligible,
        eligibilityGap: retirementRow.eligibilityGap
    };
}

/** 浏览器和Node测试共用同一导出对象，避免两套入口产生差异。 */
const PensionCalculatorCore = {
    calculatePension,
    calculateYearDetails,
    getPaymentMonths,
    getMinimumContributionYears,
    PERSONAL_CONTRIBUTION_RATE,
    BASIC_PENSION_RATE,
    MIN_CONTRIBUTION_RATE,
    MAX_CONTRIBUTION_RATE
};

if (typeof window !== 'undefined') {
    window.PensionCalculatorCore = PensionCalculatorCore;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PensionCalculatorCore;
}
