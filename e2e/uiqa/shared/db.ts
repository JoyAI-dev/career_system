/**
 * UIQA Shared Database Utilities
 *
 * Provides Prisma client connection and helper functions for UIQA seed scripts.
 * Connects to the staging database (career_staging on localhost:5432).
 */

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ─── Database Connection ─────────────────────────────────────────────

const CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgresql://career_staging:career_staging_2026@127.0.0.1:5432/career_staging';

let pool: Pool;
let prisma: PrismaClient;

export async function getDb() {
  if (!prisma) {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }
  return { prisma, pool };
}

export async function cleanup() {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (pool) {
    await pool.end();
  }
}

// ─── User Helpers ────────────────────────────────────────────────────

/**
 * Reset a test user: delete all related data and recreate with password = username.
 * Returns the user record.
 */
export async function resetUser(db: PrismaClient, username: string) {
  // Delete existing user and all cascaded data
  await db.user.deleteMany({ where: { username } });

  // Create fresh user with password = username
  const passwordHash = await bcrypt.hash(username, 10);
  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      role: 'USER',
    },
  });

  return user;
}

/**
 * Ensure a test user exists (upsert) without deleting data.
 * Useful when you want to keep existing data but ensure the user exists.
 */
export async function ensureUser(db: PrismaClient, username: string) {
  const passwordHash = await bcrypt.hash(username, 10);
  return db.user.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
      role: 'USER',
    },
  });
}

// ─── Announcement Helpers ────────────────────────────────────────────

/**
 * Get the currently active announcement.
 */
export async function getActiveAnnouncement(db: PrismaClient) {
  return db.announcement.findFirst({
    where: { isActive: true },
  });
}

/**
 * Mark an announcement as viewed for a user (skips countdown on next visit).
 */
export async function markAnnouncementViewed(
  db: PrismaClient,
  userId: string,
  announcementId: string,
) {
  return db.announcementView.upsert({
    where: {
      userId_announcementId: { userId, announcementId },
    },
    update: {},
    create: {
      userId,
      announcementId,
    },
  });
}

/**
 * Delete announcement view records for a user (reset "has viewed" state).
 */
export async function clearAnnouncementViews(db: PrismaClient, userId: string) {
  return db.announcementView.deleteMany({ where: { userId } });
}

// ─── Preference Helpers ──────────────────────────────────────────────

/**
 * Get all preference categories with their options and sliders.
 */
export async function getAllPreferenceCategories(db: PrismaClient) {
  return db.preferenceCategory.findMany({
    include: {
      options: { orderBy: { order: 'asc' } },
      sliders: true,
    },
    orderBy: { order: 'asc' },
  });
}

/**
 * Create completed preference selections for a user.
 * `selections` is a map of category slug → array of option values to select.
 * `sliderValues` is a map of category slug → slider value (0-10).
 */
export async function seedPreferences(
  db: PrismaClient,
  userId: string,
  selections: Record<string, string[]>,
  sliderValues?: Record<string, number>,
) {
  // Delete existing preferences
  await db.userPreference.deleteMany({ where: { userId } });

  // Create the preference record
  const pref = await db.userPreference.create({
    data: {
      userId,
      completedAt: new Date(),
    },
  });

  // Get all categories with options
  const categories = await getAllPreferenceCategories(db);

  // Create selections
  for (const [slug, values] of Object.entries(selections)) {
    const category = categories.find((c) => c.slug === slug);
    if (!category) {
      console.warn(`⚠️ Category slug "${slug}" not found, skipping`);
      continue;
    }

    for (const value of values) {
      // Find option by value (search recursively for hierarchical options)
      const option = category.options.find((o) => o.value === value);
      if (!option) {
        console.warn(`⚠️ Option value "${value}" not found in category "${slug}", skipping`);
        continue;
      }

      await db.userPreferenceSelection.create({
        data: {
          userPreferenceId: pref.id,
          optionId: option.id,
        },
      });
    }
  }

  // Create slider values
  if (sliderValues) {
    for (const [slug, value] of Object.entries(sliderValues)) {
      const category = categories.find((c) => c.slug === slug);
      if (!category || category.sliders.length === 0) continue;

      for (const slider of category.sliders) {
        await db.userPreferenceSliderValue.create({
          data: {
            userPreferenceId: pref.id,
            sliderId: slider.id,
            value,
          },
        });
      }
    }
  }

  return pref;
}

// ─── Questionnaire Helpers ───────────────────────────────────────────

/**
 * Get the active questionnaire version with full structure.
 */
export async function getActiveVersion(db: PrismaClient) {
  return db.questionnaireVersion.findFirst({
    where: { isActive: true },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          subTopics: {
            orderBy: { order: 'asc' },
            include: {
              dimensions: {
                orderBy: { order: 'asc' },
                include: {
                  questions: {
                    orderBy: { order: 'asc' },
                    include: {
                      answerOptions: { orderBy: { order: 'asc' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Create a draft response snapshot (not yet submitted) with random answers.
 * If `skipLastQuestionOfLastTopic` is true, leaves the last question of the last topic unanswered.
 */
export async function seedDraftResponses(
  db: PrismaClient,
  userId: string,
  options?: {
    skipLastQuestionOfLastTopic?: boolean;
    preferenceSelections?: Record<string, string[]>; // needed for REPEAT mode
  },
) {
  const version = await getActiveVersion(db);
  if (!version) throw new Error('No active questionnaire version found');

  // Delete existing responses for this user
  await db.responseSnapshot.deleteMany({ where: { userId } });

  // Create draft snapshot (isSnapshot: false = not yet submitted)
  const snapshot = await db.responseSnapshot.create({
    data: {
      userId,
      versionId: version.id,
      isSnapshot: false,
      context: 'draft',
    },
  });

  const topics = version.topics;
  const lastTopicIdx = topics.length - 1;

  for (let ti = 0; ti < topics.length; ti++) {
    const topic = topics[ti];
    const isLastTopic = ti === lastTopicIdx;

    for (const subTopic of topic.subTopics) {
      const allQuestions = subTopic.dimensions.flatMap((d) => d.questions);
      const lastQuestionIdx = allQuestions.length - 1;

      for (let qi = 0; qi < allQuestions.length; qi++) {
        const question = allQuestions[qi];
        const isLastQuestion = qi === lastQuestionIdx;

        // Skip the last question of the last topic if requested
        if (options?.skipLastQuestionOfLastTopic && isLastTopic && isLastQuestion) {
          continue;
        }

        // Pick a random answer option
        const answerOptions = question.answerOptions;
        if (answerOptions.length === 0) continue;
        const randomOption = answerOptions[Math.floor(Math.random() * answerOptions.length)];

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

  return snapshot;
}

/**
 * Delete all response-related data for a user.
 */
export async function clearResponses(db: PrismaClient, userId: string) {
  return db.responseSnapshot.deleteMany({ where: { userId } });
}
