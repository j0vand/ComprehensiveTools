# 项目工程规范

本文档定义 ComprehensiveTools 后续开发、重构和维护时必须遵守的项目约定。它不是设计稿，也不是某次改版计划；它是长期工程规范。

## 1. 项目定位

ComprehensiveTools 是一个静态、浏览器端运行的工具集合。

必须遵守：

- 不引入构建步骤，除非单独确认。
- 不迁移到 React、Vue、Vite 等框架，除非单独确认。
- 不改变现有页面 URL、HTML 文件名和工具入口。
- 不破坏已有 `localStorage` 数据兼容性。
- 优先维护静态 Web 版本，uni-app scaffold 文件保持现状。

## 2. 核心原则

### 稳定优先

所有改动必须保持现有用户数据、页面入口和主要行为稳定。重构只能改变代码组织方式，不能顺手改变业务规则。

### 小步提交

每个提交只做一类事情，例如：

- 新增共享工具
- 迁移一个页面
- 拆分一个职责模块
- 修复一个明确问题

避免把视觉、存储、交互和业务逻辑混在同一个提交里。

### 渐进迁移

旧页面允许逐步迁移，但已经迁移到新基础设施的页面不能继续保留页面级旧 fallback。

例如：

- 已迁移到 `StorageService` 的页面，应直接依赖 `window.StorageService`。
- 不再在页面内同时保留 `CommonUtils` 或原生 `localStorage` 的旧读写路径。
- `StorageService` 内部自己的安全降级可以保留。

### 共享优先

重复出现的能力应收敛到共享模块，而不是在每个页面复制一份。

优先使用：

- `utils/storage-keys.js`
- `utils/storage-service.js`
- `utils/dialog.js`
- `css/components.css`
- `css/tool-layout.css`
- `utils/common.js` 中仍未迁移的既有公共能力

## 3. 目录与文件组织

项目入口：

- `index.html`
- `css/base.css`
- `utils/`

工具页面：

- 每个工具放在 `pages/<tool>/`
- 页面入口 HTML 保持现有命名
- 页面私有 JS/CSS 放在该工具目录下
- 复杂工具应按职责拆分 JS 文件

推荐拆分方式：

- `state`：状态、存储、数据变更
- `render`：DOM 渲染
- `events`：事件绑定
- `import-export`：导入导出
- `controller`：页面装配或流程控制

浏览器脚本仍使用普通 `<script>`，不使用 ES module，除非单独确认。

## 4. 脚本加载顺序

脚本顺序必须显式维护。

通用顺序：

```html
<script src="../../utils/storage-keys.js"></script>
<script src="../../utils/common.js"></script>
<script src="../../utils/storage-service.js"></script>
<script src="../../utils/dialog.js"></script>
<script src="page-module-a.js"></script>
<script src="page-module-b.js"></script>
<script src="page-entry.js"></script>
```

规则：

- 共享工具先加载，页面模块后加载。
- 被依赖的页面模块先加载，入口脚本最后加载。
- 新拆分模块应挂载明确的 `window.<Namespace>`，避免散落全局函数。
- 保持空 DOM 容错，同一模块可能被多个相近页面复用。

## 5. 存储规范

必须使用 `utils/storage-keys.js` 中定义的 key。禁止在新代码中随意硬编码新的 `localStorage` key。

新迁移页面应使用：

```js
window.StorageService.getJson(key, fallback);
window.StorageService.setJson(key, value);
window.StorageService.remove(key);
```

要求：

- 不改变已有 key。
- 不改变已有 JSON 数据结构，除非有明确迁移逻辑。
- 读取损坏 JSON 时必须有 fallback。
- 写入失败时要给用户明确反馈。
- 已迁移页面不保留页面级旧 fallback。

## 6. 交互规范

成功、警告、错误提示统一使用：

```js
window.DialogService.showToast(message, type, options);
```

危险操作确认统一使用：

