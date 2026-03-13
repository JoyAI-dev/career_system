import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { QUESTIONNAIRE_V2_DATA, DEFAULT_ANSWER_OPTIONS } from './seed-data/questionnaire-v2';

const connectionString =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

const pool = new Pool({
  connectionString,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed admin user (idempotent via upsert)
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'ADMIN_SEED_PASSWORD environment variable is required. ' +
        'Set it in .env.local (dev) or your environment (production).',
    );
  }
  if (adminPassword.length < 8) {
    console.warn('WARNING: ADMIN_SEED_PASSWORD is shorter than 8 characters. Use a strong password.');
  }
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      name: 'System Admin',
    },
  });
  console.log('Seeded admin user');

  // Seed grade options (idempotent via upsert)
  const gradeOptions = [
    { label: '大一', order: 1 },
    { label: '大二', order: 2 },
    { label: '大三', order: 3 },
    { label: '大四', order: 4 },
  ];

  for (const option of gradeOptions) {
    await prisma.gradeOption.upsert({
      where: { label: option.label },
      update: {},
      create: {
        label: option.label,
        order: option.order,
        isActive: true,
      },
    });
  }
  console.log('Seeded grade options');

  // Seed activity types (idempotent via upsert)
  // PRD progression chain: 圆桌会议 → 探索搭子 → 深度探索 → 竞赛 → 试水案例 → 聚焦讨论 → 导师拍卖
  const activityTypeDefs = [
    {
      name: '圆桌会议',
      order: 0,
      defaultCapacity: 6,
      scope: 'GROUP_6' as const,
      peopleRequired: 6,
      duration: '2小时',
      intervalHours: 24,
      completionMode: 'LEADER_ONLY' as const,
      pairingMode: null,
      allowViewLocked: true,
      timeoutHours: 24,
      guideContent: `## 圆桌会议指南

**核心原则：** 友好、尊重、诚实、分享

### 组织方式
- 6人成组，确定2小时的会议具体时间以及具体地点
- 可以是线上，有条件鼓励并推荐尽可能多人在线下面对面进行圆桌会议
- 推选1或2人作为小组长主持以及协调后续活动

### 会议准备
- 会议开始前，请打开你的认知边界报告，在会议中就某一问题进行补充

### 个人分享（每人20分钟）
1. 自己的个性化选择
2. 自己知道的最有深度的2项分别是什么、分别都知道些什么信息、了解到什么程度、如何知道、从哪里知道、是否能够判断其信息或数据客观真实可靠
3. 不知道的但最好奇的至少2项

### 后续行动
- 6人在会议结束可根据每个人的分享自行选择 study buddy / 探索搭子
- 将你在会议中了解到的新信息补充到认知边界对比图相应的选项下提交`,
    },
    {
      name: '探索搭子',
      order: 1,
      defaultCapacity: 2,
      scope: 'PAIR_2' as const,
      peopleRequired: 2,
      duration: '0.5-2小时',
      intervalHours: 24,
      completionMode: 'LEADER_ONLY' as const,
      pairingMode: 'SELF_SELECT_WITH_LEADER' as const,
      allowViewLocked: true,
      timeoutHours: 24,
      guideContent: `## 探索搭子指南

**核心原则：** 友好、尊重、诚实、分享

### 组织方式
- 探索搭子2人成组，是为了两位互相磨合并相互监督，一起进一步深入探索
- 推荐时长0.5-2小时内，如感兴趣可自行延长
- 自行结成探索搭子的同学在日历上确定具体时间，线上线下皆可，更推荐面对面

### AI工具使用
- 6人小组长主持每个人选择一个不同的AI工具
- 鼓励并监督对方正确使用AI工具，拒绝"抄作业"：做到AI帮助而非代替我学习、思考、判断

### AI协作守则
- 建议搭子双方共同设定「AI协作守则」
- 例：约定哪些必须亲自思考（如：逻辑框架），哪些可以交给AI（如：格式排版）

### 核心监督任务
- **质疑任务：** 监督彼此是否对AI提供的信息进行了"你提供的信息是否属客观事实？"的质疑
- **判断任务：** 监督彼此是否对AI产生了「认知依赖」而未能对自己的判断力进行锻炼

### 具体步骤
1. 打开"认知边界报告"
2. 搭子们使用选择好的AI工具对认知报告做更进一步的信息获取与深度思考
3. 尝试比对不同AI工具所抓取的信息、数据，判断其是否属于客观事实、而非假设观点
4. 完善认知报告信息 & 对AI工具的特点进行交流与总结
5. 再次提交认知边界报告`,
    },
    {
      name: '深度探索',
      order: 2,
      defaultCapacity: 2,
      scope: 'PAIR_2' as const,
      peopleRequired: 2,
      duration: '2小时',
      intervalHours: 24,
      completionMode: 'LEADER_ONLY' as const,
      pairingMode: 'SELF_SELECT_WITH_LEADER' as const,
      allowViewLocked: true,
      timeoutHours: 24,
      guideContent: `## 深度探索活动指南

**核心原则：** 友好、尊重、诚实、分享

### 组织方式
- 2人成组，推荐时长2小时以内
- 线下线上皆可，推荐线下

### 活动步骤

#### 1. 选择探索领域
- 打开认知边界报告，搭子双方从认知边界报告中选择一个共同陌生的领域，和双方共同熟悉的领域

#### 2. 使用5W和5Whys进行深度探索
- **5W** (Who/When/Where/What/How) 用来理解陌生领域，例如某一行业从定义到产业链再到人才市场画像再到流动趋势
- **5Whys** 用来抽丝剥茧，深度挖掘

#### 3. 思维导图与框架
- 搭子双方监督彼此进行思考内容的框架拆解并手动画出思维导图，拍照上传
- 根据思维导图，使用AI工具形成洞察报告

#### 4. 质疑与判断
- 请就洞察报告进一步完成质疑、与判断
- 提交洞察报告

#### 5. 简化表达
- 搭子双方分别扮演老师和5岁学生，以简单明了的语言向对方解释所获取的新的信息

#### 6. 高阶挑战（有余力）
- 搭子双方使用5Whys进行压力测试：双方针对对方的思维导图进行逼迫式5连问
- 将对方的答案输入给AI工具，要求：「请找出这条逻辑链中跳跃感最强、证据最薄弱的环节」

#### 7. 最终提交
- 补充获得的有效信息，并提交认知报告`,
    },
    {
      name: '竞赛',
      order: 3,
      defaultCapacity: 12,
      scope: 'CROSS_GROUP' as const,
      peopleRequired: 12,
      duration: '1小时',
      intervalHours: 24,
      completionMode: 'LEADER_ONLY' as const,
      pairingMode: null,
      allowViewLocked: true,
      timeoutHours: 48,
      guideContent: `## 竞赛指南

**核心原则：** 友好、尊重、诚实、分享

### 组织方式
- 2个同社群的圆桌会议小组，1小时完成比赛
- 最初的6人小组长主持报名参加
- 平台随机组织本小组与同一社群中其他的小组进行比赛：小组长彼此沟通协调

### 准备阶段
1. 小组长或小组代表与组员协调并确定小组中同学的认知报告中2个共同熟悉和共同陌生的领域（总共4项/4个问题）
2. 双方小组长整理并交换彼此熟悉领域，归纳所有成员的有效信息给到彼此
3. 双方小组长整理并交换彼此陌生领域，归纳所有成员的有效信息给到彼此

### 比赛阶段
1. 双方约定共同的比赛时间，时长1小时，请自觉尽可能在规定时长完成
2. 线上线下皆可
3. 小组内6人分工合作，使用AI工具进行阶梯式提问、质疑、及判断有效信息

### 提交内容
1. 针对竞对小组熟悉的领域寻找争议点并提交
2. 对其他小组陌生的领域进行思维逻辑框架拆解后，提交手写的思维导图，然后使用AI工具生成洞察报告并提交

### 特殊规则
- **胜出的小组6人皆有资格进入导师与实习推荐拍卖环节**
- 每个人将获得的新信息补充进认知报告中，重新提交`,
    },
    {
      name: '试水案例',
      order: 4,
      defaultCapacity: 1,
      scope: 'INDIVIDUAL' as const,
      peopleRequired: 1,
      duration: '自定',
      intervalHours: 24,
      completionMode: 'ALL_MEMBERS' as const,
      pairingMode: null,
      allowViewLocked: true,
      timeoutHours: 72,
      guideContent: `## 案例学习指南

**请自觉正确使用AI工具，拒绝抄作业！**

### 活动说明
- 1人即可完成
- 试水案例是非常具有时效性的，最近期做过的方案
- 是由社群标签中感兴趣的行业和领域的有影响力的平台中的专业职场人士撰写并提供平台最终使用的方案作为比照

### 活动流程
1. 完成案例分析并提交你的答案
2. 提交后即可获得权限进入日历上方的比照方案端口进行学习

### 建议
- 鼓励与搭子和社群中的小伙伴们多交流
- 无强制要求，如果你在这一步也获得了新的认知，欢迎你补充进你的认知报告，并提交`,
    },
    {
      name: '聚焦讨论',
      order: 5,
      defaultCapacity: 6,
      scope: 'GROUP_6' as const,
      peopleRequired: 6,
      duration: '2小时',
      intervalHours: 24,
      completionMode: 'LEADER_ONLY' as const,
      pairingMode: null,
      allowViewLocked: true,
      timeoutHours: 24,
      guideContent: `## 聚焦讨论指南

**核心原则：** 友好、尊重、诚实、分享

### 活动说明
- 6人参与，推荐时长2小时
- 线上线下皆可，推荐线下

### 讨论内容
- 6人就以下维度，根据之前活动进行总结，重新进行自我定位：
  - 社会现状
  - 市场现状
  - 自我期望
  - 自我目前状态
  - 自我喜好

### 后续行动
- 调整日历个性化选择
- 鼓励在进行调整后，尝试新的一轮自我探索
- 如有新的认知，请补充你的认知报告，并提交获取本轮次的自我探索认知边界报告`,
    },
    {
      name: '导师拍卖',
      order: 6,
      defaultCapacity: 6,
      scope: 'GROUP_6' as const,
      peopleRequired: 6,
      duration: '1周+45分钟',
      intervalHours: 168,
      completionMode: 'LEADER_ONLY' as const,
      pairingMode: null,
      allowViewLocked: false,
      timeoutHours: 168,
      guideContent: `## 导师拍卖指南

**仅竞赛胜出小组可参与本活动**

### 准备阶段
1. 6人讨论并选定感兴趣领域的2个机构或企业
2. 使用AI工具将其组织架构、管理层（经理或以上级别）层级图搜出，并进行分析了解
3. 根据个人情况理性选择（并不一定级别越高对你的帮助就越大）
4. 选择其中2位导师以及2个可能性的实习平台后提交

### 拍卖阶段
- 6人在接下来1周内在平台进行拍卖

### 导师访谈（获胜者）
- 赢得导师推荐的同学请在小组内以及社群内收集大家想对导师提问的3-5个共同问题
- 准备3-5个针对自己情况的问题

### 访谈时间安排（共45分钟）
- 前20分钟：针对共同问题进行探讨
- 后25分钟：针对个人问题进行探讨`,
    },
  ];

  // First pass: upsert all types without prerequisites
  const typeMap = new Map<string, string>();
  for (const t of activityTypeDefs) {
    const created = await prisma.activityType.upsert({
      where: { name: t.name },
      update: {
        order: t.order,
        defaultCapacity: t.defaultCapacity,
        scope: t.scope,
        peopleRequired: t.peopleRequired,
        duration: t.duration,
        intervalHours: t.intervalHours,
        completionMode: t.completionMode,
        pairingMode: t.pairingMode,
        allowViewLocked: t.allowViewLocked,
        timeoutHours: t.timeoutHours,
        guideContent: t.guideContent,
      },
      create: {
        name: t.name,
        order: t.order,
        defaultCapacity: t.defaultCapacity,
        scope: t.scope,
        peopleRequired: t.peopleRequired,
        duration: t.duration,
        intervalHours: t.intervalHours,
        completionMode: t.completionMode,
        pairingMode: t.pairingMode,
        allowViewLocked: t.allowViewLocked,
        timeoutHours: t.timeoutHours,
        guideContent: t.guideContent,
      },
    });
    typeMap.set(t.name, created.id);
  }

  // Second pass: set prerequisite chain
  // 圆桌会议 → 探索搭子 → 深度探索 → 竞赛 → 试水案例 → 聚焦讨论 → 导师拍卖
  const prerequisiteChain: [string, string][] = [
    ['探索搭子', '圆桌会议'],
    ['深度探索', '探索搭子'],
    ['竞赛', '深度探索'],
    ['试水案例', '竞赛'],
    ['聚焦讨论', '试水案例'],
    ['导师拍卖', '聚焦讨论'],
  ];

  for (const [typeName, prereqName] of prerequisiteChain) {
    const typeId = typeMap.get(typeName)!;
    const prereqId = typeMap.get(prereqName)!;
    await prisma.activityType.update({
      where: { id: typeId },
      data: { prerequisiteTypeId: prereqId },
    });
  }

  console.log('Seeded 7 activity types with prerequisite chain');

  // Seed default scheduling config
  await prisma.schedulingConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      morningCutoff: '10:00',
      eveningCutoff: '17:00',
      morningDelayHours: 0,
      eveningDelayHours: 24,
      defaultActivityTime: '09:00',
      suggestedMorningStart: '09:00',
      suggestedMorningEnd: '11:00',
      suggestedAfternoonStart: '14:00',
      suggestedAfternoonEnd: '16:00',
    },
  });
  console.log('Seeded default scheduling config');

  // Seed default tags (idempotent via upsert)
  const defaultTags = ['科技', '北京', '金融', '圆桌会议', 'AI', '创业', '设计', '教育'];
  for (const tagName of defaultTags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    });
  }
  console.log('Seeded default tags');

  // ── Preference Categories Seed ────────────────────────────────────────

  interface SeedPrefOption {
    label: string;
    value: string;
    order: number;
    isAutoSelected?: boolean;
    requiresChild?: boolean;
    children?: SeedPrefOption[];
  }

  interface SeedPrefSlider {
    label: string;
    minValue: number;
    maxValue: number;
    defaultValue: number;
    step: number;
    order: number;
  }

  interface SeedPrefCategory {
    name: string;
    slug: string;
    icon: string;
    description?: string;
    order: number;
    inputType: 'SINGLE_SELECT' | 'MULTI_SELECT' | 'HIERARCHICAL_MULTI' | 'SLIDER';
    isGroupingBasis?: boolean;
    hierarchicalMatchLevel?: string;
    options?: SeedPrefOption[];
    sliders?: SeedPrefSlider[];
  }

  const prefCategories: SeedPrefCategory[] = [
    {
      name: '地点', slug: 'location', icon: 'MapPin', order: 1,
      inputType: 'MULTI_SELECT', isGroupingBasis: true,
      options: [
        { label: '北京', value: 'beijing', order: 1 },
        { label: '上海', value: 'shanghai', order: 2 },
        { label: '广州', value: 'guangzhou', order: 3 },
        { label: '深圳', value: 'shenzhen', order: 4 },
        { label: '成都', value: 'chengdu', order: 5 },
        { label: '杭州', value: 'hangzhou', order: 6 },
        { label: '南京', value: 'nanjing', order: 7 },
        { label: '武汉', value: 'wuhan', order: 8 },
        { label: '西安', value: 'xian', order: 9 },
        { label: '重庆', value: 'chongqing', order: 10 },
        { label: '天津', value: 'tianjin', order: 11 },
        { label: '苏州', value: 'suzhou', order: 12 },
      ],
    },
    {
      name: '自我定位', slug: 'self-positioning', icon: 'UserCircle', order: 2,
      inputType: 'HIERARCHICAL_MULTI', isGroupingBasis: true, hierarchicalMatchLevel: 'PARENT', isGroupingBasis: true,
      options: [
        { label: '商人', value: 'businessman', order: 1 },
        { label: '创业者', value: 'entrepreneur', order: 2 },
        {
          label: '职业经理人', value: 'professional-manager', order: 3,
          isAutoSelected: true, requiresChild: true,
          children: [
            { label: '个人贡献者', value: 'individual-contributor', order: 1 },
            { label: '管理层', value: 'management', order: 2 },
          ],
        },
      ],
    },
    {
      name: '发展方向', slug: 'development-direction', icon: 'Compass', order: 3,
      inputType: 'HIERARCHICAL_MULTI', isGroupingBasis: true, hierarchicalMatchLevel: 'PARENT', isGroupingBasis: true,
      options: [
        {
          label: '公共部门', value: 'public-sector', order: 1,
          isAutoSelected: true,
          children: [
            { label: '政府', value: 'government', order: 1 },
            { label: '非政府组织', value: 'ngo', order: 2 },
          ],
        },
        {
          label: '私营部门', value: 'private-sector', order: 2,
          isAutoSelected: true,
          children: [
            { label: '个体', value: 'individual-business', order: 1 },
            { label: '企业', value: 'enterprise', order: 2 },
          ],
        },
        {
          label: '公私合营部门', value: 'ppp-sector', order: 3,
          isAutoSelected: true,
          children: [
            { label: '公私合营', value: 'ppp', order: 1 },
          ],
        },
      ],
    },
    {
      name: '行业领域', slug: 'industry', icon: 'Building2', order: 4,
      inputType: 'MULTI_SELECT', isGroupingBasis: true,
      options: [
        { label: '科技', value: 'tech', order: 1 },
        { label: '金融', value: 'finance', order: 2 },
        { label: '咨询', value: 'consulting', order: 3 },
        { label: '医疗健康', value: 'healthcare', order: 4 },
        { label: '教育', value: 'education', order: 5 },
        { label: '制造业', value: 'manufacturing', order: 6 },
        { label: '能源', value: 'energy', order: 7 },
        { label: '零售', value: 'retail', order: 8 },
        { label: '传媒', value: 'media', order: 9 },
      ],
    },
    {
      name: '平台性质', slug: 'platform-type', icon: 'Flag', order: 5,
      inputType: 'SINGLE_SELECT', isGroupingBasis: true,
      options: [
        { label: '国内', value: 'domestic', order: 1 },
        { label: '外资', value: 'foreign', order: 2 },
        { label: '合资', value: 'joint-venture', order: 3 },
      ],
    },
    {
      name: '企业规模', slug: 'company-size', icon: 'Building', order: 6,
      inputType: 'SINGLE_SELECT', isGroupingBasis: true,
      options: [
        { label: '财富500强/跨国企业 (万亿/千亿)', value: 'fortune500', order: 1 },
        { label: '百亿', value: 'ten-billion', order: 2 },
        { label: '亿', value: 'billion', order: 3 },
        { label: '千万', value: 'ten-million', order: 4 },
        { label: '百万或以下', value: 'million-or-less', order: 5 },
      ],
    },
    {
      name: '企业文化-层级结构', slug: 'culture-hierarchy', icon: 'Network', order: 7,
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '扁平化', value: 'flat', order: 1 },
        { label: '垂直化', value: 'vertical', order: 2 },
      ],
    },
    {
      name: '企业文化-工作环境', slug: 'culture-environment', icon: 'Briefcase', order: 8,
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '企业型', value: 'corporate', order: 1 },
        { label: '快节奏', value: 'fast-paced', order: 2 },
        { label: '非升即走', value: 'up-or-out', order: 3 },
        { label: '稳定型', value: 'stable', order: 4 },
      ],
    },
    {
      name: '领导风格', slug: 'leadership-style', icon: 'Users', order: 9,
      inputType: 'SLIDER',
      sliders: [
        { label: '专制程度', minValue: 0, maxValue: 10, defaultValue: 5, step: 1, order: 1 },
        { label: '民主程度', minValue: 0, maxValue: 10, defaultValue: 5, step: 1, order: 2 },
      ],
    },
    {
      name: '培训项目', slug: 'training', icon: 'GraduationCap', order: 10,
      inputType: 'MULTI_SELECT',
      options: [
        { label: '管理培训', value: 'management-training', order: 1 },
        { label: '轮岗', value: 'rotation', order: 2 },
        { label: '内部创业', value: 'intrapreneurship', order: 3 },
        { label: '专业硬技能', value: 'hard-skills', order: 4 },
        { label: '软技能', value: 'soft-skills', order: 5 },
        { label: '行动学习', value: 'action-learning', order: 6 },
        { label: '知识库', value: 'knowledge-base', order: 7 },
        { label: '文化与准则', value: 'culture-guidelines', order: 8 },
      ],
    },
    {
      name: '加班偏好', slug: 'work-schedule', icon: 'Clock', order: 11,
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '964 (9am-6pm, 4天/周)', value: '964', order: 1 },
        { label: '965 (9am-6pm, 5天/周)', value: '965', order: 2 },
        { label: '855 (8am-5pm, 5天/周)', value: '855', order: 3 },
        { label: '966 (9am-6pm, 6天/周)', value: '966', order: 4 },
        { label: '996 (9am-9pm, 6天/周)', value: '996', order: 5 },
        { label: '995 (9am-9pm, 5天/周)', value: '995', order: 6 },
        { label: '7*24 (随时待命)', value: '7x24', order: 7 },
      ],
    },
    {
      name: '假期', slug: 'vacation', icon: 'Palmtree', order: 12,
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '5天/年', value: '5', order: 1 },
        { label: '10天/年', value: '10', order: 2 },
        { label: '15天/年', value: '15', order: 3 },
        { label: '20天/年', value: '20', order: 4 },
        { label: '25天/年', value: '25', order: 5 },
        { label: '45天/年', value: '45', order: 6 },
        { label: '60天/年', value: '60', order: 7 },
      ],
    },
    {
      name: '医疗保障', slug: 'healthcare-benefit', icon: 'Heart', order: 13,
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '普通', value: 'basic', order: 1 },
        { label: '高端', value: 'premium', order: 2 },
        { label: '定制', value: 'custom', order: 3 },
      ],
    },
    {
      name: '生育福利', slug: 'fertility', icon: 'Baby', order: 14,
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '生育检查', value: 'fertility-check', order: 1 },
        { label: '生育检查 + 精子/卵子冷冻', value: 'fertility-check-freeze', order: 2 },
        { label: '生育检查 + 精子/卵子冷冻 + 孕期保障', value: 'fertility-full', order: 3 },
      ],
    },
  ];

  // Helper: seed options recursively (handles hierarchy)
  async function seedOptions(categoryId: string, options: SeedPrefOption[], parentId: string | null = null) {
    for (const opt of options) {
      const existing = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM preference_options WHERE value = ${opt.value} AND "categoryId" = ${categoryId} LIMIT 1`,
      );
      let optionId: string;
      if (existing.length > 0) {
        optionId = existing[0].id;
      } else {
        const inserted = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`INSERT INTO preference_options (id, "categoryId", label, value, "order", "isActive", "parentId", "isAutoSelected", "requiresChild")
            VALUES (gen_random_uuid(), ${categoryId}, ${opt.label}, ${opt.value}, ${opt.order}, true, ${parentId}, ${opt.isAutoSelected ?? false}, ${opt.requiresChild ?? false})
            RETURNING id`,
        );
        optionId = inserted[0].id;
      }
      // Seed children if any
      if (opt.children && opt.children.length > 0) {
        await seedOptions(categoryId, opt.children, optionId);
      }
    }
  }

  for (const cat of prefCategories) {
    // Upsert category by slug
    const existing = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM preference_categories WHERE slug = ${cat.slug} LIMIT 1`,
    );
    let categoryId: string;
    const isGroupingBasis = cat.isGroupingBasis ?? false;
    const hierarchicalMatchLevel = cat.hierarchicalMatchLevel ?? null;
    if (existing.length > 0) {
      categoryId = existing[0].id;
      await prisma.$queryRaw(
        Prisma.sql`UPDATE preference_categories SET "isGroupingBasis" = ${isGroupingBasis}, "hierarchicalMatchLevel" = ${hierarchicalMatchLevel} WHERE id = ${categoryId}`,
      );
    } else {
      const inserted = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`INSERT INTO preference_categories (id, name, slug, icon, description, "order", "inputType", "isActive", "isGroupingBasis", "hierarchicalMatchLevel")
          VALUES (gen_random_uuid(), ${cat.name}, ${cat.slug}, ${cat.icon}, ${cat.description ?? null}, ${cat.order}, ${cat.inputType}::"PreferenceInputType", true, ${isGroupingBasis}, ${hierarchicalMatchLevel})
          RETURNING id`,
      );
      categoryId = inserted[0].id;
    }

    // Seed options
    if (cat.options) {
      await seedOptions(categoryId, cat.options);
    }

    // Seed sliders
    if (cat.sliders) {
      for (const slider of cat.sliders) {
        const existingSlider = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM preference_sliders WHERE label = ${slider.label} AND "categoryId" = ${categoryId} LIMIT 1`,
        );
        if (existingSlider.length === 0) {
          await prisma.$queryRaw(
            Prisma.sql`INSERT INTO preference_sliders (id, "categoryId", label, "minValue", "maxValue", "defaultValue", step, "order")
              VALUES (gen_random_uuid(), ${categoryId}, ${slider.label}, ${slider.minValue}, ${slider.maxValue}, ${slider.defaultValue}, ${slider.step}, ${slider.order})`,
          );
        }
      }
    }

    console.log(`  ✓ Preference category seeded: ${cat.name}`);
  }

  console.log('Seeded 14 preference categories with options and sliders');

  // ── Announcement Seed ──────────────────────────────────────────────────
  const announcementContent = `| 我 既<b style="color:red">不能</b> 也<b style="color:red">不会</b> | 我 <b style="color:green">只能</b> <b style="color:green">只会</b> |
|:---|:---|
| 替你学习、思考、判断 | 帮助你<br>- 学习如何正确使用AI工具<br>- 思考如何让AI帮你更高效<br>- 判断AI的输出是否合理 |
| 帮你做出人生选择 | 提供你需要的信息和分析框架 |
| 保证任何结果或承诺 | 陪伴你探索、试错、反思的全过程 |
| 替代真实的人际关系和经验 | 作为你探索路上的辅助工具和资源 |`;

  const existingAnnouncement = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM announcements WHERE title = '公告' LIMIT 1`,
  );
  if (existingAnnouncement.length === 0) {
    await prisma.$queryRaw(
      Prisma.sql`INSERT INTO announcements (id, title, content, "isActive", "countdownSeconds", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '公告', ${announcementContent}, true, 20, NOW(), NOW())`,
    );
    console.log('Seeded announcement: 公告');
  } else {
    console.log('Announcement already exists, skipping');
  }

  // ── Questionnaire V2 (4-tier: Topic → SubTopic → Dimension → Question) ──

  // Create or get version 2
  const questionnaireVersion = await prisma.questionnaireVersion.upsert({
    where: { version: 2 },
    update: {},
    create: { version: 2, isActive: true },
  });
  const versionId = questionnaireVersion.id;

  // Deactivate other versions
  await prisma.$queryRaw(
    Prisma.sql`UPDATE questionnaire_versions SET "isActive" = false WHERE id != ${versionId}`,
  );

  // Build a lookup map: preferenceCategorySlug → categoryId
  const catSlugToId = new Map<string, string>();
  const allCats = await prisma.$queryRaw<{ id: string; slug: string }[]>(
    Prisma.sql`SELECT id, slug FROM preference_categories`,
  );
  for (const c of allCats) {
    catSlugToId.set(c.slug, c.id);
  }

  // Build a lookup map: preferenceOptionValue → optionId (for FILTER mode)
  const optValueToId = new Map<string, string>();
  const allOpts = await prisma.$queryRaw<{ id: string; value: string }[]>(
    Prisma.sql`SELECT id, value FROM preference_options`,
  );
  for (const o of allOpts) {
    optValueToId.set(o.value, o.id);
  }

  let totalQuestions = 0;

  for (const topic of QUESTIONNAIRE_V2_DATA) {
    const preferenceCategoryId = catSlugToId.get(topic.preferenceCategorySlug) ?? null;

    // Check if topic already exists
    const existingTopics = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM topics WHERE name = ${topic.name} AND "versionId" = ${versionId} LIMIT 1`,
    );
    let topicId: string;
    if (existingTopics.length > 0) {
      topicId = existingTopics[0].id;
    } else {
      const topicOrder = QUESTIONNAIRE_V2_DATA.indexOf(topic) + 1;
      const inserted = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`INSERT INTO topics (id, name, "order", "versionId", "preferenceMode", "showInReport", "preferenceCategoryId")
          VALUES (gen_random_uuid(), ${topic.name}, ${topicOrder}, ${versionId}, ${topic.preferenceMode}::"TopicPreferenceMode", ${topic.showInReport}, ${preferenceCategoryId})
          RETURNING id`,
      );
      topicId = inserted[0].id;
    }

    // Seed SubTopics
    for (let stIdx = 0; stIdx < topic.subTopics.length; stIdx++) {
      const subTopic = topic.subTopics[stIdx];
      const preferenceOptionId = subTopic.preferenceOptionValue
        ? (optValueToId.get(subTopic.preferenceOptionValue) ?? null)
        : null;

      const existingSTs = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM sub_topics WHERE name = ${subTopic.name} AND "topicId" = ${topicId} LIMIT 1`,
      );
      let subTopicId: string;
      if (existingSTs.length > 0) {
        subTopicId = existingSTs[0].id;
      } else {
        const inserted = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`INSERT INTO sub_topics (id, "topicId", name, "order", "preferenceOptionId")
            VALUES (gen_random_uuid(), ${topicId}, ${subTopic.name}, ${stIdx + 1}, ${preferenceOptionId})
            RETURNING id`,
        );
        subTopicId = inserted[0].id;
      }

      // Seed Dimensions
      for (let dIdx = 0; dIdx < subTopic.dimensions.length; dIdx++) {
        const dim = subTopic.dimensions[dIdx];

        const existingDims = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM dimensions WHERE name = ${dim.name} AND "subTopicId" = ${subTopicId} LIMIT 1`,
        );
        let dimId: string;
        if (existingDims.length > 0) {
          dimId = existingDims[0].id;
        } else {
          const inserted = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`INSERT INTO dimensions (id, name, "order", "subTopicId")
              VALUES (gen_random_uuid(), ${dim.name}, ${dIdx + 1}, ${subTopicId})
              RETURNING id`,
          );
          dimId = inserted[0].id;
        }

        // Seed Questions
        for (let qIdx = 0; qIdx < dim.questions.length; qIdx++) {
          const question = dim.questions[qIdx];

          const existingQs = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM questions WHERE title = ${question.title} AND "dimensionId" = ${dimId} LIMIT 1`,
          );
          let questionId: string;
          if (existingQs.length > 0) {
            questionId = existingQs[0].id;
          } else {
            const inserted = await prisma.$queryRaw<{ id: string }[]>(
              Prisma.sql`INSERT INTO questions (id, title, "order", "dimensionId")
                VALUES (gen_random_uuid(), ${question.title}, ${qIdx + 1}, ${dimId})
                RETURNING id`,
            );
            questionId = inserted[0].id;
            totalQuestions++;
          }

          // Seed Answer Options
          for (const opt of DEFAULT_ANSWER_OPTIONS) {
            const existingOpts = await prisma.$queryRaw<{ id: string }[]>(
              Prisma.sql`SELECT id FROM answer_options WHERE label = ${opt.label} AND "questionId" = ${questionId} LIMIT 1`,
            );
            if (existingOpts.length === 0) {
              await prisma.$queryRaw(
                Prisma.sql`INSERT INTO answer_options (id, label, score, "order", "questionId")
                  VALUES (gen_random_uuid(), ${opt.label}, ${opt.score}, ${opt.order}, ${questionId})`,
              );
            }
          }

          // Seed Question Notes
          if (question.notes) {
            for (const note of question.notes) {
              const existingNotes = await prisma.$queryRaw<{ id: string }[]>(
                Prisma.sql`SELECT id FROM question_notes WHERE label = ${note.label} AND "questionId" = ${questionId} LIMIT 1`,
              );
              if (existingNotes.length === 0) {
                await prisma.$queryRaw(
                  Prisma.sql`INSERT INTO question_notes (id, "questionId", label, content)
                    VALUES (gen_random_uuid(), ${questionId}, ${note.label}, ${note.content})`,
                );
              }
            }
          }
        }
      }
    }

    console.log(`  ✓ Topic seeded: ${topic.name} (${topic.preferenceMode})`);
  }

  console.log(`Seeded questionnaire v2 with ${QUESTIONNAIRE_V2_DATA.length} topics, ${totalQuestions} questions`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
