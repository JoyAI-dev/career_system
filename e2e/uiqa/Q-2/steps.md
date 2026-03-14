# Q-2: Preference 过滤问卷验证

## 概述
验证用户的偏好选择如何影响问卷的展示方式。根据 Topic 的 `preferenceMode` (REPEAT/FILTER/CONTEXT)，问卷应动态调整显示内容。

## 前置条件
- 执行 `seed.ts` 创建 a12 用户并预设以下偏好选择：
  - **location** (REPEAT): 北京、上海、深圳
  - **self-positioning** (FILTER): 商人 (businessman)、创业者 (entrepreneur)
  - **development-direction** (FILTER): 私营部门 (private-sector)
  - **industry** (CONTEXT): 科技 (technology)、金融 (finance)、医疗 (healthcare)
  - **training** (FILTER): 管理培训 (management-training)、轮岗 (rotation)、软技能 (soft-skills)
  - 其余 CONTEXT 类别各选一个默认值
- 公告已标记为已查看（跳过公告流程）

## Seed 选择映射

| # | Topic | Mode | Slug | 选中的选项 |
|---|-------|------|------|------------|
| 1 | 地点选择 | REPEAT | location | beijing, shanghai, shenzhen |
| 2 | 自我定位 | FILTER | self-positioning | businessman, entrepreneur |
| 3 | 发展方向 | FILTER | development-direction | private-sector |
| 4 | 行业领域 | CONTEXT | industry | technology, finance, healthcare |
| 5 | 平台性质 | CONTEXT | platform-type | domestic |
| 6 | 平台规模 | CONTEXT | company-size | fortune-500 |
| 7 | 文化-层级 | CONTEXT | culture-hierarchy | flat |
| 8 | 文化-环境 | CONTEXT | culture-environment | corporate |
| 9 | 领导风格 | CONTEXT | leadership-style | slider=6 |
| 10 | 培训 | FILTER | training | management-training, rotation, soft-skills |
| 11 | 加班偏好 | CONTEXT | work-schedule | 964 |
| 12 | 假期 | CONTEXT | vacation | 20-days |
| 13 | 医疗保障 | CONTEXT | healthcare-benefit | premium |
| 14 | 生育福利 | CONTEXT | fertility | basic-checkup |

## 测试步骤

### Phase 1: 登录并进入问卷

**Step 1.1: 登录**
- 导航到 `https://career-staging.joysort.cn/login`
- 输入用户名: `a12`，密码: `a12`
- 点击登录
- **检查点 CP-1**: 登录成功

**Step 1.2: 公告处理**
- 如果公告弹出，应该可以立即关闭（已标记为已查看）
- **检查点 CP-2**: 公告无倒计时，可立即关闭（或不弹出）

**Step 1.3: 确认进入问卷页面**
- 偏好已完成，应跳过偏好页直接到问卷
- **检查点 CP-3**: 页面显示问卷内容（QuestionnaireFlow），URL 含 `/questionnaire`
- 📸 截图

### Phase 2: 验证 Topic 1 — 地点选择 (REPEAT 模式)

**Step 2.1: 查看第一个话题**
- 应该是"地点选择"相关的话题 tab
- **检查点 CP-4**: 第一个话题 tab 可见
- 📸 截图

**Step 2.2: 检查 REPEAT 行为**
- 预期行为（如果 REPEAT 已实现）：应该看到"城市分析"模板重复3次（北京、上海、深圳各一次）
- 当前可能行为：只显示一次"城市分析" subtopic（REPEAT 未实现）
- **检查点 CP-5**: 记录实际显示的 subtopic 数量和内容
- 📸 截图

### Phase 3: 验证 Topic 2 — 自我定位 (FILTER 模式)

**Step 3.1: 切换到第二个话题 tab**
- 点击"自我定位"话题 tab
- **检查点 CP-6**: 成功切换到第二个话题

**Step 3.2: 检查 FILTER 行为**
- 预期行为（如果 FILTER 已实现）：只显示"商人"和"创业者"两个 subtopic，不显示"职业经理人"
- 当前可能行为：三个 subtopic 全部显示（FILTER 未实现）
- **检查点 CP-7**: 记录实际显示的 subtopic 列表，与预期对比
- 📸 截图（关键验证点）

