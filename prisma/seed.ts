import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
  // PRD progression chain: 圆桌会议 → 探索搭子 → 深度探索 → 竞赛 → 试水案例 → 聚焦讨论 → 导师拍卖 → 实习拍卖
  const activityTypeNames = [
    { name: '圆桌会议', order: 0, defaultCapacity: 6 },
    { name: '探索搭子', order: 1, defaultCapacity: 6 },
    { name: '深度探索', order: 2, defaultCapacity: 10 },
    { name: '竞赛', order: 3, defaultCapacity: 20 },
    { name: '试水案例', order: 4, defaultCapacity: 10 },
    { name: '聚焦讨论', order: 5, defaultCapacity: 12 },
    { name: '导师拍卖', order: 6, defaultCapacity: 15 },
    { name: '实习拍卖', order: 7, defaultCapacity: 15 },
  ];

  // First pass: upsert all types without prerequisites
  const typeMap = new Map<string, string>();
  for (const t of activityTypeNames) {
    const created = await prisma.activityType.upsert({
      where: { name: t.name },
      update: { order: t.order, defaultCapacity: t.defaultCapacity },
      create: { name: t.name, order: t.order, defaultCapacity: t.defaultCapacity },
    });
    typeMap.set(t.name, created.id);
  }

  // Second pass: set prerequisite chain
  const prerequisiteChain: [string, string][] = [
    ['探索搭子', '圆桌会议'],
    ['深度探索', '探索搭子'],
    ['竞赛', '深度探索'],
    ['试水案例', '竞赛'],
    ['聚焦讨论', '试水案例'],
    ['导师拍卖', '聚焦讨论'],
    ['实习拍卖', '导师拍卖'],
  ];

  for (const [typeName, prereqName] of prerequisiteChain) {
    const typeId = typeMap.get(typeName)!;
    const prereqId = typeMap.get(prereqName)!;
    await prisma.activityType.update({
      where: { id: typeId },
      data: { prerequisiteTypeId: prereqId },
    });
  }

  console.log('Seeded activity types with prerequisite chain');

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

  // ── Questionnaire version 1 ───────────────────────────────────────────────

  interface SeedAnswerOption { label: string; score: number; order: number }
  interface SeedQuestion { title: string; order: number; options: SeedAnswerOption[] }
  interface SeedDimension { name: string; order: number; questions: SeedQuestion[] }
  interface SeedTopic { name: string; order: number; dimensions: SeedDimension[] }

  const SLIDER: SeedAnswerOption[] = [
    { label: '完全不知道', score: 0, order: 1 },
    { label: '听说过不确定', score: 20, order: 2 },
    { label: '做过信息搜索', score: 40, order: 3 },
    { label: '知道基本事实', score: 60, order: 4 },
    { label: '深入了解', score: 80, order: 5 },
  ];
  const q = (title: string, order: number): SeedQuestion => ({ title, order, options: SLIDER });

  const D1 = '是什么';
  const D2 = '意味着什么';
  const D3 = '对感兴趣的领域的影响';
  const D4 = '你的选择多大程度决定你更改你的兴趣领域';
  const D5 = '对人才市场有什么影响';

  const topics: SeedTopic[] = [
    // 1. 地点选择
    {
      name: '地点选择（中国城市列表）', order: 1,
      dimensions: [
        { name: D1, order: 1, questions: [q('你选择的城市在中国是什么定位？有哪些支柱产业？为什么这些产业是支柱产业？有什么样的政策倾向？代表了什么样的职业环境和发展机会？是经济发达的地区，还是文化氛围浓厚的城市？', 1)] },
        { name: D2, order: 2, questions: [q('这些支柱产业意味着什么样的政策倾向？选择特定的城市工作意味着你将面临哪些特定的生活成本、工作节奏和职业机遇？', 1)] },
        { name: D3, order: 3, questions: [q('你选择的城市如何影响你感兴趣的行业和领域？比如，某些行业是否在某些城市更加集中？对市场趋势有什么样的影响？', 1)] },
        { name: D4, order: 4, questions: [q('选择城市的同时，是否会改变你对行业或职业方向的兴趣？例如，大城市可能会带来更多的科技行业机会，农村地区可能更倾向于农业或基础设施项目。', 1)] },
        { name: D5, order: 5, questions: [q('在你选择的城市，人口组成结构你清楚吗？人才竞争状况如何？这些行业或者支柱产业或者政策倾向对人才流动有什么样的影响？你是否知道你在选择的城市的人才市场的定位和竞争力？', 1)] },
      ],
    },
    // 2. 自我定位
    {
      name: '自我定位（多选）', order: 2,
      dimensions: [
        { name: D1, order: 1, questions: [
          q('商人：成为商人意味着你将承担企业经营、市场拓展和财务管理等职责。你怎么看待商人的角色定位？', 1),
          q('创业者（或企业家）：你将创造一个新的企业或产品，承担从零开始的各种挑战？你知道商人和企业家的区别吗？你如何定义创业成功和失败？', 2),
          q('职业经理人：职业经理人是什么？有几类？有几种职能几类岗位？每种职能或每类岗位的人才画像你清楚吗？职业经理人的生活方式、财富阶级、社会地位在中国处于什么位置？', 3),
        ]},
        { name: D2, order: 2, questions: [
          q('商人：做一个商人意味着你将更多地注重商业运作、风险管理和机会抓取。你准备好承担这些责任吗？', 1),
          q('创业者（或企业家）：作为创业者，意味着你可能需要不断地调整业务模式、产品和市场策略。你了解创业失败的概率远远大于成功的概率吗？你了解如果想要成为一个企业家，需要牺牲什么吗？', 2),
          q('职业经理人：你知道在管理层工作意味着你需要决策、激励团队并应对企业运营中的挑战吗？你理解职业经理人的角色直接决定了你未来的生活方式、财富阶级以及社会地位的天花板吗？', 3),
        ]},
        { name: D3, order: 3, questions: [
          q('商人：作为商人，你选择的行业是否有足够的市场空间和竞争潜力？你认为哪个行业更适合你的商业模式？', 1),
          q('创业者（或企业家）：创业需要深入了解市场需求和用户痛点，你感兴趣的领域是否有足够的市场潜力？你感兴趣的领域中充斥着创业者，你理解这会产生什么样的影响吗？', 2),
          q('职业经理人：作为职业经理人，你的兴趣领域是否有足够的发挥空间？你是否能够同时关注多个行业方向？', 3),
        ]},
        { name: D4, order: 4, questions: [
          q('商人：成为商人后，你是否更容易偏向企业管理而非技术或产品开发？', 1),
          q('创业者（或企业家）：创业可能会迫使你专注于某个特定的行业或领域，你是否准备好将你的兴趣集中在一个项目上，并放弃其他领域？', 2),
          q('职业经理人：作为职业经理人，你是否更倾向于转向某些稳定的行业，如金融、科技等，而忽略其他更具潜力或创新性的行业？', 3),
        ]},
        { name: D5, order: 5, questions: [
          q('商人：成为商人后，你是否会面临更多的挑战，如资金筹集、市场占有率和团队管理？这个选择会让你在市场上更具竞争力吗？', 1),
          q('创业者（或企业家）：你了解在人才市场上，创业者如何被定位吗？这样的选择能帮助你吸引合适的人才，还是可能面临更多的竞争和不确定性？', 2),
          q('职业经理人：在人才市场上，作为职业经理人，你是否了解在你感兴趣的领域的人才趋势、核心竞争力？你了解作为管理方向发展的职业经理人在不同行业的人才市场上的流通程度吗？', 3),
        ]},
      ],
    },
    // 3. 发展方向
    {
      name: '发展方向', order: 3,
      dimensions: [
        { name: D1, order: 1, questions: [
          q('公共部门：选择公共部门意味着你将服务于政府或非政府组织。你了解中国权力机构的运作方式吗？你了解国企、央企、事业单位以及地方政府控股企业的区别吗？你了解中国如何管理非政府组织吗？', 1),
          q('私营部门/私营领域：在私营部门工作意味着你将直接参与市场竞争和商业运营。你对商业世界如何运作了解吗？你知道商业世界的本质是什么吗？民营企业占到中国GDP的多少？民营企业有哪些类型？', 2),
          q('公私合营部门：公私合营领域有哪些机构或企业？你了解为什么合营吗？你了解在你感兴趣的领域有哪些机构或企业？它们是依靠什么在市场上占有一席之地？', 3),
        ]},
        { name: D2, order: 2, questions: [
          q('公共部门：从事公共部门工作通常伴随着更强的社会责任感和公益性，你知道这对你的思维方式、沟通方式、做事逻辑意味着什么吗？你了解在公共领域不同类型的组织对生活方式的影响吗？', 1),
          q('私营部门/私营领域：民营企业的特点你了解吗？这些特点意味着什么（比如民营企业更看重经济价值，因此意味着业绩压力）？你是否准备好迎接这种工作节奏和绩效压力？', 2),
          q('公私合营部门：选择公私合营部门可能会给你带来独特的挑战，如文化融合、政策调整等。你准备好面对这些复杂性吗？', 3),
        ]},
        { name: D3, order: 3, questions: [
          q('公共部门：你是否会在公共部门中找到与个人兴趣和社会影响相契合的领域？这个方向是否能让你专注于服务社会而非追求利润？', 1),
          q('私营部门/私营领域：私营部门是否能为你感兴趣的领域提供足够的发展机会？你清楚民营企业的竞争激烈到什么程度吗？你是否能在竞争激烈的环境中找到适合自己的职位？', 2),
          q('公私合营部门：公私合营部门是否能为你感兴趣的行业提供更多的创新机会？你能否适应两种不同的工作文化？', 3),
        ]},
        { name: D4, order: 4, questions: [
          q('公共部门：从事公共部门工作可能会让你更关注社会政策和公共事务，而非某些市场导向的行业。你准备好将职业兴趣转向这些领域吗？', 1),
          q('私营部门/私营领域：在私营部门中工作，你可能会更多关注市场需求、客户需求和盈利模式，这是否会改变你对行业的兴趣？', 2),
          q('公私合营部门：进入公私合营部门可能会让你更关注政策制定和企业合作，这是否会改变你对某些行业的兴趣？', 3),
        ]},
        { name: D5, order: 5, questions: [
          q('公共部门：你是否清楚未来有一天离开公共领域进入其他领域，你在人才市场的竞争力和可能性？你了解政府部门的工作人员的上升通道吗？你了解国企央企事业单位的上升空间目前是什么样的吗？', 1),
          q('私营部门/私营领域：在私营部门，人才市场的竞争通常较激烈，你是否有足够的能力脱颖而出？选择私营部门工作会影响你的职业成长速度吗？民营企业的人才市场中青睐什么样的人才？', 2),
          q('公私合营部门：在公私合营部门，人才市场上你可能会遇到更复杂的招聘需求和更高的竞争要求。你了解转换领域的路径吗？人才市场又是如何看待转换领域的人才？', 3),
        ]},
      ],
    },
    // 4. 行业领域
    {
      name: '行业领域（40+行业）', order: 4,
      dimensions: [
        { name: D1, order: 1, questions: [q('你选择的是哪个行业？这个行业主要在中国的哪几个地方有政策扶持？这个行业有什么样的宏观政策倾向？这个行业是不是属于你所选择的城市的支柱产业？这个行业的核心驱动力和未来10年的趋势是什么样的？具有影响力的几个机构或企业都是哪几家？', 1)] },
        { name: D2, order: 2, questions: [q('选择不同的行业意味着什么？它是一片蓝海还是红海？你对行业发展的前景和可能带来的职业机会有何期待？这个行业意味着什么样的人才画像？你是否了解转换行业意味着什么？', 1)] },
        { name: D3, order: 3, questions: [q('你所选择的行业可能涉及哪些创新、技术应用或市场需求？它如何与其他领域相交叉？在现有的AI技术冲击下，你选择的行业面临着哪些必然的改变？', 1)] },
        { name: D4, order: 4, questions: [q('你选择的这个行业是你的兴趣使然还是出于对现实的妥协？这两者你清楚对你未来的发展有什么样的影响吗？如果是出于对现实的妥协，你是否认为你能从这个行业中学习到与你的兴趣相结合的东西？你选择一个行业是否会让你逐渐进入一个更专注或更垂直的细分领域？', 1)] },
        { name: D5, order: 5, questions: [q('你选择的行业目前所对应的人才市场是什么情况？行业的成熟度、竞争情况、人才供需如何影响你的职业发展？在现有的AI冲击下，你选择的行业的人才市场对人才画像是否有明确的人机协同的要求？你是否了解这个行业的人才市场在你所选择的城市的人才集中度以及竞争水平？', 1)] },
      ],
    },
    // 5. 平台性质
    {
      name: '平台性质', order: 5,
      dimensions: [
        { name: D1, order: 1, questions: [q('你选择的是哪种类型的平台？国有企业、民营企业、外资企业，还是合资企业？你了解不同性质的平台的共性是什么吗？区别又是什么？你了解不同性质的平台是如何产生的？存在的意义是什么？', 1)] },
        { name: D2, order: 2, questions: [q('不同性质的平台有何文化差异、工作流程和发展机会？不同的工作流程是否意味着不同的思维方式？这些对你未来想要的生活方式意味着什么？不同性质的平台意味着不同的人才画像吗？', 1)] },
        { name: D3, order: 3, questions: [q('你理解不同性质的平台会在发展方向和行业选择上有所不同。你了解这些差异对你感兴趣的领域意味着什么吗？', 1)] },
        { name: D4, order: 4, questions: [q('选择国内平台是否让你更倾向于一些政策导向和本地化需求较强的领域？外资平台可能让你更有机会接触到跨国运营和多元化发展。', 1)] },
        { name: D5, order: 5, questions: [q('平台的性质如何影响公司对人才的招聘标准和待遇？它如何影响你在求职市场上的竞争力？你了解人才市场如何看待不同性质的平台的人才吗？你了解不同性质的平台如何培养年轻的人才吗？', 1)] },
      ],
    },
    // 6. 企业规模
    {
      name: '企业规模', order: 6,
      dimensions: [
        { name: D1, order: 1, questions: [q('你选择加入的是大企业、小企业，还是中型企业？你了解财富500强/跨国企业、百亿、亿、千万、百万或以下规模的企业的区别是什么？你了解你所选择的行业的不同规模的企业都有哪几家？', 1)] },
        { name: D2, order: 2, questions: [q('企业规模对你职业发展的影响是什么？大企业有更多的培训和晋升机会，小企业则可能让你承担更多职责？', 1)] },
        { name: D3, order: 3, questions: [q('企业规模可能决定了你能接触到的项目类型、技术发展方向以及跨部门的合作机会？', 1)] },
        { name: D4, order: 4, questions: [q('大企业可能会让你更倾向于专注于某个小领域的深耕，而小企业或创业公司则要求你接触更广泛的工作内容。你能分清楚平台价值以及个人价值吗？你能分清楚你的兴趣在你选择的平台上会有多少发挥空间？', 1)] },
        { name: D5, order: 5, questions: [q('不同规模的企业对年轻人才有着天差地别的画像，这是为什么？你了解从小企业向大企业、从大企业到小企业的职业发展路径吗？你了解人才市场如何看待一直在大企业的人才？大企业的人才有哪些短板？你了解人才市场如何看待一直在小企业的人才，又有哪些短板？', 1)] },
      ],
    },
    // 7. 企业文化
    {
      name: '企业文化', order: 7,
      dimensions: [
        { name: D1, order: 1, questions: [q('你更喜欢扁平化结构还是垂直化结构的企业文化？这种不同设定的背后的底层逻辑是什么？你是否了解决策人使用某种特定的模式想要解决的问题、谋求的利益是什么？', 1)] },
        { name: D2, order: 2, questions: [q('扁平化结构鼓励创新和灵活性，垂直化结构更注重管理规范和发展路径。你清楚扁平化的结构适合什么样的平台？不同的结构会对你的思维方式和做事逻辑造成什么样的影响？', 1)] },
        { name: D3, order: 3, questions: [q('在不同文化结构下，你如何在工作中定位自己的角色？你了解垂直化的结构给平台带来的价值吗？你如何适应这种工作方式？', 1)] },
        { name: D4, order: 4, questions: [q('如果你选择了扁平化结构，你是否更倾向于创新型、创业型的工作内容？垂直化结构是否更适合那些喜欢稳定和明确发展路径的人？你的兴趣在哪一种结构可以得到更大的发挥空间？', 1)] },
        { name: D5, order: 5, questions: [q('在不同的企业文化中，你的职业发展会如何受到影响？如何评估这些文化对你的适应性？', 1)] },
      ],
    },
    // 8. 领导风格
    {
      name: '领导风格', order: 8,
      dimensions: [
        { name: D1, order: 1, questions: [q('你喜欢哪种领导风格？专制型还是民主型？你了解不同性质不同规模的平台的领导风格吗？你了解中国的人才市场如何定义领导风格吗？', 1)] },
        { name: D2, order: 2, questions: [q('不同的领导风格对团队合作、工作氛围、决策效率等有何影响？', 1)] },
        { name: D3, order: 3, questions: [q('领导风格可能会影响你所在领域的创新性、灵活性和风险承担吗？', 1)] },
        { name: D4, order: 4, questions: [q('专制型领导可能更适合高效执行，而民主型领导则适合鼓励创新和多方合作。你是否更倾向于选择支持你个性发展的领域？', 1)] },
        { name: D5, order: 5, questions: [q('不同的领导风格会影响你的职业发展方向，尤其是在多变的市场环境中，不同风格的公司对人才的吸引力如何？', 1)] },
      ],
    },
    // 9. 培训
    {
      name: '培训', order: 9,
      dimensions: [
        { name: D1, order: 1, questions: [
          q('管理培训：你是否考虑参加管理培训项目？管理培训通常包括领导力、决策制定、团队管理等核心技能的培养。许多大公司（如跨国企业）会定期开展管理培训，帮助员工从技术角色向管理角色过渡。', 1),
          q('轮岗：你是否愿意参与轮岗培训项目？轮岗培训让员工在多个部门或职位间转换，帮助其拓宽知识面和技能，通常在大型跨国公司或快速发展的企业中实施。', 2),
          q('内部创业：你是否考虑参与公司内部创业项目？内部创业项目让员工在公司内独立负责创业性项目，通常会为员工提供资金、资源和平台进行创新实验。', 3),
          q('专业硬技能：你是否考虑提升某些专业硬技能（如编程、财务分析等）？硬技能通常是特定领域的专业能力，这些技能对你的职业定位和薪资水平有重要影响。', 4),
          q('软技能：你是否有意提升你的软技能（如沟通能力、团队合作、情商等）？软技能包括沟通、领导力、团队协作、时间管理等，这些能力在职场中越来越受到重视。', 5),
          q('行动学习：你是否愿意参与行动学习项目？行动学习是一种通过实践来学习和解决实际问题的方式，通常通过小组合作解决公司面临的真实问题。', 6),
          q('知识库：你是否有意参与知识库建设或分享？知识库包括公司内部共享的文档、研究报告、最佳实践等，通过积累和共享知识，企业能够提高效率和创新能力。', 7),
          q('文化与准则：你是否愿意了解并参与公司文化与准则培训？公司文化与准则培训帮助员工理解公司的价值观、行为规范和发展战略，以确保其与企业文化保持一致。', 8),
        ]},
        { name: D2, order: 2, questions: [
          q('管理培训：管理培训通常针对有潜力成为管理者的员工，它为你提供了在公司内部晋升的机会。大公司通常提供结构化的管理培训计划，帮助员工快速适应领导岗位的挑战，培养战略思维、团队合作和项目管理能力。', 1),
          q('轮岗：轮岗项目让你能够了解公司多个业务领域，提升全局观念并积累跨职能经验。许多大型企业（如IBM、GE）提供轮岗计划，员工可以在不同岗位上工作，从而增强他们的管理能力和决策能力。', 2),
          q('内部创业：内部创业项目允许你在企业内部创造新的产品或服务，像创业一样推动公司业务的创新。例如，谷歌的"20%时间"政策允许员工用部分时间来开发自己的项目，激发了大量创新。', 3),
          q('专业硬技能：硬技能直接与某些技术岗位或专业领域的工作要求挂钩，它们是你在某个专业领域内立足的基础。IT行业要求扎实的编程技能，金融行业要求精通财务报表分析和建模，数据科学领域要求掌握统计学和机器学习技能。', 4),
          q('软技能：软技能决定了你如何与他人互动，如何处理工作中的挑战和人际关系，它们能极大地影响你的工作效率和领导能力。良好的沟通能力有助于提高信息传递效率，情商则有助于在团队中建立良好的合作氛围。', 5),
          q('行动学习：通过解决实际业务问题，行动学习可以帮助你在实践中锻炼决策、问题解决和创新能力。哈佛商学院的行动学习课程要求学员通过参与真实的商业项目实践理论知识，这种方式能加速职业技能提升。', 6),
          q('知识库：通过参与知识库建设，你能够积累更多的行业知识，提升专业能力，并为公司提供增值的知识支持。咨询公司通常有庞大的知识库系统，员工通过访问和贡献内容来提升整体工作效率和行业竞争力。', 7),
          q('文化与准则：了解并参与公司文化与准则培训意味着什么？这对你适应职场环境、理解公司价值观和发展战略有什么样的影响？', 8),
        ]},
        { name: D3, order: 3, questions: [
          q('管理培训：如果你有意进入管理岗位，管理培训是否能帮助你加速对领导力和团队管理的掌握？通过管理培训，你将获得关于如何处理复杂团队、制定决策和解决冲突等管理技能，这对于你进入更高级的职位至关重要。', 1),
          q('轮岗：轮岗是否能让你对不同的工作领域产生新的兴趣或发现自己的优势领域？通过轮岗，你可以接触到不同的业务领域和工作内容，这可能让你重新评估自己最感兴趣和最擅长的领域。', 2),
          q('内部创业：如果你参与内部创业项目，你能否在创新或新兴市场领域中获得更多的经验？通过内部创业，你有机会从零开始构建一个项目，对于提升创新能力和市场洞察力至关重要，特别是对科技、互联网和产品开发领域尤为有利。', 3),
          q('专业硬技能：硬技能能否提升你在某些专业领域的竞争力？具备特定硬技能的员工在技术密集型行业中（如AI、金融、IT）具有竞争优势，因为这些技能是求职的基础要求。', 4),
          q('软技能：软技能能否提升你在团队合作、管理职位和跨职能工作的能力？软技能对管理、项目协调、客户关系等职位至关重要，这些职位不仅需要专业技能，更需要良好的沟通和解决问题的能力。', 5),
          q('行动学习：行动学习能否帮助你在感兴趣的领域中积累更多的实际经验？如果你从事咨询、产品管理、企业战略等领域，行动学习提供的实际问题解决经验将帮助你提升实战能力并加速职业晋升。', 6),
          q('知识库：在你感兴趣的领域，参与知识库的建设是否能帮助你积累更深的专业知识？通过参与公司知识库，你将能够接触到该行业的最新动态和最佳实践，这对你的专业成长和领域理解至关重要。', 7),
          q('文化与准则：了解公司文化与准则对你感兴趣的领域有什么样的影响？这对你理解不同类型平台的运作方式和价值取向有什么帮助？', 8),
        ]},
        { name: D4, order: 4, questions: [
          q('管理培训：如果你选择参加管理培训，是否意味着你会从技术专才转向管理角色？管理培训通常是从技术型角色向管理型角色转型的桥梁，它可能会影响你选择更倾向于领导岗位而非专业技术岗位的职业路径。', 1),
          q('轮岗：如果你参与了轮岗，是否会让你对更多领域产生兴趣，甚至改变你的职业方向？轮岗可以帮助你发现自己在不同领域的适应性和兴趣，进而影响你的职业选择，可能从某个技术专才角色转向更具战略性的岗位。', 2),
          q('内部创业：如果你选择了内部创业，是否意味着你可能对创业领域产生更多兴趣？内部创业可以让你尝试创意和产品开发，这可能激发你走向外部创业的兴趣，尤其是如果你享受快速发展的环境和创新挑战。', 3),
          q('专业硬技能：如果你决定学习某项硬技能，是否会使你重新考虑是否进入某些技术密集型或专业要求较高的行业？学习硬技能可能会使你进入数据分析、编程等技术领域，改变你过去可能偏好的领域（如管理或市场营销）。', 4),
          q('软技能：软技能的提升是否会改变你从事技术职位向管理职位或人际交往较多的职业方向转变？如果你提升了软技能，尤其是在领导力、沟通和情商等方面，你可能更倾向于转向管理岗位，尤其是在需要团队协作和跨部门合作的领域。', 5),
          q('行动学习：参与行动学习是否意味着你会更关注实际应用和解决问题的能力，而非单纯的理论研究？行动学习能让你接触到实际的商业挑战，这可能促使你对实际问题解决产生更大兴趣，从而调整你的职业方向。', 6),
          q('知识库：如果你深入参与知识库建设，是否意味着你更倾向于专注于某个领域的知识积累，而非实践操作？知识库通常偏重于理论和知识积累，这可能使你从实践工作转向更专注于研究、分析和知识管理的领域。', 7),
          q('文化与准则：参与公司文化与准则培训是否会影响你对某些工作环境和领域的偏好？这对你的职业兴趣和价值取向有什么样的影响？', 8),
        ]},
        { name: D5, order: 5, questions: [
          q('管理培训：企业通过管理培训培养未来的领导者，这类项目在人才市场上的认可度如何？在人才市场中，管理培训背景的求职者通常受到大型企业的青睐。', 1),
          q('轮岗：参与轮岗项目的员工通常具备更强的跨职能能力，这对市场上的职业机会有何影响？具有轮岗经验的员工往往能展现出更强的适应性和多面性，企业更愿意雇佣那些能够跨部门合作的人才。', 2),
          q('内部创业：拥有内部创业经验的员工往往具备高层次的创新能力、资源整合能力和战略思维，这对人才市场有何影响？具有内部创业经验的员工在市场上往往更受欢迎，尤其是在初创公司或希望推动创新的企业中。', 3),
          q('专业硬技能：硬技能在人才市场上通常与职位要求直接挂钩，这些技能对求职和晋升有什么影响？许多行业（如IT、金融、医疗）对具备高技术能力的人才需求量大，这让你在求职市场上的竞争力大大增强。', 4),
          q('软技能：软技能在人才市场中越发重要，如何评估自己的软技能并让其在竞争激烈的市场中脱颖而出？许多企业，尤其是跨国公司，已将软技能列为招聘和晋升的核心标准。', 5),
          q('行动学习：具有行动学习经历的员工通常具备较强的解决问题和创新能力，这在市场上有何竞争优势？行动学习的参与者通常能够解决复杂的业务问题，具备创新和战略思维，因此在人才市场上具有较强的竞争力。', 6),
          q('知识库：具备知识库建设或管理经验的员工，是否在人才市场上具有更多优势？参与知识库建设的人才通常具备较强的研究能力和行业深度，这些技能使他们在咨询、研究和高级分析领域具有竞争力。', 7),
          q('文化与准则：参与公司文化与准则培训对你在人才市场上的定位有什么样的影响？这对你适应不同企业文化和环境有什么样的帮助？', 8),
        ]},
      ],
    },
    // 10. 加班偏好
    {
      name: '加班偏好', order: 10,
      dimensions: [
        { name: D1, order: 1, questions: [q('你能接受的工作时长和工作强度是怎样的（964/965/855/996/995/7×24）？目前中国的市场上你知道什么类型的平台在适用哪一种工作时长和工作强度？你了解964的这种工作时长目前只存在于中国的外资企业吗？你清楚不同工作强度的平台对人才的画像是什么样的吗？', 1)] },
        { name: D2, order: 2, questions: [q('加班偏好的选择反映了你对工作与生活平衡的重视程度，以及对职业压力的适应能力。你清楚你自己想要什么样的平衡吗？你了解自己对压力的适应和处理能力吗？', 1)] },
        { name: D3, order: 3, questions: [q('高强度的加班文化可能会出现在创业公司或某些高压行业，你的选择将影响你在这些领域的职业路径。你所选择的行业普遍的工作强度是什么样的？', 1)] },
        { name: D4, order: 4, questions: [q('如果你选择了更高强度的工作模式，是否意味着你清楚这个强度对你的健康和生活的影响？你是否认为高强度的工作对应高回报行业（如金融、互联网等）？你了解多高强度对应多高的回报吗？你认为的回报里都有什么？你的兴趣排在第几位？', 1)] },
        { name: D5, order: 5, questions: [q('人才市场上对加班文化的接受度如何？中国目前的人才市场对于工作强度与工作效率的定位是什么？你了解工作强度与工作效率的关系吗？你了解不同规模的平台对工作效率以及工作强度的定义和标准都有所不同吗？', 1)] },
      ],
    },
    // 11. 假期天数/年
    {
      name: '假期天数/年', order: 11,
      dimensions: [
        { name: D1, order: 1, questions: [q('你期望的假期天数是多少（5天/10天/15天/20天/25天/45天/60天）？不同的假期政策都存在于什么类型的平台？作为年轻人才，你了解与管理层或者老员工的假期政策差别吗？你了解外资平台管理层与一线员工假期待遇无差别的原因吗？', 1)] },
        { name: D2, order: 2, questions: [q('不同的假期政策反映工作与生活平衡的文化和对员工休息的重视程度。这对你未来的生活方式意味着什么？', 1)] },
        { name: D3, order: 3, questions: [q('不同领域的假期政策差异如何影响你的工作状态和工作效率？', 1)] },
        { name: D4, order: 4, questions: [q('你的兴趣需要哪个程度的员工福利和生活平衡的行业？你是否可以在你的兴趣与职业之间找到一个平衡？', 1)] },
        { name: D5, order: 5, questions: [q('你的选择在人才市场上会被如何看待？你所选择的行业、城市与自我定位对你在假期的选择上有什么样的影响？', 1)] },
      ],
    },
    // 12. 医疗保障
    {
      name: '医疗保障', order: 12,
      dimensions: [
        { name: D1, order: 1, questions: [q('你期望的医疗保障水平是多少（普通/高端/定制）？这些不同的医疗保障分别对应哪些类型的平台？不同程度的医疗保障都分别包括哪些医疗选项？你是否了解中国目前对于外资投资及建立医院的政策倾向？你了解目前中国的哪些城市拥有多少三甲公立医院以及多少高水准的综合全科民营医院？', 1)] },
        { name: D2, order: 2, questions: [q('不同的医疗保障意味着你对健康保障的重视程度，以及对工作环境中福利的期望。你认为牙科护理、私人医生等医疗保障对你来说意味着什么？对你的生活方式的选择意味着什么？', 1)] },
        { name: D3, order: 3, questions: [q('某些领域（例如跨国公司或大型企业）可能会提供更高水平的医疗保障，这会影响你的选择吗？关于医疗保障，你是否会将它排在影响你选择的因素的前几位？', 1)] },
        { name: D4, order: 4, questions: [q('你的兴趣领域是否要求有更好的医疗保障？如果你的自我定位对身体健康或精神健康有极大影响，你是否考虑过更换你的兴趣领域？你了解自己身体的物理极限吗？你了解自己的精神极限吗？', 1)] },
        { name: D5, order: 5, questions: [q('不同的平台对员工健康保障的投入程度如何影响你在求职市场的选择？你所选择的领域对应的人才市场的医疗保障普遍是什么水平？包含哪些内容？涵盖哪些服务？所使用的频率是什么样的？', 1)] },
      ],
    },
    // 13. 生育福利
    {
      name: '生育福利', order: 13,
      dimensions: [
        { name: D1, order: 1, questions: [q('你期望的生育福利是什么（生育检查/生育检查+精子/卵子冷冻/生育检查+精子/卵子冷冻+孕期保障）？你知道中国为数不多提供员工生殖福利的平台有哪几个吗？你是否有清晰的婚育计划？你了解中国现行的法律对于生育方面的具体条款吗？你了解在你所选择的城市生和育的政策是什么？', 1)] },
        { name: D2, order: 2, questions: [q('生育福利反映了一个公司或行业对员工家庭规划的支持程度。对于你的人生和生活方式意味着什么？如果你没有生育计划，你是否理解这在你选择的城市和平台的环境中意味着什么样的职业选择以及舆论压力？如果你有生育计划，你是否了解在你选择的城市和平台意味着什么样的物质和精神基础？', 1)] },
        { name: D3, order: 3, questions: [q('哪些行业可能提供更为完善的生育福利（如某互联网公司提供女性员工冻卵的福利、某医疗大健康公司提供生殖遗传病的检测福利等等）？这可能会影响你对这些领域的兴趣吗？', 1)] },
        { name: D4, order: 4, questions: [q('选择更好的生育福利可能使你倾向于那些注重员工生活质量和福利的公司或行业。你的生育计划如何影响你对行业和平台的选择？', 1)] },
        { name: D5, order: 5, questions: [q('生育福利政策的优劣如何影响公司在市场中的竞争力，特别是在年轻人才的吸引上？你了解中国人才市场上不同城市不同行业对未婚未育、已婚未育、已婚已育、以及未婚已育男性和女性员工的生育定位吗？你知道女性员工生育假期的延长加重了女性在职场的困境吗？', 1)] },
      ],
    },
  ];

  const questionnaireVersion = await prisma.questionnaireVersion.upsert({
    where: { version: 1 },
    update: {},
    create: { version: 1, isActive: true },
  });
  const versionId = questionnaireVersion.id;

  for (const topic of topics) {
    const existingTopics = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM topics WHERE name = ${topic.name} AND "versionId" = ${versionId} LIMIT 1`,
    );
    let topicId: string;
    if (existingTopics.length > 0) {
      topicId = existingTopics[0].id;
    } else {
      const inserted = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`INSERT INTO topics (id, name, "order", "versionId") VALUES (gen_random_uuid(), ${topic.name}, ${topic.order}, ${versionId}) RETURNING id`,
      );
      topicId = inserted[0].id;
    }

    for (const dim of topic.dimensions) {
      const existingDims = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM dimensions WHERE name = ${dim.name} AND "topicId" = ${topicId} LIMIT 1`,
      );
      let dimId: string;
      if (existingDims.length > 0) {
        dimId = existingDims[0].id;
      } else {
        const inserted = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`INSERT INTO dimensions (id, name, "order", "topicId") VALUES (gen_random_uuid(), ${dim.name}, ${dim.order}, ${topicId}) RETURNING id`,
        );
        dimId = inserted[0].id;
      }

      for (const question of dim.questions) {
        const existingQs = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM questions WHERE title = ${question.title} AND "dimensionId" = ${dimId} LIMIT 1`,
        );
        let questionId: string;
        if (existingQs.length > 0) {
          questionId = existingQs[0].id;
        } else {
          const inserted = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`INSERT INTO questions (id, title, "order", "dimensionId") VALUES (gen_random_uuid(), ${question.title}, ${question.order}, ${dimId}) RETURNING id`,
          );
          questionId = inserted[0].id;
        }

        for (const opt of question.options) {
          const existingOpts = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM answer_options WHERE label = ${opt.label} AND "questionId" = ${questionId} LIMIT 1`,
          );
          if (existingOpts.length === 0) {
            await prisma.$queryRaw(
              Prisma.sql`INSERT INTO answer_options (id, label, score, "order", "questionId") VALUES (gen_random_uuid(), ${opt.label}, ${opt.score}, ${opt.order}, ${questionId})`,
            );
          }
        }
      }
    }
    console.log(`  ✓ Topic seeded: ${topic.name}`);
  }

  console.log('Seeded questionnaire version 1 with 13 topics × 5 dimensions');
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
