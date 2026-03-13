# UIQA — UI Quality Assurance Framework

career_system 的 UI 验收测试框架。通过预设种子数据 + agent-browser 自动化操作，验证 staging 环境上的 UI 流程。

## 快速使用

```bash
# 调用 skill
/uiqa

# 或直接执行某个测试用例的 seed
cd /opt/workspace/joysort2026/career_system
npx tsx e2e/uiqa/Q-1/seed.ts
```

## 目录结构

```
e2e/uiqa/
├── README.md              # 本文件
├── shared/
│   └── db.ts              # 共享 Prisma 连接 + 工具函数
├── Q-1/                   # 测试用例 1
│   ├── manifest.json      # 元数据：编号、标题、用户、描述
│   ├── steps.md           # 详细步骤 + 完成标准
│   └── seed.ts            # 数据准备脚本
├── Q-2/                   # 测试用例 2
│   └── ...
└── Q-N/
    └── ...
```

## 测试用户

| 用户 | 密码 | 用途 |
|------|------|------|
| a11 | a11 | Q-1: 新用户公告流程 |
| a12 | a12 | Q-2: Preference 过滤验证 |
| a13 | a13 | Q-3: 问卷恢复与完成 |
| a14-a20 | 同用户名 | 预留，供新用例使用 |

## 环境信息

| 项目 | 值 |
|------|-----|
| Staging URL | https://career-staging.joysort.cn |
| Database | postgresql://career_staging:career_staging_2026@127.0.0.1:5432/career_staging |
| Dev server | pm2: career-staging, port 3450 |

## 当前测试用例

| ID | 标题 | 用户 | 关键验证 |
|----|------|------|----------|
| Q-1 | 新用户公告流程 | a11 | 公告倒计时、重登录无倒计时 |
| Q-2 | Preference 过滤问卷验证 | a12 | REPEAT/FILTER/CONTEXT 模式行为 |
| Q-3 | 问卷恢复与完成流程 | a13 | 草稿恢复、完成提交、跳转 dashboard |

---

## 如何创建新测试用例

### 第一步：明确测试目标

与用户讨论清楚：
1. **测试什么功能/流程？** — 例如："活动创建和加入流程"
2. **预期行为是什么？** — 每一步应该看到什么
3. **完成标准是什么？** — 什么算通过，什么算失败

### 第二步：选择测试用户

从 a14-a20 中选择一个未被占用的用户。查看所有 `manifest.json` 确认哪些用户已被使用。

### 第三步：分析数据需求

根据测试场景，确定需要预设哪些数据：

**常见数据类型及依赖关系：**

```
User (基础)
  ├── AnnouncementView (控制公告行为)
  ├── UserPreference (控制是否跳过偏好页)
  │   ├── UserPreferenceSelection (具体选择)
  │   └── UserPreferenceSliderValue (滑块值)
  ├── ResponseSnapshot (控制是否跳过问卷)
  │   └── ResponseAnswer (具体回答)
  ├── Membership (活动参与)
  └── Activity (创建的活动)
```

**重要数据关系：**

1. **偏好 → 问卷过滤**：每个 Topic 有 `preferenceCategorySlug` + `preferenceMode`
   - `REPEAT`：同一模板按偏好选择重复（如每个城市一组问题）
   - `FILTER`：只显示与偏好匹配的 SubTopic
   - `CONTEXT`：全部显示，偏好作为上下文标签

2. **问卷完成判定**：`ResponseSnapshot.isSnapshot === true` 存在即认为完成

3. **偏好完成判定**：`UserPreference` 记录存在即认为完成

4. **公告行为控制**：
   - 无 `AnnouncementView` → 20秒强制倒计时
   - 有 `AnnouncementView` → 可立即关闭
   - `sessionStorage` 控制同 session 内不重复弹出

### 第四步：创建三件套文件

#### manifest.json
```json
{
  "id": "Q-N",
  "title": "测试用例标题",
  "user": "a14",
  "description": "简要描述测试目的和关键验证点",
  "tags": ["tag1", "tag2"],
  "status": "ready"
}
```

#### steps.md
遵循以下模板：
```markdown
# Q-N: 测试标题

## 概述
一句话描述。

## 前置条件
- 执行 seed.ts 做了什么

## 测试步骤

### Phase 1: 阶段名
**Step 1.1: 步骤名**
- 具体操作指令
- **检查点 CP-1**: 预期结果
- 📸 截图

## 完成标准
| 检查点 | 描述 | 预期 |
|--------|------|------|
| CP-1 | ... | ... |
```

#### seed.ts
遵循以下模板：
```typescript
import { getDb, resetUser, cleanup } from '../shared/db';

async function seed() {
  const { prisma } = await getDb();
  try {
    const user = await resetUser(prisma, 'a14');
    // ... 准备数据
    console.log('✅ Q-N seed completed successfully');
  } finally {
    await cleanup();
  }
}

seed().catch((err) => {
  console.error('❌ Q-N seed failed:', err);
  process.exit(1);
});
```

### 第五步：验证

1. 运行 seed：`npx tsx e2e/uiqa/Q-N/seed.ts`
2. 通过 agent-browser 执行测试步骤
3. 根据结果调整 seed 数据或步骤描述
4. 重复直到测试用例稳定可重复

### 第六步：维护

- **代码变更导致测试失败**：判断是 bug 还是设计调整。如果是设计调整，更新 steps.md 和/或 seed.ts
- **新增功能**：考虑是否需要新的测试用例覆盖
- **Seed 数据失效**：如果数据库 schema 变更（如新增字段、改变关系），更新 shared/db.ts 和受影响的 seed

---

## shared/db.ts 工具函数

| 函数 | 用途 |
|------|------|
| `getDb()` | 获取 Prisma 客户端连接 |
| `cleanup()` | 关闭连接 |
| `resetUser(db, username)` | 删除用户所有数据并重建（密码=用户名） |
| `ensureUser(db, username)` | 确保用户存在（不删除现有数据） |
| `getActiveAnnouncement(db)` | 获取当前激活的公告 |
| `markAnnouncementViewed(db, userId, annId)` | 标记公告为已查看 |
| `clearAnnouncementViews(db, userId)` | 清除公告查看记录 |
| `getAllPreferenceCategories(db)` | 获取所有偏好类别及选项 |
| `seedPreferences(db, userId, selections, sliders)` | 创建完整的偏好选择 |
| `getActiveVersion(db)` | 获取活跃问卷版本（含完整结构） |
| `seedDraftResponses(db, userId, options)` | 创建问卷草稿回答 |
| `clearResponses(db, userId)` | 清除问卷回答数据 |
