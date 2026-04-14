# StudyClaw 后端开发指南

本文档描述 StudyClaw 当前后端的实际落地状态。内容基于仓库中的当前代码，以及已经部署到腾讯云服务器上的运行方式整理。

覆盖范围：

- 当前后端架构
- 主要技术栈
- 代码目录与关键文件职责
- 数据库表结构
- API 端点
- AI 服务层设计
- Docker 与腾讯云部署信息
- 日常开发、发布、排障方式

## 1. 总览

StudyClaw 当前后端是一个 **Docker 化的模块化单体服务**。

它现在承担 6 类核心职责：

- 用户注册、登录、退出、登录态校验
- 用户资料、密码、偏好、AI 偏好管理
- 自定义 API 配置的服务端加密存储
- 专注会话创建、更新、完成、查询
- Progress 快照保存与读取
- 附件分析、默认 AI 任务生成、Workflow 聊天助手

当前不是微服务，也没有单独 worker。所有业务逻辑都在一个 `Express` API 进程里完成，数据库使用 `PostgreSQL`。

当前生产部署的 StudyClaw 容器有：

- `studyclaw-api`
- `studyclaw-postgres-1`
- `studyclaw-frontend`

此外服务器上还有其他项目容器，如 `hush-backend`、`rp-api`、`rp-nginx`、`rp-postgres`、`rp-redis`，它们**不属于 StudyClaw**，部署和排障时不要误操作。

## 2. 当前架构

### 2.1 架构风格

当前实现可以理解为：

- HTTP 层：`Express`
- 路由层：`auth / account / analyze / chat / progress / sessions`
- 服务层：
  - 认证：`auth.ts`
  - 账户与偏好：`account.ts`
  - 会话与 progress 持久化：`store.ts`
  - 默认 AI 服务层：`src/ai/*`
- 数据层：`pg` 直连 PostgreSQL
- 文件处理：内存上传 + 同步文本抽取
- AI 调用：同步请求 OpenAI-compatible `chat/completions`

### 2.2 请求流

#### 注册 / 登录

1. 前端请求 `/api/auth/register` 或 `/api/auth/login`
2. 后端写入或读取 `app_users`
3. 后端生成随机 bearer token
4. token 的 SHA-256 摘要写入 `auth_tokens`
5. 原始 token 返回给前端
6. 前端将 token 保存在浏览器本地存储

#### 用户偏好 / AI 偏好

1. 前端登录后拉取 `/api/account/preferences` 或 `/api/account/ai-preferences`
2. 后端按用户读取 `user_preferences`、`user_ai_preferences`
3. 若偏好行不存在，会自动补默认值
4. 自定义 API key 只会以**密文**形式存入数据库，接口只返回掩码

#### 专注会话

1. 前端在 Task Setup 创建 `/api/sessions`
2. 后端识别用户并写入 `workflow_sessions`
3. Workflow 阶段持续 `PATCH /api/sessions/:id`
4. 完成后调用 `POST /api/sessions/:id/complete`
5. Dashboard 可继续调用 `/api/progress` 保存快照

#### 附件分析与默认 AI 任务生成

1. 前端上传目标和附件到 `POST /api/analyze`
2. 后端使用 `multer` 以内存方式接收文件
3. 后端抽取文本并拼接 `contextForAI`
4. `generateStudyPlan(...)` 通过统一 AI 服务层调用默认模型
5. 返回兼容前端的 `ai.status / ai.message / ai.tasks / ai.summary`

#### Workflow 聊天助手

1. 前端调用 `POST /api/chat/workflow-assistant`
2. 后端从请求体拿到 workflow live snapshot
3. 统一 AI 服务层构造 prompt 和工具集合
4. 模型可通过 tool calling 获取：
   - 当前用户资料
   - 当前学习上下文和活跃 session
   - 最近 3 条 saved progress
5. 工具结果回填给模型，再生成最终聊天回复

## 3. 技术栈

### 3.1 运行时

- Node.js 20
- TypeScript
- Express 4

### 3.2 数据库

- PostgreSQL 16
- `pg`

### 3.3 鉴权与安全

- `bcryptjs`：密码哈希
- Bearer Token：当前登录态方案
- `crypto`（Node 内置）：token hash、对称加密辅助
- 自定义 API key：服务端 AES-GCM 风格对称加密存储

