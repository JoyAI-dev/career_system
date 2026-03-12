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
    options?: SeedPrefOption[];
    sliders?: SeedPrefSlider[];
  }

  const prefCategories: SeedPrefCategory[] = [
    {
      name: '地点', slug: 'location', icon: 'MapPin', order: 1,
      inputType: 'MULTI_SELECT',
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
      inputType: 'HIERARCHICAL_MULTI',
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
      inputType: 'HIERARCHICAL_MULTI',
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
      inputType: 'MULTI_SELECT',
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
      inputType: 'SINGLE_SELECT',
      options: [
        { label: '国内', value: 'domestic', order: 1 },
        { label: '外资', value: 'foreign', order: 2 },
        { label: '合资', value: 'joint-venture', order: 3 },
      ],
    },
    {
      name: '企业规模', slug: 'company-size', icon: 'Building', order: 6,
      inputType: 'SINGLE_SELECT',
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
    if (existing.length > 0) {
      categoryId = existing[0].id;
    } else {
      const inserted = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`INSERT INTO preference_categories (id, name, slug, icon, description, "order", "inputType", "isActive")
          VALUES (gen_random_uuid(), ${cat.name}, ${cat.slug}, ${cat.icon}, ${cat.description ?? null}, ${cat.order}, ${cat.inputType}::"PreferenceInputType", true)
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
