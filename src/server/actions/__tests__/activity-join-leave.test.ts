import { describe, it, expect } from 'vitest';

/**
 * Comprehensive unit tests for join/leave activity business rules.
 * Tests pure logic without hitting the database.
 * The actual server actions use Prisma interactive transactions with
 * SELECT FOR UPDATE for concurrency safety.
 */

// ─── Core Business Rules (extracted for testability) ────────────────

function canJoinActivity(params: {
  activityStatus: string;
  currentMembers: number;
  capacity: number;
  isAlreadyMember: boolean;
  isTypeUnlocked: boolean;
}): { allowed: boolean; error?: string } {
  if (params.activityStatus !== 'OPEN') {
    return { allowed: false, error: 'Activity is not open for joining.' };
  }
  if (!params.isTypeUnlocked) {
    return { allowed: false, error: 'You have not completed the prerequisite activity type.' };
  }
  if (params.isAlreadyMember) {
    return { allowed: false, error: 'You have already joined this activity.' };
  }
  if (params.currentMembers >= params.capacity) {
    return { allowed: false, error: 'Activity is full.' };
  }
  return { allowed: true };
}

function determineRole(currentMembers: number): 'LEADER' | 'MEMBER' {
  return currentMembers === 0 ? 'LEADER' : 'MEMBER';
}

function shouldTransitionToFull(currentMembers: number, capacity: number): boolean {
  return currentMembers + 1 >= capacity;
}

function canLeaveActivity(params: {
  isMember: boolean;
  role: string;
  totalMembers: number;
}): { allowed: boolean; error?: string } {
  if (!params.isMember) {
    return { allowed: false, error: 'You are not a member of this activity.' };
  }
  if (params.role === 'LEADER' && params.totalMembers > 1) {
    return { allowed: false, error: 'Leader cannot leave while other members remain. Transfer leadership first.' };
  }
  return { allowed: true };
}

function shouldRevertToOpen(activityStatus: string): boolean {
  return activityStatus === 'FULL';
}

/**
 * Progressive unlock: a type is unlocked if it has no prerequisite,
 * or the user has completed an activity of the prerequisite type.
 */
