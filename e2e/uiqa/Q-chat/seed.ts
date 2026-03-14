/**
 * Q-chat Seed: Chat System E2E Test Data
 *
 * Creates two test users (a14, a15) with:
 * - Completed preferences (same grouping → same community)
 * - Completed questionnaire (isSnapshot: true → skip to dashboard)
 * - Announcement marked as viewed (no countdown)
 * - Both in the same community and virtual group
 *
 * Usage: npx tsx e2e/uiqa/Q-chat/seed.ts
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

// Same preferences for both users → same community fingerprint
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

async function seedCompletedQuestionnaire(
  db: any,
  userId: string,
) {
  const version = await getActiveVersion(db);
  if (!version) throw new Error('No active questionnaire version found');

  // Delete existing responses for this user
  await db.responseSnapshot.deleteMany({ where: { userId } });

  // Create COMPLETED snapshot (isSnapshot: true = submitted)
  const snapshot = await db.responseSnapshot.create({
    data: {
      userId,
      versionId: version.id,
      isSnapshot: true,
      completedAt: new Date(),
      context: 'uiqa-chat-seed',
    },
  });

  // Answer ALL questions randomly
  for (const topic of version.topics) {
    for (const subTopic of topic.subTopics) {
      for (const dimension of subTopic.dimensions) {
        for (const question of dimension.questions) {
          const options = question.answerOptions;
          if (options.length === 0) continue;
          const randomOption = options[Math.floor(Math.random() * options.length)];
          await db.responseAnswer.create({
            data: {
              snapshotId: snapshot.id,
              questionId: question.id,
              selectedOptionId: randomOption.id,
            },
          });
        }
      }
    }
  }

  return snapshot;
}

async function seed() {
  const { prisma } = await getDb();

  try {
    console.log('=== Q-chat Seed: Chat System E2E Test ===\n');

    // ─── Step 1: Reset and create test users ────────────────────
    console.log('Step 1: Creating test users a14 and a15...');
    const userA = await resetUser(prisma, 'a14');
    const userB = await resetUser(prisma, 'a15');
    console.log(`  ✅ a14 (id: ${userA.id})`);
    console.log(`  ✅ a15 (id: ${userB.id})`);

    // ─── Step 2: Mark announcements as viewed ───────────────────
    console.log('\nStep 2: Marking announcements as viewed...');
    const announcement = await getActiveAnnouncement(prisma);
    if (announcement) {
      await markAnnouncementViewed(prisma, userA.id, announcement.id);
      await markAnnouncementViewed(prisma, userB.id, announcement.id);
      console.log(`  ✅ Announcement "${announcement.title}" marked as viewed for both users`);
    } else {
      console.log('  ⚠️ No active announcement found (skipping)');
    }

    // ─── Step 3: Seed preferences ───────────────────────────────
    console.log('\nStep 3: Seeding preferences...');
    await seedPreferences(prisma, userA.id, SHARED_PREFERENCES, SHARED_SLIDER_VALUES);
    await seedPreferences(prisma, userB.id, SHARED_PREFERENCES, SHARED_SLIDER_VALUES);
    console.log('  ✅ Both users have identical preferences (same grouping basis)');

    // ─── Step 4: Seed completed questionnaires ──────────────────
    console.log('\nStep 4: Seeding completed questionnaires...');
    await seedCompletedQuestionnaire(prisma, userA.id);
    await seedCompletedQuestionnaire(prisma, userB.id);
    console.log('  ✅ Both users have completed questionnaires (isSnapshot: true)');

    // ─── Step 5: Create shared community ────────────────────────
    console.log('\nStep 5: Creating shared community and virtual group...');

    // Clean up any previous test community
    const existingCommunity = await prisma.community.findFirst({
      where: { name: 'Chat Test Community' },
    });
    if (existingCommunity) {
      // Delete virtual groups and members first
      await prisma.virtualGroupMember.deleteMany({
        where: { virtualGroup: { communityId: existingCommunity.id } },
      });
      await prisma.virtualGroup.deleteMany({
        where: { communityId: existingCommunity.id },
      });
      await prisma.communityMember.deleteMany({
        where: { communityId: existingCommunity.id },
      });
      await prisma.communityTag.deleteMany({
        where: { communityId: existingCommunity.id },
      });
      await prisma.community.delete({
        where: { id: existingCommunity.id },
      });
    }

    // Create community
    const community = await prisma.community.create({
      data: {
        fingerprint: 'uiqa_chat_test_community_fingerprint',
        name: 'Chat Test Community',
        memberCount: 2,
      },
    });
    console.log(`  ✅ Community: "${community.name}" (id: ${community.id})`);

    // Add both users to community
    await prisma.communityMember.create({
      data: { communityId: community.id, userId: userA.id },
    });
    await prisma.communityMember.create({
      data: { communityId: community.id, userId: userB.id },
    });
    console.log('  ✅ Both users added to community');

    // Create virtual group in the community
    const virtualGroup = await prisma.virtualGroup.create({
      data: {
        communityId: community.id,
        name: 'Chat Test Group',
        status: 'ACTIVE',
        leaderId: userA.id,
      },
    });
    console.log(`  ✅ Virtual Group: "${virtualGroup.name}" (id: ${virtualGroup.id})`);

    // Add both users to virtual group
    await prisma.virtualGroupMember.create({
      data: {
        virtualGroupId: virtualGroup.id,
        userId: userA.id,
        order: 1,
      },
    });
    await prisma.virtualGroupMember.create({
      data: {
        virtualGroupId: virtualGroup.id,
        userId: userB.id,
        order: 2,
      },
    });
    console.log('  ✅ Both users added to virtual group');

    // ─── Step 6: Clean up any existing friendships ──────────────
    console.log('\nStep 6: Cleaning up existing friendships...');
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userA.id },
          { addresseeId: userA.id },
          { requesterId: userB.id },
          { addresseeId: userB.id },
        ],
      },
    });
    console.log('  ✅ Friendships cleaned (fresh start for friend request test)');

    // ─── Summary ────────────────────────────────────────────────
    console.log('\n=== Seed Complete ===');
    console.log(`
Test Users:
  a14 (password: a14) - id: ${userA.id}
  a15 (password: a15) - id: ${userB.id}

Community: "Chat Test Community" (id: ${community.id})
Virtual Group: "Chat Test Group" (id: ${virtualGroup.id})

Both users:
  ✅ Preferences completed (same grouping basis)
  ✅ Questionnaire completed (isSnapshot: true)
  ✅ Announcement viewed (no countdown)
  ✅ In same community and virtual group
  ✅ No existing friendships (clean slate for testing)

Login URLs:
  Session A: https://career-staging.joysort.cn/login → a14/a14
  Session B: https://career-staging.joysort.cn/login → a15/a15
`);
  } finally {
    await cleanup();
  }
}

seed().catch((err) => {
  console.error('❌ Q-chat seed failed:', err);
  process.exit(1);
});
