import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Integration tests for activity join/leave concurrency.
 * Requires a running PostgreSQL database.
 * Run with: npm run test:integration
 *
 * These tests verify that SELECT FOR UPDATE prevents
 * oversubscription under concurrent join attempts.
 */

let pool: Pool;
let prisma: PrismaClient;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
});

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

// Helper: create a test activity type
async function createTestType(name: string) {
  return prisma.activityType.upsert({
    where: { name },
    update: {},
    create: { name, order: 0, defaultCapacity: 10, isEnabled: true },
  });
}

// Helper: create a test user
async function createTestUser(username: string) {
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash: 'test-hash', role: 'USER', name: username },
  });
}

// Helper: create an OPEN activity
async function createTestActivity(typeId: string, createdBy: string, capacity: number) {
  return prisma.activity.create({
    data: { typeId, title: `Test Activity ${Date.now()}`, capacity, createdBy, status: 'OPEN' },
  });
}

// Simulate the join logic (mirrors the server action's transactional logic)
async function simulateJoin(activityId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // Lock activity row
      const activities = await tx.$queryRaw<
        { id: string; capacity: number; status: string }[]
      >(Prisma.sql`SELECT id, capacity, status FROM activities WHERE id = ${activityId} FOR UPDATE`);

      if (activities.length === 0) throw new Error('Activity not found.');
      const activity = activities[0];
      if (activity.status !== 'OPEN') throw new Error('Activity is not open.');

      // Check duplicate
      const existing = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      if (existing) throw new Error('Already joined.');

      // Count members
      const count = await tx.membership.count({ where: { activityId } });
      if (count >= activity.capacity) throw new Error('Activity is full.');

      const role = count === 0 ? 'LEADER' : 'MEMBER';
      await tx.membership.create({ data: { activityId, userId, role } });

      if (count + 1 >= activity.capacity) {
        await tx.activity.update({ where: { id: activityId }, data: { status: 'FULL' } });
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

describe('Concurrent Join Tests', () => {
  let typeId: string;
  let creatorId: string;

  beforeAll(async () => {
    const type = await createTestType('ConcurrencyTestType');
    typeId = type.id;
    const creator = await createTestUser('concurrency-test-admin');
    creatorId = creator.id;
  });

  beforeEach(async () => {
    // Clean up test memberships and activities from previous runs
    await prisma.membership.deleteMany({
      where: { activity: { title: { startsWith: 'Test Activity' } } },
    });
    await prisma.activity.deleteMany({
      where: { title: { startsWith: 'Test Activity' } },
    });
  });

  it('exactly N users succeed when N simultaneous joins race for N spots', async () => {
    const CAPACITY = 6;
    const TOTAL_USERS = 10;

    // Create activity with capacity 6
    const activity = await createTestActivity(typeId, creatorId, CAPACITY);

    // Create 10 test users
    const users = await Promise.all(
      Array.from({ length: TOTAL_USERS }, (_, i) =>
        createTestUser(`concurrency-user-${i}-${Date.now()}`),
      ),
    );

    // Attempt 10 simultaneous joins
    const results = await Promise.all(
      users.map((user) => simulateJoin(activity.id, user.id)),
    );

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactly 6 should succeed
    expect(successes.length).toBe(CAPACITY);
    // Exactly 4 should fail
    expect(failures.length).toBe(TOTAL_USERS - CAPACITY);

    // Verify all failures are "full" errors
    for (const failure of failures) {
      expect(failure.error).toMatch(/full|not open/i);
    }

    // Verify actual member count in DB
    const memberCount = await prisma.membership.count({
      where: { activityId: activity.id },
    });
    expect(memberCount).toBe(CAPACITY);

    // Verify activity is FULL
    const updatedActivity = await prisma.activity.findUnique({
      where: { id: activity.id },
    });
    expect(updatedActivity?.status).toBe('FULL');

    // Verify exactly one LEADER
    const leaders = await prisma.membership.count({
      where: { activityId: activity.id, role: 'LEADER' },
    });
    expect(leaders).toBe(1);

    // Clean up test users
    for (const user of users) {
      await prisma.membership.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('prevents duplicate join by same user', async () => {
    const activity = await createTestActivity(typeId, creatorId, 10);
    const user = await createTestUser(`dup-test-${Date.now()}`);

    const first = await simulateJoin(activity.id, user.id);
    expect(first.success).toBe(true);

    const second = await simulateJoin(activity.id, user.id);
    expect(second.success).toBe(false);
    expect(second.error).toContain('Already joined');

    // Clean up
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('allows rejoin after leave when activity reverts to OPEN', async () => {
    const activity = await createTestActivity(typeId, creatorId, 1);
    const user1 = await createTestUser(`rejoin-user1-${Date.now()}`);
    const user2 = await createTestUser(`rejoin-user2-${Date.now()}`);

    // User1 joins → fills capacity → FULL
    const join1 = await simulateJoin(activity.id, user1.id);
    expect(join1.success).toBe(true);

    const act = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(act?.status).toBe('FULL');

    // User2 cannot join (FULL)
    const join2 = await simulateJoin(activity.id, user2.id);
    expect(join2.success).toBe(false);

    // User1 leaves
    await prisma.membership.deleteMany({ where: { activityId: activity.id, userId: user1.id } });
    await prisma.activity.update({ where: { id: activity.id }, data: { status: 'OPEN' } });

    // User2 can now join
    const join3 = await simulateJoin(activity.id, user2.id);
    expect(join3.success).toBe(true);

    // Clean up
    await prisma.membership.deleteMany({ where: { userId: user1.id } });
    await prisma.membership.deleteMany({ where: { userId: user2.id } });
    await prisma.user.delete({ where: { id: user1.id } });
    await prisma.user.delete({ where: { id: user2.id } });
  });

  it('first member gets LEADER role', async () => {
    const activity = await createTestActivity(typeId, creatorId, 5);
    const user = await createTestUser(`leader-test-${Date.now()}`);

    await simulateJoin(activity.id, user.id);

    const membership = await prisma.membership.findUnique({
      where: { activityId_userId: { activityId: activity.id, userId: user.id } },
    });
    expect(membership?.role).toBe('LEADER');

    // Clean up
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.membership.deleteMany({
      where: { activity: { title: { startsWith: 'Test Activity' } } },
    });
    await prisma.activity.deleteMany({
      where: { title: { startsWith: 'Test Activity' } },
    });
  });
});
