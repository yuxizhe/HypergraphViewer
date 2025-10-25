# GitHub Pages 部署说明

本项目已配置好 GitHub Pages 静态页面部署功能。

## 自动部署配置

### 1. 启用 GitHub Pages

在 GitHub 仓库中：

1. 进入 **Settings** → **Pages**
2. 在 **Source** 部分选择 **GitHub Actions**
3. 保存设置

### 2. 自动部署流程

当您推送代码到 `main` 分支时，GitHub Actions 会自动：

- 安装依赖
- 构建项目
- 部署到 GitHub Pages

部署完成后，您的网站将在以下地址可访问：

```
https://yourusername.github.io/HypergraphViewer/
```

### 3. 手动部署（可选）

如果您想手动触发部署：

1. **使用 GitHub Actions**：

   - 前往 Actions 页面
   - 选择 "Deploy to GitHub Pages" workflow
   - 点击 "Run workflow"

2. **使用本地命令**：

   ```bash
   # 安装依赖（首次）
   npm install

   # 构建并部署
   npm run deploy
   ```

## 构建配置

- **构建输出目录**: `dist/`
- **基础路径**: `/HypergraphViewer/`
- **构建命令**: `npm run build`

## 项目文件说明

- `vite.config.js`: 配置了 GitHub Pages 的基础路径
- `.github/workflows/deploy.yml`: GitHub Actions 自动部署配置
- `package.json`: 添加了 `deploy` 脚本和 `gh-pages` 依赖

## 注意事项

1. 确保仓库是公开的或者您有 GitHub Pro/Team 账户
2. 首次部署可能需要几分钟时间生效
3. 如果修改了仓库名称，需要同时更新 `vite.config.js` 中的 `base` 配置
