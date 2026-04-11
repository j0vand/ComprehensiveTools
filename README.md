# 综合工具箱 ComprehensiveTools

一个集成了多种实用工具的Web应用集合，包含计算器、管理系统和康复训练工具。

## 🌟 功能特性

### 💰 个税计算器
- 快速计算个人所得税
- 支持年终奖计算
- 专项附加扣除支持
- 复杂场景计算

### 🏠 房贷计算器
- 商业贷款计算
- 公积金贷款计算
- 组合贷款计算
- 支持等额本息和等额本金

### 📊 理财计算器
- 复利计算
- 贷款计算
- 定投收益计算
- 目标规划

### 📦 库存管理
- 物品记录和管理
- 智能搜索
- 自动分类
- 数据导入导出
- 统计图表

### 🍱 今日点餐
- 午餐和晚餐记录
- 餐点管理
- 历史记录

### 👵 养老金计算器
- 基于中国养老保险制度
- 估算退休后可领取的养老金金额
- 支持不同城市和缴费基数

### 🏃 腰突康复训练
- 专业的腰椎间盘突出康复训练计时器
- 自定义训练计划
- 持续时间型和次数型训练
- 语音提示功能
- 数据导入导出
- 专业训练计划模板

## 🚀 快速开始

### 本地运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/你的用户名/ComprehensiveTools.git
   cd ComprehensiveTools
   ```

2. **使用HTTP服务器运行**
   
   **Python 3:**
   ```bash
   python3 -m http.server 8000
   ```
   
   **Node.js:**
   ```bash
   npx http-server -p 8000
   ```
   
   **PHP:**
   ```bash
   php -S localhost:8000
   ```

3. **访问应用**
   
   打开浏览器访问：`http://localhost:8000/index.html`

### GitHub Pages部署

1. **Fork本仓库**

2. **启用GitHub Pages**
   - 进入仓库 Settings
   - 找到 Pages 选项
   - Source 选择 `main` 分支
   - 保存

3. **访问**
   
   访问：`https://你的用户名.github.io/ComprehensiveTools/index.html`

## 📁 项目结构

```
ComprehensiveTools/
├── index.html                 # 首页
├── pages/                     # 工具页面
│   ├── tax/                   # 个税计算器
│   ├── mortgage/              # 房贷计算器
│   ├── finance/               # 理财计算器
│   ├── inventory/             # 库存管理
│   ├── meal/                  # 今日点餐
│   ├── pension-calculator/    # 养老金计算器
│   └── rehab-trainer/         # 腰突康复训练
├── static/                    # 静态资源
└── README.md                  # 项目说明
```

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **UI框架**: Bootstrap 5 (部分页面)
- **图表**: Chart.js (库存管理)
- **存储**: LocalStorage
- **语音**: Web Speech API (康复训练)

## 📱 浏览器支持

- Chrome/Edge (推荐)
- Firefox
- Safari
- 移动端浏览器

**注意**: 某些工具在移动端使用 `file://` 协议时可能有限制，建议使用HTTP服务器或GitHub Pages访问。

## 🔧 移动端使用建议

### 方案1: GitHub Pages（推荐）
部署到GitHub Pages后，可以直接在移动浏览器访问，所有功能正常。

### 方案2: 本地HTTP服务器
在手机上安装HTTP服务器应用（如Simple HTTP Server），然后访问本地服务器。

### 方案3: 电脑HTTP服务器
电脑和手机连接同一WiFi，在电脑运行HTTP服务器，手机访问电脑IP。

## 📝 使用说明

### 个税计算器
1. 输入月收入
2. 选择专项附加扣除项目
3. 查看计算结果

### 房贷计算器
1. 输入贷款金额、利率、期限
2. 选择还款方式
3. 查看还款计划

### 库存管理
1. 添加物品信息
2. 使用搜索和分类功能
3. 导出数据备份

### 腰突康复训练
1. 创建训练计划
2. 添加训练项（持续时间型或次数型）
3. 开始训练，跟随语音提示
4. 支持数据导入导出

详细使用说明请参考各工具页面内的帮助文档。

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

感谢所有使用和反馈的用户！

## 📞 联系方式

如有问题或建议，请提交Issue。

---

**注意**: 本项目仅供学习和个人使用，计算结果仅供参考，不构成专业建议。
