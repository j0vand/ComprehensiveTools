/**
 * 养老金计算器核心逻辑
 */

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    // 绑定计算按钮事件
    document.getElementById('calculate-btn').addEventListener('click', calculatePension);
    
    // 绑定重置按钮事件
    document.getElementById('reset-btn').addEventListener('click', resetForm);
    
    // 绑定性别切换事件
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        radio.addEventListener('change', updateRetirementAgeNote);
    });
    
    // 绑定年龄变化事件
    document.getElementById('current-age').addEventListener('change', updateRetirementAgeNote);
    document.getElementById('plan-to-pay-years').addEventListener('change', updateRetirementAgeNote);
    
    // 初始化退休年龄提示
    updateRetirementAgeNote();
});

/**
 * 更新退休年龄提示信息
 */
function updateRetirementAgeNote() {
    const gender = document.querySelector('input[name="gender"]:checked').value;
    const currentAge = parseInt(document.getElementById('current-age').value) || 30;
    const planToPayYears = parseInt(document.getElementById('plan-to-pay-years').value) || 15;
    
    // 标准退休年龄
    const standardRetirementAge = gender === 'male' ? 60 : 55;
    
    // 预计退休年龄
    const estimatedRetirementAge = currentAge + planToPayYears;
    
    const retirementAgeNote = document.getElementById('retirement-age-note');
    
    if (estimatedRetirementAge < standardRetirementAge) {
        retirementAgeNote.textContent = `预计 ${estimatedRetirementAge} 岁退休，低于标准退休年龄 ${standardRetirementAge} 岁`;
        retirementAgeNote.style.color = 'var(--warning-color)';
    } else {
        retirementAgeNote.textContent = `预计 ${estimatedRetirementAge} 岁退休`;
        retirementAgeNote.style.color = 'var(--success-color)';
    }
}

/**
 * 计算养老金
 */
function calculatePension() {
    // 隐藏先前的错误信息和结果
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    
    // 获取表单数据
    const formData = getFormData();
    
    // 验证数据
    if (!validateFormData(formData)) {
        document.getElementById('error-message').classList.remove('hidden');
        return;
    }
    
    // 计算结果
    const results = performCalculation(formData);
    
    // 显示结果
    displayResults(results);
}

/**
 * 获取表单数据
 */
function getFormData() {
    return {
        gender: document.querySelector('input[name="gender"]:checked').value,
        currentAge: parseInt(document.getElementById('current-age').value) || 0,
        avgSalary: parseFloat(document.getElementById('avg-salary').value) || 0,
        paidYears: parseInt(document.getElementById('paid-years').value) || 0,
        planToPayYears: parseInt(document.getElementById('plan-to-pay-years').value) || 0,
        salaryBase: parseFloat(document.getElementById('salary-base').value) || 0,
        paymentRatio: parseFloat(document.getElementById('payment-ratio').value) || 8,
        avgIndex: parseFloat(document.getElementById('avg-index').value) || 1
    };
}

/**
 * 验证表单数据
 */
function validateFormData(data) {
    // 检查必填字段
    if (data.avgSalary <= 0) return false;
    if (data.currentAge <= 0) return false;
    if (data.salaryBase <= 0) return false;
    if (data.paymentRatio <= 0) return false;
    if (data.avgIndex <= 0) return false;
    
    // 年龄范围验证
    if (data.currentAge < 18 || data.currentAge > 65) return false;
    
    return true;
}

/**
 * 执行养老金计算
 */
