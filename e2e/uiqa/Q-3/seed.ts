/**
 * Q-3 Seed: 问卷恢复与完成流程
 *
 * Creates user a13 with:
 * - Announcement marked as viewed (can close immediately)
 * - Preferences fully completed (random selections per category)
 * - Questionnaire draft saved (all questions answered EXCEPT the last question of the last topic)
 * - No isSnapshot=true record (questionnaire not yet formally submitted)
 */

import {
  getDb,
  resetUser,
  getActiveAnnouncement,
  markAnnouncementViewed,
  seedPreferences,
  seedDraftResponses,
  cleanup,
} from '../shared/db';

async function seed() {
  const { prisma } = await getDb();

  try {
    // 1. Reset user a13
    const user = await resetUser(prisma, 'a13');
    console.log(`✅ User a13 created (id: ${user.id})`);

    // 2. Mark announcement as viewed
    const announcement = await getActiveAnnouncement(prisma);
    if (announcement) {
      await markAnnouncementViewed(prisma, user.id, announcement.id);
      console.log('✅ Announcement marked as viewed');
    } else {
      console.warn('⚠️ No active announcement found');
    }

    // 3. Seed preferences (diverse selections across categories)
    const selections: Record<string, string[]> = {
      'location': ['beijing', 'guangzhou'],
      'self-positioning': ['professional-manager'],
      'development-direction': ['public-sector', 'private-sector'],
      'industry': ['tech', 'education'],
      'platform-type': ['foreign'],
      'company-size': ['billion'],
      'culture-hierarchy': ['vertical'],
      'culture-environment': ['fast-paced'],
      'training': ['rotation', 'hard-skills', 'action-learning'],
      'work-schedule': ['965'],
      'vacation': ['15'],
      'healthcare-benefit': ['basic'],
      'fertility': ['fertility-full'],
    };

    const sliderValues: Record<string, number> = {
      'leadership-style': 4,
    };

    const pref = await seedPreferences(prisma, user.id, selections, sliderValues);

    const selectionCount = await prisma.userPreferenceSelection.count({
      where: { userPreferenceId: pref.id },
    });
    console.log(`✅ Preferences seeded — ${selectionCount} selections`);

    // 4. Seed draft questionnaire responses (skip last question of last topic)
    const snapshot = await seedDraftResponses(prisma, user.id, {
      skipLastQuestionOfLastTopic: true,
      preferenceSelections: selections,
    });

    const answerCount = await prisma.responseAnswer.count({
      where: { snapshotId: snapshot.id },
    });

    // Count total questions to show how many were answered vs skipped
    const version = await prisma.questionnaireVersion.findFirst({
      where: { isActive: true },
      include: {
        topics: {
          include: {
            subTopics: {
              include: {
                dimensions: {
                  include: {
                    questions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const totalQuestions = version?.topics.reduce(
      (sum, t) =>
        sum +
        t.subTopics.reduce(
          (s, st) =>
            s + st.dimensions.reduce((s2, d) => s2 + d.questions.length, 0),
          0,
        ),
      0,
    ) ?? 0;

    console.log(`✅ Draft responses seeded — ${answerCount}/${totalQuestions} questions answered`);
    console.log(`   (Last question of last topic intentionally left unanswered)`);

    // 5. Verify no snapshot exists
    const snapshotCount = await prisma.responseSnapshot.count({
      where: { userId: user.id, isSnapshot: true },
    });
    console.log(`✅ Submitted snapshots: ${snapshotCount} (should be 0)`);

    // Show which question was skipped
    const lastTopic = version?.topics[version.topics.length - 1];
    const lastSubTopic = lastTopic?.subTopics[lastTopic.subTopics.length - 1];
    const lastDimension = lastSubTopic?.dimensions[lastSubTopic.dimensions.length - 1];
    const lastQuestion = lastDimension?.questions[lastDimension.questions.length - 1];

    if (lastQuestion) {
      console.log(`✅ Skipped question: "${lastQuestion.title.substring(0, 60)}..." (topic: ${lastTopic?.name})`);
    }

    console.log('✅ Q-3 seed completed successfully');
  } finally {
    await cleanup();
  }
}

seed().catch((err) => {
  console.error('❌ Q-3 seed failed:', err);
  process.exit(1);
});
