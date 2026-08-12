/**
 * 贷款、定投与目标规划共用的金融计算规则。
 */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FinanceCalculations = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    /** 周期名对应的一年期数，供页面校验计划周期与明细粒度。 */
    const PERIODS_PER_YEAR = Object.freeze({
        day: 365,
        week: 52,
        month: 12,
        quarter: 4,
        year: 1
    });

    /** 单次计划允许生成的最大明细期数，避免输入异常大时阻塞页面。 */
    const MAX_PLAN_PERIODS = 5000;
    /** 贷款明细的最大期数。 */
    const MAX_INSTALLMENT_PERIODS = 1200;
    /** 资金耗尽推演的最大月数（200 年），超出视为可长期维持。 */
    const MAX_RUNWAY_MONTHS = 2400;

    /** 国内贷款报价为名义年利率，月利率按年利率直接除以 12。 */
    function nominalMonthlyRate(annualPercent) {
        const rate = Number(annualPercent) / 100 / 12;
        if (!Number.isFinite(rate) || rate <= -1) {
            throw new RangeError('年利率无法换算为有效月利率');
        }
        return rate;
    }

    /** 按名义年利率计算等额本息的每期还款额，零利率时平均偿还本金。 */
    function equalPayment(principal, annualPercent, totalPeriods) {
        const amount = Number(principal);
        const periods = Number(totalPeriods);
        if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(periods) || periods <= 0) {
            throw new RangeError('贷款本金和还款期数必须有效');
        }

        const rate = nominalMonthlyRate(annualPercent);
        if (rate === 0) return amount / periods;

        const factor = Math.pow(1 + rate, periods);
        const payment = amount * rate * factor / (factor - 1);
        if (!Number.isFinite(payment)) {
            throw new RangeError('贷款参数无法计算出有限月供');
        }
        return payment;
    }

    /** 将正整数贷款年限转换为月数，拒绝小数年限被页面静默截断。 */
    function loanYearsToMonths(years) {
        const value = Number(years);
        const months = value * 12;
        if (!Number.isSafeInteger(value) || value <= 0 || !Number.isSafeInteger(months)
            || months > MAX_INSTALLMENT_PERIODS) {
            throw new RangeError('贷款年限必须是 1 到 100 之间的正整数');
        }
        return months;
    }

    function effectivePeriodRate(annualPercent, periodsPerYear) {
        const annualRate = Number(annualPercent) / 100;
        const periods = Number(periodsPerYear);
        if (!Number.isFinite(annualRate) || annualRate <= -1 || !Number.isInteger(periods) || periods <= 0) {
            throw new RangeError('年化收益率或周期无效');
        }

        const rate = Math.pow(1 + annualRate, 1 / periods) - 1;
        if (!Number.isFinite(rate) || rate <= -1) {
            throw new RangeError('年化收益率无法换算为有效周期收益率');
        }
        return rate;
    }

    /** 校验定投输入，并返回页面生成逐期计划所需的期数与周期利率。 */
    function validateRecurringInvestment(params) {
        const amount = Number(params.amount);
        const annualPercent = Number(params.annualPercent);
        const years = Number(params.years);
        const periodsPerYear = Number(params.periodsPerYear);

        if (!Number.isFinite(amount) || amount <= 0) {
            return { valid: false, error: '定投金额必须大于 0' };
        }
        if (!Number.isFinite(years) || years <= 0 || !Number.isInteger(periodsPerYear) || periodsPerYear <= 0) {
            return { valid: false, error: '投资年限和投资周期必须有效' };
        }
        if (!Number.isFinite(annualPercent) || annualPercent <= -100) {
            return { valid: false, error: '年化收益率必须是大于 -100% 的有限数值' };
        }

        const totalPeriods = years * periodsPerYear;
        if (!Number.isInteger(totalPeriods) || totalPeriods <= 0) {
            return { valid: false, error: '投资年限必须对应完整的定投期数' };
        }
        if (totalPeriods > MAX_PLAN_PERIODS) {
            return { valid: false, error: `定投明细不能超过 ${MAX_PLAN_PERIODS} 期` };
        }

        let periodRate;
        try {
            periodRate = effectivePeriodRate(annualPercent, periodsPerYear);
        } catch (error) {
            return { valid: false, error: error.message };
        }

        return { valid: true, totalPeriods, periodRate };
    }

    /** 判断源周期数据能否无拆分地汇总到指定展示粒度。 */
    function canAggregatePeriods(sourcePeriodsPerYear, viewType, totalPeriods) {
        const sourcePeriods = Number(sourcePeriodsPerYear);
        const viewPeriods = PERIODS_PER_YEAR[viewType];
        const canAggregate = Number.isInteger(sourcePeriods)
            && sourcePeriods > 0
            && Number.isInteger(viewPeriods)
            && viewPeriods <= sourcePeriods
            && sourcePeriods % viewPeriods === 0;
        if (!canAggregate || totalPeriods === undefined) return canAggregate;

        const count = Number(totalPeriods);
        const groupSize = sourcePeriods / viewPeriods;
        return Number.isInteger(count) && count >= 0 && count % groupSize === 0;
    }

    /** 将逐期明细按可用展示粒度分组；不能准确汇总时直接拒绝。 */
    function groupPeriods(periodData, sourcePeriodsPerYear, viewType) {
        if (!Array.isArray(periodData)
            || !canAggregatePeriods(sourcePeriodsPerYear, viewType, periodData.length)) {
            throw new RangeError('源周期数据无法按该粒度汇总');
        }

        const groupSize = sourcePeriodsPerYear / PERIODS_PER_YEAR[viewType];
        const groups = [];
        for (let start = 0; start < periodData.length; start += groupSize) {
            groups.push(periodData.slice(start, start + groupSize));
        }
        return groups;
    }

    /** 支出调整最多条数，避免异常输入拖垮页面。 */
    const MAX_RUNWAY_ADJUSTMENTS = 50;

    /**
     * 规范化资金耗尽的阶段性支出调整。
     * afterYears：满该年后的下一月生效；applyInflation 默认 true，表示按初始购买力×累计通胀换算。
     */
    function normalizeRunwayAdjustments(adjustments) {
        if (adjustments == null) {
            return { valid: true, adjustments: [] };
        }
        if (!Array.isArray(adjustments)) {
            return { valid: false, error: '支出调整列表格式无效' };
        }
        if (adjustments.length > MAX_RUNWAY_ADJUSTMENTS) {
            return { valid: false, error: `支出调整不能超过 ${MAX_RUNWAY_ADJUSTMENTS} 条` };
        }

        const normalized = [];
        for (let index = 0; index < adjustments.length; index += 1) {
            const item = adjustments[index] || {};
            const afterYears = Number(item.afterYears);
            const monthlySpend = Number(item.monthlySpend);
            if (!Number.isInteger(afterYears) || afterYears <= 0 || afterYears > 200) {
                return { valid: false, error: `第 ${index + 1} 条调整：年数须为 1 到 200 的整数` };
            }
            if (!Number.isFinite(monthlySpend) || monthlySpend <= 0) {
                return { valid: false, error: `第 ${index + 1} 条调整：每月支出须大于 0` };
            }
            normalized.push({
                afterYears,
                startMonth: afterYears * 12 + 1,
                monthlySpend,
                applyInflation: item.applyInflation !== false
            });
        }

        normalized.sort((left, right) => {
            if (left.startMonth !== right.startMonth) return left.startMonth - right.startMonth;
            return left.afterYears - right.afterYears;
        });
        return { valid: true, adjustments: normalized };
    }

    /**
     * 计算初始资金在年化收益、通胀与每月支出下还能支撑多久。
     * 口径：名义月利率/月通胀 = 年化%/12；每月先计息，再于月末支出，随后按月通胀上调支出。
     * 勾选「考虑通胀」的调整：新支出 = 填写金额 × 自起点累计通胀因子（如 1000→2000 时改 800 → 1600）。
     */
    function calculateCapitalRunway(params) {
        const principal = Number(params.principal);
        const annualPercent = Number(params.annualPercent);
        const monthlySpendInput = Number(params.monthlySpend);
        const inflationRaw = params.inflationPercent;
        const inflationPercent = inflationRaw === undefined || inflationRaw === null || inflationRaw === ''
            ? 0
            : Number(inflationRaw);
        const normalizedAdjustments = normalizeRunwayAdjustments(params.adjustments);
        if (!normalizedAdjustments.valid) {
            return normalizedAdjustments;
        }
        const adjustments = normalizedAdjustments.adjustments;

        if (!Number.isFinite(principal) || principal <= 0) {
            return { valid: false, error: '初始资金必须大于 0' };
        }
        if (!Number.isFinite(annualPercent) || annualPercent < 0 || annualPercent > 100) {
            return { valid: false, error: '年化收益率必须在 0% 到 100% 之间' };
        }
        if (!Number.isFinite(monthlySpendInput) || monthlySpendInput <= 0) {
            return { valid: false, error: '每月支出必须大于 0' };
        }
        if (!Number.isFinite(inflationPercent) || inflationPercent < 0 || inflationPercent > 100) {
            return { valid: false, error: '年通胀率必须在 0% 到 100% 之间' };
        }

        let monthlyRate;
        let monthlyInflation;
        try {
            monthlyRate = nominalMonthlyRate(annualPercent);
            monthlyInflation = nominalMonthlyRate(inflationPercent);
        } catch (error) {
            return { valid: false, error: error.message };
        }

        // 无调整、无通胀且月支出不超过当月利息时，本金不会被消耗完
        if (adjustments.length === 0
            && monthlyInflation === 0
            && monthlyRate > 0
            && monthlySpendInput <= principal * monthlyRate + 1e-9) {
            return {
                valid: true,
                sustainable: true,
                months: null,
                years: null,
                totalWithdrawn: null,
                yearDetails: []
            };
        }

        let balance = principal;
        let spend = monthlySpendInput;
        let inflationFactor = 1;
        let month = 0;
        let totalWithdrawn = 0;
        let adjustmentIndex = 0;
        const yearDetails = [];
        let yearStartBalance = principal;
        let yearInterest = 0;
        let yearWithdrawn = 0;

        while (balance > 1e-9 && month < MAX_RUNWAY_MONTHS) {
            month += 1;

            while (adjustmentIndex < adjustments.length
                && adjustments[adjustmentIndex].startMonth === month) {
                const adjustment = adjustments[adjustmentIndex];
                spend = adjustment.applyInflation
                    ? adjustment.monthlySpend * inflationFactor
                    : adjustment.monthlySpend;
                adjustmentIndex += 1;
            }

            const interest = balance * monthlyRate;
            const available = balance + interest;
            const withdrawn = Math.min(spend, available);
            balance = available - withdrawn;

            yearInterest += interest;
            yearWithdrawn += withdrawn;
            totalWithdrawn += withdrawn;
            spend *= (1 + monthlyInflation);
            inflationFactor *= (1 + monthlyInflation);

            const yearEnded = month % 12 === 0;
            const depleted = balance <= 1e-9;
            if (yearEnded || depleted) {
                yearDetails.push({
                    year: Math.ceil(month / 12),
                    startBalance: yearStartBalance,
                    interest: yearInterest,
                    withdrawn: yearWithdrawn,
                    endBalance: Math.max(0, balance),
                    monthlySpend: spend / (1 + monthlyInflation)
                });
                yearStartBalance = Math.max(0, balance);
                yearInterest = 0;
                yearWithdrawn = 0;
            }

            if (depleted) break;
        }

        if (balance > 1e-9) {
            return {
                valid: true,
                sustainable: true,
                capped: true,
                months: null,
                years: null,
                totalWithdrawn: null,
                yearDetails
            };
        }

        return {
            valid: true,
            sustainable: false,
            months: month,
            years: month / 12,
            totalWithdrawn,
            yearDetails
        };
    }

    /** 计算按所选周期投入的目标计划，时长严格表示正整数期数。 */
    function calculateTargetPlan(params) {
        const target = Number(params.target);
        const duration = Number(params.duration);
        const periodsPerYear = Number(params.periodsPerYear);

        if (!Number.isFinite(target) || target <= 0) {
            return { valid: false, error: '目标金额必须大于 0' };
        }
        if (!Number.isInteger(duration) || duration <= 0) {
            return { valid: false, error: '计划时长必须是大于 0 的整数期数' };
        }
        if (duration > MAX_PLAN_PERIODS) {
            return { valid: false, error: `计划明细不能超过 ${MAX_PLAN_PERIODS} 期` };
        }

        let periodRate;
        try {
            periodRate = effectivePeriodRate(params.annualPercent, periodsPerYear);
        } catch (error) {
            return { valid: false, error: error.message };
        }

        const growth = Math.pow(1 + periodRate, duration);
        const periodRequired = periodRate === 0
            ? target / duration
            : target * periodRate / (growth - 1);
        if (!Number.isFinite(periodRequired) || periodRequired <= 0) {
            return { valid: false, error: '当前参数无法计算出有限的每期投入' };
        }

        const periodData = [];
        let currentAmount = 0;
        for (let period = 1; period <= duration; period += 1) {
            const startAmount = currentAmount;
            const interest = startAmount * periodRate;
            currentAmount = startAmount + interest + periodRequired;
            periodData.push({
                startAmount,
                investment: periodRequired,
                interest,
                endAmount: currentAmount
            });
        }

        if (!Number.isFinite(periodData[periodData.length - 1].endAmount)) {
            return { valid: false, error: '当前参数无法生成有限的目标计划' };
        }

        const totalRequired = periodRequired * duration;
        const totalInterest = target - totalRequired;
        if (!Number.isFinite(totalRequired) || !Number.isFinite(totalInterest)) {
            return { valid: false, error: '当前参数产生的投入金额过大，请缩短计划或调整收益率' };
        }
        return {
            valid: true,
            periodRate,
            periodRequired,
            totalRequired,
            totalInterest,
            periodData
        };
    }

    return {
        PERIODS_PER_YEAR,
        MAX_INSTALLMENT_PERIODS,
        MAX_RUNWAY_MONTHS,
        MAX_RUNWAY_ADJUSTMENTS,
        nominalMonthlyRate,
        equalPayment,
        loanYearsToMonths,
        validateRecurringInvestment,
        canAggregatePeriods,
        groupPeriods,
        normalizeRunwayAdjustments,
        calculateCapitalRunway,
        calculateTargetPlan
    };
});
