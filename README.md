# career_system

学生职业探索平台 — 帮助大学生通过认知评估、社区活动和反思来探索职业方向。

## 技术栈

Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS + Shadcn UI + Prisma (PostgreSQL) + Auth.js v5

## 本地开发

### 前置条件

- Node.js 22+ (推荐 nvm)
- Docker (用于本地 PostgreSQL)
- pm2 (`npm install -g pm2`)

### 首次设置

```bash
# 安装依赖
npm install

# 创建本地数据库
docker exec aas-postgres psql -U aas -d postgres \
  -c "CREATE USER career_staging WITH PASSWORD 'career_staging_2026';" \
  -c "CREATE DATABASE career_staging OWNER career_staging;"

# 运行数据库迁移
DATABASE_URL="postgresql://career_staging:career_staging_2026@127.0.0.1:5432/career_staging" npx prisma migrate deploy

# 填充种子数据
cp .env.dev .env.local && npx prisma db seed && rm .env.local

# 启动开发服务器
pm2 start ecosystem.config.cjs
```

### 日常开发

开发服务器通过 **pm2** 管理（进程名: `career-staging`，端口 3450）：

```bash
pm2 start ecosystem.config.cjs    # 首次注册并启动
pm2 restart career-staging         # 重启（自动清理所有子进程）
pm2 stop career-staging            # 停止
pm2 logs career-staging            # 查看日志
pm2 status                         # 查看状态
```

访问地址：
- 本地: http://localhost:3450
- 公网: https://career-staging.joysort.cn

> **为什么用 pm2？** `next dev` 会产生多层子进程（npx → sh → node → next-server → node）。手动 kill 顶层进程会导致 next-server 残留占用端口。pm2 的 treekill 机制能确保 stop/restart 时干净地终止整棵进程树。

### 常用命令

```bash
npm run build            # 生产构建
npm run lint             # ESLint 检查
npm run typecheck        # TypeScript 类型检查
npm test                 # 单元测试 (vitest)
npm run db:migrate       # 数据库迁移
npm run db:seed          # 填充种子数据
npm run db:studio        # Prisma Studio (数据库可视化)
```

## 部署

生产环境部署在 `8.131.74.70`（pm2: career-system, port 3000），通过 `career.joysort.cn` 访问。
