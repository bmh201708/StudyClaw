# StudyClaw API（非 AI）

Express + 内存存储，用于**专注会话**的创建、增量更新、结束与已完成列表。

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

## 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/sessions` | 创建会话 `{ goal, mode }` |
| GET | `/api/sessions?status=completed&limit=20` | 最近已完成会话 |
| GET | `/api/sessions/:id` | 单条会话 |
| PATCH | `/api/sessions/:id` | 更新活跃会话（计时、任务快照等） |
| POST | `/api/sessions/:id/complete` | 结束并归档（可含 `distractionEscrow: string[]`） |

## 下一步（未实现）

- SQLite / Postgres 持久化
- 用户维度与鉴权
- 工作流中定时 `PATCH` 同步（前端已预留 `patchServerSession`）
