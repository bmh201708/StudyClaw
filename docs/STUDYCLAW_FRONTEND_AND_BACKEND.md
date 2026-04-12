# StudyClaw 前端逻辑说明与后端任务清单

本文档梳理当前仓库内**前端应用逻辑**（路由、状态、存储、各页职责），并列出若产品化时**建议由后端承担的任务**。

---

## 1. 技术栈与入口

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| 路由 | React Router 7（`createBrowserRouter`） |
| 样式 | Tailwind CSS 4 |
| 动效 | `motion`（原 Framer Motion） |
| 提示 | `sonner`（全局 `<Toaster />`） |
| UI 基座 | Radix 系组件 + 自封装 `components/ui/*` |

**入口链**：`src/main.tsx` → `App.tsx`（`AiSettingsProvider` + `RouterProvider` + `Toaster`）→ `routes.tsx` 定义的浏览器路由。

---

## 2. 全局状态与持久化

### 2.1 React Context：`AiSettingsProvider`

- **文件**：`src/app/contexts/AiSettingsContext.tsx`
- **职责**：在内存中维护「是否已配置 AI」及完整 `AiSettings`，与 `localStorage` 同步。
- **API**：`settings`、`isConfigured`、`setSettings`、`refreshFromStorage`、`logoutAi`。
- **跨标签**：监听 `storage` 事件，键为 `studyclaw_ai_settings` 时重新 `loadAiSettings()`。

### 2.2 `localStorage`

| 键名 | 写入位置 | 用途 |
|------|------------|------|
| `studyclaw_ai_settings` | `aiSettingsStorage.ts` / Context / `AiGateway` / `HeaderAiSettings` | JSON：`provider`、`model`、`apiKey`、`baseUrl`（归一化后保存） |
| `studyClaw_archivedSessions` | `FeedbackDashboard` | 会话归档数组（最多 50 条），每项为会话快照 + `archivedAt` |

### 2.3 `sessionStorage`

| 键名 | 写入位置 | 读取位置 | 用途 |
|------|------------|----------|------|
| `currentGoal` | `TaskSetup` | `ActiveWorkflow` | 当前会话目标文案 |
| `workflowMode` | `TaskSetup` | 当前未在业务逻辑中消费（预留） |
| `sessionData` | `ActiveWorkflow`（结束会话） | `FeedbackDashboard` | 本次会话统计 JSON（含 `distractionEscrow[]`：分心收件箱条目，报告页顶部提醒） |
| `workflowEntryFrom` | `FeedbackDashboard`（从报告跳转） | 当前未在 `ActiveWorkflow` 中读取（预留） |
| `serverSessionId` | `TaskSetup`（后端创建成功） | `ActiveWorkflow`（结束会话时 `complete`）；成功完成后从 storage 移除 |

**注意**：以上均为**纯前端**持久化，刷新页面后 `sessionStorage` 在同源会话内保留；关闭标签页即丢失（除已写入 `localStorage` 的项）。

---

## 3. 路由结构

```
/welcome                    → AiGateway（无 Layout，全屏 AI 配置）
/                           → Layout + GuardedTaskSetup（TaskSetup）
/workflow                   → Layout + GuardedWorkflow（ActiveWorkflow）
/dashboard                  → Layout + GuardedDashboard（FeedbackDashboard）
```

### 3.1 `RequireAiConfig`

- **文件**：`src/app/components/RequireAiConfig.tsx`
- **逻辑**：`useAiSettings().isConfigured === false` 时 `<Navigate to="/welcome" replace />`，否则渲染子页面。
- **效果**：除 `/welcome` 外，主应用三页均需先完成 AI 配置（或本地已有合法配置）。

### 3.2 `Layout`

- **文件**：`src/app/components/Layout.tsx`
- **顶栏**：品牌、步骤文案（Task Setup → Active Workflow → Feedback Dashboard）、返回（非第一步时）、`HeaderAiSettings`（齿轮）、占位头像。
- **步骤路径**：`/`、`/workflow`、`/dashboard`（与 `navigate` 目标一致）。

---

## 4. 按页面梳理的前端逻辑

### 4.1 `/welcome` — `AiGateway`

- **布局**：独立全屏，无顶栏。
- **行为**：表单（服务商 / 模型 / API Key / 兼容 Base URL）由 `AiSettingsFormFields` 渲染；校验通过后 `normalizeAiSettings` + `setSettings`，`toast` 后 `navigate("/", { replace: true })`。
- **已配置**：可「跳过，进入应用」直接回 `/`。
- **数据**：完全依赖 `AiSettingsContext` + `localStorage`，**无后端调用**。

### 4.2 `/` — `TaskSetup`

