# GitHub部署指南

## 📋 部署步骤

### 1. 创建GitHub仓库

1. 登录GitHub
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `ComprehensiveTools`
   - Description: `综合工具箱 - 包含个税、房贷、理财、库存管理等实用工具`
   - 选择 Public（GitHub Pages需要）
   - 不要勾选 "Initialize this repository with a README"（因为本地已有文件）
4. 点击 "Create repository"

### 2. 上传代码到GitHub

在项目根目录执行：

```bash
# 初始化Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 综合工具箱"

# 添加远程仓库（替换YOUR_USERNAME为你的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/ComprehensiveTools.git

# 推送到GitHub
git branch -M main
git push -u origin main
```

### 3. 启用GitHub Pages

#### 方法1: 使用GitHub Actions（推荐，已配置）

1. 进入仓库 Settings
2. 找到左侧 "Pages"
3. 在 "Source" 选择 "GitHub Actions"
4. 保存

#### 方法2: 使用main分支

1. 进入仓库 Settings
2. 找到左侧 "Pages"
3. 在 "Source" 选择 "Deploy from a branch"
4. Branch选择 "main"，文件夹选择 "/ (root)"
5. 点击 "Save"

### 4. 访问网站

等待几分钟后，访问：
```
https://YOUR_USERNAME.github.io/ComprehensiveTools/index.html
```

## 🔧 配置说明

### 自定义域名（可选）

如果想使用自己的域名：

1. 在仓库 Settings → Pages → Custom domain 输入域名
2. 在域名DNS添加CNAME记录指向 `YOUR_USERNAME.github.io`

### 更新内容

每次推送代码到main分支后，GitHub Pages会自动更新：

```bash
git add .
git commit -m "更新说明"
git push
```

等待1-2分钟，网站会自动更新。

## 📝 注意事项

1. **文件路径**: GitHub Pages使用相对路径，确保所有链接都是相对路径
2. **HTTPS**: GitHub Pages自动提供HTTPS，某些功能可能需要HTTPS才能正常工作
3. **CDN资源**: 确保CDN资源（如Bootstrap）可以正常加载
4. **LocalStorage**: 在GitHub Pages上可以正常使用LocalStorage

## 🐛 常见问题

### Q: 页面显示404？
A: 
- 检查仓库是否为Public
- 检查Pages设置是否正确
- 等待几分钟让GitHub处理

### Q: 样式或JS文件加载失败？
A: 
- 检查文件路径是否为相对路径
- 检查文件是否已提交到GitHub
- 清除浏览器缓存

### Q: 如何更新网站？
A: 
- 修改代码后，提交并推送到GitHub
- 等待1-2分钟自动更新

## 🎉 完成！

部署完成后，你可以：
- 分享链接给其他人使用
- 在任何设备上访问
- 持续更新和维护
