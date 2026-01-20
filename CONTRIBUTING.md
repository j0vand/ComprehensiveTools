# 项目开发规范

本文档定义了 ComprehensiveTools 项目的开发规范和最佳实践，所有贡献者都应遵循这些规范。

## 📋 目录

- [代码规范](#代码规范)
- [文件组织规范](#文件组织规范)
- [命名规范](#命名规范)
- [错误处理规范](#错误处理规范)
- [存储规范](#存储规范)
- [UI/UX规范](#uiux规范)
- [模块化规范](#模块化规范)
- [提交规范](#提交规范)
- [文档规范](#文档规范)

---

## 代码规范

### JavaScript 规范

#### 1. 代码风格

- **缩进**: 使用 4 个空格，不使用 Tab
- **引号**: 优先使用单引号 `'`，HTML 属性使用双引号 `"`
- **分号**: 语句末尾必须加分号
- **行长度**: 每行不超过 120 个字符
- **大括号**: 使用 K&R 风格（开括号不换行）

```javascript
// ✅ 正确
function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ 错误
function calculateTotal(items)
{
    return items.reduce((sum, item) => sum + item.price, 0)
}
```

#### 2. 变量声明

- 优先使用 `const`，需要重新赋值时使用 `let`
- 禁止使用 `var`
- 变量名使用驼峰命名法（camelCase）

```javascript
// ✅ 正确
const MAX_RETRY_COUNT = 3;
let currentIndex = 0;
const userName = 'John';

// ❌ 错误
var maxRetryCount = 3;
let CurrentIndex = 0;
const user_name = 'John';
```

#### 3. 函数定义

- 优先使用函数声明，需要动态创建时使用箭头函数
- 函数名使用动词开头，使用驼峰命名法
- 必须添加 JSDoc 注释说明函数用途、参数和返回值

```javascript
/**
 * 计算两个数的和
 * @param {number} a - 第一个数
 * @param {number} b - 第二个数
 * @returns {number} 两数之和
 */
function add(a, b) {
    return a + b;
}

// 箭头函数用于回调
const numbers = [1, 2, 3].map(n => n * 2);
```

#### 4. 常量定义

- 常量使用全大写字母，单词间用下划线分隔
- 常量定义在文件顶部或模块顶部

```javascript
// ✅ 正确
const PERSONAL_CONTRIBUTION_RATE = 0.08;
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT = 5000;

// ❌ 错误
const personalContributionRate = 0.08;
const maxRetryCount = 3;
```

#### 5. 注释规范

- 使用中文注释
- 复杂逻辑必须添加注释说明
- 使用 JSDoc 格式注释函数和类

```javascript
/**
 * 养老金计算核心函数
 * @param {Object} data - 输入数据对象
 * @param {Object} retirementInfo - 退休信息对象
 * @returns {Object} 计算结果对象
 * @throws {Error} 当计算结果无效时抛出错误
 */
function calculatePension(data, retirementInfo) {
    // 计算退休时的社会平均工资（按复利增长）
    const futureAvgSalary = data.avgSalary * Math.pow(1 + data.socAvgGrowth, yearsToRetire);
    
    // ... 其他计算逻辑
}
```

#### 6. 错误处理

- 必须使用 try-catch 捕获可能抛出异常的操作
- 提供有意义的错误信息
- 使用统一的错误提示方式（见[错误处理规范](#错误处理规范)）

```javascript
// ✅ 正确
try {
    const result = calculatePension(inputs, retirementInfo);
    renderResults(result);
} catch (error) {
    console.error('计算过程出错:', error);
    showError('计算过程中发生错误：' + error.message);
}

// ❌ 错误
const result = calculatePension(inputs, retirementInfo); // 没有错误处理
```

#### 7. 事件监听器初始化

**初始化时机**：
- **优先使用 `DOMContentLoaded`**：DOM 结构加载完成后立即执行，不需要等待图片等资源
- **仅在需要时使用 `window.onload`**：需要等待所有资源（包括图片）加载完成时使用
- **避免直接执行**：确保 DOM 已准备好再绑定事件

```javascript
// ✅ 正确 - 使用 DOMContentLoaded（推荐）
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('calculate-btn');
    if (btn) {
        btn.addEventListener('click', calculate);
    }
});

// ⚠️ 仅在需要等待所有资源时使用
window.addEventListener('load', function() {
    // 需要图片等资源加载完成后才能执行的操作
    handleTableScroll();
});

// ❌ 错误 - 直接执行，可能 DOM 未准备好
const btn = document.getElementById('calculate-btn');
btn.addEventListener('click', calculate); // 可能报错
```

**事件委托**：
- **动态生成的元素**：必须使用事件委托
- **大量相似元素**：使用事件委托减少内存占用
- **事件委托绑定在稳定的父元素上**

```javascript
// ✅ 正确 - 动态生成的元素使用事件委托
const container = document.getElementById('bonusInputs');
container.addEventListener('input', (e) => {
    if (e.target && e.target.id && e.target.id.startsWith('bonus_m')) {
        saveState();
    }
});

// ❌ 错误 - 直接绑定到动态元素
const input = document.getElementById('bonus_m1'); // 可能不存在
if (input) {
    input.addEventListener('input', saveState);
}
```

#### 8. 防抖和节流

**防抖（Debounce）**：适用于频繁触发但只需处理最后一次的操作
- 搜索输入框
- 窗口 resize 事件
- 滚动事件（某些场景）

**节流（Throttle）**：适用于需要限制执行频率的操作
- 滚动事件（需要实时反馈）
- 鼠标移动事件
- 动画帧更新

```javascript
// ✅ 正确 - 搜索输入框使用防抖
const searchInput = document.getElementById('search');
searchInput.addEventListener('input', Utils.debounce(() => {
    performSearch();
}, 300));

// ✅ 正确 - 滚动事件使用节流
window.addEventListener('scroll', Utils.throttle(() => {
    updateScrollPosition();
}, 100));
```

### HTML 规范

#### 1. 文档结构

- 使用 HTML5 文档类型
- 必须包含 `<meta charset="UTF-8">`
- 必须包含 viewport meta 标签
- 使用语义化标签

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>页面标题</title>
</head>
<body>
    <!-- 内容 -->
</body>
</html>
```

#### 2. 属性规范

- 属性值使用双引号
- 布尔属性可以省略值（如 `checked`, `disabled`）
- 自定义属性使用 `data-` 前缀

```html
<!-- ✅ 正确 -->
<input type="text" id="user-name" data-role="input" disabled>
<div class="container" data-module="calculator"></div>

<!-- ❌ 错误 -->
<input type='text' id=user-name dataRole="input">
```

#### 3. 链接和按钮

- **导航链接必须使用 `<a>` 标签**，禁止使用 `onclick` 内联事件
- 按钮操作使用 `<button>` 标签，通过 `addEventListener` 绑定事件
- **禁止使用内联 JavaScript**（`onclick`, `onchange` 等）

```html
<!-- ✅ 正确 -->
<a href="pages/calculator/calculator.html" class="tool-card">计算器</a>
<button id="calculate-btn" class="btn btn-primary">计算</button>

<script>
document.getElementById('calculate-btn').addEventListener('click', calculate);
</script>

<!-- ❌ 错误 - 使用 onclick -->
<div onclick="window.location.href='calculator.html'" class="tool-card">计算器</div>
<button onclick="calculate()">计算</button>
<input type="text" onchange="handleChange()">

<!-- ❌ 错误 - 内联事件处理 -->
<a href="#" onclick="calculate(); return false;">计算</a>
```

#### 4. Script 标签位置和加载顺序

**位置**：
- **优先放在 `</body>` 之前**：避免阻塞页面渲染
- 如果必须在 `<head>` 中，使用 `defer` 或 `async` 属性

**加载顺序**：
1. 公共工具库（storage-keys.js, common.js）
2. 核心逻辑模块（module-core.js）
3. 存储模块（module-storage.js）
4. UI 模块（module-ui.js）
5. 主逻辑文件（module.js）

```html
<!-- ✅ 正确 - 放在 body 末尾 -->
<body>
    <!-- HTML 内容 -->
    
    <!-- 按依赖顺序加载 -->
    <script src="../../utils/storage-keys.js"></script>
    <script src="../../utils/common.js"></script>
    <script src="calculator-core.js"></script>
    <script src="calculator-storage.js"></script>
    <script src="calculator.js"></script>
</body>

<!-- ❌ 错误 - 放在 head 中阻塞渲染 -->
<head>
    <script src="calculator.js"></script>
</head>
```

### CSS 规范

#### 1. 命名规范

- 使用 BEM 命名法或语义化命名
- 类名使用小写字母和连字符
- ID 用于唯一标识，类用于样式复用

```css
/* ✅ 正确 - BEM 命名 */
.tool-card { }
.tool-card__icon { }
.tool-card--highlighted { }

/* ✅ 正确 - 语义化命名 */
.container { }
.header { }
.main-content { }
```

#### 2. 组织规范

- 相关样式放在同一文件中
- 使用注释分隔不同功能区域
- 按功能模块组织文件

```css
/* ==========================================
   工具卡片样式
   ========================================== */
.tool-card {
    /* 样式 */
}

/* ==========================================
   响应式设计
   ========================================== */
@media (max-width: 768px) {
    /* 移动端样式 */
}
```

---

## 文件组织规范

### 目录结构

```
ComprehensiveTools/
├── index.html                 # 首页入口
├── utils/                     # 公共工具库
│   ├── common.js             # 通用工具函数
│   └── storage-keys.js       # 存储键名管理
├── pages/                     # 各功能模块
│   ├── module-name/          # 模块目录
│   │   ├── module.html       # HTML 文件
│   │   ├── module.js         # 主逻辑文件
│   │   ├── module-core.js    # 核心计算逻辑（可选）
│   │   ├── module-storage.js  # 存储逻辑（可选）
│   │   ├── module-ui.js       # UI 逻辑（可选）
│   │   ├── style.css         # 样式文件
│   │   └── js/               # JS 子模块（如需要）
│   │       ├── main.js
│   │       ├── utils.js
│   │       └── ...
│   └── ...
└── static/                    # 静态资源
    └── logo.png
```

### 文件命名规范

- **HTML 文件**: 使用小写字母和连字符，如 `pensionCalculator.html`
- **JavaScript 文件**: 使用小写字母和连字符，如 `calculator-core.js`
- **CSS 文件**: 使用小写字母和连字符，如 `main-style.css`
- **图片文件**: 使用小写字母和连字符，如 `logo-icon.png`

### 模块拆分原则

- **单个文件不超过 1000 行**：超过时应拆分为多个模块
- **按功能拆分**：核心逻辑、UI、存储、工具函数分别拆分
- **保持单一职责**：每个文件只负责一个明确的功能

```javascript
// ✅ 正确 - 模块化拆分
// calculator-core.js - 核心计算逻辑
function calculatePension() { }

// calculator-ui.js - UI 渲染
function renderResults() { }

// calculator-storage.js - 数据存储
function saveFormData() { }

// ❌ 错误 - 所有功能混在一个文件
// calculator.js - 包含计算、UI、存储所有逻辑（超过1000行）
```

---

## 命名规范

### JavaScript 命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量 | camelCase | `userName`, `totalAmount` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT` |
| 函数 | camelCase，动词开头 | `calculateTotal()`, `getUserInfo()` |
| 类 | PascalCase | `DataManager`, `VoiceManager` |
| 私有成员 | 下划线前缀 | `_internalMethod()`, `_privateProperty` |
| 全局对象 | PascalCase | `CommonUtils`, `StorageKeys` |

### HTML/CSS 命名

| 类型 | 规范 | 示例 |
|------|------|------|
| ID | kebab-case | `user-name`, `calculate-btn` |
| Class | kebab-case 或 BEM | `tool-card`, `tool-card__icon` |
| 自定义属性 | data-kebab-case | `data-user-id`, `data-module-name` |

---

## 错误处理规范

### 1. 统一错误提示

**必须使用公共工具库的统一通知组件**，禁止在各模块中重复实现通知功能：

```javascript
// ✅ 正确 - 使用公共工具库
function showError(message) {
    if (window.CommonUtils && window.CommonUtils.showNotification) {
        window.CommonUtils.showNotification(message, 'error', 5000);
    } else {
        // 降级处理
        alert(message);
    }
}

// ❌ 错误 - 重复实现通知功能
function showToast(message, type) {
    // 各模块自己实现通知逻辑
}

// ❌ 错误 - 直接使用 alert
alert('发生错误');
```

**规则**：
- 所有通知功能必须使用 `utils/common.js` 中的 `showNotification`
- 禁止在各模块中定义 `showToast`、`showNotification` 等类似函数
- 如果模块需要特殊的通知样式，应扩展公共工具库而非自己实现

### 2. 错误边界处理

所有可能抛出异常的操作必须使用 try-catch：

```javascript
// ✅ 正确
function calculateAndShow() {
    try {
        const result = calculatePension(inputs, retirementInfo);
        renderResults(result);
    } catch (error) {
        console.error('计算过程出错:', error);
        showError('计算过程中发生错误：' + (error.message || '未知错误'));
    }
}

// ❌ 错误
function calculateAndShow() {
    const result = calculatePension(inputs, retirementInfo); // 没有错误处理
    renderResults(result);
}
```

### 3. 数据验证

在计算前必须验证输入数据的有效性：

```javascript
// ✅ 正确
function validateInputs(data) {
    if (data.currentAge < 18) {
        showError('请输入有效的年龄 (18岁以上)');
        return false;
    }
    if (data.avgSalary <= 0 || !isFinite(data.avgSalary)) {
        showError('请输入有效的平均工资');
        return false;
    }
    return true;
}
```

### 4. 计算结果验证

计算后必须验证结果的有效性：

```javascript
// ✅ 正确
const result = calculatePension(inputs, retirementInfo);

// 验证计算结果的有效性
if (!result || typeof result.totalPension !== 'number' || 
    isNaN(result.totalPension) || !isFinite(result.totalPension)) {
    showError('计算结果无效，请检查输入数据。');
    console.error('计算结果无效:', result);
    return;
}
```

---

## 存储规范

### 1. 统一存储键名管理

所有 localStorage 键名必须在 `utils/storage-keys.js` 中统一管理：

```javascript
// utils/storage-keys.js
const STORAGE_KEYS = {
    PENSION_CALCULATOR: 'pensionCalculator_data',
    REHAB_TRAINER_PLANS: 'rehabTrainer_plans',
    // ...
};

// 使用
const STORAGE_KEY = window.StorageKeys.PENSION_CALCULATOR;
```

### 2. 使用公共存储函数

**必须使用 `utils/common.js` 中的存储函数**，统一错误处理和键名管理：

```javascript
// ✅ 正确 - 使用统一的存储键名和函数
const STORAGE_KEY = window.StorageKeys.PENSION_CALCULATOR;

if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
    window.CommonUtils.setLocalStorageItem(STORAGE_KEY, formData);
} else {
    // 降级处理
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch (e) {
        console.warn('无法保存数据到 localStorage:', e);
    }
}

// ❌ 错误 - 直接使用 localStorage，没有错误处理
localStorage.setItem('myKey', JSON.stringify(data));

// ❌ 错误 - 使用硬编码的键名
localStorage.setItem('pensionCalculator_data', data); // 应该使用 StorageKeys
```

### 3. 数据版本管理

数据结构变更时，应添加版本号和迁移逻辑：

```javascript
const DATA_VERSION = 1;
const formData = {
    version: DATA_VERSION,
    // ... 其他数据
};
```

---

## UI/UX规范

### 1. 响应式设计

- 所有页面必须支持移动端
- 使用媒体查询适配不同屏幕尺寸
- 测试常见设备尺寸（320px, 375px, 768px, 1024px）

```css
/* 移动端优先 */
.container {
    padding: 16px;
}

/* 平板和桌面 */
@media (min-width: 768px) {
    .container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
    }
}
```

### 2. 交互反馈

- 按钮点击必须有视觉反馈（hover、active 状态）
- 加载状态显示加载指示器
- 操作成功/失败显示明确的提示信息

### 3. 可访问性

- 表单元素必须有 `<label>` 标签
- 图片必须有 `alt` 属性
- 使用语义化 HTML 标签
- 确保键盘导航可用

```html
<!-- ✅ 正确 -->
<label for="user-name">用户名</label>
<input type="text" id="user-name" name="userName">
<img src="logo.png" alt="项目Logo">

<!-- ❌ 错误 -->
<input type="text" placeholder="用户名"> <!-- 缺少 label -->
<img src="logo.png"> <!-- 缺少 alt -->
```

---

## 模块化规范

### 1. 模块导出

使用全局对象导出模块，避免污染全局命名空间：

```javascript
// ✅ 正确
if (typeof window !== 'undefined') {
    window.PensionCalculatorCore = {
        calculatePension,
        calculateYearDetails,
        getPaymentMonths
    };
}

// ❌ 错误
// 直接定义全局函数
function calculatePension() { } // 污染全局命名空间
```

### 2. 模块依赖

明确声明模块依赖关系，在 HTML 中按顺序加载：

```html
<!-- ✅ 正确 -->
<script src="../../utils/storage-keys.js"></script>
<script src="../../utils/common.js"></script>
<script src="calculator-core.js"></script>
<script src="calculator-storage.js"></script>
<script src="calculator.js"></script>

<!-- ❌ 错误 -->
<!-- 顺序错误或缺少依赖 -->
<script src="calculator.js"></script>
<script src="calculator-core.js"></script>
```

### 3. 降级处理

所有模块功能都应提供降级处理，确保在依赖未加载时仍能工作：

```javascript
// ✅ 正确
function getElementValue(id, type = 'float', defaultValue = 0) {
    if (window.CommonUtils && window.CommonUtils.getElementValue) {
        return window.CommonUtils.getElementValue(id, type, defaultValue);
    }
    // 降级处理：如果公共工具库未加载，使用本地实现
    const element = document.getElementById(id);
    if (!element || !element.value) return defaultValue;
    return type === 'int' ? parseInt(element.value) || defaultValue : 
           parseFloat(element.value) || defaultValue;
}
```

---

## 提交规范

### 1. Commit Message 格式

使用约定式提交格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**:
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**:

```
feat(pension): 添加错误边界处理

为养老金计算器添加了完整的错误处理机制，包括：
- 输入验证
- 计算结果验证
- 异常捕获和提示

修复了计算过程中可能出现的崩溃问题。
```

### 2. 代码审查清单

提交前检查：

- [ ] 代码符合规范
- [ ] 已添加必要的注释
- [ ] 已处理所有可能的错误情况
- [ ] 已测试基本功能
- [ ] 无控制台错误
- [ ] 移动端显示正常
- [ ] 已更新相关文档（如需要）
- [ ] 事件监听器正确初始化（使用 DOMContentLoaded）
- [ ] 动态生成的元素使用事件委托
- [ ] 使用了防抖/节流处理频繁触发的事件
- [ ] 所有异步操作都有错误处理
- [ ] 降级处理完善

---

## 文档规范

### 1. 代码注释

- 所有公共函数必须添加 JSDoc 注释
- 复杂逻辑必须添加行内注释
- 注释使用中文

```javascript
/**
 * 计算养老金总额
 * @param {Object} data - 输入数据对象
 * @param {number} data.currentAge - 当前年龄
 * @param {number} data.avgSalary - 平均工资
 * @param {Object} retirementInfo - 退休信息
 * @returns {Object} 计算结果对象
 * @throws {Error} 当输入数据无效时抛出错误
 */
function calculatePension(data, retirementInfo) {
    // 实现...
}
```

### 2. README 文档

每个模块应包含 README.md，说明：

- 功能概述
- 使用方法
- API 文档（如适用）
- 注意事项

### 3. 变更日志

重大变更应在 CHANGELOG.md 中记录：

```markdown
## [1.1.0] - 2024-01-15

### 新增
- 添加错误边界处理
- 统一错误提示组件

### 修复
- 修复计算结果验证问题

### 优化
- 拆分大文件为模块化结构
```

---

## 最佳实践

### 1. 性能优化

- 避免重复查询 DOM，缓存元素引用
- 使用事件委托减少事件监听器数量
- 避免在循环中进行 DOM 操作
- 使用防抖/节流处理频繁触发的事件

```javascript
// ✅ 正确 - 缓存 DOM 元素
const calculateBtn = document.getElementById('calculate-btn');
calculateBtn.addEventListener('click', calculateAndShow);

// ❌ 错误 - 重复查询
document.getElementById('calculate-btn').addEventListener('click', () => {
    document.getElementById('result').textContent = '...'; // 每次都查询
});
```

### 4. 代码组织规范

**文件结构顺序**：
1. 常量定义（文件顶部）
2. 工具函数（辅助函数）
3. 核心业务逻辑函数
4. 事件处理函数
5. 初始化函数
6. 事件监听器初始化（DOMContentLoaded）

**函数定义顺序**：
- 按功能分组
- 相关函数放在一起
- 被调用的函数定义在使用之前

```javascript
// ✅ 正确 - 清晰的代码组织
// 1. 常量定义
const STORAGE_KEY = 'calculator_data';
const MAX_RETRY_COUNT = 3;

// 2. 工具函数
function formatMoney(num) { }
function validateInput(value) { }

// 3. 核心业务逻辑
function calculate() { }
function renderResults() { }

// 4. 事件处理函数
function handleCalculate() { }
function handleReset() { }

// 5. 初始化
function init() {
    loadData();
    bindEvents();
}

// 6. 事件监听器初始化
document.addEventListener('DOMContentLoaded', init);
```

### 2. 代码复用

- 提取公共函数到 `utils/common.js`
- 避免重复实现相同功能
- 使用公共工具库而非自己实现

### 3. 向后兼容

- 所有新功能都应提供降级处理
- 数据结构变更时保持向后兼容或提供迁移逻辑
- 避免破坏性变更

### 5. 降级处理策略

**降级原则**：
1. **功能降级**：核心功能必须可用，辅助功能可以降级
2. **优雅降级**：提供替代方案，不直接报错
3. **用户提示**：明确告知用户当前使用的降级方案

**常见降级场景**：
- 公共工具库未加载：使用本地实现
- localStorage 不可用：提示用户或使用内存存储
- 浏览器 API 不支持：检测并提示用户

```javascript
// ✅ 正确 - 完整的降级处理
function saveData(data) {
    const STORAGE_KEY = window.StorageKeys?.CALCULATOR_DATA || 'calculator_data';
    
    // 优先使用公共工具库
    if (window.CommonUtils?.setLocalStorageItem) {
        return window.CommonUtils.setLocalStorageItem(STORAGE_KEY, data);
    }
    
    // 降级：使用原生 localStorage
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        // 降级：使用内存存储（仅当前会话）
        if (!window.memoryStorage) {
            window.memoryStorage = {};
        }
        window.memoryStorage[STORAGE_KEY] = data;
        console.warn('localStorage 不可用，使用内存存储');
        return false;
    }
}
```

---

## 工具和资源

### 推荐工具

- **代码编辑器**: VS Code
- **代码格式化**: Prettier
- **代码检查**: ESLint
- **浏览器调试**: Chrome DevTools

### 参考资源

- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript 风格指南](https://github.com/airbnb/javascript)
- [HTML 最佳实践](https://github.com/hail2u/html-best-practices)
- [CSS 指南](https://cssguidelin.es/)

---

## 问题反馈

如有疑问或建议，请：

1. 查看本文档
2. 搜索已有的 Issue
3. 创建新的 Issue 描述问题

---

---

## 迁移指南

### 从旧代码迁移到新规范

如果发现现有代码不符合规范，应按以下优先级逐步迁移：

1. **高优先级**（影响功能和可维护性）：
   - 移除所有 `onclick` 内联事件，改用 `addEventListener`
   - 统一使用公共工具库的通知函数，移除各模块自己的实现
   - 统一使用存储键名管理，移除硬编码的键名

2. **中优先级**（影响代码质量）：
   - 移除重复的常量定义
   - 拆分超过 1000 行的文件
   - 添加缺失的 JSDoc 注释

3. **低优先级**（代码风格）：
   - 统一代码格式（缩进、引号等）
   - 统一命名风格

### 迁移示例

**移除 onclick 内联事件**：

```html
<!-- 旧代码 -->
<button onclick="calculate()">计算</button>

<!-- 新代码 -->
<button id="calculate-btn">计算</button>
<script>
document.getElementById('calculate-btn').addEventListener('click', calculate);
</script>
```

**统一通知函数**：

```javascript
// 旧代码 - 各模块自己实现
function showToast(message) {
    // 自定义实现
}

// 新代码 - 使用公共工具库
function showToast(message, type = 'info') {
    if (window.CommonUtils && window.CommonUtils.showNotification) {
        window.CommonUtils.showNotification(message, type, 3000);
    } else {
        alert(message); // 降级处理
    }
}
```

---

**最后更新**: 2024-01-15
