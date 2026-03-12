---
name: deploy
description: 部署/发布 career_system 到生产服务器。触发词：部署、发布、deploy、release、上线、更新服务器。
---

# Deploy Career System

部署 career_system 到生产服务器 `8.131.74.70`。可选参数: `$ARGUMENTS`（如 `full`, `code-only`, `db-migrate`, `restart`）。

**重要**: 你必须按照下面的流程严格执行，不要跳过任何步骤。

## Architecture

```
User -> career.joysort.cn (HTTPS)
     -> Caddy reverse proxy on admin.joysort.cn (10.0.1.198)
     -> Next.js app on 8.131.74.70 (10.0.1.201:3000, pm2: career-system)
     -> PostgreSQL 16 on 8.131.74.70 (Docker: postgres16, 127.0.0.1:5432)
```

## Servers

| Role | Host | Internal IP | Access |
|------|------|-------------|--------|
| App + DB | 8.131.74.70 | 10.0.1.201 | `ssh root@8.131.74.70` |
| Reverse Proxy | admin.joysort.cn | 10.0.1.198 | `ssh root@admin.joysort.cn` |

## Database

- **Container**: `postgres16` (image: `postgres:16-alpine`)
- **Volume**: `pgdata` (persistent)
- **User**: `student_app`
- **Database**: `student_system`
- **Connection**: `postgresql://student_app:<password>@127.0.0.1:5432/student_system`
- **Env file**: `/opt/career_system/.env.local`

---

## Phase 1: Pre-Deploy Checks (MANDATORY)

在执行任何部署操作之前，**必须**按顺序完成以下检查：

### 1.1 检查 repo 是否 dirty

```bash
git status --porcelain
```

- 如果有未提交的改动（dirty），**不要直接部署**。进入 Phase 1.2。
- 如果 repo 是 clean 的，跳到 Phase 1.3。

### 1.2 处理 dirty 改动

1. 运行 `git status` 和 `git diff --stat` 展示给用户，让用户确认这些改动是否是他们希望提交的内容。
2. 如果用户确认要提交：
   - `git add` 相关文件（注意不要提交 .env 等敏感文件）
   - 让用户确认 commit message，然后提交
3. 如果用户不想提交这些改动：
   - 询问用户是否要 stash 或 discard
   - 处理完毕后继续

### 1.3 版本 Tag 管理

1. 查看当前最新 tag：
   ```bash
   git tag --sort=-v:refname | head -5
   ```

2. 基于最新 tag 自动推荐下一个版本号（末位 +1）：
   - 例如当前最新 `v0.1.1` → 推荐 `v0.1.2`
   - 如果没有 tag → 推荐 `v0.1.0`

3. **向用户展示推荐版本号**，用户可以：
   - 接受推荐版本
   - 输入自定义版本号（如 `v0.2.0` 用于 minor 升级）

4. 创建 tag 并推送：
   ```bash
   git tag -a {version} -m "Release {version}: {brief_description}"
   git push origin {version}
   ```

**重要**: 部署始终基于 tag，不要使用 `git push origin main`。服务器拉取时使用 `git fetch --tags && git checkout {version}`。

---

## Phase 2: Smart Mode Recommendation

根据当前改动内容，**自动分析并推荐**最合适的部署模式。

### 分析规则

在本地运行以下检查（对比上一个 tag 和当前 HEAD 之间的差异）：

```bash
# 获取上一个 tag
PREV_TAG=$(git tag --sort=-v:refname | sed -n '2p')
# 如果只有一个 tag，则对比该 tag 与 HEAD
# 获取变更文件列表
git diff --name-only ${PREV_TAG}..HEAD
```

根据变更文件判断：

| 变更内容 | 检测条件 | 推荐模式 |
|----------|----------|----------|
| 仅代码文件 (src/, public/, etc.) | 无 package.json 变更，无 prisma/migrations 变更 | `code-only` |
| 包含 package.json 或 package-lock.json | package*.json 有变更 | `full` |
| 包含数据库迁移 | prisma/migrations/ 有新文件 | `full` 或 `db-migrate` + `code-only` |
| 仅配置变更 | 只有 .env.example 或 config 变更 | `restart` |
| 什么都没变 | git diff 为空 | 提示用户"没有需要部署的改动" |

