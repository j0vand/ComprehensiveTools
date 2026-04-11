/**
 * 中国主要城市平均工资数据
 * 数据来源: 根据2022年各地统计局公布的数据整理
 * 注意: 仅供参考，实际计算养老金时应使用政府最新公布的数据
 */
const CITY_DATA = {
    // 直辖市
    '北京': {
        averageSalary: 12768,
        region: '华北'
    },
    '上海': {
        averageSalary: 13148,
        region: '华东'
    },
    '天津': {
        averageSalary: 8767,
        region: '华北'
    },
    '重庆': {
        averageSalary: 8129,
        region: '西南'
    },
    
    // 华东地区
    '杭州': {
        averageSalary: 10128,
        region: '华东'
    },
    '南京': {
        averageSalary: 9857,
        region: '华东'
    },
    '青岛': {
        averageSalary: 8794,
        region: '华东'
    },
    '济南': {
        averageSalary: 8378,
        region: '华东'
    },
    '厦门': {
        averageSalary: 8582,
        region: '华东'
    },
    '宁波': {
        averageSalary: 8865,
        region: '华东'
    },
    '福州': {
        averageSalary: 7883,
        region: '华东'
    },
    '合肥': {
        averageSalary: 7684,
        region: '华东'
    },
    
    // 华南地区
    '深圳': {
        averageSalary: 12532,
        region: '华南'
    },
    '广州': {
        averageSalary: 11035,
        region: '华南'
    },
    '珠海': {
        averageSalary: 9042,
        region: '华南'
    },
    '佛山': {
        averageSalary: 8736,
        region: '华南'
    },
    '东莞': {
        averageSalary: 8249,
        region: '华南'
    },
    '海口': {
        averageSalary: 7495,
        region: '华南'
    },
    '南宁': {
        averageSalary: 7106,
        region: '华南'
    },
    
    // 华中地区
    '武汉': {
        averageSalary: 8786,
        region: '华中'
    },
    '长沙': {
        averageSalary: 8417,
        region: '华中'
    },
    '郑州': {
        averageSalary: 7724,
        region: '华中'
    },
    '南昌': {
        averageSalary: 7256,
        region: '华中'
    },
    
    // 华北地区
    '石家庄': {
        averageSalary: 7187,
        region: '华北'
    },
    '太原': {
        averageSalary: 7184,
        region: '华北'
    },
    '呼和浩特': {
        averageSalary: 7105,
        region: '华北'
    },
    
    // 西南地区
    '成都': {
        averageSalary: 8645,
        region: '西南'
    },
    '昆明': {
        averageSalary: 7572,
        region: '西南'
    },
    '贵阳': {
        averageSalary: 7352,
        region: '西南'
    },
    '西宁': {
        averageSalary: 7156,
        region: '西南'
    },
    '拉萨': {
        averageSalary: 9156,
        region: '西南'
    },
    
    // 西北地区
    '西安': {
        averageSalary: 8219,
        region: '西北'
    },
    '银川': {
        averageSalary: 7193,
        region: '西北'
    },
    '兰州': {
        averageSalary: 7035,
        region: '西北'
    },
    '乌鲁木齐': {
        averageSalary: 7218,
        region: '西北'
    }
};

// 按照地区对城市进行分类
const REGIONS = {
    '华北': [],
    '华东': [],
    '华南': [],
    '华中': [],
    '西南': [],
    '西北': []
};

// 计发月数表 - 根据退休年龄确定计发月数
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

// 初始化地区分类
for (const city in CITY_DATA) {
    const region = CITY_DATA[city].region;
    if (REGIONS[region]) {
        REGIONS[region].push(city);
    }
}

// 获取计发月数
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

// 填充城市选择器
function populateCitySelector() {
    const citySelector = document.getElementById('city');
    
    // 添加地区分组
    for (const region in REGIONS) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = region;
        
        // 添加该地区的城市
        for (const city of REGIONS[region]) {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            optgroup.appendChild(option);
        }
        
        citySelector.appendChild(optgroup);
    }
    
    // 城市选择事件
    citySelector.addEventListener('change', function() {
        const selectedCity = this.value;
        const avgSalaryInput = document.getElementById('avg-salary');
        
        if (selectedCity && CITY_DATA[selectedCity]) {
            avgSalaryInput.value = CITY_DATA[selectedCity].averageSalary;
        } else {
            avgSalaryInput.value = '';
        }
    });
} 