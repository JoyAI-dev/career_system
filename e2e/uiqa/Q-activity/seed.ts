/**
 * Q-activity Seed: 活动系统交互式测试数据
 *
 * Creates 6 test users with:
 * - Chinese display names (赵小明, 钱小红, 孙小刚, 李小芳, 周小伟, 吴小丽)
 * - Identical preferences → same community (same fingerprint)
 * - Completed questionnaire (isSnapshot: true → skip to dashboard)
 * - Announcement marked as viewed (no countdown)
 * - Shared community created (no virtual group — let activity flow create it)
 *
 * Usage: npx tsx e2e/uiqa/Q-activity/seed.ts
 */

import {
  getDb,
  resetUser,
  cleanup,
  getActiveAnnouncement,
  markAnnouncementViewed,
  seedPreferences,
  getActiveVersion,
} from '../shared/db';

// ─── Test Users ──────────────────────────────────────────────────────

const TEST_USERS = [
  { username: 'act_zhao', name: '赵小明' },
  { username: 'act_qian', name: '钱小红' },
  { username: 'act_sun', name: '孙小刚' },
  { username: 'act_li', name: '李小芳' },
  { username: 'act_zhou', name: '周小伟' },
  { username: 'act_wu', name: '吴小丽' },
];

// ─── Shared Preferences (identical → same community) ─────────────────

const SHARED_PREFERENCES: Record<string, string[]> = {
  location: ['beijing'],
  'self-positioning': ['businessman'],
  'development-direction': ['private-sector'],
  industry: ['tech'],
  'platform-type': ['domestic'],
  'company-size': ['fortune500'],
  'culture-hierarchy': ['flat'],
  'culture-environment': ['corporate'],
  training: ['management-training'],
  'work-schedule': ['964'],
  vacation: ['20'],
  'healthcare-benefit': ['premium'],
  fertility: ['fertility-check'],
};

const SHARED_SLIDER_VALUES: Record<string, number> = {
  'leadership-style': 5,
};

// ─── Helpers ─────────────────────────────────────────────────────────

async function seedCompletedQuestionnaire(db: any, userId: string) {
  const version = await getActiveVersion(db);
  if (!version) throw new Error('No active questionnaire version found');

  // Delete existing responses
  await db.responseSnapshot.deleteMany({ where: { userId } });

  // Create COMPLETED snapshot (isSnapshot: true = submitted)
  const snapshot = await db.responseSnapshot.create({
    data: {
      userId,
      versionId: version.id,
      isSnapshot: true,
      completedAt: new Date(),
      context: 'activity-test-seed',
    },
  });

  // Answer ALL questions randomly
  let answerCount = 0;
  for (const topic of version.topics) {
    for (const subTopic of topic.subTopics) {
      for (const dimension of subTopic.dimensions) {
        for (const question of dimension.questions) {
          const options = question.answerOptions;
          if (options.length === 0) continue;
          const randomOption =
            options[Math.floor(Math.random() * options.length)];
          await db.responseAnswer.create({
            data: {
              snapshotId: snapshot.id,
              questionId: question.id,
              selectedOptionId: randomOption.id,
            },
          });
          answerCount++;
        }
      }
    }
  }

  return { snapshot, answerCount };
}

// ─── Main Seed ───────────────────────────────────────────────────────

