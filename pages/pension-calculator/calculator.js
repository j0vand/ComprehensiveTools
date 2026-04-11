/**
 * 养老金计算器核心逻辑
 * 
 * 包含：
 * 1. 数据初始化 (城市选择)
 * 2. 养老金计算模型 (包含复利增长)
 * 3. UI 交互控制
 */

document.addEventListener('DOMContentLoaded', function() {
    initCitySelector();
    initEventListeners();
});

// ==========================================
// 1. 初始化与事件监听
// ==========================================

function initCitySelector() {
    const citySelect = document.getElementById('city-select');
    if (!citySelect || typeof CITY_DATA === 'undefined') return;

    // 按地区分组
    const groups = {};
    for (const city in CITY_DATA) {
        const data = CITY_DATA[city];
        if (!groups[data.region]) {
            groups[data.region] = [];
        }
        groups[data.region].push(city);
    }

    // 填充下拉框
    for (const region in groups) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = region;
        groups[region].forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            optgroup.appendChild(option);
        });
        citySelect.appendChild(optgroup);
    }

    // 监听选择变化
    citySelect.addEventListener('change', function(e) {
        const city = e.target.value;
        if (city && CITY_DATA[city]) {
            const avgSalaryInput = document.getElementById('avg-salary');
            avgSalaryInput.value = CITY_DATA[city].averageSalary;
            
            // 触发高亮动画提示用户
            avgSalaryInput.style.transition = 'background-color 0.3s';
            avgSalaryInput.style.backgroundColor = '#e3f2fd';
            setTimeout(() => {
                avgSalaryInput.style.backgroundColor = '#fff';
            }, 500);
        }
    });
}

function initEventListeners() {
    // 按钮事件
    document.getElementById('calculate-btn').addEventListener('click', calculateAndShow);
    document.getElementById('reset-btn').addEventListener('click', resetForm);
    
    // 监听缴费规划变化
    const planRadios = document.querySelectorAll('input[name="payment-plan"]');
    planRadios.forEach(radio => {
        radio.addEventListener('change', toggleStopAgeInput);
    });
}

function toggleStopAgeInput(e) {
    const stopAgeGroup = document.getElementById('stop-age-group');
    if (e.target.value === 'stop_early') {
        stopAgeGroup.classList.remove('hidden');
    } else {
        stopAgeGroup.classList.add('hidden');
    }
}

// ==========================================
// 2. 核心计算逻辑
// ==========================================

/**
 * 计发月数表 (国发[2005]38号)
 */
const PAYMENT_MONTHS = {
    40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
    45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
    50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
    55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
    60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
    65: 101, 66: 93,  67: 84,  68: 75,  69: 65,
    70: 56
};

function getPaymentMonths(age) {
    // 边界处理
    if (age < 40) return 233;
    if (age > 70) return 56;
    return PAYMENT_MONTHS[Math.floor(age)];
}

function calculateAndShow() {
    // 1. 获取输入数据
    const inputs = getInputs();
    if (!validateInputs(inputs)) return;

    // 2. 计算退休信息
    const retirementInfo = calculateRetirementInfo(inputs.gender, inputs.currentAge);
    
    // 再次验证：停止缴费年龄不能大于退休年龄
    if (inputs.paymentPlan === 'stop_early') {
        if (inputs.stopAge > retirementInfo.retireAge) {
            alert(`您的预计退休年龄为 ${retirementInfo.retireAge} 岁，停止缴费年龄不能大于退休年龄。`);
            return;
        }
        if (inputs.stopAge <= inputs.currentAge) {
            alert("停止缴费年龄必须大于当前年龄。");
            return;
        }
    }

    // 3. 执行核心计算
    const result = calculatePension(inputs, retirementInfo);

    // 4. 渲染结果
    renderResults(result, retirementInfo);
}

function getInputs() {
    const paymentPlan = document.querySelector('input[name="payment-plan"]:checked').value;
    
    return {
        gender: document.querySelector('input[name="gender"]:checked').value,
        currentAge: parseInt(document.getElementById('current-age').value) || 0,
        avgSalary: parseFloat(document.getElementById('avg-salary').value) || 0,
        paidYears: parseFloat(document.getElementById('paid-years').value) || 0,
        accountBalance: parseFloat(document.getElementById('account-balance').value) || 0,
        salaryBase: parseFloat(document.getElementById('salary-base').value) || 0,
        avgIndex: parseFloat(document.getElementById('avg-index').value) || 1,
        
        // 缴费规划
        paymentPlan: paymentPlan,
        stopAge: parseInt(document.getElementById('stop-age').value) || 0,

        // 高级参数
        salaryGrowth: (parseFloat(document.getElementById('salary-growth').value) || 0) / 100,
        socAvgGrowth: (parseFloat(document.getElementById('soc-avg-growth').value) || 0) / 100,
        interestRate: (parseFloat(document.getElementById('interest-rate').value) || 0) / 100
    };
}

