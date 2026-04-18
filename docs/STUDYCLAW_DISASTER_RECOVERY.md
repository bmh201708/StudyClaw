# StudyClaw 灾备与恢复手册

本文档描述 StudyClaw 当前已经落地的灾备内容，以及在服务器故障、代码损坏、容器损坏时的恢复步骤。

适用对象：

- 需要恢复腾讯云上的 StudyClaw 服务
- 需要确认当前备份是否足够恢复前后端和数据库
- 需要在新机器上重建 StudyClaw

## 1. 当前灾备范围

目前已经补齐的是 **应用级灾备**，不是整机镜像灾备。

也就是说，当前灾备可以恢复：

- 后端代码与部署目录
- 前端代码与部署目录
- StudyClaw PostgreSQL 数据库内容
- StudyClaw 的 nginx 路由配置
- StudyClaw 当前容器运行快照

但它不包含：

- 整台机器的系统镜像
- Docker 镜像缓存
- 其他项目容器的数据
- 腾讯云实例级快照

## 2. 当前备份位置

当前最新一套完整灾备位于服务器：

- 灾备目录：`/opt/backups/studyclaw-dr-20260414-145343`
- 总归档：`/opt/backups/studyclaw-dr-20260414-145343.tgz`

目录内包含：

- `backend-code.tgz`
  - `/opt/studyclaw-backend` 的完整打包
- `frontend-code.tgz`
  - `/opt/studyclaw-frontend` 的完整打包
- `postgres-studyclaw.sql.gz`
  - StudyClaw 数据库导出
- `nginx-studyclaw.inc`
  - StudyClaw 的 nginx include 配置
- `docker-ps.txt`
  - 备份时的容器列表快照
- `docker-inspect-summary.txt`
  - StudyClaw 容器镜像与重启策略摘要
- `manifest.txt`
  - 本次灾备的清单和 sha256

## 3. 灾备检查

在服务器上确认备份是否存在：

```bash
ls -lh /opt/backups/studyclaw-dr-20260414-145343
ls -lh /opt/backups/studyclaw-dr-20260414-145343.tgz
cat /opt/backups/studyclaw-dr-20260414-145343/manifest.txt
```

## 4. 恢复前原则

恢复前必须先确认：

1. 你要恢复的是 StudyClaw，不是服务器上的其他项目
2. 不要删除 `hush-backend`、`rp-api`、`rp-nginx`、`rp-postgres`、`rp-redis`
3. StudyClaw 当前使用的目录和端口是：
   - 后端目录：`/opt/studyclaw-backend`
   - 前端目录：`/opt/studyclaw-frontend`
   - 后端端口：`127.0.0.1:38101 -> 3001`
   - 前端端口：`127.0.0.1:38180 -> 80`
   - Postgres：`127.0.0.1:55432 -> 5432`

## 5. 同机恢复

适用于：

- 容器坏了
- 代码目录损坏了
- 前端部署目录被误删
- 数据库仍在，或者需要从 SQL dump 覆盖恢复

### 5.1 停止 StudyClaw 容器

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw down

cd /opt/studyclaw-frontend
docker compose -f docker-compose.frontend.yml down
```

### 5.2 恢复后端代码

```bash
rm -rf /opt/studyclaw-backend
mkdir -p /opt/studyclaw-backend
tar -xzf /opt/backups/studyclaw-dr-20260414-145343/backend-code.tgz -C /opt
```

恢复后确认：

```bash
ls -la /opt/studyclaw-backend
```

### 5.3 恢复前端代码

```bash
rm -rf /opt/studyclaw-frontend
mkdir -p /opt/studyclaw-frontend
tar -xzf /opt/backups/studyclaw-dr-20260414-145343/frontend-code.tgz -C /opt
```

### 5.4 恢复 nginx 路由

```bash
cp /opt/backups/studyclaw-dr-20260414-145343/nginx-studyclaw.inc \
  /www/server/panel/vhost/nginx/111.229.204.242.studyclaw.inc

nginx -t
nginx -s reload
```

### 5.5 重建数据库容器

如果只是代码损坏，而数据库容器和 volume 还在，通常不需要这一步。

如果数据库也坏了，先启动 StudyClaw postgres：

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw up -d postgres
```

等待数据库健康：

```bash
docker compose -p studyclaw ps
docker compose -p studyclaw exec postgres pg_isready -U studyclaw -d studyclaw
```

### 5.6 恢复数据库内容

使用 SQL dump 恢复：

```bash
gunzip -c /opt/backups/studyclaw-dr-20260414-145343/postgres-studyclaw.sql.gz | \
docker exec -i studyclaw-postgres-1 psql -U studyclaw -d studyclaw
```

如果你要先清空现有数据再恢复，可以先执行：

```bash
docker exec -i studyclaw-postgres-1 psql -U studyclaw -d studyclaw <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO studyclaw;
GRANT ALL ON SCHEMA public TO public;
SQL
```

然后再导入 dump。

### 5.7 重启后端与前端

