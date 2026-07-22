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
    /** 贷款和信用卡明细的最大期数。 */
    const MAX_INSTALLMENT_PERIODS = 1200;

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
        nominalMonthlyRate,
        equalPayment,
        loanYearsToMonths,
        validateRecurringInvestment,
        canAggregatePeriods,
        groupPeriods,
        calculateTargetPlan
    };
});
