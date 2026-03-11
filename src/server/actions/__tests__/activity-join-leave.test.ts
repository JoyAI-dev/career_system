import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for join/leave activity logic.
 * Tests the core business rules without hitting the database.
 * The actual server actions use Prisma interactive transactions with
 * SELECT FOR UPDATE for concurrency safety.
 */

// Core business rules extracted for testability
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

describe('Join Activity Business Rules', () => {
  it('allows joining an open activity with available capacity', () => {
    const result = canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 3,
      capacity: 10,
      isAlreadyMember: false,
      isTypeUnlocked: true,
    });
    expect(result.allowed).toBe(true);
  });

  it('rejects joining a non-OPEN activity', () => {
    for (const status of ['FULL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']) {
      const result = canJoinActivity({
        activityStatus: status,
        currentMembers: 3,
        capacity: 10,
        isAlreadyMember: false,
        isTypeUnlocked: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Activity is not open for joining.');
    }
  });

  it('rejects joining when type is locked (prerequisite not completed)', () => {
    const result = canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 0,
      capacity: 10,
      isAlreadyMember: false,
      isTypeUnlocked: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('prerequisite');
  });

  it('rejects duplicate join', () => {
    const result = canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 3,
      capacity: 10,
      isAlreadyMember: true,
      isTypeUnlocked: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('already joined');
  });

  it('rejects joining when at capacity', () => {
    const result = canJoinActivity({
      activityStatus: 'OPEN',
      currentMembers: 10,
      capacity: 10,
      isAlreadyMember: false,
      isTypeUnlocked: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('Activity is full.');
  });
});

describe('Role Assignment', () => {
  it('assigns LEADER to first member', () => {
    expect(determineRole(0)).toBe('LEADER');
  });

  it('assigns MEMBER to subsequent members', () => {
    expect(determineRole(1)).toBe('MEMBER');
    expect(determineRole(5)).toBe('MEMBER');
  });
});

describe('Status Transitions', () => {
  it('transitions to FULL when capacity reached', () => {
    expect(shouldTransitionToFull(9, 10)).toBe(true);
  });

  it('does not transition to FULL when below capacity', () => {
    expect(shouldTransitionToFull(5, 10)).toBe(false);
  });

  it('transitions to FULL for capacity of 1', () => {
    expect(shouldTransitionToFull(0, 1)).toBe(true);
  });
});

describe('Leave Activity Business Rules', () => {
  it('allows member to leave', () => {
    const result = canLeaveActivity({
      isMember: true,
      role: 'MEMBER',
      totalMembers: 5,
    });
    expect(result.allowed).toBe(true);
  });

  it('rejects leaving if not a member', () => {
    const result = canLeaveActivity({
      isMember: false,
      role: 'MEMBER',
      totalMembers: 5,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('not a member');
  });

  it('prevents leader from leaving with other members present', () => {
    const result = canLeaveActivity({
      isMember: true,
      role: 'LEADER',
      totalMembers: 3,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('Leader cannot leave');
  });

  it('allows leader to leave if they are the only member', () => {
    const result = canLeaveActivity({
      isMember: true,
      role: 'LEADER',
      totalMembers: 1,
    });
    expect(result.allowed).toBe(true);
  });
});

describe('Revert Status on Leave', () => {
  it('reverts FULL to OPEN when member leaves', () => {
    expect(shouldRevertToOpen('FULL')).toBe(true);
  });

  it('does not revert OPEN status', () => {
    expect(shouldRevertToOpen('OPEN')).toBe(false);
  });

  it('does not revert SCHEDULED status', () => {
    expect(shouldRevertToOpen('SCHEDULED')).toBe(false);
  });
});