后端：

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw up -d --build
```

前端：

```bash
cd /opt/studyclaw-frontend
docker compose -f docker-compose.frontend.yml up -d --build
```

### 5.8 恢复后校验

```bash
curl http://127.0.0.1:38101/health
curl http://111.229.204.242/studyclaw-api/health
curl -I http://111.229.204.242/studyclaw/
curl -I http://111.229.204.242/studyclaw/profile
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

## 6. 新服务器恢复

适用于：

- 整台腾讯云机器损坏
- 你要把 StudyClaw 迁到一台新云服务器

### 6.1 准备新机器

需要先安装：

- Docker
- Docker Compose
- nginx

并准备目录：

```bash
mkdir -p /opt/studyclaw-backend
mkdir -p /opt/studyclaw-frontend
mkdir -p /opt/backups
mkdir -p /www/server/panel/vhost/nginx
```

### 6.2 上传灾备包

把这一份完整归档传到新机器：

- `/opt/backups/studyclaw-dr-20260414-145343.tgz`

解压：

```bash
cd /opt/backups
tar -xzf studyclaw-dr-20260414-145343.tgz
```

### 6.3 恢复代码目录

```bash
tar -xzf /opt/backups/studyclaw-dr-20260414-145343/backend-code.tgz -C /opt
tar -xzf /opt/backups/studyclaw-dr-20260414-145343/frontend-code.tgz -C /opt
```

### 6.4 恢复 nginx 配置

```bash
cp /opt/backups/studyclaw-dr-20260414-145343/nginx-studyclaw.inc \
  /www/server/panel/vhost/nginx/111.229.204.242.studyclaw.inc
```

如果新机器不是这个 IP，需要把文件名和站点主配置引用一起调整。

### 6.5 配置后端 `.env`

检查：

```bash
cat /opt/studyclaw-backend/.env
```

重点确认这些变量可用：

- `DATABASE_URL`
- `AUTH_TOKEN_TTL_DAYS`
- `USER_SECRET_ENCRYPTION_KEY`
- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_BASE_URL`
- `LLM_API_KEY`

如果是迁移到新机器，但仍然用容器内 postgres，通常保留原来的：

```bash
DATABASE_URL=postgresql://studyclaw:change-me@postgres:5432/studyclaw
```

### 6.6 启动数据库

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw up -d postgres
```

### 6.7 导入数据库

```bash
gunzip -c /opt/backups/studyclaw-dr-20260414-145343/postgres-studyclaw.sql.gz | \
docker exec -i studyclaw-postgres-1 psql -U studyclaw -d studyclaw
```

### 6.8 启动后端与前端

后端：

```bash
cd /opt/studyclaw-backend
docker compose -p studyclaw up -d --build
```

前端：

```bash
cd /opt/studyclaw-frontend
docker compose -f docker-compose.frontend.yml up -d --build
```

### 6.9 配置 nginx

确保主 nginx 配置会 include：

- `/www/server/panel/vhost/nginx/111.229.204.242.studyclaw.inc`

然后：

```bash
nginx -t
nginx -s reload
```

## 7. 恢复验证清单

恢复完成后至少验证这些：

### 7.1 容器状态

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

应看到：

- `studyclaw-api`
- `studyclaw-postgres-1`
- `studyclaw-frontend`

### 7.2 健康检查

```bash
curl http://127.0.0.1:38101/health
curl http://111.229.204.242/studyclaw-api/health
```

### 7.3 前端入口

```bash
curl -I http://111.229.204.242/studyclaw/
curl -I http://111.229.204.242/studyclaw/profile
```

### 7.4 核心 API

至少验证：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/account/preferences`
- `GET /api/account/stats`

### 7.5 数据完整性

确认至少存在：

- 用户
- 一条 session
- 一条 progress

示例：

```bash
docker exec -it studyclaw-postgres-1 psql -U studyclaw -d studyclaw -c "select count(*) from app_users;"
docker exec -it studyclaw-postgres-1 psql -U studyclaw -d studyclaw -c "select count(*) from workflow_sessions;"
docker exec -it studyclaw-postgres-1 psql -U studyclaw -d studyclaw -c "select count(*) from saved_progress;"
```

## 8. 当前灾备的边界

这套灾备现在已经能恢复 **StudyClaw 应用本身**，但仍有边界：

- 不是整机镜像
- 不包含腾讯云实例快照
- 不包含其他项目的数据
- 不会自动恢复 TLS/域名层配置
- 不会自动恢复宝塔或系统级其他设置

所以更稳的方案仍然建议叠加：

- 腾讯云云盘快照
- 定期 SQL dump
- `/opt/backups` 异机同步

## 9. 建议的后续增强

如果你要把灾备再提高一个级别，建议做这三件：

1. 定时自动备份
   - 后端代码
   - 前端代码
   - PostgreSQL dump

2. 把 `/opt/backups` 同步到另一台机器或对象存储

3. 为恢复流程单独做一键脚本
   - `restore-backend.sh`
   - `restore-frontend.sh`
   - `restore-db.sh`
