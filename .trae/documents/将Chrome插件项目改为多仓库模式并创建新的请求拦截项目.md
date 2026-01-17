# 将Chrome插件项目改为多仓库模式并创建新的请求拦截项目

## 1. 项目分析

当前项目是一个使用Vite+Vue+TypeScript开发的Chrome插件，用于拦截网络请求并返回模拟数据。

## 2. 多仓库模式规划

我将在父目录`D:\my\chrome-plugin-mock`下创建两个子目录，分别作为独立的仓库：

* `repo1`：存放当前的Chrome插件项目

* `repo2`：存放新创建的Chrome插件项目，用于拦截特定域名请求

## 3. 具体步骤

### 步骤1：创建多仓库目录结构

```powershell
# 在父目录下创建两个子目录
mkdir D:\my\chrome-plugin-mock\packages\mock
mkdir D:\my\chrome-plugin-mock\packages\test
```

### 步骤2：将当前项目移入repo1目录

```powershell
# 将当前项目的所有文件和目录移动到repo1
Move-Item -Path D:\my\chrome-plugin-mock\chrome-plugin-mock\* -Destination D:\my\chrome-plugin-mock\packages\mock -Force
```

### 步骤3：创建新的Chrome插件项目

#### 3.1 创建repo2项目结构

* 创建必要的目录结构：`src`、`icons`

* 创建基本配置文件：`package.json`、`vite.config.ts`、`tsconfig.json`、`manifest.json`

#### 3.2 配置manifest.json

* 设置manifest\_version: 3

* 添加必要的权限：`webRequest`、`webRequestBlocking`

* 添加host\_permissions：`["*://developer.233xyx.com/*"]`

* 配置background service worker

#### 3.3 编写background.ts

* 实现请求拦截逻辑，专门拦截developer.233xyx.com域名的请求

* 对匹配的请求返回`{ cancel: true }`，取消请求

## 4. 项目结构

### repo1（原项目）

* 保留原有功能，继续作为完整的Mock Data Tool

### repo2（新项目）

* 专注于拦截developer.233xyx.com域名的请求

* 只包含必要的功能，简化配置

## 5. 技术要点

* 两个项目都是独立的Chrome插件，可单独安装和使用

* 新项目使用最小化配置，只实现特定功能

* 保持代码结构清晰，便于维护和扩展

