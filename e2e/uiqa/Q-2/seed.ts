/**
 * Q-2 Seed: Preference 过滤问卷验证
 *
 * Creates user a12 with completed preferences (specific selections for each category)
 * and announcement marked as viewed. No questionnaire responses.
 *
 * Preference selections:
 * - location (REPEAT): 北京, 上海, 深圳
 * - self-positioning (FILTER): 商人, 创业者
 * - development-direction (FILTER): 私营部门
 * - industry (CONTEXT): 科技, 金融, 医疗
 * - platform-type (CONTEXT): 国内
 * - company-size (CONTEXT): 财富500强
 * - culture-hierarchy (CONTEXT): 扁平化
 * - culture-environment (CONTEXT): 企业型
 * - leadership-style (CONTEXT): slider=6
 * - training (FILTER): 管理培训, 轮岗, 软技能
 * - work-schedule (CONTEXT): 964
 * - vacation (CONTEXT): 20天
 * - healthcare-benefit (CONTEXT): 高端
 * - fertility (CONTEXT): 生育检查
 */

import {
  getDb,
  resetUser,
  getActiveAnnouncement,
  markAnnouncementViewed,
  seedPreferences,
  cleanup,
} from '../shared/db';

async function seed() {
  const { prisma } = await getDb();

  try {
    // 1. Reset user a12
    const user = await resetUser(prisma, 'a12');
    console.log(`✅ User a12 created (id: ${user.id})`);

    // 2. Mark announcement as viewed (skip countdown)
    const announcement = await getActiveAnnouncement(prisma);
    if (announcement) {
      await markAnnouncementViewed(prisma, user.id, announcement.id);
      console.log('✅ Announcement marked as viewed');
    } else {
      console.warn('⚠️ No active announcement found');
    }

    // 3. Seed preferences with specific selections
    // These option values must match the PreferenceOption.value in the database
    // (seeded by the main seed script from prisma/seed.ts)
    const selections: Record<string, string[]> = {
      'location': ['beijing', 'shanghai', 'shenzhen'],
      'self-positioning': ['businessman', 'entrepreneur'],
      'development-direction': ['private-sector'],
      'industry': ['tech', 'finance', 'healthcare'],
      'platform-type': ['domestic'],
      'company-size': ['fortune500'],
      'culture-hierarchy': ['flat'],
      'culture-environment': ['corporate'],
      'training': ['management-training', 'rotation', 'soft-skills'],
      'work-schedule': ['964'],
      'vacation': ['20'],
      'healthcare-benefit': ['premium'],
      'fertility': ['fertility-check'],
    };

    const sliderValues: Record<string, number> = {
      'leadership-style': 6,
    };

    const pref = await seedPreferences(prisma, user.id, selections, sliderValues);

    // Verify selections were created
    const selectionCount = await prisma.userPreferenceSelection.count({
      where: { userPreferenceId: pref.id },
    });
    const sliderCount = await prisma.userPreferenceSliderValue.count({
      where: { userPreferenceId: pref.id },
    });

    console.log(`✅ Preferences seeded — ${selectionCount} selections, ${sliderCount} slider values`);

    // 4. Verify no questionnaire responses exist
    const responseCount = await prisma.responseSnapshot.count({ where: { userId: user.id } });
    console.log(`✅ Response snapshots: ${responseCount} (should be 0)`);

    console.log('✅ Q-2 seed completed successfully');
    console.log('');
    console.log('Preference summary:');
    console.log('  location (REPEAT): 北京, 上海, 深圳');
    console.log('  self-positioning (FILTER): 商人, 创业者');
    console.log('  development-direction (FILTER): 私营部门');
    console.log('  industry (CONTEXT): 科技, 金融, 医疗');
    console.log('  training (FILTER): 管理培训, 轮岗, 软技能');
    console.log('  [其他均为 CONTEXT 模式，各选一项]');
  } finally {
    await cleanup();
  }
}

seed().catch((err) => {
  console.error('❌ Q-2 seed failed:', err);
  process.exit(1);
});
