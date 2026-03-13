/**
 * UIQA Seed Script — Activity System Testing
 *
 * Creates 6 test users with identical preferences (same community),
 * each with a partial questionnaire draft (all questions answered except 1 random).
 *
 * Usage:
 *   DATABASE_URL="postgresql://career_staging:career_staging_2026@127.0.0.1:5432/career_staging" npx tsx prisma/seed-uiqa.ts
 *
 * After running:
 *   - Log in as testuser1..testuser6 (password: test123)
 *   - Each user will see the questionnaire with 1 unanswered question
 *   - Answer it and submit to trigger matchUserToFirstActivity
 */

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Configuration ────────────────────────────────────────────────────

const TEST_USERS = [
  { username: 'testuser1', name: 'Test User 1' },
  { username: 'testuser2', name: 'Test User 2' },
  { username: 'testuser3', name: 'Test User 3' },
  { username: 'testuser4', name: 'Test User 4' },
  { username: 'testuser5', name: 'Test User 5' },
  { username: 'testuser6', name: 'Test User 6' },
];
const TEST_PASSWORD = 'test123';

// Identical preference choices for all users so they land in the SAME community.
// One option per grouping-basis category (by slug → value):
const SHARED_PREFERENCES: Record<string, string[]> = {
  // Grouping-basis categories (determine community)
  'location': ['beijing'],
  'self-positioning': ['professional-manager', 'individual-contributor'], // parent auto-selected + child
  'development-direction': ['private-sector', 'enterprise'],            // parent auto-selected + child
  'industry': ['tech'],
  'platform-type': ['domestic'],
  'company-size': ['fortune500'],
  // Non-grouping categories (just pick first option)
  'culture-hierarchy': ['flat'],
  'culture-environment': ['corporate'],
  'training': ['management-training'],
  'work-schedule': ['965'],
  'vacation': ['10'],
  'healthcare-benefit': ['basic'],
  'fertility': ['fertility-check'],
};

