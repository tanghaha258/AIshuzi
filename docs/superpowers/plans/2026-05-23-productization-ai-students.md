# AI数字学生课堂微格实训平台落地实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前本地 demo 升级为可真实试讲、可接入 DeepSeek、可持久化复盘的单机产品雏形。

**Architecture:** 保留 React + Vite + TypeScript 前端、Node.js + Express + SQLite 本地后端，把 AI 能力收束到统一 Provider 和服务层。微格试讲室以事件流为核心，教师语音、视觉观察、AI学生反应、教学建议、报告生成都写入同一条课堂时间线。

**Tech Stack:** React, TypeScript, Express, SQLite, OpenAI-compatible Chat Completions, DeepSeek, Web Speech API, MediaPipe Tasks Vision, optional sherpa-onnx/whisper.cpp, Electron.

---

## 1. 当前诊断

- 已有可运行原型：`src/client`、`src/server`、`src/shared`、`electron`、`data/platform.db` 都已存在，`npm run typecheck` 当前通过。
- 当前最大硬伤：多处中文文案和提示词已变成乱码，会污染 UI、默认数据、AI Prompt 和报告内容，必须先修。
- 当前 AI 学生是“单轮响应生成”，还没有持续状态、记忆、主动行为、课堂阶段意识和多 Agent 调度。
- 当前模型 Provider 已有 OpenAI-compatible 雏形，但缺少 DeepSeek 默认配置、JSON 模式约束、错误分类、调用日志和统一 AI 服务入口。
- 当前语音识别只做浏览器 Web Speech API，缺少分段转写、置信度、失败提示、服务端 ASR 适配层。
- 当前摄像头只预览，未做教师姿态、脸部可见度、视线/头部朝向等教学观察指标。
- 当前报告主要是规则汇总，缺少大模型生成的诊断文本和可追溯证据链。
- 当前目录不是 Git 仓库；进入工程化落地前建议初始化 Git 或接入已有版本管理。

### 1.1 阶段进度快照

Updated on 2026-05-24:

- [x] P0 工程底座：已初始化 Git，建立本地 Web 平台、SQLite 持久化、Electron 预留入口和基础验证脚本。
- [x] P1 DeepSeek-ready Provider：已支持 OpenAI-compatible provider 配置、默认 DeepSeek 地址、场景测试和本地 fallback。
- [x] P2 AI学生运行时：已实现学生运行态持久化、状态气泡、姿态变化、教师回合响应、被动 tick 和训练室事件流更新。
- [x] 训练室布局优化：已将试讲室推进到大屏控制台风格，包含教师区、课件区、AI学生舞台、即时建议、课堂脉搏、雷达与时间线。
- [x] P3 备课与脚本生成：已实现 AI/本地备课脚本生成、阶段表、预设突发事件、推荐学生和一键进入试讲室。
- [x] P3.5 模型可观测性与备课升级：已补齐模型调用日志、DeepSeek/fallback 明示、教材课时备课模式、教师教法字段、Provider 超时保护和设置页调用历史。
- [x] P3.5 真实 AI 服务验证：2026-05-24 已通过平台 API 完成 DeepSeek 连接测试和备课场景测试，日志显示 `usedModel: true`，设置页可见真实调用记录。
- [x] P4 语音转文字管线：已实现 Web Speech 连续分段、转写事件入库、试讲室转写面板、转写文本驱动 AI 学生回合。
- [ ] P5/P6/P7 未开始：真实视觉观察、报告 2.0、Electron 产品化仍在后续阶段。

## 2. 落地边界

- 第一阶段仍以单机本地产品为目标，不做云账号、不做多人协同、不上传课堂数据。
- DeepSeek 作为默认真实大模型 Provider；无 Key 时保留本地模拟，保证演示流程不断。
- 视觉识别只分析教师端摄像头，不做真实学生隐私采集。第一版只输出教学可用的弱指标：画面稳定、脸部可见、头部朝向、讲解节奏、表情活跃度。
- 语音转文字优先浏览器能力；Electron/本地部署阶段增加离线 ASR 插件。
- 课堂“智能体学生动起来”的验收标准：学生有独立画像、课堂状态、记忆、主动触发、被点名响应、互相影响，并在试讲室实时更新。

## 3. 外部能力选型

