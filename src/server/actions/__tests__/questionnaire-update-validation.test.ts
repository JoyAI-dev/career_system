import { describe, it, expect } from 'vitest';

/**
 * Unit tests for questionnaire update activityId validation logic.
 * Tests pure business rules without hitting the database.
 */

// ─── Core Business Rule (extracted for testability) ─────────────────

type MembershipCheck = {
  exists: boolean;
  activityStatus?: string;
};

function canLinkActivityToUpdate(
  activityId: string | null,
  membership: MembershipCheck,
): { allowed: boolean; error?: string } {
  if (!activityId) {
    // No activity context — always allowed (standalone update)
    return { allowed: true };
  }
  if (!membership.exists) {
    return { allowed: false, error: 'You are not a member of this activity.' };
  }
  if (membership.activityStatus !== 'COMPLETED') {
    return {
      allowed: false,
      error: 'Activity must be completed before updating questionnaire.',
    };
  }
  return { allowed: true };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('canLinkActivityToUpdate', () => {
  it('allows update without activityId (standalone)', () => {
    const result = canLinkActivityToUpdate(null, { exists: false });
    expect(result.allowed).toBe(true);
  });

  it('rejects update with activityId user is not a member of', () => {
    const result = canLinkActivityToUpdate('activity-123', {
      exists: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('You are not a member of this activity.');
  });

  it('rejects update with activityId in OPEN status', () => {
    const result = canLinkActivityToUpdate('activity-123', {
      exists: true,
      activityStatus: 'OPEN',
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(
      'Activity must be completed before updating questionnaire.',
    );
  });

  it('rejects update with activityId in IN_PROGRESS status', () => {
    const result = canLinkActivityToUpdate('activity-123', {
      exists: true,
      activityStatus: 'IN_PROGRESS',
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(
      'Activity must be completed before updating questionnaire.',
    );
  });

  it('rejects update with activityId in SCHEDULED status', () => {
    const result = canLinkActivityToUpdate('activity-123', {
      exists: true,
      activityStatus: 'SCHEDULED',
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(
      'Activity must be completed before updating questionnaire.',
    );
  });

  it('rejects update with activityId in FULL status', () => {
    const result = canLinkActivityToUpdate('activity-123', {
      exists: true,
      activityStatus: 'FULL',
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBe(
      'Activity must be completed before updating questionnaire.',
    );
  });

  it('allows update with activityId in COMPLETED status and valid membership', () => {
    const result = canLinkActivityToUpdate('activity-123', {
      exists: true,
      activityStatus: 'COMPLETED',
    });
    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