### 3.4 附件处理

- `multer`：文件上传
- `pdf-parse`：PDF 文本抽取
- `mammoth`：DOCX 文本抽取

### 3.5 容器化

- Docker
- Docker Compose

### 3.6 AI 接入

- OpenAI-compatible Chat Completions
- 默认模型配置环境变量：
  - `LLM_PROVIDER`
  - `LLM_BASE_URL`
  - `LLM_API_KEY`
  - `LLM_MODEL`

## 4. 代码目录

后端代码位于 [server](/Users/jimjimu/Documents/GitHub/StudyClaw/server)。

当前主要结构：

```text
server/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── auth.ts
│   ├── account.ts
│   ├── crypto.ts
│   ├── extractFileText.ts
│   ├── store.ts
│   ├── types.ts
│   ├── ai/
│   │   ├── client.ts
│   │   ├── config.ts
│   │   ├── errors.ts
│   │   ├── parsers.ts
│   │   ├── prompts.ts
│   │   ├── service.ts
│   │   ├── tools.ts
│   │   └── types.ts
│   └── routes/
│       ├── account.ts
│       ├── analyze.ts
│       ├── auth.ts
│       ├── chat.ts
│       ├── progress.ts
│       └── sessions.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

### 4.1 关键文件说明

- [server/src/index.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/index.ts)
  - API 入口
  - 初始化 DB
  - 挂载所有路由

- [server/src/db.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/db.ts)
  - PostgreSQL 连接池
  - 启动时自动建表
  - 数据库行到领域对象的映射

- [server/src/auth.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/auth.ts)
  - 注册、登录、token 管理
  - `requireUser()` 鉴权入口

- [server/src/account.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/account.ts)
  - 用户资料更新
  - 修改密码
  - 用户偏好读写
  - AI 偏好读写
  - 用户统计聚合查询

- [server/src/crypto.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/crypto.ts)
  - 自定义 API key 加密
  - 掩码生成

- [server/src/store.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/store.ts)
  - `workflow_sessions` 和 `saved_progress` 的数据库读写

- [server/src/extractFileText.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/extractFileText.ts)
  - 附件文本抽取

- [server/src/ai/service.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/ai/service.ts)
  - 对外提供两个用例：
    - `generateStudyPlan(...)`
    - `runWorkflowAssistant(...)`

- [server/src/ai/tools.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/ai/tools.ts)
  - Workflow Assistant 的 tool registry

- [server/src/routes/account.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/account.ts)
  - 个人中心相关接口

- [server/src/routes/progress.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/progress.ts)
  - Progress 保存与读取

- [server/src/routes/chat.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/chat.ts)
  - Workflow 聊天助手入口

## 5. 数据库设计

数据库初始化逻辑在 [server/src/db.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/db.ts)。

### 5.1 `app_users`

用途：用户主表

字段：

- `id TEXT PRIMARY KEY`
- `email TEXT UNIQUE NOT NULL`
- `name TEXT NOT NULL`
- `password_hash TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### 5.2 `auth_tokens`

用途：登录态表

字段：

- `token_hash TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `last_used_at TIMESTAMPTZ NOT NULL`
- `expires_at TIMESTAMPTZ NOT NULL`

说明：

- 返回给前端的是明文 token
- 数据库里只保存 token 的 SHA-256 摘要
- 退出登录时会撤销 token

### 5.3 `workflow_sessions`

用途：专注会话主表

字段：

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `goal TEXT NOT NULL`
- `mode TEXT NOT NULL`
- `status TEXT NOT NULL`
- `focus_time INTEGER NOT NULL`
- `completed_tasks INTEGER NOT NULL`
- `total_tasks INTEGER NOT NULL`
- `distraction_count INTEGER NOT NULL`
- `tasks JSONB NOT NULL`
- `distraction_escrow JSONB NOT NULL`
- `context_summary TEXT`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`
- `completed_at TIMESTAMPTZ`

说明：

- 当前没有任务子表，任务快照直接落 JSONB
- `PATCH /api/sessions/:id` 会持续更新这些统计字段

### 5.4 `saved_progress`

用途：用户主动保存的 progress 快照

字段：

