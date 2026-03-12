---
name: deploy
description: Deploy or update the career system to production server
disable-model-invocation: true
---

# Deploy Career System

Deploy the career system to production on `8.131.74.70`. Pass optional arguments: `$ARGUMENTS` (e.g., `full`, `code-only`, `db-migrate`, `restart`).

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

## Deployment Steps

### 1. Pull latest code on server

```bash
ssh root@8.131.74.70 "cd /opt/career_system && git pull origin main"
```

### 2. Install dependencies (if package.json changed)

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npm install"
```

Note: Docker Hub is blocked from China. If npm has issues, use npmmirror:
```bash
npm install --registry=https://registry.npmmirror.com
```

### 3. Run database migrations (if prisma/migrations changed)

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npx prisma migrate deploy"
```

### 4. Build the application

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npm run build"
```

### 5. Restart the app

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 restart career-system"
```

### 6. Verify deployment

```bash
# Health check
ssh root@8.131.74.70 "curl -s http://127.0.0.1:3000/api/health"

# External check
curl -sI https://career.joysort.cn | head -5
```

## Quick Commands

### code-only (no migration, no npm install)

```bash
ssh root@8.131.74.70 "cd /opt/career_system && git pull origin main && source /root/.nvm/nvm.sh && npm run build && pm2 restart career-system"
```

### restart (just restart, no rebuild)

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && pm2 restart career-system"
```

### db-migrate (run pending migrations only)

```bash
ssh root@8.131.74.70 "source /root/.nvm/nvm.sh && cd /opt/career_system && npx prisma migrate deploy"
```

### full (complete deployment)

Run steps 1-6 in sequence.

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

## Key Details

- **Node**: v22 LTS via nvm (source /root/.nvm/nvm.sh required before any node/npm/pm2 command)
- **nvm mirror**: `NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node` (China)
- **Docker mirror**: `docker.1panel.live` configured in `/etc/docker/daemon.json`
- **TLS**: Auto via Caddy + Aliyun DNS challenge (alidns plugin)
- **Caddy config**: `/etc/caddy/conf.d/career.caddy` on admin.joysort.cn
- **pm2 auto-start**: Configured via `pm2 startup` + `pm2 save`
- **App listens on**: `0.0.0.0:3000` (accessible via internal IP 10.0.1.201)