function isTypeUnlocked(
  typeId: string,
  types: { id: string; prerequisiteTypeId: string | null }[],
  completedTypeIds: Set<string>,
): boolean {
  const type = types.find((t) => t.id === typeId);
  if (!type) return false;
  if (!type.prerequisiteTypeId) return true;
  return completedTypeIds.has(type.prerequisiteTypeId);
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Join Activity Business Rules', () => {
  const defaultParams = {
    activityStatus: 'OPEN',
    currentMembers: 3,
    capacity: 10,
    isAlreadyMember: false,
    isTypeUnlocked: true,
  };

  it('allows joining an open activity with available capacity', () => {
    const result = canJoinActivity(defaultParams);
    expect(result.allowed).toBe(true);
  });

  it('allows joining when exactly one spot remains', () => {
    const result = canJoinActivity({ ...defaultParams, currentMembers: 9 });
    expect(result.allowed).toBe(true);
  });

  it('allows joining an empty activity', () => {
    const result = canJoinActivity({ ...defaultParams, currentMembers: 0 });
    expect(result.allowed).toBe(true);
  });

  describe('status checks', () => {
    for (const status of ['FULL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']) {
      it(`rejects joining a ${status} activity`, () => {
        const result = canJoinActivity({ ...defaultParams, activityStatus: status });
        expect(result.allowed).toBe(false);
        expect(result.error).toBe('Activity is not open for joining.');
      });
    }
  });

  it('rejects joining when type is locked (prerequisite not completed)', () => {
    const result = canJoinActivity({ ...defaultParams, isTypeUnlocked: false });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('prerequisite');
  });

  it('rejects duplicate join', () => {
    const result = canJoinActivity({ ...defaultParams, isAlreadyMember: true });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('already joined');
  });

  it('rejects joining when at capacity', () => {
    const result = canJoinActivity({ ...defaultParams, currentMembers: 10 });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('Activity is full.');
  });

  it('rejects joining when over capacity (edge case)', () => {
    const result = canJoinActivity({ ...defaultParams, currentMembers: 11 });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('Activity is full.');
  });

  it('checks status before type unlock (short-circuit order)', () => {
    const result = canJoinActivity({
      ...defaultParams,
      activityStatus: 'FULL',
      isTypeUnlocked: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('Activity is not open for joining.');
  });
});

describe('Role Assignment', () => {
  it('assigns LEADER to first member (0 existing)', () => {
    expect(determineRole(0)).toBe('LEADER');
  });

  it('assigns MEMBER to second member', () => {
    expect(determineRole(1)).toBe('MEMBER');
  });

  it('assigns MEMBER to nth member', () => {
    expect(determineRole(5)).toBe('MEMBER');
    expect(determineRole(99)).toBe('MEMBER');
  });
});

describe('OPEN → FULL Status Transition', () => {
  it('transitions to FULL when last spot is filled (capacity 10, 9 members)', () => {
    expect(shouldTransitionToFull(9, 10)).toBe(true);
  });

  it('does not transition when below capacity', () => {
    expect(shouldTransitionToFull(5, 10)).toBe(false);
    expect(shouldTransitionToFull(0, 10)).toBe(false);
    expect(shouldTransitionToFull(8, 10)).toBe(false);
  });

  it('transitions for capacity of 1 (single member fills it)', () => {
    expect(shouldTransitionToFull(0, 1)).toBe(true);
  });

  it('transitions for capacity of 2', () => {
    expect(shouldTransitionToFull(0, 2)).toBe(false);
    expect(shouldTransitionToFull(1, 2)).toBe(true);
  });
});

describe('Leave Activity Business Rules', () => {
  it('allows regular member to leave', () => {
    const result = canLeaveActivity({ isMember: true, role: 'MEMBER', totalMembers: 5 });
    expect(result.allowed).toBe(true);
  });

  it('rejects leaving if not a member', () => {
    const result = canLeaveActivity({ isMember: false, role: 'MEMBER', totalMembers: 5 });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('not a member');
  });

  it('prevents leader from leaving with other members present', () => {
    const result = canLeaveActivity({ isMember: true, role: 'LEADER', totalMembers: 3 });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Leader cannot leave');
  });

  it('prevents leader from leaving with exactly 2 members', () => {
    const result = canLeaveActivity({ isMember: true, role: 'LEADER', totalMembers: 2 });
    expect(result.allowed).toBe(false);
  });

  it('allows leader to leave as the only member', () => {
    const result = canLeaveActivity({ isMember: true, role: 'LEADER', totalMembers: 1 });
    expect(result.allowed).toBe(true);
  });
});

describe('FULL → OPEN Revert on Leave', () => {
  it('reverts FULL to OPEN when member leaves', () => {
    expect(shouldRevertToOpen('FULL')).toBe(true);
  });

  it('does not revert OPEN status', () => {
    expect(shouldRevertToOpen('OPEN')).toBe(false);
  });

  it('does not revert SCHEDULED status', () => {
    expect(shouldRevertToOpen('SCHEDULED')).toBe(false);
  });

  it('does not revert IN_PROGRESS status', () => {
    expect(shouldRevertToOpen('IN_PROGRESS')).toBe(false);
  });

  it('does not revert COMPLETED status', () => {
    expect(shouldRevertToOpen('COMPLETED')).toBe(false);
  });
});

describe('Progressive Unlock Logic', () => {
  // Simulated type chain: Type A (no prereq) → Type B (requires A) → Type C (requires B)
  const types = [
    { id: 'typeA', prerequisiteTypeId: null },
    { id: 'typeB', prerequisiteTypeId: 'typeA' },
    { id: 'typeC', prerequisiteTypeId: 'typeB' },
  ];

  it('unlocks type with no prerequisite', () => {
    expect(isTypeUnlocked('typeA', types, new Set())).toBe(true);
  });

  it('locks type when prerequisite not completed', () => {
    expect(isTypeUnlocked('typeB', types, new Set())).toBe(false);
  });

  it('unlocks type when prerequisite completed', () => {
    expect(isTypeUnlocked('typeB', types, new Set(['typeA']))).toBe(true);
  });

  it('locks type C when only type A completed (chain)', () => {
    expect(isTypeUnlocked('typeC', types, new Set(['typeA']))).toBe(false);
  });

  it('unlocks type C when type B completed', () => {
    expect(isTypeUnlocked('typeC', types, new Set(['typeB']))).toBe(true);
  });

  it('unlocks type C when both A and B completed', () => {
    expect(isTypeUnlocked('typeC', types, new Set(['typeA', 'typeB']))).toBe(true);
  });

  it('returns false for unknown type ID', () => {
    expect(isTypeUnlocked('unknown', types, new Set())).toBe(false);
  });

  it('handles empty types array', () => {
    expect(isTypeUnlocked('typeA', [], new Set())).toBe(false);
  });

  it('handles single type with no prereq', () => {
    const singleType = [{ id: 'solo', prerequisiteTypeId: null }];
    expect(isTypeUnlocked('solo', singleType, new Set())).toBe(true);
  });
});

describe('End-to-End Join/Leave Scenarios', () => {
  it('simulates first member joining empty activity', () => {
    // Verify can join
    expect(canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 0,
      capacity: 6,
      isAlreadyMember: false,
      isTypeUnlocked: true,
    }).allowed).toBe(true);

    // First member is LEADER
    expect(determineRole(0)).toBe('LEADER');

    // Not at capacity yet
    expect(shouldTransitionToFull(0, 6)).toBe(false);
  });

  it('simulates capacity-filling join', () => {
    // 5 of 6 spots filled
    expect(canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 5,
      capacity: 6,
      isAlreadyMember: false,
      isTypeUnlocked: true,
    }).allowed).toBe(true);

    // 6th member is MEMBER not LEADER
    expect(determineRole(5)).toBe('MEMBER');

    // Should transition to FULL
    expect(shouldTransitionToFull(5, 6)).toBe(true);
  });

  it('simulates leave-and-rejoin flow', () => {
    // Activity is FULL with 6 members
    // Member leaves → should revert to OPEN
    expect(shouldRevertToOpen('FULL')).toBe(true);

    // Now at 5/6, new member can join
    expect(canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 5,
      capacity: 6,
      isAlreadyMember: false,
      isTypeUnlocked: true,
    }).allowed).toBe(true);

    // Fills again
    expect(shouldTransitionToFull(5, 6)).toBe(true);
  });
});