- **状态**：`mode`（digital / physical）、`goal`、`isLoading`、`cameraStatus`（前端切换，无真实摄像头 API）。
- **核心操作「AI Smash」**：`handleAISmash`  
  - 校验 `goal` 非空 → `setIsLoading(true)` → **`await` 固定 2s 模拟延迟**（非真实 AI）→ 写入 `sessionStorage.currentGoal` / `workflowMode` → `navigate("/workflow")`。
- **缺口**：任务分解、推荐链接等均**未**调用用户配置的 `useAiSettings()`；与 `/welcome` 的 AI 配置尚未打通业务流。

### 4.3 `/workflow` — `ActiveWorkflow`

**数据输入**

- `goal`：`sessionStorage.currentGoal` 或默认文案。
- **任务列表**：`useEffect` 内写死的一组 mock `Task[]`（非来自 AI、非来自后端）。
- **计时器**：`focusTime` 秒表，`isTimerRunning` 控制 `setInterval` 每秒 +1。
- **分心列表**：本地 `distractions` 数组，用户输入追加。

**核心交互**

- 任务勾选、延迟完成动画、编辑、置顶、新增任务、优先级四象限标签。
- **结束会话**：组装 `sessionData`（含 `distractionEscrow`：Distraction Escrow Inbox 全文列表）写入 `sessionStorage`，`navigate("/dashboard")`；报告页最顶部展示「会后待办」提醒卡。
- **治愈伴侣**：`healingProminent` 由「有分心 / 30s 定时 empathy / 专注≥120s 且零完成」且未软关闭共同决定；全屏温暖发光层 + 文案区按钮（休息 / 继续 / 呼吸引导 / Not now）；`BreathingGuideDialog` 为独立对话框。
- **AI 推荐链接**：`picksForContext(goal, 当前首条未完成任务)` 纯前端关键词匹配 + 外链，**不调 API**。
- **计时 UI**：顶栏时间旁仅 Pause/Play 图标切换 `isTimerRunning`；治愈区内主按钮在运行/暂停间切换「I'm taking a break」与「Continue」。

**其它**

- `showEmpathy`：30s 后若完成数 &lt; 2 则置 true，用于抬高治愈态（原全屏 `EmpathyOverlay` 已不在路由中使用，组件仍存在于仓库）。

### 4.4 `/dashboard` — `FeedbackDashboard`

- **读数据**：优先 `sessionStorage.sessionData`；若无则使用**写死的演示数据**。
- **交互**：分享（Web Share API 或剪贴板）、下载 Markdown 摘要、归档（`localStorage` + 清 `sessionData` + 回 `/`）、新开流程（清 `sessionData` + 回 `/`）、时间线跳转工作流等，均为前端逻辑。
- **缺口**：归档列表无独立列表页；`workflowEntryFrom` 未驱动工作流高亮。

---

## 5. 共享组件与库（与业务强相关）

| 模块 | 说明 |
|------|------|
| `HeaderAiSettings` | 顶栏齿轮：Dialog 内复用 `AiSettingsFormFields`，保存 / 清除并回 `/welcome` |
| `AiSettingsFormFields` | AI 配置表单字段 |
| `BreathingGuideDialog` | 呼吸引导轮次与 `motion` 圆环动画 |
| `lib/aiSettingsStorage.ts` | AI 配置的序列化、归一化 Base URL、预设模型表 |

---

## 6. 当前前端与「理想产品」之间的差距（摘要）

1. **AI 配置**：已保存，但 **TaskSetup 的「AI Smash」未使用** `settings` 调用任何模型 API。  
2. **任务来源**：工作流任务为 **静态 mock**，非服务端或模型返回。  
3. **会话与报告**：仅 **sessionStorage + 可选 localStorage 归档**，无用户维度、无多端同步。  
4. **分心 / 治愈**：规则与文案前端写死，无服务端策略或个性化模型。  
5. **安全**：API Key 存浏览器；生产环境通常应改为 **后端代理或托管密钥**。

---

## 7. 后端需要完成的任务（建议清单）

以下按**领域**分组，便于排期；并非每一项都必须做 MVP，可按阶段裁剪。

### 7.1 身份与租户

- [ ] 用户注册 / 登录（邮箱、OAuth 或企业 SSO 等策略选型）。
- [ ] 会话（Session）或 JWT 与前端路由守卫对齐（替代或补充纯 `localStorage` AI 门槛）。
- [ ] 多设备同步「用户偏好」（模型选择可改为服务端默认，密钥策略见下）。

### 7.2 AI 与任务分解（核心业务）