- `id TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `source_session_id TEXT NULL`
- `goal TEXT NOT NULL`
- `focus_time INTEGER NOT NULL`
- `completed_tasks INTEGER NOT NULL`
- `total_tasks INTEGER NOT NULL`
- `distraction_count INTEGER NOT NULL`
- `completed_task_titles JSONB NOT NULL`
- `distraction_escrow JSONB NOT NULL`
- `context_summary TEXT`
- `saved_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

### 5.5 `user_preferences`

用途：用户基础偏好

字段：

- `user_id TEXT PRIMARY KEY`
- `default_workflow_mode TEXT NOT NULL`
- `focus_reminder_enabled BOOLEAN NOT NULL`
- `break_reminder_enabled BOOLEAN NOT NULL`
- `theme_variant TEXT NOT NULL`
- `ui_density TEXT NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

### 5.6 `user_ai_preferences`

用途：用户 AI 偏好与自定义 API 配置

字段：

- `user_id TEXT PRIMARY KEY`
- `mode TEXT NOT NULL`
- `provider TEXT NOT NULL`
- `model TEXT NOT NULL`
- `base_url TEXT NOT NULL`
- `custom_api_key_encrypted TEXT NULL`
- `custom_api_key_masked TEXT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

说明：

- 明文 API key **不会**存数据库
- 接口只会返回 `hasCustomApiKey` 和 `customApiKeyMasked`
- 当前是一用户一套 AI 偏好，不支持多套配置切换

## 6. API 端点

### 6.1 健康检查

#### `GET /health`

用途：容器健康检查、反向代理探活

示例响应：

```json
{
  "ok": true,
  "service": "studyclaw-api",
  "ts": "2026-04-13T15:03:31.513Z"
}
```

### 6.2 认证接口

#### `POST /api/auth/register`

用途：注册用户