function validateInputs(data) {
    if (data.currentAge < 18 || data.currentAge >= 60 && data.gender === 'male') {
        alert("请输入有效的年龄 (18岁以上，未退休)");
        return false;
    }
    if (data.avgSalary <= 0) {
        alert("请输入有效的平均工资");
        return false;
    }
    return true;
}

function calculateRetirementInfo(gender, currentAge) {
    let retireAge = 60;
    if (gender === 'female_worker') retireAge = 50;
    if (gender === 'female_cadre') retireAge = 55;

    const yearsToRetire = Math.max(0, retireAge - currentAge);
    const retireYear = new Date().getFullYear() + yearsToRetire;

    return {
        retireAge,
        yearsToRetire,
        retireYear
    };
}

/**
 * 养老金计算核心函数
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
    let futureContributionTotal = 0;
    let currentBase = data.salaryBase;

    // 循环 "未来需要缴费的年份"
    for (let i = 0; i < futurePaymentYears; i++) {
        // 当年缴费额 (个人部分 8%)
        const yearlyContribution = currentBase * 0.08 * 12;
        
        // 计算这笔钱到【退休时】的本息和
        // 距离退休的年数 = 总距离退休年数 - 当前第几年 - 0.5(年中缴费)
        const yearsToCompound = yearsToRetire - i - 0.5;
        
        const contributionFutureValue = yearlyContribution * Math.pow(1 + data.interestRate, Math.max(0, yearsToCompound));
        
        futureContributionTotal += contributionFutureValue;

        // 下一年基数增长
        currentBase = currentBase * (1 + data.salaryGrowth);
    }

    const totalAccountBalance = balanceFutureValue + futureContributionTotal;

    // D. 基础养老金计算
    // 公式：退休时社平工资 × (1 + 平均缴费指数) / 2 × 累计缴费年限 × 1%
    const basicPension = futureAvgSalary * (1 + data.avgIndex) / 2 * totalYears * 0.01;

    // E. 个人账户养老金计算
    // 公式：账户余额 / 计发月数
    const paymentMonths = getPaymentMonths(retireAge);
    const personalPension = totalAccountBalance / paymentMonths;

    // F. 总计
    const totalPension = basicPension + personalPension;

    return {
        totalPension,
        basicPension,
        personalPension,
        totalAccountBalance,
        totalYears,
        paymentMonths,
        futureAvgSalary
    };
}

// ==========================================
// 3. 结果渲染
// ==========================================

function renderResults(result, retirementInfo) {
    const section = document.getElementById('result-section');
    section.classList.remove('hidden');

    // 滚动到结果
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 填充数据
    setText('res-retire-age', retirementInfo.retireAge);
    setText('res-retire-year', retirementInfo.retireYear);
    
    setText('res-total-pension', formatMoney(result.totalPension));
    setText('res-basic-pension', formatMoney(result.basicPension));
    setText('res-personal-pension', formatMoney(result.personalPension));
    
    setText('res-months', result.paymentMonths);
    setText('res-account-total', formatMoney(result.totalAccountBalance));
    setText('res-total-years', result.totalYears.toFixed(1));

    // 计算替代率 (相对于退休时的预估社平工资)
    const replaceRate = (result.totalPension / result.futureAvgSalary) * 100;
    setText('res-replace-rate', replaceRate.toFixed(1));
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatMoney(num) {
    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function resetForm() {
    // 简单刷新页面或手动重置值
    document.getElementById('current-age').value = 30;
    document.getElementById('paid-years').value = 5;
    document.getElementById('account-balance').value = 20000;
    document.getElementById('salary-base').value = 8000;
    document.getElementById('city-select').value = "";
    document.getElementById('avg-salary').value = 8000;
    
    // 重置缴费规划
    document.querySelector('input[value="continuous"]').checked = true;
    document.getElementById('stop-age-group').classList.add('hidden');
    document.getElementById('stop-age').value = 50;

    document.getElementById('result-section').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
