# StudyClaw API

Express + PostgreSQL，用于**用户注册/登录**、**专注会话持久化**、**附件分析/默认 AI 任务生成**。

## 运行

```bash
npm install
npm run dev
```

默认监听 `http://127.0.0.1:3001`。

与前端同时开发：

```bash
# 仓库根目录
npm install
npm run dev:full
```

根目录 `vite` 已将 `/api` 代理到 `3001`。

## Docker 部署

```bash
cp .env.example .env
docker compose up -d --build
```

默认会绑定到 `127.0.0.1:38101`，并同时启动 `postgres`，避免直接暴露到公网。

如需给前端“使用默认 API”选项提供默认模型，请在部署机器上的 `server/.env` 中配置：

```bash
LLM_PROVIDER=openai-compatible
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=
LLM_API_KEY=
```

## 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/auth/register` | 注册用户 `{ name, email, password }` |
| POST | `/api/auth/login` | 登录 `{ email, password }` |
| GET | `/api/auth/me` | 获取当前用户 |
| POST | `/api/auth/logout` | 退出登录 |
| POST | `/api/sessions` | 创建会话 `{ goal, mode }`，需登录 |
| GET | `/api/sessions?status=completed&limit=20` | 最近已完成会话，需登录 |
| GET | `/api/sessions/:id` | 单条会话，需登录 |
| PATCH | `/api/sessions/:id` | 更新活跃会话（计时、任务快照等），需登录 |
| POST | `/api/sessions/:id/complete` | 结束并归档（可含 `distractionEscrow: string[]`），需登录 |

## 当前限制

- 图片附件仍未接视觉模型
- Redis / worker 队列仍未接入
- 还没有密码重置、邮箱验证等正式账号功能