async function seed() {
  const { prisma } = await getDb();

  try {
    console.log('=== Q-activity Seed: 活动系统交互式测试 ===\n');

    // ─── Step 1: Reset and create test users ────────────────────
    console.log('Step 1: 创建 6 个测试用户...');
    const users: Array<{ id: string; username: string; name: string }> = [];

    for (const { username, name } of TEST_USERS) {
      const user = await resetUser(prisma, username);
      // Set display name
      await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
      users.push({ id: user.id, username, name });
      console.log(`  ✅ ${name} (${username}, id: ${user.id})`);
    }

    // ─── Step 2: Mark announcements as viewed ───────────────────
    console.log('\nStep 2: 标记公告已读...');
    const announcement = await getActiveAnnouncement(prisma);
    if (announcement) {
      for (const user of users) {
        await markAnnouncementViewed(prisma, user.id, announcement.id);
      }
      console.log(
        `  ✅ 公告 "${announcement.title}" 已标记为 6 人已读`,
      );
    } else {
      console.log('  ⚠️ 没有活跃公告（跳过）');
    }

    // ─── Step 3: Seed identical preferences ─────────────────────
    console.log('\nStep 3: 设置统一偏好...');
    for (const user of users) {
      await seedPreferences(
        prisma,
        user.id,
        SHARED_PREFERENCES,
        SHARED_SLIDER_VALUES,
      );
    }
    console.log('  ✅ 6 人偏好完全一致（将分配到同一社群）');

    // ─── Step 4: Seed completed questionnaires ──────────────────
    console.log('\nStep 4: 随机回答问卷...');
    for (const user of users) {
      const { answerCount } = await seedCompletedQuestionnaire(
        prisma,
        user.id,
      );
      console.log(`  ✅ ${user.name}: ${answerCount} 题已答`);
    }

    // ─── Step 5: Create shared community ────────────────────────
    console.log('\nStep 5: 创建共享社群...');

    // Clean up any previous activity-test community
    const COMMUNITY_FINGERPRINT = 'activity_test_community_fp_v1';
    const existingCommunity = await prisma.community.findFirst({
      where: {
        OR: [
          { fingerprint: COMMUNITY_FINGERPRINT },
          { name: 'Activity Test Community' },
        ],
      },
    });

    if (existingCommunity) {
      // Clean up in correct order (respect foreign key constraints)
      // 1. Delete memberships of activities in virtual groups
      const virtualGroups = await prisma.virtualGroup.findMany({
        where: { communityId: existingCommunity.id },
        select: { id: true },
      });
      const vgIds = virtualGroups.map((vg: any) => vg.id);

      if (vgIds.length > 0) {
        // Delete activity memberships
        const activities = await prisma.activity.findMany({
          where: { virtualGroupId: { in: vgIds } },
          select: { id: true },
        });
        const actIds = activities.map((a: any) => a.id);
        if (actIds.length > 0) {
          await prisma.membership.deleteMany({
            where: { activityId: { in: actIds } },
          });
          await prisma.activityComment.deleteMany({
            where: { activityId: { in: actIds } },
          });
          await prisma.activityTag.deleteMany({
            where: { activityId: { in: actIds } },
          });
          await prisma.activity.deleteMany({
            where: { id: { in: actIds } },
          });
        }

        // Delete pairings
        await prisma.pairing.deleteMany({
          where: { virtualGroupId: { in: vgIds } },
        });

        // Delete virtual group members
        await prisma.virtualGroupMember.deleteMany({
          where: { virtualGroupId: { in: vgIds } },
        });

        // Delete virtual groups
        await prisma.virtualGroup.deleteMany({
          where: { communityId: existingCommunity.id },
        });
      }

      // Delete community members and tags
      await prisma.communityMember.deleteMany({
        where: { communityId: existingCommunity.id },
      });
      await prisma.communityTag.deleteMany({
        where: { communityId: existingCommunity.id },
      });

      // Delete community
      await prisma.community.delete({
        where: { id: existingCommunity.id },
      });
      console.log('  🧹 清除旧的测试社群');
    }

    // Create new community
    const community = await prisma.community.create({
      data: {
        fingerprint: COMMUNITY_FINGERPRINT,
        name: 'Activity Test Community',
        memberCount: users.length,
      },
    });

    // Add all users to community
    for (const user of users) {
      await prisma.communityMember.create({
        data: {
          communityId: community.id,
          userId: user.id,
        },
      });
    }
    console.log(
      `  ✅ 社群 "${community.name}" 已创建，${users.length} 人已加入`,
    );

    // ─── Step 6: Clean up existing activities & virtual groups ───
    console.log('\nStep 6: 清理用户的旧活动数据...');
    for (const user of users) {
      // Remove from any existing memberships
      await prisma.membership.deleteMany({
        where: { userId: user.id },
      });
      // Remove from any existing virtual group memberships (outside our community)
      await prisma.virtualGroupMember.deleteMany({
        where: { userId: user.id },
      });
      // Remove standby status
      await prisma.standbyUser.deleteMany({
        where: { userId: user.id },
      });
    }
    console.log('  ✅ 旧活动数据已清理（虚拟组将由活动流程自动创建）');

    // ─── Summary ────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    console.log('Seed 完成！\n');
    console.log('测试用户:');
    for (const user of users) {
      console.log(`  ${user.name} (${user.username} / ${user.username})`);
    }
    console.log(`\n社群: "${community.name}" (id: ${community.id})`);
    console.log('虚拟组: 未创建（由活动加入流程自动生成）');
    console.log('\n所有用户状态:');
    console.log('  ✅ 偏好已完成（相同偏好 → 同社群）');
    console.log('  ✅ 问卷已完成（isSnapshot: true）');
    console.log('  ✅ 公告已读（无倒计时弹窗）');
    console.log('  ✅ 无旧活动数据（干净的测试环境）');
    console.log(
      `\n登录地址: https://career-staging.joysort.cn/login`,
    );
    console.log('='.repeat(50));
  } finally {
    await cleanup();
  }
}

seed().catch((err) => {
  console.error('❌ Q-activity seed failed:', err);
  process.exit(1);
});
