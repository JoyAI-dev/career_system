# 活动系统交互式测试 Prompt

> 本 prompt 用于辅助测试活动系统（圆桌会议、探索搭子等）。
> Claude 操控 5 个虚拟用户，人类操控 1 个用户，协同完成活动流程测试。

---

## 阶段一：Seed 数据准备

### 1.1 创建测试用户

运行 seed 脚本 `e2e/uiqa/Q-activity/seed.ts`，创建 **6 个测试用户**，赋予中文人名以便区分：

| 用户名 | 密码 | 显示名 | 备注 |
|--------|------|--------|------|
| act_zhao | act_zhao | 赵小明 | 候选人类操控 |
| act_qian | act_qian | 钱小红 | 候选人类操控 |
| act_sun  | act_sun  | 孙小刚 | 候选人类操控 |
| act_li   | act_li   | 李小芳 | 候选人类操控 |
| act_zhou | act_zhou | 周小伟 | 候选人类操控 |
| act_wu   | act_wu   | 吴小丽 | 候选人类操控 |

### 1.2 Seed 数据内容

对每个用户执行以下操作（通过 seed 脚本一次性完成）：

1. **重置用户** — 删除已有数据，创建新用户（密码 = 用户名）
2. **设置用户名** — 更新 `user.name` 为对应中文显示名
3. **完成偏好** — 所有 6 个用户使用 **完全相同** 的偏好选择（确保分配到同一社群）
4. **完成问卷** — 为每个用户随机回答所有问卷问题（`isSnapshot: true`）
5. **标记公告已读** — 跳过公告倒计时弹窗
6. **创建共享社群** — 6 人自动归入同一社群（因偏好相同）
7. **不创建虚拟组** — 虚拟组由活动加入流程自动生成，留待测试阶段验证

### 1.3 共享偏好配置

```typescript
const SHARED_PREFERENCES: Record<string, string[]> = {
  location: ['beijing'],
  'self-positioning': ['businessman'],
  'development-direction': ['private-sector'],
  industry: ['tech'],
  'platform-type': ['domestic'],
  'company-size': ['fortune500'],
  'culture-hierarchy': ['flat'],
  'culture-environment': ['corporate'],
  training: ['management-training'],
  'work-schedule': ['964'],
  vacation: ['20'],
  'healthcare-benefit': ['premium'],
  fertility: ['fertility-check'],
};

const SHARED_SLIDER_VALUES: Record<string, number> = {
  'leadership-style': 5,
};
```

### 1.4 Seed 脚本位置

`e2e/uiqa/Q-activity/seed.ts` — 基于 `e2e/uiqa/shared/db.ts` 的共享工具函数。

---

## 阶段二：角色分配

Seed 完成后，向人类展示用户列表，请人类选择一个用户作为自己操控的角色：

```
以下 6 个测试用户已创建完毕，均在同一社群中：

1. 赵小明 (act_zhao / act_zhao)
2. 钱小红 (act_qian / act_qian)
3. 孙小刚 (act_sun / act_sun)
4. 李小芳 (act_li / act_li)
5. 周小伟 (act_zhou / act_zhou)
6. 吴小丽 (act_wu / act_wu)

登录地址: https://career-staging.joysort.cn/login

请选择你要操控的用户（输入编号 1-6），其余 5 个由我来操控。
```

人类选定后，记录：
- **人类用户** = 人类选择的用户
- **AI 用户** = 剩余 5 个用户

---

## 阶段三：浏览器操控

### 3.1 架构要求

- **主进程**：保持与人类的对话通道，接收指令、反馈状态
- **子进程（subagent）**：每个 AI 用户通过独立的 `agent-browser` subagent 操控
- 启动 agent-browser 时 **必须使用 Task tool 的 subagent 模式**，不在主进程中直接操作浏览器

### 3.2 浏览器会话管理

为每个 AI 用户启动独立的浏览器 subagent：

```
subagent-1: 操控用户 X → 登录 → 等待指令
subagent-2: 操控用户 Y → 登录 → 等待指令
subagent-3: 操控用户 Z → 登录 → 等待指令
subagent-4: 操控用户 W → 登录 → 等待指令
subagent-5: 操控用户 V → 登录 → 等待指令
```

每个 subagent 的初始操作：
1. 打开 `https://career-staging.joysort.cn/login`
2. 输入对应用户名和密码
3. 登录成功后确认进入 Dashboard
4. 报告就绪状态，**等待主进程转发的下一步指令**

---

## 阶段四：指令执行模式

### 4.1 等待-执行循环

主进程进入等待模式，持续监听人类指令。指令格式示例：

| 人类指令 | Claude 执行 |
|---------|------------|
| "让所有人加入圆桌会议" | 5 个 subagent 分别点击加入活动 |
| "让 act_qian 先加入" | 仅操控对应 subagent 执行加入 |
| "让 act_sun 当组长" | 确保 act_sun 是第一个加入活动的人 |
| "等我先加入" | 暂停所有 subagent，等人类操作完毕后再继续 |
| "让其他人提交问卷评论" | 5 个 subagent 分别提交评论 |
| "让 act_li 和 act_wu 完成活动" | 操控指定 subagent 标记活动完成 |

### 4.2 组长控制

圆桌会议（GROUP_6）的组长由 **第一个加入活动的人** 自动担任。

- 如果人类说 **"我要当组长"** → 让人类先加入，然后再让 AI 用户依次加入
- 如果人类说 **"让 XXX 当组长"** → 让指定 AI 用户先加入，然后人类加入，最后其余 AI 用户加入
- 如果人类没有指定 → 默认询问人类：**"你想自己当组长，还是让某个 AI 用户先加入当组长？"**

### 4.3 状态反馈

每次执行指令后，主进程向人类报告：

```
✅ 已完成操作：
  - act_qian: 已加入圆桌会议 (第1个，组长)
  - act_sun: 已加入圆桌会议 (第2个)
  - act_li: 已加入圆桌会议 (第3个)

⏳ 等待中：
  - act_zhou: 等待指令
  - act_wu: 等待指令

👤 你的用户 (赵小明/act_zhao): 请在浏览器中操作，完成后告诉我下一步。
```

---

## 阶段五：活动流程参考

### 圆桌会议（首个活动）流程

```
1. 用户在 Dashboard 看到 "圆桌会议" 入口
2. 点击加入 → 系统自动创建/加入虚拟组
3. 第一个加入的人自动成为组长 (LEADER)
4. 6 人全部加入 → 活动状态变为 FULL
5. 组长安排时间 → 活动状态变为 SCHEDULED
6. 活动完成后 → 解锁下一个活动类型（探索搭子）
```

### 后续活动类型链

```
圆桌会议 → 探索搭子 → 深度探索 → 竞赛 → 试水案例 → 聚焦讨论 → 导师拍卖
```

---

## 注意事项

1. **Seed 脚本是幂等的** — 多次运行会清除旧数据重新创建
2. **所有 subagent 使用 staging 环境** — `https://career-staging.joysort.cn`
3. **不要并行操作会产生竞态条件的步骤** — 比如加入活动时需要控制顺序（决定谁是组长）
4. **人类可能随时改变指令** — 保持灵活，不要假设后续步骤
5. **操作失败时截图反馈** — 如果某个 subagent 操作失败，截图并报告给人类
6. **保持主进程畅通** — 主进程只做沟通和协调，不做浏览器操作
