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