// Slider values for the leadership-style category
const SHARED_SLIDER_VALUES: Record<string, number> = {
  '专制程度': 3,
  '民主程度': 7,
};

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('=== UIQA Activity System Seed Script ===\n');

  // 0. Verify prerequisites exist
  const activeVersion = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    select: { id: true, version: true },
  });
  if (!activeVersion) {
    throw new Error('No active questionnaire version found. Run `npm run db:seed` first.');
  }
  console.log(`Using questionnaire version ${activeVersion.version} (id: ${activeVersion.id})`);

  // ── Step 1: Create test users ────────────────────────────────────

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const userIds: string[] = [];

  for (const u of TEST_USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash, name: u.name },
      create: {
        username: u.username,
        passwordHash,
        name: u.name,
        role: 'USER',
      },
    });
    userIds.push(user.id);
    console.log(`  User: ${u.username} (id: ${user.id})`);
  }
  console.log(`Created/updated ${userIds.length} test users\n`);

  // ── Step 2: Load preference categories & options ─────────────────

  const categories = await prisma.preferenceCategory.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: {
      options: {
        where: { isActive: true },
        include: {
          children: { where: { isActive: true } },
        },
      },
      sliders: true,
    },
  });

  // Build lookup maps: optionValue → optionId, sliderLabel → sliderId
  const optionValueToId = new Map<string, string>();
  for (const cat of categories) {
    for (const opt of cat.options) {
      optionValueToId.set(`${cat.slug}:${opt.value}`, opt.id);
      for (const child of opt.children) {
        optionValueToId.set(`${cat.slug}:${child.value}`, child.id);
      }
    }
  }

  const sliderLabelToId = new Map<string, string>();
  for (const cat of categories) {
    for (const slider of cat.sliders) {
      sliderLabelToId.set(slider.label, slider.id);
    }
  }

  // Resolve option IDs for all users
  const allOptionIds: string[] = [];
  for (const cat of categories) {
    if (cat.inputType === 'SLIDER') continue;
    const values = SHARED_PREFERENCES[cat.slug];
    if (!values || values.length === 0) {
      throw new Error(`No preference values configured for category '${cat.slug}'`);
    }
    for (const val of values) {
      const key = `${cat.slug}:${val}`;
      const optId = optionValueToId.get(key);
      if (!optId) {
        throw new Error(`Preference option not found: ${key}. Run db:seed first.`);
      }
      allOptionIds.push(optId);
    }
  }

  // Resolve slider values
  const sliderData: { sliderId: string; value: number }[] = [];
  for (const [label, value] of Object.entries(SHARED_SLIDER_VALUES)) {
    const sliderId = sliderLabelToId.get(label);
    if (!sliderId) {
      throw new Error(`Slider not found: '${label}'. Run db:seed first.`);
    }
    sliderData.push({ sliderId, value });
  }

  console.log(`Resolved ${allOptionIds.length} option IDs + ${sliderData.length} slider values\n`);

  // ── Step 3: Submit preferences for all users ─────────────────────

  for (const userId of userIds) {
    // Clean up any existing preference for idempotency
    const existing = await prisma.userPreference.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) {
      await prisma.userPreference.delete({ where: { id: existing.id } });
    }

    // Create preference with selections
    await prisma.$transaction(async (tx) => {
      const pref = await tx.userPreference.create({
        data: {
          userId,
          completedAt: new Date(),
        },
      });

      if (allOptionIds.length > 0) {
        await tx.userPreferenceSelection.createMany({
          data: allOptionIds.map((optionId) => ({
            userPreferenceId: pref.id,
            optionId,
          })),
        });
      }

      if (sliderData.length > 0) {
        await tx.userPreferenceSliderValue.createMany({
          data: sliderData.map((sv) => ({
            userPreferenceId: pref.id,
            sliderId: sv.sliderId,
            value: sv.value,
          })),
        });
      }
    });
  }
  console.log('Submitted identical preferences for all 6 users');

  // ── Step 4: Compute communities ──────────────────────────────────

  // Import and use computeUserCommunities logic directly via Prisma
  // (the service function uses the singleton prisma, we replicate the logic here)
  const { createHash } = await import('crypto');

  function generateFingerprint(tags: { categoryId: string; optionId: string }[]): string {
    const sorted = [...tags].sort((a, b) => a.categoryId.localeCompare(b.categoryId));
    const key = sorted.map(t => `${t.categoryId}:${t.optionId}`).join('|');
    return createHash('sha256').update(key).digest('hex').slice(0, 32);
  }

  function generateCommunityName(tags: { label: string }[]): string {
    return tags.map(t => t.label).join(' \u00b7 ');
  }

  function cartesianProduct<T>(arrays: T[][]): T[][] {
    if (arrays.length === 0) return [[]];
    return arrays.reduce<T[][]>(
      (acc, arr) => acc.flatMap(combo => arr.map(item => [...combo, item])),
      [[]]
    );
  }

  // Compute effective values per grouping category (replicate from community.ts)
  const groupingCategories = categories.filter(c => c.isGroupingBasis);
  const selectedOptionIdSet = new Set(allOptionIds);

  interface TagCombo { categoryId: string; optionId: string; label: string; }

  function computeEffective(cat: typeof categories[0]): TagCombo[] {
    const results: TagCombo[] = [];
    if (cat.inputType === 'SINGLE_SELECT' || cat.inputType === 'MULTI_SELECT') {
      for (const opt of cat.options) {
        if (selectedOptionIdSet.has(opt.id)) {
          results.push({ categoryId: cat.id, optionId: opt.id, label: opt.label });
        }
      }
    } else if (cat.inputType === 'HIERARCHICAL_MULTI') {
      const matchLevel = cat.hierarchicalMatchLevel || 'PARENT';
      if (matchLevel === 'PARENT') {
        const seen = new Set<string>();
        for (const parentOpt of cat.options) {
          for (const child of parentOpt.children) {
            if (selectedOptionIdSet.has(child.id)) {
              if (parentOpt.isAutoSelected) {
                if (!seen.has(parentOpt.id)) {
                  seen.add(parentOpt.id);
                  results.push({ categoryId: cat.id, optionId: parentOpt.id, label: parentOpt.label });
                }
              } else {
                if (!seen.has(child.id)) {
                  seen.add(child.id);
                  results.push({ categoryId: cat.id, optionId: child.id, label: child.label });
                }
              }
            }
          }
          if (selectedOptionIdSet.has(parentOpt.id) && !parentOpt.isAutoSelected) {
            if (!seen.has(parentOpt.id)) {
              seen.add(parentOpt.id);
              results.push({ categoryId: cat.id, optionId: parentOpt.id, label: parentOpt.label });
            }
          }
        }
      }
    }
    return results;
  }

  const effectivePerCat: TagCombo[][] = [];
  for (const cat of groupingCategories) {
    const effective = computeEffective(cat);
    if (effective.length === 0) {
      throw new Error(`No effective values for grouping category '${cat.slug}'. Check preference config.`);
    }
    effectivePerCat.push(effective);
  }

  const combinations = cartesianProduct(effectivePerCat);
  console.log(`Computed ${combinations.length} community combination(s)`);

  // Create communities and add all users as members
  for (const combo of combinations) {
    const fingerprint = generateFingerprint(combo);
    const name = generateCommunityName(combo);

    let community = await prisma.community.findUnique({ where: { fingerprint } });
    if (!community) {
      community = await prisma.community.create({
        data: {
          fingerprint,
          name,
          memberCount: 0,
          tags: {
            create: combo.map(tag => ({
              categoryId: tag.categoryId,
              optionId: tag.optionId,
            })),
          },
        },
      });
    }

    // Add all test users as members
    for (const userId of userIds) {
      await prisma.communityMember.upsert({
        where: {
          communityId_userId: { communityId: community.id, userId },
        },
        update: {},
        create: { communityId: community.id, userId },
      });
    }

    // Update member count
    const count = await prisma.communityMember.count({
      where: { communityId: community.id },
    });
    await prisma.community.update({
      where: { id: community.id },
      data: { memberCount: count },
    });

    console.log(`  Community: "${name}" — ${count} members`);
  }
  console.log('');

  // ── Step 5: Create partial questionnaire drafts ──────────────────

  // Load ALL questions for the active questionnaire version, along with their answer options.
  // Questions are accessed via: Version → Topics → SubTopics → Dimensions → Questions
  const fullVersion = await prisma.questionnaireVersion.findUnique({
    where: { id: activeVersion.id },
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
                      answerOptions: {
                        orderBy: { order: 'asc' },
                      },
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

  if (!fullVersion) throw new Error('Failed to load full questionnaire version');

  // Flatten all questions
  type FlatQ = {
    questionId: string;
    firstOptionId: string;  // We'll pick the first answer option as default
    topicName: string;
    subTopicName: string;
    preferenceOptionId: string | null; // For REPEAT mode topics
    preferenceMode: string;
  };

  const allQuestions: FlatQ[] = [];

  for (const topic of fullVersion.topics) {
    for (const subTopic of topic.subTopics) {
      for (const dim of subTopic.dimensions) {
        for (const q of dim.questions) {
          if (q.answerOptions.length === 0) continue;

          if (topic.preferenceMode === 'REPEAT') {
            // For REPEAT topics, we need to create answers per user's preference selections.
            // The user selected cities (location category). Find which preference options apply.
            // For REPEAT mode, the topic links to a preferenceCategory.
            // The user's selected options in that category are the "instances".
            if (topic.preferenceCategoryId) {
              // Find user's selected options for this category
              const catOptions = categories.find(c => c.id === topic.preferenceCategoryId);
              if (catOptions) {
                const userSelectedInCat = allOptionIds.filter(oid => {
                  return catOptions.options.some(o => o.id === oid) ||
                    catOptions.options.some(o => o.children.some(c => c.id === oid));
                });
                for (const prefOptId of userSelectedInCat) {
                  allQuestions.push({
                    questionId: q.id,
                    firstOptionId: q.answerOptions[0].id,
                    topicName: topic.name,
                    subTopicName: subTopic.name,
                    preferenceOptionId: prefOptId,
                    preferenceMode: 'REPEAT',
                  });
                }
              }
            }
          } else if (topic.preferenceMode === 'FILTER') {
            // For FILTER mode, only include SubTopics whose preferenceOptionId matches user selections
            if (subTopic.preferenceOptionId) {
              if (selectedOptionIdSet.has(subTopic.preferenceOptionId)) {
                allQuestions.push({
                  questionId: q.id,
                  firstOptionId: q.answerOptions[0].id,
                  topicName: topic.name,
                  subTopicName: subTopic.name,
                  preferenceOptionId: null,
                  preferenceMode: 'FILTER',
                });
              }
            } else {
              // SubTopic without preference filter — include always
              allQuestions.push({
                questionId: q.id,
                firstOptionId: q.answerOptions[0].id,
                topicName: topic.name,
                subTopicName: subTopic.name,
                preferenceOptionId: null,
                preferenceMode: 'FILTER',
              });
            }
          } else {
            // CONTEXT mode: include all questions
            allQuestions.push({
              questionId: q.id,
              firstOptionId: q.answerOptions[0].id,
              topicName: topic.name,
              subTopicName: subTopic.name,
              preferenceOptionId: null,
              preferenceMode: 'CONTEXT',
            });
          }
        }
      }
    }
  }

  console.log(`Found ${allQuestions.length} total answerable questions for this user's preferences\n`);

  if (allQuestions.length < 6) {
    throw new Error(`Only ${allQuestions.length} questions found, need at least 6 (one to skip per user).`);
  }

  // Randomly pick 6 distinct indices to skip (one per user)
  const skipIndices = pickRandomDistinct(allQuestions.length, 6);

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const skipIdx = skipIndices[i];
    const skippedQ = allQuestions[skipIdx];

    // Clean up any existing draft snapshots for this user (idempotency)
    const existingDrafts = await prisma.responseSnapshot.findMany({
      where: { userId, isSnapshot: false },
      select: { id: true },
    });
    for (const draft of existingDrafts) {
      await prisma.responseAnswer.deleteMany({ where: { snapshotId: draft.id } });
      await prisma.responseSnapshot.delete({ where: { id: draft.id } });
    }

    // Create draft ResponseSnapshot (isSnapshot: false, context: 'draft')
    const draft = await prisma.responseSnapshot.create({
      data: {
        userId,
        versionId: activeVersion.id,
        context: 'draft',
        isSnapshot: false,
        completedAt: new Date(),
      },
    });

    // Create ResponseAnswer records for all questions EXCEPT the skipped one
    const answersToCreate = allQuestions
      .filter((_, idx) => idx !== skipIdx)
      .map((q) => ({
        snapshotId: draft.id,
        questionId: q.questionId,
        selectedOptionId: q.firstOptionId,
        preferenceOptionId: q.preferenceOptionId,
      }));

    await prisma.responseAnswer.createMany({ data: answersToCreate });

    console.log(
      `  ${TEST_USERS[i].username}: ${answersToCreate.length}/${allQuestions.length} answered, ` +
      `skipped question in "${skippedQ.topicName}" > "${skippedQ.subTopicName}" (mode: ${skippedQ.preferenceMode})`
    );
  }

  console.log('\n=== Seed complete! ===');
  console.log('\nHow to test:');
  console.log('  1. Log in as testuser1 (password: test123)');
  console.log('  2. Go to /questionnaire — you will see 1 unanswered question');
  console.log('  3. Answer it and click Submit');
  console.log('  4. This triggers matchUserToFirstActivity → user joins roundtable');
  console.log('  5. Repeat for testuser2..testuser6 to fill the 6-person roundtable');
}

// Pick `count` distinct random indices from [0, max)
function pickRandomDistinct(max: number, count: number): number[] {
  if (count > max) throw new Error(`Cannot pick ${count} distinct from ${max}`);
  const indices = new Set<number>();
  while (indices.size < count) {
    indices.add(Math.floor(Math.random() * max));
  }
  return [...indices];
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log('Database connections closed.');
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
