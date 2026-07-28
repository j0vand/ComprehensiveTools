/**
 * FIRE 资产轨迹计算
 */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FireProjection = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    function applyInflation(baseValue, years, rate) {
        return baseValue * Math.pow(1 + rate, Math.max(0, years));
    }

    /** 统一计算指定年龄的月度与年度现金流，供资金需求、曲线和明细共用。 */
    function calculateYearlyCashflow(params, age) {
        const yearsFromNow = age - params.currentAge;
        const monthlyExpense = applyInflation(params.monthlyExpense, yearsFromNow, params.inflationRate);
        const monthlyMedicalExpense = applyInflation(
            params.medicalMonthlyExpense,
            yearsFromNow,
            params.inflationRate
        );
        const monthlyPension = age >= params.pensionAge
            ? params.expectedPension * Math.pow(1 + params.pensionGrowthRate, age - params.pensionAge)
            : 0;
        const monthlyGrossSpending = monthlyExpense + monthlyMedicalExpense;
        const monthlyNetOutflow = Math.max(0, monthlyGrossSpending - monthlyPension);

        return {
            monthlyExpense,
            monthlyMedicalExpense,
            monthlyPension,
            monthlyNetOutflow,
            yearlyGrossSpending: monthlyGrossSpending * 12,
            yearlyPension: monthlyPension * 12,
            yearlyNetOutflow: monthlyNetOutflow * 12
        };
    }

    /** 退休所需资金包含未来净支出的现值，以及退休时单独预留的医疗备用金。 */
    function calculateRequiredSpendingCapitalAtAge(params) {
        let requiredCapital = 0;

        for (let year = params.retireAge; year < params.lifeExpectancy; year++) {
            const discountYears = year - params.retireAge;
            requiredCapital += calculateYearlyCashflow(params, year).yearlyNetOutflow
                / Math.pow(1 + params.investmentReturn, discountYears);
        }

        const medicalReserve = Math.max(0, Number(params.medicalReserve) || 0);
        return requiredCapital + applyInflation(
            medicalReserve,
            params.retireAge - params.currentAge,
            params.inflationRate
        );
    }

    function calculateStopSavingAssetSeries(params) {
        const trendData = Array.isArray(params.trendData) ? params.trendData : [];
        if (params.firstFireAge === -1 || trendData.length === 0) {
            return trendData.map(item => item.assets);
        }

        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        const stopSavingAge = params.firstFireAge + extraSavingYearsAfterFire;
        const stopPoint = trendData.find(point => point.age === stopSavingAge);
        const medicalReserve = applyInflation(
            Math.max(0, Number(params.medicalReserve) || 0),
            stopSavingAge - params.currentAge,
            params.inflationRate
        );
        let postStopBalance = stopPoint ? stopPoint.assets : 0;

        return trendData.map(item => {
            if (item.age <= stopSavingAge) {
                return item.assets;
            }

            if (item.age === stopSavingAge + 1) {
                postStopBalance -= medicalReserve;
            }
            postStopBalance -= calculateYearlyCashflow(params, item.age - 1).yearlyNetOutflow;
            postStopBalance = Math.max(0, postStopBalance * (1 + params.investmentReturn));

            return postStopBalance;
        });
    }

    function calculateActualRetireAge(params) {
        if (params.firstFireAge === -1 || params.firstFireAge === null || params.firstFireAge === undefined) {
            return null;
        }
        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        const actualRetireAge = params.firstFireAge + extraSavingYearsAfterFire;
        if (Number.isFinite(params.lifeExpectancy) && actualRetireAge >= params.lifeExpectancy) {
            return null;
        }
        return actualRetireAge;
    }

    /** 退休某年：先扣净支出（退休首年另扣医疗备用金），剩余资产再计理财收益。 */
    function calculateRetirementYearInvestmentGain(params) {
        const startingAssets = Math.max(0, Number(params.startingAssets) || 0);
        const rate = Number(params.investmentReturn) || 0;
        const cashflow = calculateYearlyCashflow(params, params.age);
        const medicalReserve = params.age === params.retireAge
            ? applyInflation(
                Math.max(0, Number(params.medicalReserve) || 0),
                params.retireAge - params.currentAge,
                params.inflationRate
            )
            : 0;
        const remaining = Math.max(0, startingAssets - cashflow.yearlyNetOutflow - medicalReserve);
        return remaining * rate;
    }

    /** 生成严格早于预期寿命的 FIRE 候选轨迹，寿命年龄本身不参与判定。 */
    function calculateFireTrend(params) {
        const trendData = [];
        let firstFireAge = -1;
        let firstFireAssets = 0;
        let assetsAtRetire = params.currentAssets;

        for (let retireAge = params.currentAge; retireAge < params.lifeExpectancy; retireAge += 1) {
            const requiredCapital = calculateRequiredSpendingCapitalAtAge({
                ...params,
                retireAge
            });
            const isFire = assetsAtRetire >= requiredCapital;
            // 累积期：以该年龄初动态本金计当年理财收益，之后再计入年储蓄
            const yearlyInvestmentGain = assetsAtRetire * params.investmentReturn;
            trendData.push({
                age: retireAge,
                assets: assetsAtRetire,
                required: requiredCapital,
                yearlyInvestmentGain,
                isFire
            });

            if (isFire && firstFireAge === -1) {
                firstFireAge = retireAge;
                firstFireAssets = assetsAtRetire;
            }
            assetsAtRetire = assetsAtRetire * (1 + params.investmentReturn) + params.annualSavings;
        }

        return { trendData, firstFireAge, firstFireAssets };
    }

    /** 按退休年初可用资金判断耗尽年份，医疗备用金仅在退休首年划出一次。 */
    function calculateAssetDepletionAge(trendData, assetSeries, params) {
        if (!Array.isArray(trendData) || !Array.isArray(assetSeries)) return null;
        const actualRetireAge = params && params.actualRetireAge;
        if (!Number.isInteger(actualRetireAge)) return null;

        const medicalReserve = applyInflation(
            Math.max(0, Number(params.medicalReserve) || 0),
            actualRetireAge - params.currentAge,
            params.inflationRate
        );
        for (let i = 0; i < trendData.length; i += 1) {
            const age = trendData[i].age;
            if (age < actualRetireAge) continue;

            const yearlyNeed = calculateYearlyCashflow(params, age).yearlyNetOutflow
                + (age === actualRetireAge ? medicalReserve : 0);
            if (yearlyNeed > 0 && assetSeries[i] <= yearlyNeed) return age;
        }
        return null;
    }

    function calculateSafetyMetrics(params) {
        const assets = Number(params.assets) || 0;
        const required = Number(params.required) || 0;
        const buffer = assets - required;
        const ratio = required > 0 ? assets / required : null;
        let level = '充足';

        if (ratio !== null) {
            if (ratio < 1) {
                level = '不足';
            } else if (ratio < 1.2) {
                level = '勉强';
            } else if (ratio < 1.5) {
                level = '较稳';
            }
        }

        return {
            buffer,
            ratio,
            level
        };
    }

    /** 校验 FIRE 页面输入边界；失败时返回首个可直接展示给用户的原因。 */
    function validateInputs(params) {
        const warnings = [];

        if (!Number.isInteger(params.currentAge) || params.currentAge < 18 || params.currentAge > 70) {
            return { valid: false, error: '当前年龄必须是 18 到 70 之间的整数' };
        }
        if (!Number.isInteger(params.lifeExpectancy)
            || params.lifeExpectancy < 50 || params.lifeExpectancy > 120) {
            return { valid: false, error: '预期寿命必须是 50 到 120 之间的整数' };
        }
        if (params.currentAge >= params.lifeExpectancy) {
            return { valid: false, error: '当前年龄不能大于或等于预期寿命' };
        }
        if (!Number.isFinite(params.currentAssets) || params.currentAssets < 0
            || params.currentAssets > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: '当前已有资产必须是大于或等于 0 且不过大的有限数值' };
        }
        if (!Number.isFinite(params.annualSavings) || params.annualSavings < 0
            || params.annualSavings > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: '每年可存金额必须是大于或等于 0 且不过大的有限数值' };
        }
        if (!Number.isFinite(params.monthlyExpense) || params.monthlyExpense < 0
            || params.monthlyExpense > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: '期望月生活费必须是大于或等于 0 且不过大的有限数值' };
        }
        if (!Number.isFinite(params.medicalMonthlyExpense) || params.medicalMonthlyExpense < 0
            || params.medicalMonthlyExpense > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: '当前月医疗支出必须是大于或等于 0 且不过大的有限数值' };
        }
        if (!Number.isFinite(params.medicalReserve) || params.medicalReserve < 0
            || params.medicalReserve > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: '医疗备用金必须是大于或等于 0 且不过大的有限数值' };
        }
        if (params.targetRetireAge !== null
            && (!Number.isInteger(params.targetRetireAge)
                || params.targetRetireAge < 30 || params.targetRetireAge > 80)) {
            return { valid: false, error: '目标退休年龄必须留空，或填写 30 到 80 之间的整数' };
        }
        if (!Number.isInteger(params.extraSavingYearsAfterFire)
            || params.extraSavingYearsAfterFire < 0 || params.extraSavingYearsAfterFire > 40) {
            return { valid: false, error: 'FIRE 后继续储蓄年数必须是 0 到 40 之间的整数' };
        }
        if (!Number.isFinite(params.expectedPension) || params.expectedPension < 0
            || params.expectedPension > Number.MAX_SAFE_INTEGER) {
            return { valid: false, error: '预计可领社保退休金必须是大于或等于 0 且不过大的有限数值' };
        }
        if (!Number.isInteger(params.pensionAge) || params.pensionAge < 50 || params.pensionAge > 70) {
            return { valid: false, error: '退休金开始领取年龄必须是 50 到 70 之间的整数' };
        }
        if (!Number.isFinite(params.inflationRate)
            || params.inflationRate < 0 || params.inflationRate > 0.1) {
            return { valid: false, error: '预期年通货膨胀率必须在 0% 到 10% 之间' };
        }
        if (!Number.isFinite(params.investmentReturn)
            || params.investmentReturn < 0 || params.investmentReturn > 0.15) {
            return { valid: false, error: '预期投资年化收益率必须在 0% 到 15% 之间' };
        }
        if (!Number.isFinite(params.pensionGrowthRate)
            || params.pensionGrowthRate < 0 || params.pensionGrowthRate > 0.1) {
            return { valid: false, error: '退休金年增长比例必须在 0% 到 10% 之间' };
        }

        const realReturn = (1 + params.investmentReturn) / (1 + params.inflationRate) - 1;
        if (realReturn < 0) {
            warnings.push(
                '投资收益率（' + (params.investmentReturn * 100).toFixed(1) + '%）低于通胀率（' +
                (params.inflationRate * 100).toFixed(1) + '%），实际收益率为负，资产会被通胀侵蚀'
            );
        }

        return { valid: true, warnings };
    }

    /** 按目标退休年龄反推每年年末需存入的金额。 */
    function calculateTargetAnnualSavings(params) {
        if (params.targetRetireAge === null || Number.isNaN(params.targetRetireAge)) {
            return {
                requiredAnnualSavings: null,
                desc: '未填写目标退休年龄，未执行反推'
            };
        }
        if (params.targetRetireAge <= params.currentAge) {
            return {
                requiredAnnualSavings: null,
                desc: '目标年龄 ' + params.targetRetireAge + ' 岁不大于当前年龄，无法反推'
            };
        }
        if (params.targetRetireAge >= params.lifeExpectancy) {
            return {
                requiredAnnualSavings: null,
                desc: '目标年龄需小于预期寿命（当前寿命设置为 ' + params.lifeExpectancy + ' 岁）'
            };
        }

        const requiredCapital = calculateRequiredSpendingCapitalAtAge({
            ...params,
            retireAge: params.targetRetireAge
        });
        const years = params.targetRetireAge - params.currentAge;
        const assetFutureValue = params.currentAssets * Math.pow(1 + params.investmentReturn, years);
        const gap = requiredCapital - assetFutureValue;

        if (gap <= 0) {
            return {
                requiredAnnualSavings: 0,
                desc: '按目标 ' + params.targetRetireAge + ' 岁退休，当前资产已覆盖所需资金'
            };
        }

        const factor = params.investmentReturn === 0
            ? years
            : (Math.pow(1 + params.investmentReturn, years) - 1) / params.investmentReturn;
        return {
            requiredAnnualSavings: gap / factor,
            desc: '目标退休年龄 ' + params.targetRetireAge + ' 岁，反推年储蓄额'
        };
    }

    return {
        calculateStopSavingAssetSeries,
        calculateActualRetireAge,
        calculateFireTrend,
        calculateAssetDepletionAge,
        calculateSafetyMetrics,
        validateInputs,
        calculateTargetAnnualSavings,
        calculateRequiredSpendingCapitalAtAge,
        calculateYearlyCashflow,
        calculateRetirementYearInvestmentGain
    };
});
