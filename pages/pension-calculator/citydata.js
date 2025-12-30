/**
 * 中国主要城市平均工资数据
 * 数据来源: 根据各地统计局公布的数据整理 (2022/2023)
 * 注意: 仅供参考，实际计算养老金时应使用政府最新公布的数据
 */
const CITY_DATA = {
    // 直辖市
    '北京': { averageSalary: 12768, region: '华北' },
    '上海': { averageSalary: 13148, region: '华东' },
    '天津': { averageSalary: 8767, region: '华北' },
    '重庆': { averageSalary: 8129, region: '西南' },
    
    // 华东地区
    '杭州': { averageSalary: 10128, region: '华东' },
    '南京': { averageSalary: 9857, region: '华东' },
    '青岛': { averageSalary: 8794, region: '华东' },
    '济南': { averageSalary: 8378, region: '华东' },
    '厦门': { averageSalary: 8582, region: '华东' },
    '宁波': { averageSalary: 8865, region: '华东' },
    '福州': { averageSalary: 7883, region: '华东' },
    '合肥': { averageSalary: 7684, region: '华东' },
    '苏州': { averageSalary: 10500, region: '华东' },
    '无锡': { averageSalary: 9600, region: '华东' },
    
    // 华南地区
    '深圳': { averageSalary: 12532, region: '华南' },
    '广州': { averageSalary: 11035, region: '华南' },
    '珠海': { averageSalary: 9042, region: '华南' },
    '佛山': { averageSalary: 8736, region: '华南' },
    '东莞': { averageSalary: 8249, region: '华南' },
    '海口': { averageSalary: 7495, region: '华南' },
    '南宁': { averageSalary: 7106, region: '华南' },
    
    // 华中地区
    '武汉': { averageSalary: 8786, region: '华中' },
    '长沙': { averageSalary: 8417, region: '华中' },
    '郑州': { averageSalary: 7724, region: '华中' },
    '南昌': { averageSalary: 7256, region: '华中' },
    
    // 华北地区
    '石家庄': { averageSalary: 7187, region: '华北' },
    '太原': { averageSalary: 7184, region: '华北' },
    '呼和浩特': { averageSalary: 7105, region: '华北' },
    
    // 西南地区
    '成都': { averageSalary: 8645, region: '西南' },
    '昆明': { averageSalary: 7572, region: '西南' },
    '贵阳': { averageSalary: 7352, region: '西南' },
    '西宁': { averageSalary: 7156, region: '西南' },
    '拉萨': { averageSalary: 9156, region: '西南' },
    
    // 西北地区
    '西安': { averageSalary: 8219, region: '西北' },
    '银川': { averageSalary: 7193, region: '西北' },
    '兰州': { averageSalary: 7035, region: '西北' },
    '乌鲁木齐': { averageSalary: 7218, region: '西北' },
    
    // 东北地区
    '沈阳': { averageSalary: 7300, region: '东北' },
    '大连': { averageSalary: 7800, region: '东北' },
    '长春': { averageSalary: 7200, region: '东北' },
    '哈尔滨': { averageSalary: 6800, region: '东北' }
};