```js
window.DialogService.confirmAction(message).then(function(confirmed) {
    if (!confirmed) return;
    // mutation
});
```

规则：

- 不新增 `alert()`。
- 不新增 `confirm()`。
- 现有 `prompt()` 暂不强制迁移，但新增重命名/输入类交互应优先使用页面内表单或统一弹层。
- 异步确认后，数据变更必须放进 `confirmed` 分支内。
- 取消确认不能产生任何数据变更。

## 7. CSS 与视觉规范

共享视觉能力优先放在：

- `css/base.css`：token、reset、字体、全局基础
- `css/components.css`：按钮、卡片、表单、toast、dialog、空状态、工具栏
- `css/tool-layout.css`：工具页标题区、容器、常见布局、移动端约束

页面私有 CSS 只保留业务特有样式。

规则：

- 避免新增大段内联 `<style>`。
- 避免新增大量 `style=""`。
- 返回主页、按钮、卡片、表单、空状态优先使用共享类。
- 移动端必须检查文本不溢出、不遮挡、不重叠。
- 工具页优先做可用界面，不做营销式 landing page。

## 8. JavaScript 编码规范

使用 plain HTML、CSS、ES6 JavaScript。

规则：

- JavaScript 使用 4 空格缩进。
- 函数名使用描述性 camelCase。
- 目录和 CSS 文件名使用 kebab-case。
- 不引入第三方依赖，除非已有页面已使用或单独确认。
- 不做无关重构。
- 不顺手改变计算公式、业务规则或数据模型。
- 新模块应边界清晰，一个文件只承担一个主要职责。

## 9. 大文件拆分规范

拆分目标是降低维护成本，不是重写。

拆分时必须：

- 先识别职责边界。
- 每次只移动一组职责。
- 保持旧公开入口可用。
- 保持脚本加载顺序正确。
- 拆分后立即运行测试和语法检查。

推荐优先拆：

- 导入导出
- 摘要/分页
- 独立弹窗
- 渲染辅助函数

暂缓拆：

- 训练执行流程
- 计时器、语音、屏幕常亮交叉逻辑
- 大量闭包依赖和事件耦合的主渲染链

## 10. 测试与验证

所有代码改动至少运行：

```bash
node --test
git diff --check
```

JS 文件拆分后额外运行：

```bash
node --check path/to/file.js
```

页面级改动应手工验证：

- 页面可打开，无控制台错误
- 数据可保存和读取
- 新增、编辑、删除、导入、导出等核心流程正常
- 移动端布局不重叠
- 危险操作取消时不改变数据

本地服务：

```bash
python3 -m http.server 8000
```

## 11. Git 提交规范

提交信息使用 Conventional Commit 风格，允许中文摘要。

示例：

```text
feat: 增加统一交互提示服务
refactor: 拆分出行清单模块
fix: 修复存储降级异常
docs: 新增项目工程规范
```

提交前必须确认：

- `git status --short` 中只包含本次相关文件。
- `node --test` 已通过。
- `git diff --check` 无输出。
- 没有误删用户已有改动。

## 12. 禁止事项

禁止：

- 未确认就引入构建工具或框架。
- 未确认就改变页面 URL。
- 未确认就改变 `localStorage` key。
- 在已迁移页面保留页面级旧 fallback。
- 新增 `alert()` / `confirm()`。
- 用一次提交混合多个阶段的改动。
- 重构时顺手修改业务规则。
- 删除或回滚不是自己产生的改动。

## 13. 新增页面检查清单

新增或大改页面前，检查：

- 页面是否放在 `pages/<tool>/`
- 是否加载必要共享 CSS
- 是否加载必要共享 JS
- 是否使用 `StorageKeys`
- 是否使用 `StorageService`
- 是否使用 `DialogService`
- 是否有移动端布局
- 是否有空状态
- 是否可导入导出或说明不需要
- 是否通过 `node --test` 和 `git diff --check`
