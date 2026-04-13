# StudyClaw 后端落地方案

这份方案分成两层：

- 当前可立即落地：单个 `api` 容器，直接部署现有 Express 服务。
- 下一阶段演进：保留同一代码仓的模块化单体结构，再接 `postgres + redis`，把 AI 与附件分析逐步异步化。

## 1. 当前推荐目录

```text
server/
├── src/
│   ├── index.ts                 # HTTP 入口
│   ├── types.ts                 # DTO / 领域类型
│   ├── store.ts                 # 当前内存存储（后续替换为 repository）
│   ├── extractFileText.ts       # 附件抽取
│   └── routes/
│       ├── analyze.ts           # /api/analyze
│       └── sessions.ts          # /api/sessions
├── Dockerfile                   # 生产镜像
├── docker-compose.yml           # 本地/云服务器统一部署入口
├── .env.example                 # 运行时变量样例
├── tsconfig.json
├── tsconfig.build.json          # 生产构建
└── package.json
```

这版目录不强行大改现有代码，优先保证：

- 能直接构建镜像并在容器里跑起来
- 对现有前端接口零破坏
- 给后续数据库接入保留演进路径

## 2. 下一阶段建议结构

当你开始接数据库和真实 AI 时，建议把 `server/src` 逐步整理成下面的结构：

```text
server/src/
├── app/
│   ├── config/                  # 环境变量、日志、CORS、限流
│   ├── http/                    # Express app、middleware、router 装配
│   └── bootstrap/               # 启动入口
├── modules/
│   ├── health/
│   ├── ai/
│   │   ├── providers/           # OpenAI-compatible / Anthropic / mock
│   │   ├── prompts/
│   │   └── ai.service.ts
│   ├── attachments/
│   │   ├── extractors/          # pdf/docx/image
│   │   ├── storage/             # 本地盘或对象存储
│   │   └── attachments.service.ts
│   ├── sessions/
│   │   ├── sessions.controller.ts
│   │   ├── sessions.service.ts
│   │   ├── sessions.repository.ts
│   │   └── sessions.types.ts
│   └── reports/
├── shared/
│   ├── db/                      # Prisma/Drizzle client
│   ├── queue/                   # BullMQ / Redis
│   └── utils/
└── worker/
    └── index.ts                 # 异步任务入口
```

核心原则：

- 先保持单仓单服务思路，不急着拆微服务
- `api` 负责 HTTP 与同步响应
- `worker` 负责 AI 调用、长文本处理、报告生成
- `postgres` 负责会话、任务、附件元数据、报告
- `redis` 负责队列、缓存和节流

## 3. 容器化策略

### 当前上线

- 只启动 `api`
- 主机端口绑定到 `127.0.0.1:38101`
- 不改现有 nginx，不抢占已有端口，不碰别的 compose 项目

### 后续扩展

- 用同一个 `docker-compose.yml` 的 `infra` profile 启动 `postgres`、`redis`
- 前端或反向代理需要接入时，再单独配置一个新的 nginx 站点或 location 转发到 `127.0.0.1:38101`

## 4. 云服务器部署约束

部署时遵守以下约束，避免影响现有业务：

- 新项目目录单独放在 `/opt/studyclaw-backend`
- 使用独立 compose 项目名，例如 `studyclaw`
- 仅绑定新端口 `127.0.0.1:38101`
- 不修改现有容器、不复用现有容器网络、不改系统 nginx 配置

## 5. 建议的下一步开发顺序

1. 把 `SessionStore` 换成 Postgres repository
2. 新增 `POST /api/plans`，把 `/api/analyze` 的结果真正送入模型，返回结构化任务
3. 在工作流页增加自动 `PATCH /api/sessions/:id`
4. 补鉴权与用户维度，再决定是否支持用户自带 AI Key
