# 将项目改为 pnpm 多仓库模式的计划

## 目标
将当前项目转换为 pnpm 多仓库模式，支持多个 Chrome 插件，并将公共配置提取到根目录。

## 步骤

### 1. 初始化 pnpm 工作区
- 在根目录创建 `pnpm-workspace.yaml` 文件，定义工作区范围
- 配置包含 `packages/*` 目录，支持多个 Chrome 插件

### 2. 创建根目录公共配置
- **package.json**：添加公共依赖（如 typescript、vite、vue 相关依赖）和工作区脚本
- **tsconfig.base.json**：提取公共 TypeScript 配置
- **tsconfig.json**：根目录 TypeScript 配置，引用 tsconfig.base.json

### 3. 修改 packages/mock 配置
- 更新 `package.json`：移除公共依赖，添加对根目录依赖的引用
- 更新 `tsconfig.json`：继承根目录的 tsconfig.base.json
- 更新 `tsconfig.app.json` 和 `tsconfig.node.json`：简化配置，继承公共配置
- 更新 `vite.config.ts`：可以考虑提取公共 Vite 配置到根目录

### 4. 验证配置
- 运行 pnpm install 确保依赖安装正常
- 运行构建命令确保项目可以正常构建
- 测试 Chrome 插件功能正常

## 预期结果
- 项目使用 pnpm 多仓库模式管理
- 支持在 packages 目录下添加多个 Chrome 插件
- 公共配置集中在根目录，便于维护
- 各插件可以共享公共依赖和配置

## 注意事项
- 确保所有路径引用正确，特别是 Vite 配置中的别名和入口文件
- 保持 TypeScript 配置的继承关系正确
- 确保构建脚本在多仓库模式下正常工作

## 后续扩展
- 可以添加更多插件到 packages 目录，如 packages/another-plugin
- 可以添加根目录的脚本，用于统一管理所有插件的构建和发布