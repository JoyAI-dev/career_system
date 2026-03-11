import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
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