| 能力 | 首选 | 备选 | 落地策略 |
| --- | --- | --- | --- |
| 大模型 | DeepSeek OpenAI-compatible API | 任意 OpenAI-compatible 服务 | Provider 层只暴露 `chatJson`、`chatText`、`streamText`，所有 AI 功能统一走这里。 |
| 结构化输出 | DeepSeek JSON Output / OpenAI-compatible `response_format` | Prompt 内 JSON 约束 + 本地修复解析 | 学生响应、备课、报告全部用 JSON schema 校验后入库。 |
| 教师视觉观察 | MediaPipe Face Landmarker Web | face-api.js、OpenFace、EduSense | Web 端先用 MediaPipe；OpenFace/EduSense 太重，作为后续研究，不直接绑死。 |
| 语音转文字 | Web Speech API | sherpa-onnx、whisper.cpp | 浏览器先跑通实时分段；Electron 阶段接本地 ASR 服务。 |
| 图表报告 | 现有 Recharts | ECharts | 继续使用 Recharts，避免引入新图表体系。 |

参考源：
- DeepSeek API: https://api-docs.deepseek.com/
- DeepSeek 模型更新: https://api-docs.deepseek.com/news/news0725
- MediaPipe Face Landmarker Web: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
- face-api.js: https://github.com/justadudewhohacks/face-api.js
- OpenFace: https://github.com/TadasBaltrusaitis/OpenFace
- EduSense: https://github.com/edusense/edusense
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- whisper.cpp: https://github.com/ggerganov/whisper.cpp
- sherpa-onnx: https://github.com/k2-fsa/sherpa-onnx

## 4. 目标架构

### 4.1 AI 服务层

创建独立服务边界，所有 AI 能力都从这里进入：

- `src/server/ai/provider.ts`：底层 OpenAI-compatible HTTP、流式解析、错误分类。
- `src/server/ai/deepseek.ts`：DeepSeek 默认配置、模型建议、JSON 模式兼容。
- `src/server/ai/json.ts`：JSON 提取、schema 校验、失败降级。
- `src/server/ai/prompts.ts`：中文 Prompt 模板，禁止散落在路由中。
- `src/server/services/agentRuntime.ts`：AI学生多 Agent 调度。
- `src/server/services/lessonPlanner.ts`：备课生成。
- `src/server/services/reportGenerator.ts`：课后报告生成。

### 4.2 课堂事件流

课堂所有变化都落到 `ClassroomEvent`：

- 教师发言：`teacher_utterance`
- 转写片段：`transcript_segment`
- 学生回应：`student_response`
- 学生提问：`student_question`
- 学生走神：`student_distraction`
- 学生状态变化：`student_state_change`
- 视觉观察：`teacher_observation`
- 系统建议：`system_suggestion`
- 课堂指标：`classroom_metric`
- 报告节点：`report_evidence`

### 4.3 AI学生运行时

每个 `StudentAgent` 拆成三层：

- 静态画像：姓名、年级、性格、基础、典型行为、禁忌、口头禅。
- 动态状态：注意力、理解度、参与意愿、困惑点、情绪、最近一次发言时间。
- 行为策略：何时主动提问、何时走神、何时回应、何时挑战教师、被点名时如何变化。

运行机制：

- 每 5-8 秒执行一次轻量 tick，更新学生状态。
- 每次教师发言后执行 `respondToTeacherTurn`，由调度器选择 1-4 个学生发言或状态变化。
- 当困惑度、沉默时间、挑战意愿达到阈值时，即使教师没有点名，也能主动冒泡。
- 每个学生保留 session 内短记忆，用于“刚才我没听懂”“老师刚才说的例子”等连续上下文。

## 5. 阶段计划

### P0: 工程底座修复

**目标:** 先让项目成为可维护、可验证的工程。

**文件:**
- Modify: `README.md`
- Modify: `src/client/**/*.tsx`
- Modify: `src/server/**/*.ts`
- Modify: `src/shared/types.ts`
- Create: `docs/architecture.md`
- Create: `src/server/db/migrations.ts`

- [ ] 修复所有中文乱码文案、默认种子数据、错误提示、Prompt。
- [ ] 建立 SQLite migration 机制，避免继续把 schema 写死在 `initDb()`。
- [ ] 增加 `npm run check`，串起 typecheck、build、基础 API smoke test。
- [ ] 如用户确认，初始化 Git 仓库并提交 P0 基线。