向用户展示分析结果和推荐，例如：

> 分析结果：
> - 变更文件 12 个，均为 `src/` 下的代码文件
> - 无 package.json 变更
> - 无数据库迁移变更
>
> **推荐模式: `code-only`** (只拉代码、构建、重启)
>
> 是否确认？或者你想选择其他模式？

---

## Phase 3: Execute Deployment

### 部署模式详解

#### `code-only` (推荐 - 最常用)

拉取指定 tag、构建、重启。不运行 npm install 和数据库迁移。

```bash
ssh root@8.131.74.70 "cd /opt/career_system && git fetch --tags && git checkout {version} && source /root/.nvm/nvm.sh && npm run build && pm2 restart career-system"
```

#### `full` (完整部署)

完整流程：拉取 → npm install → 数据库迁移 → 构建 → 重启 → 验证。

```bash
# Step 1: Pull tag
ssh root@8.131.74.70 "cd /opt/career_system && git fetch --tags && git checkout {version}"

# Step 2: Install dependencies
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npm install"
# Note: If npm has issues in China, use: npm install --registry=https://registry.npmmirror.com

# Step 3: Database migration
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npx prisma migrate deploy"

# Step 4: Build
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npm run build"

# Step 5: Restart
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 restart career-system"
```

#### `db-migrate` (仅数据库迁移)

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npx prisma migrate deploy"
```

#### `restart` (仅重启)

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 restart career-system"
```

---

## Phase 4: Post-Deploy Verification (MANDATORY)

部署完成后 **必须** 执行验证：

```bash
# 1. Health check (内部)
ssh root@8.131.74.70 "curl -s http://127.0.0.1:3000/api/health"

# 2. 检查 pm2 状态
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 status"

# 3. 检查最近日志有无错误
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 logs career-system --lines 20 --nostream"

# 4. External check (如果可达)
curl -sI https://career.joysort.cn | head -5
```

向用户报告验证结果。如果有错误，立即检查日志并报告。

---

## Troubleshooting

### Check app logs
```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 logs career-system --lines 50"
```

### Check app status
```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 status"
```

### Check database
```bash
ssh root@8.131.74.70 "docker exec postgres16 psql -U student_app -d student_system -c 'SELECT 1;'"
```

### Restart database
```bash
ssh root@8.131.74.70 "docker restart postgres16"
```

### Check Caddy proxy config
```bash
ssh root@admin.joysort.cn "cat /etc/caddy/conf.d/career.caddy"
```

### Reload Caddy (after config change)
```bash
ssh root@admin.joysort.cn "systemctl reload caddy"
```

### Rollback to previous tag
```bash
PREV_TAG=$(ssh root@8.131.74.70 "cd /opt/career_system && git tag --sort=-v:refname | sed -n '2p'")
ssh root@8.131.74.70 "cd /opt/career_system && git checkout ${PREV_TAG} && source /root/.nvm/nvm.sh && npm run build && pm2 restart career-system"
```

## Key Details

- **Node**: v22 LTS via nvm (source /root/.nvm/nvm.sh required before any node/npm/pm2 command)
- **nvm mirror**: `NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node` (China)
- **Docker mirror**: `docker.1panel.live` configured in `/etc/docker/daemon.json`
- **TLS**: Auto via Caddy + Aliyun DNS challenge (alidns plugin)
- **Caddy config**: `/etc/caddy/conf.d/career.caddy` on admin.joysort.cn
- **pm2 auto-start**: Configured via `pm2 startup` + `pm2 save`
- **App listens on**: `0.0.0.0:3000` (accessible via internal IP 10.0.1.201)
- **Tag format**: `vX.Y.Z` (semver), e.g. `v0.1.1`, `v0.2.0`
- **Deploy from tag, NOT from main branch**
