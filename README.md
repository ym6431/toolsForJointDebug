# Frontend State Migrator

一个基于 `Lit + TypeScript + Chrome Extension Manifest V3` 的浏览器扩展，用于在不同页面之间手动迁移非敏感前端状态，帮助本地联调、UI 复现和配置排查。

## 项目目标

这个扩展主要服务于这样的开发场景：

- 在线上页面读取若干可安全迁移的前端状态
- 将这些状态保存为数据集
- 在本地开发环境或其他页面中手动导入
- 快速复现线上页面表现，减少重复登录、切换开关和恢复上下文的成本

整个流程坚持手动触发，不尝试绕过浏览器安全边界。

## 当前能力

- 在 popup 中读取当前页面信息
- 扫描配置命中的 `localStorage`、`sessionStorage`、`cookie`
- 预览并勾选要导出的状态项
- 将选中项保存为数据集到 `chrome.storage.local`
- 选择已保存数据集并预览导入内容
- 手动勾选导入项并写回页面环境
- 删除数据集
- 在 options 页面维护迁移 key 配置
- 支持基于 CSS 变量的浅色 / 暗黑模式

## 约束与原则

- 所有导出与导入都必须由用户手动操作
- 数据只保存在 `chrome.storage.local`
- 只处理非敏感前端状态
- 导入前必须可见、可勾选、可确认
- 不尝试访问浏览器不允许的受保护数据

## 技术栈

- `Lit`
- `TypeScript`
- `Vite`
- `Chrome Extension Manifest V3`
- `chrome.storage.local`

## 项目结构

```text
.
├─ public/
│  ├─ favicon.svg
│  └─ manifest.json
├─ src/
│  ├─ options/
│  │  ├─ main.ts
│  │  └─ options-app.ts
│  ├─ popup/
│  │  ├─ main.ts
│  │  └─ popup-app.ts
│  ├─ shared/
│  │  ├─ base.css
│  │  ├─ constants.ts
│  │  ├─ storage.ts
│  │  ├─ types.ts
│  │  └─ utils.ts
│  ├─ background.ts
│  ├─ content.ts
│  └─ page-bridge.ts
├─ options.html
├─ popup.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## 核心模块说明

### Popup

`src/popup/popup-app.ts`

- 展示当前页面
- 扫描可导出项
- 保存数据集
- 选择数据集并导入
- 展示操作结果

### Options

`src/options/options-app.ts`

- 维护可迁移 key 配置
- 支持新增、编辑、删除、清空配置
- 使用 grid 布局处理较长字段

### Storage

`src/shared/storage.ts`

- 统一封装数据集与配置的读取和写入
- 对配置项和数据项做去重与规范化
- 当前版本仅使用用户维护的配置，不再混入默认配置

### Content Script

`src/content.ts`

- 接收 popup 发出的扫描 / 导入请求
- 与页面上下文协作读取或写入前端状态

### Background

`src/background.ts`

- 处理 popup 与浏览器标签页之间的桥接行为
- 提供打开配置页、获取当前标签页、刷新标签页等能力

### Shared Styles

`src/shared/base.css`

- 定义全局主题变量
- 通过 CSS 变量适配浅色和暗黑模式

## 数据模型

主要有两类数据：

### 配置项

```ts
type StorageType = 'localStorage' | 'sessionStorage' | 'cookie'

interface ConfigItem {
  storageType: StorageType
  key: string
  description: string
}
```

### 数据集

```ts
interface DatasetItem {
  storageType: StorageType
  key: string
  value: string
}

interface Dataset {
  id: string
  datasetName: string
  sourceUrl: string
  createdAt: string
  items: DatasetItem[]
}
```

## 开发与构建

安装依赖：

```bash
pnpm install
```

本地开发：

```bash
pnpm dev
```

类型检查：

```bash
pnpm check
```

生产构建：

```bash
pnpm build
```

## 加载扩展

1. 运行 `pnpm build`
2. 打开 Chrome 扩展管理页 `chrome://extensions`
3. 开启“开发者模式”
4. 选择“加载已解压的扩展程序”
5. 选择项目中的 `dist` 目录

## 设计取向

- UI 尽量克制，避免过度装饰
- popup 优先适配横屏桌面使用场景
- options 页面更偏配置编辑器体验
- 样式通过共享颜色变量统一管理
- 组件内部显式使用 `box-sizing: border-box`

## 适用场景

- 本地复现线上语言、主题、布局状态
- 快速同步实验开关或业务上下文
- 联调时减少重复准备环境的时间

## 不适用场景

- 敏感 token、密码、认证凭据迁移
- 尝试绕过 HttpOnly 或浏览器安全限制
- 需要自动同步或静默导入的场景

## 后续可扩展方向

- 提供真正的扩展图标资源集
- 支持数据集搜索与分组
- 支持导出 / 导入日志
- 支持按域名推荐配置模板
