# 全站结构与交互体验优化设计规格

## 目标

在不引入构建工具、不改变现有页面入口、不破坏 localStorage 数据兼容性的前提下，降低 ComprehensiveTools 的长期维护成本。优化顺序为：

1. 基础设施收敛
2. 交互体验统一
3. 大文件拆分

本次工作聚焦静态 Web 版本。uni-app scaffold 文件保持现状，不作为主要改造目标。

## 当前问题

项目已经完成一轮视觉统一，但仍存在结构性维护问题：

- 多个页面包含大量 `<style>` 和 `style=""`，通用按钮、卡片、表单、返回按钮、空状态重复实现。
- 多个工具直接调用 `localStorage`，错误处理、JSON 解析、容量异常和迁移策略不一致。
- 提示与确认交互混用 `alert()`、`confirm()`、toast 和自定义 DOM。
- 关键文件过大，尤其是 `pages/rehab-trainer/js/main.js`、`pages/inventory/js/modals.js`、`pages/inventory/js/ui.js`、`pages/travel-checklist/travel-checklist.js` 和 `pages/tax/taxCalculator.html`。
- 自动测试主要覆盖表单导入导出，计算器、存储服务和核心数据操作覆盖不足。

## 非目标

- 不迁移到 React、Vue、Vite 或其他构建系统。
- 不重写所有页面。
- 不改变已部署 URL 和页面文件名。
- 不改变已有 localStorage key。
- 不一次性重构全部业务逻辑。
- 不修改计算规则本身，除非测试暴露现有 bug 且单独确认。

## 阶段一：基础设施收敛

### CSS 基础设施

新增共享样式文件，逐步减少页面内联样式：

- `css/components.css`：按钮、卡片、表单、返回按钮、toast、dialog、空状态、工具栏。
- `css/tool-layout.css`：工具页标题区、内容容器、表单/结果双区布局、移动端通用约束。

`css/base.css` 保持为 token、reset、字体和全局基础，不继续膨胀成所有组件的集合。

页面迁移策略：

- 新页面或已触达页面优先使用共享类。
- 已存在页面先迁移高频重复结构：返回按钮、卡片、按钮、输入框、空状态。
- 页面私有 CSS 只保留与该工具业务场景强相关的样式。

### 存储基础设施

新增 `utils/storage-service.js`，封装：

- `getJson(key, fallback)`
- `setJson(key, value)`
- `remove(key)`
- `safeParseJson(raw, fallback)`
- `isQuotaExceeded(error)`

要求：

- 不改变现有 `utils/storage-keys.js` key。
- 读取损坏 JSON 时返回 fallback，并保留错误日志。
- 写入失败时返回结构化结果，调用方可提示用户。
- 暂不引入数据迁移框架，只保留版本字段支持空间。

### 测试基础

新增 Node 测试，优先覆盖纯函数和无浏览器依赖逻辑：

- `tests/storage-service.test.js`
- 计算核心测试：养老金、FIRE、表单导入导出已有测试继续保留。

若现有计算逻辑深度耦合 DOM，本阶段只抽取最小纯函数，不进行大规模重写。

## 阶段二：交互体验统一

### Dialog 与 Toast

新增 `utils/dialog.js`，提供：

- `showToast(message, type, options)`
- `confirmAction(message, options)`
- `showError(errorOrMessage)`

实现要求：

- 使用原生 DOM，不依赖第三方库。
- `confirmAction` 返回 `Promise<boolean>`。
- 在不支持或初始化失败时可降级到 `window.confirm` / `window.alert`。
- 视觉样式来自 `css/components.css`。

迁移顺序：

1. 出行清单
2. 点餐
3. 计算器页面
4. 库存
5. 康复训练

### 内联样式清理

优先清理用户高频可见区域：

- 返回主页链接
- 空状态
- 表单辅助说明
- 结果提示
- 动态渲染出的列表项和状态标签

动态 HTML 字符串中保留必要的 `style="display:none"` 直到对应 JS 状态逻辑被拆分，不在本阶段强行改成类切换。

### 用户体验一致性

统一以下行为：

- 成功、警告、错误提示使用统一 toast。
- 危险操作使用统一 confirm dialog。
- 空状态使用统一图标/标题/说明/操作结构。
- 导入导出反馈使用统一消息系统。

## 阶段三：大文件拆分

拆分遵循“先测试保护，后迁移”的原则。每次拆分只移动一组职责，并保持页面行为不变。

### 康复训练

目标拆分 `pages/rehab-trainer/js/main.js`：

- `state.js`：训练计划、当前训练状态、选择状态。
- `plan-ui.js`：计划列表、动作列表、表单渲染。
- `training-session.js`：训练执行流程、暂停/继续/跳过/结束。
- `import-export.js`：计划导入导出。

保留现有 `timer.js`、`storage.js`、`audio.js`、`screen-wake-lock.js`。

### 库存管理

目标拆分：

- `pages/inventory/js/modals.js`：按分类管理、批量操作、购物清单、提醒等拆为独立模块。
- `pages/inventory/js/ui.js`：列表渲染、表格渲染、筛选 UI、状态标签拆分。

保留现有数据接口，避免同时改 `data.js` 的数据模型。

### 出行清单

目标拆分 `pages/travel-checklist/travel-checklist.js`：

- 状态与存储
- 清单渲染
- 类型管理
- 导入导出
- 事件绑定

### 个税页面

目标是降低 `pages/tax/taxCalculator.html` 的内联样式和模板复杂度：

- 将可复用静态样式移到页面 CSS 或共享 CSS。
- 将结果渲染中的重复片段提取为 JS helper。
- 不改变计税逻辑。

## 数据与兼容性

- 所有现有 localStorage key 保持不变。
- 新存储服务必须兼容已有 JSON 结构。
- 导入导出 payload 格式保持兼容。
- 页面脚本加载顺序必须显式维护：共享工具先加载，页面脚本后加载。

## 测试与验证

每个阶段都必须通过：

- `node --test`
- `git diff --check`
- 本地静态服务器页面烟测

阶段一额外验证：

- 存储服务测试覆盖正常读写、损坏 JSON、配额错误识别。
- 迁移后的页面仍能读取原有 localStorage 数据。

阶段二额外验证：

- Toast、confirm、error dialog 在移动端不遮挡核心操作。
- 危险操作仍需用户确认。
- 键盘焦点可见。

阶段三额外验证：

- 拆分前后核心页面行为一致。
- 康复训练可开始、暂停、继续、跳过、结束。
- 库存可新增、编辑、筛选、打开弹窗。
- 出行清单可新增、勾选、删除、管理类型。

## 实施策略

按阶段生成实施计划。第一阶段完成并验证后，再进入第二阶段；第二阶段完成后，再进入第三阶段。

每个阶段应保持小提交：

- 新增共享能力
- 添加测试
- 迁移一组页面
- 验证并提交

大文件拆分阶段允许使用子任务和子代理，但同一文件同一时间只能由一个执行者负责。

