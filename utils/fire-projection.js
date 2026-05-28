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

    function applyInflation(baseValue, fromAge, toAge, rate) {
        return baseValue * Math.pow(1 + rate, Math.max(0, toAge - fromAge));
    }

    function thousandYuanToYuan(value) {
        const numericValue = Number(value) || 0;
        return numericValue * 1000;
    }

    function calculateYearlyNetOutflow(params, age) {
        const yearsFromNow = age - params.currentAge;
        const inflatedMonthlyExpense = applyInflation(params.monthlyExpense, 0, yearsFromNow, params.inflationRate);
        const inflatedMonthlyMedicalExpense = applyInflation(params.medicalMonthlyExpense, params.currentAge, age, params.inflationRate);
        const yearlyPension = age >= params.pensionAge
            ? params.expectedPension * Math.pow(1 + params.pensionGrowthRate, age - params.pensionAge) * 12
            : 0;

        return Math.max(0, (inflatedMonthlyExpense + inflatedMonthlyMedicalExpense) * 12 - yearlyPension);
    }

    function calculateYearlyGrossSpending(params, age) {
        const yearsFromNow = age - params.currentAge;
        const inflatedMonthlyExpense = applyInflation(params.monthlyExpense, 0, yearsFromNow, params.inflationRate);
        const inflatedMonthlyMedicalExpense = applyInflation(params.medicalMonthlyExpense, params.currentAge, age, params.inflationRate);

        return (inflatedMonthlyExpense + inflatedMonthlyMedicalExpense) * 12;
    }

    function calculateRequiredSpendingCapitalAtAge(params) {
        let requiredCapital = 0;

        for (let year = params.retireAge; year < params.lifeExpectancy; year++) {
            const netCashOutflow = calculateYearlyNetOutflow(params, year);
            const discountYears = year - params.retireAge;
            const presentValueOfOutflow = params.investmentReturn === 0
                ? netCashOutflow
                : netCashOutflow / Math.pow(1 + params.investmentReturn, discountYears);
            requiredCapital += presentValueOfOutflow;
        }

        return requiredCapital;
    }

    function calculateStopSavingAssetSeries(params) {
        const trendData = Array.isArray(params.trendData) ? params.trendData : [];
        if (params.firstFireAge === -1 || trendData.length === 0) {
            return trendData.map(item => item.assets);
        }

        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        const stopSavingAge = params.firstFireAge + extraSavingYearsAfterFire;
        let postStopBalance = null;

        return trendData.map(item => {
            if (item.age <= stopSavingAge) {
                return item.assets;
            }

            if (postStopBalance === null) {
                const stopPoint = trendData.find(point => point.age === stopSavingAge);
                postStopBalance = stopPoint ? stopPoint.assets : item.assets;
            }

            postStopBalance = postStopBalance * (1 + params.investmentReturn);
            postStopBalance -= calculateYearlyNetOutflow(params, item.age - 1);

            return postStopBalance;
        });
    }

    function calculateRequiredCapitalSeries(params) {
        const trendData = Array.isArray(params.trendData) ? params.trendData : [];
        if (params.firstFireAge === -1 || trendData.length === 0) {
            return trendData.map(item => item.required);
        }

        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        const actualRetireAge = params.firstFireAge + extraSavingYearsAfterFire;

        return trendData.map(item => item.age <= actualRetireAge ? item.required : null);
    }

    function calculateActualRetireAge(params) {
        if (params.firstFireAge === -1 || params.firstFireAge === null || params.firstFireAge === undefined) {
            return params.fallbackAge;
        }
        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        return params.firstFireAge + extraSavingYearsAfterFire;
    }

    function calculateAssetDepletionAge(trendData, assetSeries) {
        if (!Array.isArray(trendData) || !Array.isArray(assetSeries)) return null;
        for (let i = 0; i < trendData.length; i += 1) {
            if (assetSeries[i] !== null && assetSeries[i] !== undefined && assetSeries[i] <= 0) {
                return trendData[i].age;
            }
        }
        return null;
    }

    function calculateSafetyMetrics(params) {
        const assets = Number(params.assets) || 0;
        const required = Number(params.required) || 0;
        const buffer = assets - required;
        const ratio = required > 0 ? assets / required : Infinity;
        let level = '充足';

        if (ratio < 1) {
            level = '不足';
        } else if (ratio < 1.2) {
            level = '勉强';
        } else if (ratio < 1.5) {
            level = '较稳';
        }

        return {
            buffer,
            ratio,
            level
        };
    }

    function calculateAnnualSpendingSeries(params) {
        const trendData = Array.isArray(params.trendData) ? params.trendData : [];
        if (params.firstFireAge === -1 || trendData.length === 0) {
            return trendData.map(() => null);
        }

        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        const actualRetireAge = params.firstFireAge + extraSavingYearsAfterFire;

        return trendData.map(item => {
            if (item.age < actualRetireAge) return null;
            return calculateYearlyGrossSpending(params, item.age);
        });
    }

    return {
        calculateStopSavingAssetSeries,
        calculateRequiredCapitalSeries,
        calculateActualRetireAge,
        calculateAssetDepletionAge,
        calculateSafetyMetrics,
        calculateAnnualSpendingSeries,
        calculateRequiredSpendingCapitalAtAge,
        thousandYuanToYuan,
        calculateYearlyGrossSpending,
        calculateYearlyNetOutflow
    };
});