- [ ] **任务分解接口**：入参 `goal`、`mode`（digital/physical）、可选上下文；出参结构化任务列表（含优先级、建议时长、备注字段），与前端 `Task` 类型对齐。
- [ ] **流式输出**（可选）：SSE/WebSocket 提升「AI Smash」体验。
- [ ] **模型路由**：按套餐或用户选择路由到 OpenAI / Anthropic / 自建兼容端；**API Key 默认不落浏览器**：使用服务端环境变量或用户在后端安全存储的加密凭据。
- [ ] **代理层**：统一鉴权、限流、计费、日志脱敏；避免前端直连厂商 Key 带来的泄露与 CORS 问题。
- [ ] **推荐资源**（可选）：由模型或规则服务返回「站点/文档」列表，替代纯关键词 `picksForContext`。

### 7.3 专注会话与数据持久化

- [ ] **会话实体**：创建 / 更新 / 结束会话（`focusTime`、任务快照、分心次数、里程碑等）。
- [ ] **任务状态同步**：勾选、编辑、置顶等可增量同步（乐观 UI + 冲突处理策略）。
- [ ] **报告生成**：服务端生成 PDF/图片/Markdown（可选），与当前前端下载逻辑对齐或替代。
- [ ] **归档 API**：替代仅 `localStorage` 的 `studyClaw_archivedSessions`，支持列表、搜索、删除。

### 7.4 分心、治愈与策略引擎（可选增强）

- [ ] 分心事件上报与时间线存储（用于真实「Achievement Timeline」）。
- [ ] **困难检测**：基于空闲时长、切换标签、输入节奏等（需浏览器扩展或桌面端配合时另议）；当前前端规则可由服务端配置下发。
- [ ] 治愈话术 / 呼吸引导配置化（多语言、A/B）。

### 7.5 物理模式与多媒体（若产品保留）

- [ ] 摄像头/屏幕权限相关能力通常在**客户端或浏览器扩展**；若上云则需合规（同意书、加密存储、保留期限）。
- [ ] 媒体文件上传与病毒扫描、签名 URL。

### 7.6 运维与安全

- [ ] HTTPS、CSP、依赖漏洞扫描。
- [ ] 审计日志（谁在何时调用了哪个 AI 端点）。
- [ ] 速率限制与异常检测（防刷 Key、防滥用）。

### 7.7 与当前前端的对接要点（接口设计提示）

- 约定 **REST 或 tRPC** 的路径前缀（如 `/api/v1`）。
- **会话开始**：`POST /sessions` → 返回 `sessionId` + 初始任务列表（替代 mock）。
- **会话更新**：`PATCH /sessions/:id`（计时、任务、分心条数可批量或字段级）。
- **会话结束**：`POST /sessions/:id/complete` → 返回报告摘要 ID，前端跳转报告页时带 `sessionId` 拉取详情（逐步替代 `sessionData` 整包塞 `sessionStorage`）。

---

## 8. 已实现的后端能力（非 AI，第一步）

仓库内 `server/` 为独立 Node 服务（Express + TypeScript + `tsx`），**内存存储**，进程重启后数据清空。

### 8.1 运行方式

| 命令 | 说明 |
|------|------|
| `npm run dev --prefix server` | 仅 API，默认 `127.0.0.1:3001` |
| `npm run dev:full`（根目录，需先 `npm install` 安装 `concurrently`） | 同时启动 Vite + API |
| `vite` 开发时 | `vite.config.ts` 将 `/api` 代理到 `3001` |

生产环境前端可设置 `VITE_API_URL` 指向真实 API 根地址（无则仍请求相对路径 `/api`）。

### 8.2 与前端对接

- **Task Setup** 在「AI Smash」模拟结束后调用 `POST /api/sessions`，成功则将 `id` 写入 `sessionStorage.serverSessionId`；失败则移除该键，**不影响**进入工作流。
- **结束会话** 时若有 `serverSessionId`，调用 `POST /api/sessions/:id/complete`；成功则在 `sessionData` 中附带 `serverSessionId` 供报告页后续扩展；失败则保留本地 `sessionData`，**不删除** `serverSessionId` 以便用户再次尝试结束（若需可改为强清）。

### 8.3 客户端工具

- `src/app/lib/sessionApi.ts`：`createServerSession`、`completeServerSession`、`patchServerSession`、`fetchCompletedSessions`。

### 8.4 建议的「下一步」后端迭代（仍不含 AI）

1. 工作流页定时或失焦时 `PATCH` 同步 `focusTime`、任务进度（减少刷新丢失）。
2. 报告页合并 `GET /api/sessions?status=completed` 与本地 `localStorage` 归档展示。
3. 持久化存储 + 部署环境变量 `PORT`。
4. 鉴权与用户级会话隔离。

---

## 9. 文档维护

- 路由、存储键或页面职责变更时，请同步更新本节与第 4、7、8 章对应表格/清单。
- 若引入真实 AI 调用，请在 `TaskSetup` / `ActiveWorkflow` 中补充「请求失败 / 重试 / 取消」的状态机说明并回链至此文档。

---

*生成自仓库当前代码结构；未包含 `node_modules` 与构建产物。*
