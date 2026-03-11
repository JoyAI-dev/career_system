import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
    { name: '圆桌会议', order: 0, defaultCapacity: 8 },
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

  // Seed questionnaire version 1 with topics, dimensions, questions, and answer options
  const questionnaireVersion = await prisma.questionnaireVersion.upsert({
    where: { version: 1 },
    update: {},
    create: { version: 1, isActive: true },
  });
  const versionId = questionnaireVersion.id;

  // Helper: seed a full topic tree (dimensions → questions → answer options)
  interface SeedAnswerOption { label: string; score: number; order: number }
  interface SeedQuestion { title: string; order: number; options: SeedAnswerOption[] }
  interface SeedDimension { name: string; order: number; questions: SeedQuestion[] }
  interface SeedTopic { name: string; order: number; dimensions: SeedDimension[] }

  const topics: SeedTopic[] = [
    {
      name: '职业兴趣',
      order: 1,
      dimensions: [
        {
          name: '技术倾向',
          order: 1,
          questions: [
            {
              title: '你对学习新的编程语言或技术工具的兴趣程度如何？',
              order: 1,
              options: [
                { label: '非常感兴趣，经常主动学习', score: 40, order: 1 },
                { label: '比较感兴趣，偶尔会尝试', score: 30, order: 2 },
                { label: '一般，需要时才会学', score: 20, order: 3 },
                { label: '不太感兴趣', score: 10, order: 4 },
              ],
            },
            {
              title: '面对复杂的技术问题时，你通常的反应是？',
              order: 2,
              options: [
                { label: '兴奋，喜欢挑战', score: 40, order: 1 },
                { label: '愿意尝试解决', score: 30, order: 2 },
                { label: '希望有人指导再动手', score: 20, order: 3 },
                { label: '倾向于回避', score: 10, order: 4 },
              ],
            },
          ],
        },
        {
          name: '商业倾向',
          order: 2,
          questions: [
            {
              title: '你对市场分析和商业模式的关注程度如何？',
              order: 1,
              options: [
                { label: '经常关注行业动态和商业案例', score: 40, order: 1 },
                { label: '偶尔会看相关资讯', score: 30, order: 2 },
                { label: '很少主动关注', score: 20, order: 3 },
                { label: '完全不关注', score: 10, order: 4 },
              ],
            },
            {
              title: '你是否有兴趣参与创业或商业项目？',
              order: 2,
              options: [
                { label: '非常想，已经有想法或在行动', score: 40, order: 1 },
                { label: '有兴趣，但还没具体计划', score: 30, order: 2 },
                { label: '不确定，需要了解更多', score: 20, order: 3 },
                { label: '没有兴趣', score: 10, order: 4 },
              ],
            },
          ],
        },
      ],
    },
    {
      name: '能力评估',
      order: 2,
      dimensions: [
        {
          name: '沟通协作',
          order: 1,
          questions: [
            {
              title: '在团队项目中，你通常扮演什么角色？',
              order: 1,
              options: [
                { label: '主动组织协调，推动进度', score: 40, order: 1 },
                { label: '积极参与讨论和执行', score: 30, order: 2 },
                { label: '完成分配的任务', score: 20, order: 3 },
                { label: '较少主动参与', score: 10, order: 4 },
              ],
            },
            {
              title: '当团队成员意见不一致时，你会怎么做？',
              order: 2,
              options: [
                { label: '主动调解，寻找共识', score: 40, order: 1 },
                { label: '表达自己的观点并倾听他人', score: 30, order: 2 },
                { label: '跟随多数人的意见', score: 20, order: 3 },
                { label: '保持沉默，不参与讨论', score: 10, order: 4 },
              ],
            },
          ],
        },
        {
          name: '学习能力',
          order: 2,
          questions: [
            {
              title: '你如何对待课堂以外的知识学习？',
              order: 1,
              options: [
                { label: '有系统的自学计划和目标', score: 40, order: 1 },
                { label: '会主动阅读相关书籍或课程', score: 30, order: 2 },
                { label: '偶尔浏览感兴趣的内容', score: 20, order: 3 },
                { label: '基本不进行课外学习', score: 10, order: 4 },
              ],
            },
            {
              title: '遇到不熟悉的领域时，你的学习方式是？',
              order: 2,
              options: [
                { label: '制定计划，系统性学习', score: 40, order: 1 },
                { label: '通过实践边做边学', score: 30, order: 2 },
                { label: '等有人教或有教程再学', score: 20, order: 3 },
                { label: '尽量避免接触不熟悉的领域', score: 10, order: 4 },
              ],
            },
          ],
        },
      ],
    },
    {
      name: '价值观取向',
      order: 3,
      dimensions: [
        {
          name: '职业价值',
          order: 1,
          questions: [
            {
              title: '选择工作时，你最看重什么？',
              order: 1,
              options: [
                { label: '个人成长和学习机会', score: 34, order: 1 },
                { label: '薪资待遇和稳定性', score: 33, order: 2 },
                { label: '社会影响和意义感', score: 33, order: 3 },
              ],
            },
            {
              title: '你理想的工作环境是怎样的？',
              order: 2,
              options: [
                { label: '创新驱动，快速变化', score: 34, order: 1 },
                { label: '结构清晰，流程规范', score: 33, order: 2 },
                { label: '自由灵活，自主性强', score: 33, order: 3 },
              ],
            },
          ],
        },
        {
          name: '发展期望',
          order: 2,
          questions: [
            {
              title: '毕业后五年内，你最希望达成什么目标？',
              order: 1,
              options: [
                { label: '成为某个领域的专家', score: 34, order: 1 },
                { label: '带领团队或创业', score: 33, order: 2 },
                { label: '获得广泛的跨领域经验', score: 33, order: 3 },
              ],
            },
            {
              title: '你对继续深造（如读研）的态度是？',
              order: 2,
              options: [
                { label: '已经在准备或计划中', score: 34, order: 1 },
                { label: '在考虑，视情况而定', score: 33, order: 2 },
                { label: '倾向于直接就业', score: 33, order: 3 },
              ],
            },
          ],
        },
      ],
    },
  ];

  for (const topic of topics) {
    // Use raw query to find existing topic by name + versionId
    const existingTopics = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM topics WHERE name = ${topic.name} AND "versionId" = ${versionId} LIMIT 1`,
    );

    let topicId: string;
    if (existingTopics.length > 0) {
      topicId = existingTopics[0].id;
    } else {
      const created = await (prisma as any).topic.create({
        data: { name: topic.name, order: topic.order, versionId },
      });
      topicId = created.id;
    }

    for (const dim of topic.dimensions) {
      const existingDims = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM dimensions WHERE name = ${dim.name} AND "topicId" = ${topicId} LIMIT 1`,
      );

      let dimId: string;
      if (existingDims.length > 0) {
        dimId = existingDims[0].id;
      } else {
        const created = await (prisma as any).dimension.create({
          data: { name: dim.name, order: dim.order, topicId },
        });
        dimId = created.id;
      }

      for (const q of dim.questions) {
        const existingQs = await prisma.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM questions WHERE title = ${q.title} AND "dimensionId" = ${dimId} LIMIT 1`,
        );

        let questionId: string;
        if (existingQs.length > 0) {
          questionId = existingQs[0].id;
        } else {
          const created = await (prisma as any).question.create({
            data: { title: q.title, order: q.order, dimensionId: dimId },
          });
          questionId = created.id;
        }

        for (const opt of q.options) {
          const existingOpts = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM answer_options WHERE label = ${opt.label} AND "questionId" = ${questionId} LIMIT 1`,
          );

          if (existingOpts.length === 0) {
            await (prisma as any).answerOption.create({
              data: {
                label: opt.label,
                score: opt.score,
                order: opt.order,
                questionId,
              },
            });
          }
        }
      }
    }
  }

  console.log('Seeded questionnaire version 1 with topics, dimensions, questions, and answer options');
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