### Phase 4: 验证 Topic 3 — 发展方向 (FILTER 模式)

**Step 4.1: 切换到第三个话题 tab**
- 点击"发展方向"话题 tab

**Step 4.2: 检查 FILTER 行为**
- 预期行为（如果 FILTER 已实现）：只显示"私营部门"subtopic，不显示"公共部门"和"公私合营"
- 当前可能行为：三个 subtopic 全部显示
- **检查点 CP-8**: 记录实际显示的 subtopic 列表，与预期对比
- 📸 截图

### Phase 5: 验证 Topic 4 — 行业领域 (CONTEXT 模式)

**Step 5.1: 切换到第四个话题 tab**
- 点击"行业领域"话题 tab

**Step 5.2: 检查 CONTEXT 行为**
- 预期行为：所有问题全部显示（CONTEXT 不过滤），用户的偏好选择作为上下文标签展示
- **检查点 CP-9**: 所有问题都可见（"行业认知" subtopic 下的所有维度和问题）
- **检查点 CP-10**: 是否能看到用户偏好的上下文标签（如"科技"、"金融"、"医疗"）
- 📸 截图

### Phase 6: 验证 Topic 10 — 培训 (FILTER 模式)

**Step 6.1: 切换到第十个话题 tab**
- 点击"培训"话题 tab

**Step 6.2: 检查 FILTER 行为**
- 预期行为（如果 FILTER 已实现）：只显示"管理培训"、"轮岗"、"软技能"三个 subtopic
- 当前可能行为：全部 8 个 subtopic 显示
- **检查点 CP-11**: 记录实际显示的 subtopic 数量和名称
- 📸 截图（关键验证点）

### Phase 7: 验证其他 CONTEXT 话题（抽样）

**Step 7.1: 抽查第五个话题（平台性质，CONTEXT）**
- 切换到"平台性质"话题 tab
- **检查点 CP-12**: 所有问题全部显示，不因偏好而过滤
- 📸 截图

### Phase 8: 检查不同维度的显示

**Step 8.1: 在任一话题中检查维度分组**
- 每个话题下的问题应按维度分组显示（是什么、意味着什么、对感兴趣的领域的影响、...）
- **检查点 CP-13**: 维度标题可见且问题正确分组
- 📸 截图

## 完成标准

| 检查点 | 描述 | 预期 | 判定依据 |
|--------|------|------|----------|
| CP-1 | 登录成功 | 页面跳转 | URL 变化 |
| CP-2 | 公告可立即关闭 | 无倒计时 | 无秒数显示 |
| CP-3 | 进入问卷页 | 显示问卷 | URL 含 /questionnaire |
| CP-4 | 第一个话题 tab | 可见 | Tab 存在 |
| CP-5 | REPEAT 模式 | 城市模板重复3次 | SubTopic 数量 |
| CP-6 | 切换话题 | 成功切换 | 内容变化 |
| CP-7 | FILTER #2 | 只显示 businessman+entrepreneur | SubTopic 列表 |
| CP-8 | FILTER #3 | 只显示 private-sector | SubTopic 列表 |
| CP-9 | CONTEXT #4 | 所有问题显示 | 问题数量完整 |
| CP-10 | 上下文标签 | 偏好标签可见 | UI 元素 |
| CP-11 | FILTER #10 | 只显示3个培训 subtopic | SubTopic 数量 |
| CP-12 | CONTEXT #5 | 所有问题显示 | 问题数量完整 |
| CP-13 | 维度分组 | 维度标题正确 | UI 分组结构 |

## 特别说明

此测试用例的主要目的是**验证当前系统对 preferenceMode 的实现状态**。根据代码调研，QuestionnaireFlow 组件目前可能尚未实现 REPEAT/FILTER 的过滤逻辑。因此：

- **CP-5, CP-7, CP-8, CP-11 预计会显示"不符合预期"**（显示全部而非过滤后的 subtopic）
- 这些 checkpoint 的失败本身就是有价值的测试发现，应如实记录到报告中
- CP-9, CP-10, CP-12 (CONTEXT 模式) 预计正常，因为 CONTEXT 本身不做过滤
