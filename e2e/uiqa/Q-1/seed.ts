/**
 * Q-1 Seed: 新用户公告流程
 *
 * Creates a clean a11 user with no data (no preferences, no responses, no announcement views).
 * This ensures the user will see the full announcement countdown on first login.
 */

import { getDb, resetUser, cleanup } from '../shared/db';

async function seed() {
  const { prisma } = await getDb();

  try {
    // Reset user a11 — deletes all cascaded data and recreates
    const user = await resetUser(prisma, 'a11');
    console.log(`✅ User a11 created (id: ${user.id})`);

    // Verify there's an active announcement
    const announcement = await prisma.announcement.findFirst({
      where: { isActive: true },
    });

    if (announcement) {
      console.log(`✅ Active announcement found: "${announcement.title}" (countdown: ${announcement.countdownSeconds}s)`);
    } else {
      console.warn('⚠️ No active announcement found! CP-2 ~ CP-5 and CP-10 ~ CP-12 will fail.');
      console.warn('   Run the main seed script to create announcements first.');
    }

    // Verify no data exists for this user
    const prefCount = await prisma.userPreference.count({ where: { userId: user.id } });
    const responseCount = await prisma.responseSnapshot.count({ where: { userId: user.id } });
    const viewCount = await prisma.announcementView.count({ where: { userId: user.id } });

    console.log(`✅ Data verification — preferences: ${prefCount}, responses: ${responseCount}, announcement views: ${viewCount}`);
    console.log('✅ Q-1 seed completed successfully');
  } finally {
    await cleanup();
  }
}

seed().catch((err) => {
  console.error('❌ Q-1 seed failed:', err);
  process.exit(1);
});
