# StudyClaw 后端开发指南

本文档描述 StudyClaw 当前后端的实际落地状态，包括：

- 后端架构
- 技术栈
- 代码目录
- 数据模型
- API 端点
- Docker 与服务器部署
- 腾讯云服务器上的实际位置和容器
- 日常开发、发布、排障方式

本文档基于当前仓库代码和已上线的腾讯云环境整理。

## 1. 概览

StudyClaw 当前后端是一个 **Docker 化的模块化单体服务**。

核心职责有三类：

- 用户注册、登录、登录态校验
- 专注会话的创建、更新、完成、查询
- 任务设置阶段的附件分析与默认 LLM 任务生成

当前后端不是微服务架构，也没有独立 worker。所有业务逻辑都在一个 `Express` API 进程里完成。

当前生产部署为两容器：

- `studyclaw-api`
- `studyclaw-postgres-1`

`redis` 只在 `docker-compose.yml` 里预留了 profile，没有进入当前生产主链。

## 2. 当前架构

### 2.1 架构风格

当前实现可以理解为：

- HTTP 层：`Express`
- 路由层：`auth / analyze / sessions`
- 业务层：分散在 `auth.ts`、`store.ts`、`planWithDefaultLlm.ts`
- 数据层：`pg` 直连 PostgreSQL
- 文件处理：内存上传 + 同步文本抽取
- AI 调用：同步请求 OpenAI-compatible 接口

### 2.2 请求流

#### 注册/登录

1. 前端调用 `/api/auth/register` 或 `/api/auth/login`
2. 后端写入或读取 `app_users`
3. 后端生成随机 token
4. token 的 SHA-256 摘要写入 `auth_tokens`
5. 原始 token 返回给前端
6. 前端把 token 保存在浏览器本地存储

#### 专注会话

1. 前端在 Task Setup 或 Workflow 阶段请求 `/api/sessions`
2. 后端从 `Authorization: Bearer <token>` 中识别用户
3. 会话写入 `workflow_sessions`
4. 后续 `PATCH /api/sessions/:id` 增量更新
5. `POST /api/sessions/:id/complete` 结束会话并标记 `completed`

#### 附件分析与 AI 任务生成

1. 前端上传目标和附件到 `/api/analyze`
2. 后端用 `multer` 读入内存
3. 文本型附件同步抽取正文
4. 所有内容合并成 `contextForAI`
5. 使用默认模型配置调用 `LLM_BASE_URL/chat/completions`
6. 解析模型 JSON 输出并返回 `ai.tasks`

## 3. 技术栈

### 3.1 运行时

- Node.js 20
- TypeScript
- Express 4

### 3.2 数据库

- PostgreSQL 16
- `pg` 驱动

### 3.3 鉴权与安全

- `bcryptjs`：密码哈希
- Bearer Token：当前登录态方案
- Token 在数据库中只存 SHA-256 摘要，不直接存明文

### 3.4 附件处理

- `multer`：上传解析
- `pdf-parse`：PDF 文本抽取
- `mammoth`：DOCX 文本抽取

### 3.5 容器化

- Docker
- Docker Compose

### 3.6 AI 接入

- OpenAI-compatible Chat Completions
- 环境变量：
  - `LLM_PROVIDER`
  - `LLM_BASE_URL`
  - `LLM_API_KEY`
  - `LLM_MODEL`

## 4. 代码目录

当前后端代码位于仓库内的 [server](/Users/jimjimu/Documents/GitHub/StudyClaw/server)。

主要结构如下：