function performCalculation(data) {
    // 计算退休年龄
    let retirementAge;
    if (data.gender === 'male') {
        retirementAge = Math.max(60, data.currentAge + data.planToPayYears);
    } else {
        retirementAge = Math.max(55, data.currentAge + data.planToPayYears);
    }
    
    // 计算累计缴费年限
    const totalPaidYears = data.paidYears + data.planToPayYears;
    
    // 计算个人账户累计金额 (月缴费基数 × 个人缴费比例 × 12个月 × 缴费年限)
    const personalAccountTotal = data.salaryBase * (data.paymentRatio / 100) * 12 * totalPaidYears;
    
    // 获取计发月数
    const paymentMonths = getPaymentMonths(data.gender, retirementAge);
    
    // 计算基础养老金 (当地月平均工资 × (1 + 个人平均缴费指数) ÷ 2 × 缴费年限 × 1%)
    const basicPension = data.avgSalary * (1 + data.avgIndex) / 2 * totalPaidYears * 0.01;
    
    // 计算个人账户养老金 (个人账户累计金额 ÷ 计发月数)
    const personalPension = personalAccountTotal / paymentMonths;
    
    // 计算月养老金总额
    const totalPension = basicPension + personalPension;
    
    // 计算替代率
    const replacementRate = (totalPension / data.avgSalary) * 100;
    
    return {
        retirementAge,
        totalPaidYears,
        personalAccountTotal,
        basicPension,
        personalPension,
        totalPension,
        replacementRate,
        paymentMonths
    };
}

/**
 * 显示计算结果
 */
function displayResults(results) {
    // 显示基本参数
    document.getElementById('retirement-age').textContent = `${results.retirementAge} 岁`;
    document.getElementById('total-paid-years').textContent = `${results.totalPaidYears} 年`;
    document.getElementById('personal-account-total').textContent = `${formatCurrency(results.personalAccountTotal)} 元`;
    
    // 显示养老金明细
    document.getElementById('basic-pension').textContent = `${formatCurrency(results.basicPension)}`;
    document.getElementById('personal-pension').textContent = `${formatCurrency(results.personalPension)}`;
    document.getElementById('total-pension').textContent = `${formatCurrency(results.totalPension)}`;
    document.getElementById('replacement-rate').textContent = `${results.replacementRate.toFixed(2)}%`;
    
    // 显示结果区域
    document.getElementById('results').classList.remove('hidden');
    
    // 滚动到结果区域
    document.getElementById('result-panel').scrollIntoView({ behavior: 'smooth' });
}

/**
 * 格式化货币显示
 */
function formatCurrency(value) {
    return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * 重置表单
 */
function resetForm() {
    // 重置性别为男性
    document.querySelector('input[value="male"]').checked = true;
    
    // 重置年龄为30
    document.getElementById('current-age').value = 30;
    
    // 重置平均工资
    document.getElementById('avg-salary').value = 8000;
    
    // 重置已缴费年限
    document.getElementById('paid-years').value = 0;
    
    // 重置计划缴费年限
    document.getElementById('plan-to-pay-years').value = 15;
    
    // 重置月缴费基数
    document.getElementById('salary-base').value = 5000;
    
    // 重置缴费比例
    document.getElementById('payment-ratio').value = 8;
    
    // 重置平均缴费指数
    document.getElementById('avg-index').value = 1;
    
    // 隐藏结果和错误信息
    document.getElementById('results').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
    
    // 更新退休年龄提示
    updateRetirementAgeNote();
}

/**
 * 计发月数表 - 根据退休年龄确定计发月数
 */
const PAYMENT_MONTHS = {
    // 男性
    'male': {
        '40': 233,
        '50': 195,
        '55': 170,
        '60': 139,
        '65': 101,
        '70': 56
    },
    // 女性
    'female': {
        '40': 233,
        '45': 216,
        '50': 195,
        '55': 170,
        '60': 139,
        '65': 101,
        '70': 56
    }
};

/**
 * 获取计发月数
 */
function getPaymentMonths(gender, retirementAge) {
    const genderTable = PAYMENT_MONTHS[gender];
    
    // 如果没有精确匹配的年龄，找到最接近的年龄
    const ages = Object.keys(genderTable).map(Number);
    let closestAge = ages[0];
    
    for (const age of ages) {
        if (Math.abs(age - retirementAge) < Math.abs(closestAge - retirementAge)) {
            closestAge = age;
        }
    }
    
    return genderTable[closestAge];
} 
 