请求体：

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "StudyClaw123"
}
```

成功响应：

```json
{
  "token": "<plain-token>",
  "user": {
    "id": "<uuid>",
    "email": "alice@example.com",
    "name": "Alice",
    "createdAt": "2026-04-13T09:20:52.768Z",
    "updatedAt": "2026-04-13T09:20:52.768Z"
  }
}
```

约束：

- `name` 至少 2 个字符
- `email` 必须符合格式
- `password` 至少 8 个字符

#### `POST /api/auth/login`

用途：登录

#### `GET /api/auth/me`

用途：获取当前用户

需 `Authorization: Bearer <token>`

#### `POST /api/auth/logout`

用途：退出登录并撤销当前 token

### 6.3 账户接口

所有 `/api/account/*` 都需要登录。

#### `PATCH /api/account/profile`

用途：修改昵称

请求体：

```json
{
  "name": "Radiant Fox"
}
```

#### `POST /api/account/change-password`

用途：修改密码

请求体：

```json
{
  "currentPassword": "old-password",
  "nextPassword": "new-password"
}
```

#### `GET /api/account/preferences`

用途：一次性返回基础偏好 + AI 偏好

响应结构：

```json
{
  "preferences": {
    "userId": "<user-id>",
    "defaultWorkflowMode": "digital",
    "focusReminderEnabled": true,
    "breakReminderEnabled": true,
    "themeVariant": "radiant",
    "uiDensity": "comfortable",
    "updatedAt": "2026-04-13T15:03:59.601Z"
  },
  "aiPreferences": {
    "userId": "<user-id>",
    "mode": "default",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "baseUrl": "https://api.openai.com/v1",
    "hasCustomApiKey": false,
    "updatedAt": "2026-04-13T15:03:59.709Z"
  }
}
```

#### `PUT /api/account/preferences`

用途：保存基础偏好

可更新字段：

- `defaultWorkflowMode`
- `focusReminderEnabled`
- `breakReminderEnabled`
- `themeVariant`
- `uiDensity`

#### `GET /api/account/ai-preferences`

用途：单独读取 AI 偏好

#### `PUT /api/account/ai-preferences`

用途：保存 AI 偏好

支持两种模式：

- `mode = "default"`
- `mode = "custom"`

自定义模式可提交：

- `provider`
- `model`
- `baseUrl`
- `customApiKey`

说明：

- `customApiKey` 仅在更新时提交
- 读取时不会回传明文
- `openai-compatible` 的自定义模式要求显式 `baseUrl`

#### `GET /api/account/stats`

用途：个人中心统计页聚合数据

返回字段：

- `totalFocusTime`
- `completedSessions`
- `savedProgressCount`
- `last7Days`
- `recentSessions`

### 6.4 会话接口

所有 `/api/sessions/*` 都需要登录。

#### `POST /api/sessions`

用途：创建活跃会话

请求体：

```json
{
  "goal": "Finish chapter summary",
  "mode": "digital",
  "contextSummary": "Optional AI context"
}
```

#### `GET /api/sessions?status=completed&limit=20`

用途：查询最近完成的 session

#### `GET /api/sessions/:id`

用途：读取单条 session

#### `PATCH /api/sessions/:id`

用途：更新进行中的 session

可更新字段：

- `focusTime`
- `completedTasks`
- `totalTasks`
- `distractionCount`
- `tasks`
- `distractionEscrow`

#### `POST /api/sessions/:id/complete`

用途：完成 session

### 6.5 Progress 接口

所有 `/api/progress/*` 都需要登录。

#### `POST /api/progress`

用途：保存 Dashboard 上的 progress 快照

请求体核心字段：

- `goal`
- `focusTime`
- `completedTasks`
- `totalTasks`
- `distractionCount`
- `completedTaskTitles`
- `distractionEscrow`
- `sourceSessionId`
- `contextSummary`

#### `GET /api/progress?limit=3`

用途：读取最近保存的 progress

### 6.6 附件分析与任务生成

#### `POST /api/analyze`

用途：

- 接收 Task Setup 的目标与附件
- 抽取文本
- 拼接 `contextForAI`
- 调用默认 AI 生成任务计划

支持附件：

- `txt`
- `md`
- `pdf`
- `docx`
- `doc`
- `jpg/png/gif/webp`

限制：

- 单文件最大 `5 MiB`
- 最多 `10` 个附件

响应中包含：

- `goal`
- `contextForAI`
- `attachments`
- `limits`
- `ai`

### 6.7 Workflow 聊天助手

#### `POST /api/chat/workflow-assistant`

用途：在 Workflow 页面中与默认 AI 聊天

请求体核心字段：

- `sessionId`
- `goal`
- `focusTime`
- `tasks`
- `distractions`
- `messages`

说明：

- 该接口只走默认 AI，不走用户自定义 API 直连
- 内部会使用 tool calling
- 若默认 AI 未配置完整，会返回 `503`

## 7. AI 服务层

当前默认 AI 已经收口到 [server/src/ai](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/ai)。

### 7.1 结构

- `config.ts`
  - 统一读取 `LLM_*`
  - 校验 provider 是否支持

- `client.ts`
  - 统一请求 OpenAI-compatible `chat/completions`
  - 处理超时、上游错误、响应读取

- `prompts.ts`
  - 任务规划 prompt
  - Workflow assistant prompt

- `parsers.ts`
  - assistant 文本提取
  - 任务 JSON 解析
  - tool call 提取

- `tools.ts`
  - Workflow assistant 的工具注册表

- `service.ts`
  - `generateStudyPlan(...)`
  - `runWorkflowAssistant(...)`

- `errors.ts`
  - AI 层统一错误模型

### 7.2 当前支持的工具

- `get_current_user_profile`
- `get_current_learning_context`
- `get_recent_saved_progress`

### 7.3 当前错误分类

- `AI_CONFIG_ERROR`
- `AI_PROVIDER_UNSUPPORTED`
- `AI_UPSTREAM_ERROR`
- `AI_TIMEOUT_ERROR`
- `AI_PARSE_ERROR`
- `AI_TOOL_ERROR`

HTTP 映射原则：

- 配置缺失 / provider 不支持：`503`
- 上游失败 / 超时：`503`
- 解析失败 / 工具轮次耗尽：`502`

## 8. 环境变量

参考模板：[server/.env.example](/Users/jimjimu/Documents/GitHub/StudyClaw/server/.env.example)

核心变量：

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
CORS_ORIGIN=

API_BIND_IP=127.0.0.1
API_PORT=38101

DATABASE_URL=postgresql://studyclaw:change-me@postgres:5432/studyclaw
REDIS_URL=redis://redis:6379
AUTH_TOKEN_TTL_DAYS=30

USER_SECRET_ENCRYPTION_KEY=replace-with-a-long-random-secret

LLM_PROVIDER=openai-compatible
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=
LLM_API_KEY=
```

说明：

- `DATABASE_URL` 必填，否则服务启动直接失败
- `USER_SECRET_ENCRYPTION_KEY` 用于自定义 API key 加密
- `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` 不完整时，默认 AI 功能会返回禁用或 `503`

## 9. Docker 与部署

### 9.1 本地容器化启动

```bash
cd /Users/jimjimu/Documents/GitHub/StudyClaw/server
cp .env.example .env
docker compose up -d --build
```

默认行为：

- 启动 `api`
- 启动 `postgres`
- `redis` 只是预留 profile，默认不启动

### 9.2 腾讯云服务器上的实际位置

当前服务器信息：

- Host: `111.229.204.242`
- User: `root`
- Port: `22`

StudyClaw 相关目录：

- 后端目录：`/opt/studyclaw-backend`
- 前端目录：`/opt/studyclaw-frontend`
- 备份目录：`/opt/backups`

后端环境变量文件：

- `/opt/studyclaw-backend/.env`

### 9.3 当前容器与端口

StudyClaw 当前使用：

- `studyclaw-api`
  - 容器内端口：`3001`
  - Host 绑定：`127.0.0.1:38101 -> 3001`
- `studyclaw-postgres-1`
  - 容器内端口：`5432`
  - Host 绑定：`127.0.0.1:55432 -> 5432`
- `studyclaw-frontend`
  - 容器内端口：`80`
  - Host 绑定：`127.0.0.1:38180 -> 80`

公网入口通过宿主机 nginx 暴露：

- 前端：`http://111.229.204.242/studyclaw/`
- 后端：`http://111.229.204.242/studyclaw-api/`

## 10. 日常开发与发布

### 10.1 本地开发

后端单独启动：

```bash
cd /Users/jimjimu/Documents/GitHub/StudyClaw/server
npm install
npm run dev
```

与前端联调：

```bash
cd /Users/jimjimu/Documents/GitHub/StudyClaw
npm run dev:full
```

### 10.2 构建检查

后端构建：

```bash
cd /Users/jimjimu/Documents/GitHub/StudyClaw/server
npm run build
```

### 10.3 服务器上直接改后端

当前后端的实际维护方式是：**直接在腾讯云服务器的 `/opt/studyclaw-backend` 上编辑和重建容器**。

常用命令：

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw ps
docker compose -p studyclaw logs -f api
docker compose -p studyclaw up -d --build
docker compose -p studyclaw down
```

### 10.4 前端发布

前端使用仓库根目录脚本：

```bash
cd /Users/jimjimu/Documents/GitHub/StudyClaw
./scripts/deploy-frontend.sh
```

### 10.5 后端发布

当前没有固定的一键后端脚本纳入仓库主流程。若需要从本地同步后端到服务器，通常做法是：

1. 打包 `server/`
2. 上传到 `/opt/studyclaw-backend`
3. 保留远端 `.env`
4. 执行 `docker compose -p studyclaw up -d --build`

## 11. 排障建议

### 11.1 容器状态

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### 11.2 后端日志

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw logs -f api
```

### 11.3 数据库连接检查

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw exec postgres pg_isready -U studyclaw -d studyclaw
```

### 11.4 健康检查

```bash
curl http://127.0.0.1:38101/health
curl http://111.229.204.242/studyclaw-api/health
```

### 11.5 常见问题

- `DATABASE_URL is required`
  - `.env` 缺失或未加载

- 默认 AI 返回 `503`
  - `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` 未配置完整

- 自定义 API 偏好保存失败
  - `USER_SECRET_ENCRYPTION_KEY` 未配置
  - 或自定义模式缺少 `customApiKey`
  - 或 `openai-compatible` 模式缺少 `baseUrl`

- 前端请求 `401`
  - 浏览器本地 token 已过期或被清除

## 12. 当前限制与后续方向

当前已完成从“原型后端”向“可持久化后端”的升级，但仍有明显边界：

- 图片附件尚未接视觉模型
- 没有 Redis 队列和异步 worker
- 没有邮箱验证、密码重置等正式账号能力
- 没有更细粒度的 session 事件流
- AI 调用缺少限流、重试和更完整的可观测性
- 当前仍是单体进程，同步处理附件抽取和 AI 请求

下一阶段优先建议：

- AI 调用日志、超时、重试、限流
- session / progress 更细粒度历史
- 异步化附件分析与 AI 任务生成
- 更完整的账户安全能力