**验收:** 新建课程、创建学生、进入试讲室、发送一轮发言、生成报告，全流程中文正常且 build 通过。

### P1: DeepSeek-ready Provider

**目标:** 后续所有 AI 功能只要填 DeepSeek Key 就能真实工作。

**文件:**
- Modify: `src/server/ai/provider.ts`
- Create: `src/server/ai/deepseek.ts`
- Create: `src/server/ai/json.ts`
- Create: `src/server/ai/prompts.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/components/SettingsPage.tsx`

- [ ] 默认模型配置改成 DeepSeek：`baseURL=https://api.deepseek.com`，推荐模型使用当前 DeepSeek 文档中的可用模型。
- [ ] Provider 支持 `response_format: { type: "json_object" }`，失败时自动回退到严格 Prompt JSON。
- [ ] 模型测试页增加“学生回应测试”“备课测试”“报告测试”三个真实场景。
- [ ] 保存每次模型调用的状态、耗时、错误、是否降级，供调试和报告追溯。
- [ ] API Key 只在服务端保存和使用，前端永远不拿明文 Key。

**验收:** 无 Key 时清楚提示并走本地模拟；有 DeepSeek Key 时学生回应、备课、报告都能产出合法 JSON。

### P2: AI学生多 Agent 运行时

**目标:** 让配置好的学生真正动起来。

**文件:**
- Modify: `src/shared/types.ts`
- Create: `src/server/services/agentRuntime.ts`
- Create: `src/server/services/studentState.ts`
- Create: `src/server/services/classroomMetrics.ts`
- Modify: `src/server/domain/simulation.ts`
- Modify: `src/server/index.ts`
- Modify: `src/client/components/TrainingRoom.tsx`
- Create: `src/client/components/training/StudentMatrix.tsx`
- Create: `src/client/components/training/EventTimeline.tsx`
- Create: `src/client/components/training/StrategyCoach.tsx`

- [ ] 扩展 `StudentAgent`，加入 `traits`、`abilities`、`triggers`、`memoryPolicy`。
- [ ] 新增 `StudentRuntimeState` 表，按 session 保存每个学生的动态状态。
- [ ] 实现课堂 tick：自动产生走神、困惑、举手、沉默、参与度变化。
- [ ] 实现教师回合调度：根据教师发言、课程目标、学生画像选择响应学生。
- [ ] 实现被点名：教师文本中出现学生名时，该学生优先回应并改变状态。
- [ ] 前端学生卡片显示实时状态、最近一句话、注意力/理解度变化动画。

**验收:** 不同学生在同一段教师发言后反应不同；同一学生在连续发言中有记忆和状态变化；刷新页面后状态和时间线可恢复。

### P3: 备课与实训脚本生成

**目标:** 让平台从“手工创建课程”升级为“AI辅助备课后直接开练”。

**文件:**
- Create: `src/server/services/lessonPlanner.ts`
- Modify: `src/server/db.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/client/components/CoursePlannerPage.tsx`
- Create: `src/client/components/planner/LessonPlanPanel.tsx`

- [ ] 输入学科、年级、主题、教学目标、课时长度，生成微格试讲脚本。
- [ ] 生成课堂阶段：导入、讲解、提问、练习、总结。
- [ ] 自动推荐学生画像组合：走神型、薄弱型、挑战型、积极型、内向型。
- [ ] 生成“预设突发事件”：听不懂、抢答、质疑、沉默、跑题。
- [ ] 课程、脚本、学生组合都入库并可复用。

**验收:** 用户 1 分钟内能从主题生成完整实训配置并进入试讲室。

### P4: 语音转文字管线

**目标:** 教师可以真实开麦试讲，平台形成可复盘转写。

**文件:**
- Modify: `src/client/hooks/useSpeechRecognition.ts`
- Create: `src/client/hooks/useTranscriptBuffer.ts`
- Create: `src/server/services/transcriptService.ts`
- Modify: `src/server/index.ts`
- Modify: `src/shared/types.ts`

