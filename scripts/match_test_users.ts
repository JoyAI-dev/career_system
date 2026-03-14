import { prisma } from '@/lib/db';
import { matchUserToFirstActivity } from '@/server/services/activityMatching';

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { in: ['act_qian', 'act_sun', 'act_zhou', 'act_wu'] } },
    select: { id: true, username: true, name: true },
  });

  for (const user of users) {
    try {
      console.log(`Matching ${user.name} (${user.username})...`);
      await matchUserToFirstActivity(user.id);
      console.log(`  ✅ ${user.name} matched successfully`);
    } catch (err: any) {
      console.log(`  ❌ ${user.name} failed: ${err.message}`);
    }
  }

  // Check result
  const members = await prisma.virtualGroupMember.findMany({
    where: { user: { username: { startsWith: 'act_' } } },
    include: {
      user: { select: { username: true, name: true } },
      virtualGroup: { select: { name: true, status: true, _count: { select: { members: true } } } },
    },
    orderBy: { order: 'asc' },
  });

  console.log('\n=== Virtual Group Status ===');
  for (const m of members) {
    console.log(`  ${m.user.name} (${m.user.username}) → ${m.virtualGroup.name} [${m.virtualGroup.status}] (${m.virtualGroup._count.members}/6)`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
