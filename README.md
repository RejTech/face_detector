# 人脸检测器

一个基于 face-api.js 的人脸识别应用，支持人脸检测、识别、命名和相似人脸自动合并。

## 功能特性

- 实时人脸检测
- 人脸识别与特征匹配
- 人脸命名功能
- 相似人脸自动合并
- 数据持久化存储
- 响应式界面设计

## 在 Cloudflare Pages 上部署

### 前置准备

1. 确保你的项目已上传到 GitHub/GitLab 仓库
2. 下载所有模型文件到 `models/` 目录（运行 `download_models.ps1`）

### 部署步骤

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create application**
3. 选择 **Pages** → **Connect to Git**
4. 选择你的仓库
5. 配置构建设置：
   - **Project name**: face-detector
   - **Production branch**: main（或你的主分支）
   - **Framework preset**: None
   - **Build command**: 留空
   - **Build output directory**: 留空
6. 点击 **Save and Deploy**

### 注意事项

- 由于使用了摄像头 API，网站必须通过 HTTPS 访问（Cloudflare Pages 默认提供 HTTPS）
- 模型文件较大，确保 `models/` 目录包含所有必要文件
- 首次加载可能需要较长时间下载模型文件

## 本地运行

### 使用 NW.js（桌面应用）

```bash
# 安装 NW.js
npm install -g nw

# 运行应用
nw .
```

### 使用浏览器（Web应用）

直接用浏览器打开 `index.html` 文件，或使用本地服务器：

```bash
# 使用 Python
python -m http.server 8000

# 使用 Node.js (http-server)
npx http-server
```

然后访问 `http://localhost:8000`

## 模型文件

项目需要以下模型文件（位于 `models/` 目录）：

- `tiny_face_detector_model-*`
- `face_landmark_68_model-*`
- `face_recognition_model-*`

运行 `download_models.ps1` 脚本可自动下载这些文件。

## 技术栈

- face-api.js - 人脸识别库
- NW.js - 桌面应用框架（可选）
- Cloudflare Pages - 静态网站托管