```text
server/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── auth.ts
│   ├── store.ts
│   ├── types.ts
│   ├── extractFileText.ts
│   ├── planWithDefaultLlm.ts
│   └── routes/
│       ├── auth.ts
│       ├── analyze.ts
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
  - 服务入口
  - 装配 CORS、JSON 解析、路由
  - 启动时执行 `initDb()`

- [server/src/db.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/db.ts)
  - PostgreSQL 连接池
  - 启动时自动建表
  - 数据库行到领域对象的映射

- [server/src/auth.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/auth.ts)
  - 密码哈希
  - token 生成与校验
  - `requireUser()` 鉴权入口

- [server/src/store.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/store.ts)
  - 会话的数据库读写
  - 当前虽然文件名叫 `store`，但实际已经是 Postgres repository

- [server/src/routes/auth.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/auth.ts)
  - 注册、登录、获取当前用户、退出登录

- [server/src/routes/sessions.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/sessions.ts)
  - 专注会话相关接口

- [server/src/routes/analyze.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/analyze.ts)
  - 附件上传
  - 文本抽取
  - 默认 AI 任务生成

- [server/src/planWithDefaultLlm.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/planWithDefaultLlm.ts)
  - 默认模型调用
  - AI 结果 JSON 解析与归一化

## 5. 数据库设计

当前数据库初始化逻辑在 [server/src/db.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/db.ts)。

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
- 数据库里只保存 `token_hash`
- 每次 `/api/auth/me` 或需要鉴权的接口访问时会刷新 `last_used_at`

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

当前没有拆分任务子表，`tasks` 和 `distraction_escrow` 直接以 JSONB 数组存储。

## 6. API 端点

### 6.1 健康检查

#### `GET /health`

用途：容器健康检查、反向代理探活

示例响应：

```json
{
  "ok": true,
  "service": "studyclaw-api",
  "ts": "2026-04-13T09:20:10.493Z"
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

失败情况：

- 重复邮箱：`409`
- 参数不合法：`400`

#### `POST /api/auth/login`

用途：登录

请求体：

```json
{
  "email": "alice@example.com",
  "password": "StudyClaw123"
}
```

成功响应结构同注册。

#### `GET /api/auth/me`

用途：获取当前用户

请求头：

```http
Authorization: Bearer <token>
```

#### `POST /api/auth/logout`

用途：删除当前 token

说明：

- 当前是单 token 粒度退出
- 不会批量踢掉该用户所有 token

### 6.3 会话接口

以下接口都需要：

```http
Authorization: Bearer <token>
```

#### `POST /api/sessions`

用途：创建专注会话

请求体：

```json
{
  "goal": "Write backend guide",
  "mode": "digital",
  "contextSummary": "Optional combined setup context"
}
```

#### `GET /api/sessions/:id`

用途：查询单条会话

#### `PATCH /api/sessions/:id`

用途：同步会话过程数据

请求体示例：

```json
{
  "focusTime": 900,
  "completedTasks": 1,
  "totalTasks": 3,
  "distractionCount": 1,
  "tasks": ["Task A"],
  "distractionEscrow": ["Check messages later"]
}
```

#### `POST /api/sessions/:id/complete`

用途：结束会话

请求体示例：

```json
{
  "focusTime": 1500,
  "completedTasks": 3,
  "totalTasks": 3,
  "distractionCount": 1,
  "tasks": ["Task A", "Task B", "Task C"],
  "distractionEscrow": ["Check messages later"]
}
```

#### `GET /api/sessions?status=completed&limit=20`

用途：列出当前用户最近完成的会话

说明：

- 当前只支持 `status=completed`
- `limit` 最大 50

### 6.4 分析与 AI 规划接口

#### `POST /api/analyze`

用途：

- 接收目标和附件
- 抽取文本
- 调用默认模型生成任务计划

请求格式：`multipart/form-data`

字段：

- `goal`
- `attachments`，可多文件

当前限制：

- 最多 10 个文件
- 单文件最大 5 MiB
- 支持：
  - `txt`
  - `md`
  - `pdf`
  - `docx`
  - `doc`
  - `jpg/jpeg`
  - `png`
  - `gif`
  - `webp`

返回内容包括：

- `goal`
- `contextForAI`
- `attachments`
- `limits`
- `ai.status`
- `ai.message`
- `ai.model`
- `ai.summary`
- `ai.tasks`

注意：

- 当前后端 **没有强制要求** `/api/analyze` 登录后访问
- 当前前端会在有 token 时自动带上 `Authorization`
- 如果未来要收紧权限，应该在该路由也接 `requireUser()`

## 7. 环境变量

样例文件在 [server/.env.example](/Users/jimjimu/Documents/GitHub/StudyClaw/server/.env.example)。

### 7.1 通用

- `NODE_ENV`
- `HOST`
- `PORT`
- `CORS_ORIGIN`

### 7.2 宿主机端口绑定

- `API_BIND_IP`
- `API_PORT`
- `POSTGRES_BIND_IP`
- `POSTGRES_PORT`
- `REDIS_BIND_IP`
- `REDIS_PORT`

当前生产约定：

- API 仅绑定 `127.0.0.1:38101`
- Postgres 仅绑定 `127.0.0.1:55432`

### 7.3 数据库

- `DATABASE_URL`

当前 compose 内部默认形态：

```bash
DATABASE_URL=postgresql://studyclaw:change-me@postgres:5432/studyclaw
```

### 7.4 认证

- `AUTH_TOKEN_TTL_DAYS`

当前默认值：`30`

### 7.5 默认 AI

- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_BASE_URL`
- `LLM_API_KEY`

当前仅支持：

- `LLM_PROVIDER=openai-compatible`

## 8. Docker 与容器

Compose 文件在 [server/docker-compose.yml](/Users/jimjimu/Documents/GitHub/StudyClaw/server/docker-compose.yml)。

### 8.1 当前主容器

- `studyclaw-api`
  - Node.js API 容器
  - 对外仅绑定 `127.0.0.1:38101`

- `studyclaw-postgres-1`
  - PostgreSQL 容器
  - 对外仅绑定 `127.0.0.1:55432`

### 8.2 预留容器

- `redis`
  - 只有在 `infra` profile 下才会启动
  - 当前生产没有使用

### 8.3 健康检查

- API 容器通过 `fetch('http://127.0.0.1:3001/health')` 探活
- Postgres 容器通过 `pg_isready` 探活

## 9. 腾讯云服务器实际部署

### 9.1 服务器信息

当前线上部署在腾讯云主机：

- Host: `111.229.204.242`
- SSH 用户：`root`
- SSH 端口：`22`

说明：

- 密码或任何密钥不要写进仓库文档
- 连接凭证单独保管

### 9.2 线上目录

当前 StudyClaw 后端代码部署目录：

- `/opt/studyclaw-backend`

当前环境变量文件：

- `/opt/studyclaw-backend/.env`

备份目录：

- `/opt/backups`

### 9.3 线上容器

截至当前整理，服务器上有这些容器：

- `studyclaw-api`
- `studyclaw-postgres-1`
- `hush-backend`
- `rp-api`
- `rp-nginx`
- `rp-postgres`
- `rp-redis`

其中 StudyClaw 相关只有：

- `studyclaw-api`
- `studyclaw-postgres-1`

其它容器属于别的项目，**不要动**。

### 9.4 线上入口

内部 API：

- `http://127.0.0.1:38101`

外部经现有 nginx 转发后的入口：

- `http://111.229.204.242/studyclaw-api`

健康检查地址：

- `http://111.229.204.242/studyclaw-api/health`

注意：

- 当前是 HTTP，不是 HTTPS
- 如果要给 Vercel 等 HTTPS 前端正式接入，后续应补域名和证书

## 10. 日常开发方式

## 10.1 本地开发

后端目录：

```bash
cd server
cp .env.example .env
docker compose up -d --build
```

本地 API：

- `http://127.0.0.1:38101`

如果只跑 Node 开发模式：

```bash
cd server
npm install
npm run dev
```

### 10.2 以后直接在云服务器开发

既然当前约定是“后端以后直接在云服务器上写”，建议把 **服务器上的 `/opt/studyclaw-backend` 视为后端运行源目录**。

常用流程：

1. SSH 登录服务器
2. 进入 `/opt/studyclaw-backend`
3. 修改代码
4. 执行 `docker compose -p studyclaw up -d --build`
5. 用 `curl` 或日志验证

常用命令：

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw ps
docker compose -p studyclaw logs -f api
docker compose -p studyclaw logs -f postgres
docker compose -p studyclaw up -d --build
docker compose -p studyclaw down
```

### 10.3 查看数据库

```bash
docker exec -it studyclaw-postgres-1 psql -U studyclaw -d studyclaw
```

常见 SQL：

```sql
select * from app_users order by created_at desc limit 20;
select * from workflow_sessions order by created_at desc limit 20;
select * from auth_tokens order by created_at desc limit 20;
```

## 11. 发布流程

当前推荐发布步骤：

1. 备份 `/opt/studyclaw-backend`
2. 替换源码，但保留 `.env`
3. 执行 `docker compose -p studyclaw up -d --build`
4. 检查 `docker compose -p studyclaw ps`
5. 验证：
   - `/health`
   - `/api/auth/register` 或 `/api/auth/login`
   - `/api/sessions`

如果你要手动备份：

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p /opt/backups
tar -C /opt -czf /opt/backups/studyclaw-backend-$TS.tgz studyclaw-backend
```

## 12. 已知限制

- 当前没有 `Prisma`/`Drizzle`，SQL 是手写的
- 当前没有 migration 体系，表结构靠 `initDb()` 启动时自动创建
- 当前认证是简单 Bearer Token，不是 JWT
- 当前没有 refresh token 机制
- 当前 `/api/analyze` 仍是同步执行，耗时会占用请求
- 当前图片附件只做登记，不做视觉识别
- 当前没有任务子表，任务列表直接写 JSONB
- 当前没有审计日志、限流、密码重置、邮箱验证
- 当前公网入口还是 HTTP

## 13. 建议的下一步演进

优先级建议如下：

1. 给 `/api/analyze` 增加鉴权校验
2. 把数据库初始化迁移为正式 migration 机制
3. 把 `workflow_sessions.tasks` 从 JSONB 拆成任务子表
4. 引入 `redis + worker`，把附件分析和 AI 生成异步化
5. 增加 HTTPS 域名入口
6. 增加用户资料、密码重置、邮箱验证

## 14. 快速定位

如果要快速找问题，优先看这些文件：

- 服务启动与路由： [server/src/index.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/index.ts)
- 数据库初始化： [server/src/db.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/db.ts)
- 认证： [server/src/auth.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/auth.ts)
- 登录接口： [server/src/routes/auth.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/auth.ts)
- 会话接口： [server/src/routes/sessions.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/sessions.ts)
- AI 任务生成： [server/src/routes/analyze.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/routes/analyze.ts)
- 默认模型调用： [server/src/planWithDefaultLlm.ts](/Users/jimjimu/Documents/GitHub/StudyClaw/server/src/planWithDefaultLlm.ts)

