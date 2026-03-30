# Frontend State Migrator

一个基于 `Lit + TypeScript + Chrome Extension Manifest V3` 的 Chrome 扩展，用于在本地开发环境与线上页面之间手动迁移非敏感前端状态，帮助开发者快速复现页面表现、调试 UI、验证配置差异。

## 这个项目解决什么问题

在联调场景里，线上页面通常已经带着一堆前端状态：

- `localStorage` 中的主题、语言、布局偏好
- `sessionStorage` 中的临时业务上下文
- 普通 `cookie` 中的非敏感配置项

而本地环境往往是“干净”的。这个扩展的目标，就是让开发者可以把这些状态手动导出成数据集，再在本地页面中按需导入，减少重复准备环境的成本。

## 核心原则

- 所有导出和导入都必须由用户手动触发
- 数据仅保存在 `chrome.storage.local`
- 只处理非敏感前端状态
- 导入前必须可见、可勾选、可确认
- 不尝试绕过浏览器安全边界

## 当前功能

### Popup

- 展示当前页面信息
- 支持导出模式与导入模式切换
- `localhost / 127.0.0.1 / [::1]` 页面默认进入导入模式
- 扫描配置命中的 `localStorage`、`sessionStorage`、`cookie`
- 预览并勾选要导出的状态项
- 保存选中项为数据集
- 选择已保存数据集并预览导入内容
- 勾选需要导入的项并写回页面
- 刷新目标页面

### Localhost 注入

- 支持维护多个 `localhost` 端口
- 支持设置默认端口
- popup 中可动态切换注入目标端口
- 支持“保存并注入到 localhost:xxx”
- 若目标页无法完成完整状态注入，会退化为仅注入 `cookie`

### Options

- 维护可迁移 key 配置
- 支持新增、编辑、删除、清空配置
- 支持导出/导入配置文件
- 支持维护 `localhost` 端口列表与默认值

### 测试

- `Vitest` 单元测试
- 基于 `vitest-environment-web-ext` 的扩展 e2e 测试

## 技术栈

- `Lit`
- `TypeScript`
- `Vite`
- `@crxjs/vite-plugin`
- `Chrome Extension Manifest V3`
- `chrome.storage.local`
- `Vitest`
- `vitest-environment-web-ext`
- `Playwright`（由 e2e 测试环境带入）

## 项目结构

```text
.
├─ AGENTS.md
├─ manifest.config.ts
├─ options.html
├─ popup.html
├─ src/
│  ├─ background.ts
│  ├─ content.ts
│  ├─ page-bridge.ts
│  ├─ chrome.d.ts
│  ├─ components/
│  │  ├─ app-choice-card.ts
│  │  ├─ app-input.ts
│  │  └─ app-select.ts
│  ├─ options/
│  │  ├─ main.ts
│  │  └─ options-app.ts
│  ├─ popup/
│  │  ├─ main.ts
│  │  ├─ popup-app.ts
│  │  ├─ popup-export-panel.ts
│  │  └─ popup-import-panel.ts
│  └─ shared/
│     ├─ base.css
│     ├─ bridge-client.ts
│     ├─ constants.ts
│     ├─ storage.ts
│     ├─ storage.test.ts
│     ├─ types.ts
│     ├─ utils.ts
│     └─ utils.test.ts
├─ test/
│  └─ extension.e2e.test.ts
├─ tsconfig.json
├─ vite.config.ts
└─ vitest.e2e.config.ts
```

## 关键模块说明

### `src/popup/popup-app.ts`

Popup 主容器，负责：

- 当前页面初始化
- 导出/导入模式切换
- 数据集状态管理
- localhost 默认端口联动
- 操作结果展示

### `src/popup/popup-export-panel.ts`

导出模式 UI，负责：

- 当前页面扫描
- 数据集命名
- 端口选择
- 保存与“保存并注入”

### `src/popup/popup-import-panel.ts`

导入模式 UI，负责：

- 数据集选择
- 导入预览
- 勾选导入项
- 刷新页面与执行导入

### `src/options/options-app.ts`

配置页，负责：

- 迁移 key 列表维护
- localhost 端口列表维护
- 默认端口设置
- 配置导出与导入

### `src/background.ts`

后台脚本，负责：

- popup 与 tab 的桥接
- 读取 `chrome.cookies`
- 打开 localhost 目标页
- 执行自动注入和 cookies 回退注入

### `src/content.ts`

内容脚本，负责：

- 接收 popup 的扫描/导入请求
- 和页面桥接脚本协作
- 合并 web storage 与 cookie 的读取结果

### `src/page-bridge.ts`

页面上下文桥接，负责：

- 读取 `localStorage`
- 读取 `sessionStorage`
- 写入 `localStorage`
- 写入 `sessionStorage`
- 页面内可访问 `cookie` 的写入

## 数据模型

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

### Localhost 目标配置

```ts
interface LocalhostTargetConfig {
  localhostPorts: string[]
  defaultLocalhostPort: string
}
```

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发：

```bash
pnpm dev
```

类型检查：

```bash
pnpm check
```

单元测试：

```bash
pnpm test
```

扩展 E2E 测试：

```bash
pnpm test:e2e
```

生产构建：

```bash
pnpm build
```

## 加载扩展

1. 运行 `pnpm build`
2. 打开 Chrome 扩展管理页：`chrome://extensions`
3. 开启“开发者模式”
4. 选择“加载已解压的扩展程序”
5. 选择项目中的 `dist` 目录

## 测试说明

### 单元测试

- 基于 `Vitest`
- 覆盖共享工具和存储模块

### E2E 测试

- 基于 `vitest-environment-web-ext`
- 使用真实扩展构建产物 `dist`
- 通过 Playwright 拉起 Chromium 并加载扩展

首次运行 e2e 时如果本机没有 Playwright 浏览器，可执行：

```bash
pnpm exec playwright install chromium
```

## 当前实现边界

### 会处理

- 手动导出的非敏感前端状态
- `localStorage`
- `sessionStorage`
- 普通 `cookie`
- localhost 开发端口的手动/半自动注入

### 不会处理

- 静默自动同步
- 绕过浏览器限制的数据访问

## 适用场景

- 本地复现线上语言、主题、布局状态
- 快速恢复实验开关或业务上下文
- 联调时减少重复登录和环境准备

## 后续可扩展方向

- 数据集搜索与分组
- 更完整的导入/导出日志
- 支持按域名推荐配置模板
- 更丰富的 e2e 覆盖场景
