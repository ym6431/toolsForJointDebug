请帮我实现一个基于 Lit + TypeScript + Chrome Extension Manifest V3 的 Chrome 扩展，用于“本地环境与线上环境联调时迁移非敏感前端状态”。

目标：
开发一个浏览器扩展，帮助开发者在本地环境和线上环境之间迁移非敏感前端状态，以便快速复现页面表现、调试 UI、验证配置差异。

重要约束：
1 所有导出与导入都必须由用户手动触发。
2. 数据仅保存到 chrome.storage.local，并支持删除。
3. 导入前必须展示预览与确认。
4. 代码需要清晰、模块化、可直接运行。

使用场景：
- 在线上页面读取某些配置项，例如：
  - 用户登陆头
  - 功能开关标记
  - 语言、主题、布局偏好
  - 某些业务上下文参数
- 然后在本地页面中写入这些状态，帮助开发调试

功能需求：

一、导出流程
1. 用户在目标网站页面打开扩展 popup
2. 扩展获取当前 tab URL
3. 通过 content script 读取：
   - localStorage
   - sessionStorage
   - document.cookie 中可访问的普通 cookie
4. 按配置的 key 列表筛选出可导出的项
5. 在 popup 中展示：
   - key
   - 来源（localStorage / sessionStorage / cookie）
   - value 预览
6. 用户勾选后点击“导出”
7. 保存为一个数据集，字段包括：
   - id
   - datasetName
   - sourceUrl
   - createdAt
   - items: [{ storageType, key, value }]

二、导入流程
1. 用户在本地开发页面打开扩展 popup
2. 选择一个已保存的数据集
3. popup 展示导入预览
4. 用户勾选需要导入的项
5. 点击“导入”
6. content script 将数据写入：
   - localStorage.setItem
   - sessionStorage.setItem
   - document.cookie
7. 导入完成后提示成功或失败，并支持刷新页面

三、配置能力
1. 支持在扩展内配置“迁移的 key 列表”
2. 配置格式例如：
   - storageType: localStorage | sessionStorage | cookie
   - key: string
   - description: string
3. 支持默认配置与用户自定义配置
4. 配置页面也用 Lit 实现

四、UI 需求
popup 页面包含以下区域：
1. 当前页面信息
2. 可导出项列表
3. 已保存数据集列表
4. 导入预览区
5. 操作结果提示
6. 配置入口

五、技术要求
1. 使用 Lit 编写 popup 和 options 页面
2. 使用 TypeScript
3. 使用 Manifest V3
4. 使用 background service worker
5. 使用 content script 访问页面上下文
6. 使用 chrome.storage.local 存储数据集和配置
7. 提供完整项目结构与全部代码
8. 不要只给片段，要给可运行版本

六、需要输出的内容
1. 完整目录结构
2. 每个关键文件的完整代码，包括：
   - manifest.json
   - package.json
   - tsconfig.json
   - popup 页面代码
   - options 页面代码
   - background.ts
   - content script
   - storage 模块
   - 类型定义
   - 工具函数
3. 构建与本地加载步骤
4. 关键设计说明

七、代码风格要求
1. 模块清晰
2. 类型完整
3. 错误处理完善
4. 关键逻辑带注释
5. UI 简洁可用
6. 不要尝试绕过浏览器安全限制

请直接生成完整方案和代码。