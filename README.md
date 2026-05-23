# AI数字学生课堂微格实训平台

面向师范生和新教师的本地微格教学实训平台。平台提供课程备课、AI学生画像、试讲控制台、即时教学策略建议和课后评价报告。

## 功能

- 中文后台式工作台，首屏直接进入平台。
- 本地 SQLite 保存课程、AI学生、实训事件和报告。
- OpenAI-compatible 大模型 Provider，可配置 `baseURL / apiKey / model / temperature`。
- 默认内置 DeepSeek 配置，接口地址为 `https://api.deepseek.com`。
- 无模型 Key 时自动使用本地课堂模拟引擎。
- 浏览器摄像头预览和 Web Speech API 语音转写，权限不可用时支持手动输入。
- 预留 Electron 桌面封装入口。

## 启动

```bash
npm install
npm run dev
```

默认地址：
- 前端开发服务：http://localhost:5173
- 后端 API：http://localhost:3001

构建生产版本：

```bash
npm run build
npm start
```

## 大模型配置

进入“模型设置”页，填写兼容 OpenAI Chat Completions 的接口：

- `Base URL` 示例：`https://api.openai.com/v1` 或其他兼容服务地址
- `模型名` 示例：`deepseek-v4-flash`、`deepseek-v4-pro`
- 勾选“启用真实大模型生成”

如果未启用或调用失败，系统会自动切换为本地模拟回应，保证课堂演示流程可继续。

## 数据

数据库文件位于 `data/platform.db`。当前版本为单机本地原型，不上传课堂数据。

## 开发检查

```bash
npm run typecheck
npm run build
npm run smoke
npm run check
```
