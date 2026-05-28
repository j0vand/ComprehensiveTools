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

    function calculateYearlyNetOutflow(params, age) {
        const yearsFromNow = age - params.currentAge;
        const inflatedMonthlyExpense = applyInflation(params.monthlyExpense, 0, yearsFromNow, params.inflationRate);
        const inflatedMonthlyMedicalExpense = applyInflation(params.medicalMonthlyExpense, params.currentAge, age, params.inflationRate);
        const yearlyPension = age >= params.pensionAge
            ? params.expectedPension * Math.pow(1 + params.pensionGrowthRate, age - params.pensionAge) * 12
            : 0;

        return Math.max(0, (inflatedMonthlyExpense + inflatedMonthlyMedicalExpense) * 12 - yearlyPension);
    }

    function calculateStopSavingAssetSeries(params) {
        const trendData = Array.isArray(params.trendData) ? params.trendData : [];
        if (params.firstFireAge === -1 || trendData.length === 0) {
            return trendData.map(item => item.assets);
        }

        const extraSavingYearsAfterFire = Math.max(0, Number(params.extraSavingYearsAfterFire) || 0);
        const stopSavingAge = params.firstFireAge + extraSavingYearsAfterFire;
        let postStopBalance = null;
        let reserveDeducted = false;

        return trendData.map(item => {
            if (item.age <= stopSavingAge) {
                return item.assets;
            }

            if (postStopBalance === null) {
                const stopPoint = trendData.find(point => point.age === stopSavingAge);
                postStopBalance = stopPoint ? stopPoint.assets : item.assets;
            }

            postStopBalance = postStopBalance * (1 + params.investmentReturn);
            if (!reserveDeducted) {
                postStopBalance -= applyInflation(params.medicalReserve, params.currentAge, stopSavingAge, params.inflationRate);
                reserveDeducted = true;
            }
            postStopBalance -= calculateYearlyNetOutflow(params, item.age - 1);

            return postStopBalance;
        });
    }

    return {
        calculateStopSavingAssetSeries,
        calculateYearlyNetOutflow
    };
});