- [ ] Web Speech API 改为连续分段模式，支持临时文本和最终文本。
- [ ] 每个转写片段入库，带开始/结束时间、来源、置信度。
- [ ] 权限失败、浏览器不支持、网络失败时保留手动输入。
- [ ] 预留 `LocalAsrProvider` 接口，Electron 阶段接 sherpa-onnx 或 whisper.cpp。

**验收:** 浏览器支持时可连续识别中文；不支持时页面不崩；转写能驱动 AI 学生响应。

### P5: 教师摄像头观察

**目标:** 把摄像头从预览升级为教学观察输入。

**文件:**
- Create: `src/client/hooks/useTeacherVision.ts`
- Create: `src/client/components/training/TeacherObservationPanel.tsx`
- Create: `src/server/services/observationService.ts`
- Modify: `src/client/components/TrainingRoom.tsx`
- Modify: `src/shared/types.ts`

- [ ] 使用 MediaPipe Face Landmarker 检测脸部可见、头部方向、表情活跃度。
- [ ] 将观察结果映射成教学建议：看镜头、语速放慢、停顿确认、增加互动。
- [ ] 所有视觉指标仅本地处理，默认不上传原始视频。
- [ ] 当 MediaPipe 加载失败时，退回摄像头预览，不阻塞试讲。

**验收:** 开启摄像头后能看到实时观察指标；权限拒绝时仍可完整试讲。

### P6: 课后报告 2.0

**目标:** 报告从“规则摘要”升级为“证据驱动的教学诊断”。

**文件:**
- Create: `src/server/services/reportGenerator.ts`
- Modify: `src/server/domain/simulation.ts`
- Modify: `src/client/components/ReportsPage.tsx`
- Create: `src/client/components/reports/ReportDetail.tsx`

- [ ] 规则引擎先生成指标和证据节点，再交给大模型生成中文诊断。
- [ ] 报告包含课堂概览、关键时间线、学生画像响应、教师策略命中、改进建议。
- [ ] 每条建议绑定证据事件，避免空泛评价。
- [ ] 支持导出 Markdown/HTML，后续再做 PDF。

**验收:** 结束试讲后 10 秒内生成可读报告；无模型 Key 时仍有规则版报告。

### P7: Electron 与本地产品化

**目标:** 从 Web 本地 demo 走向可交付桌面版。

**文件:**
- Modify: `electron/main.cjs`
- Modify: `package.json`
- Create: `electron/preload.cjs`
- Create: `docs/deployment.md`

- [ ] Electron 启动后端前检查端口、数据库路径、日志目录。
- [ ] 支持本地数据备份、清空演示数据、导入导出配置。
- [ ] 打包脚本预留 Windows 发行包。
- [ ] 增加运行日志，便于现场排错。

**验收:** 双击桌面版可启动，关闭窗口能安全停止后端，数据保存在本机。

## 6. 验证矩阵

- 工程：`npm run typecheck`、`npm run build`、`npm run check`。
- API：健康检查、课程 CRUD、学生 CRUD、session 创建、turn、complete、report。
- 模型：无 Key、错误 Key、DeepSeek 正确 Key、JSON 解析失败、流式失败。
- 试讲：手动输入、语音输入、摄像头开启、权限拒绝、刷新恢复。
- 智能体：主动提问、走神、被点名、困惑加深、教师策略后状态改善。
- 报告：有模型版、无模型版、事件少、事件多、异常中断后恢复。
- 视觉：宽屏 1440x900、笔记本 1366x768、窗口缩窄到 1180px。

## 7. 推荐执行顺序

1. P0 修复中文和工程底座。
2. P1 接好 DeepSeek Provider。
3. P2 做 AI学生运行时，这是产品灵魂。
4. P3 做备课，让用户能快速生成可训练场景。
5. P4 做语音，打通真实上课输入。
6. P5 做教师视觉观察，先轻量可用。
7. P6 做课后报告 2.0。
8. P7 做 Electron 和交付。

## 8. 近期第一轮冲刺

第一轮建议只做 P0-P2，目标是 5-8 个工作日内拿到“可真实配置 DeepSeek、AI学生会持续互动、课堂事件可追溯”的版本。

交付物：
- 修复乱码后的中文界面和 Prompt。
- DeepSeek 一键配置与测试。
- 多 Agent 学生运行时。
- 试讲室实时学生矩阵和事件时间线。
- SQLite 持久化恢复。
- 基础报告仍保留，P6 再升级为完整报告。
