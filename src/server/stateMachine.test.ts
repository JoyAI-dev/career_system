import { describe, it, expect } from 'vitest';
import { validateTransition, getAvailableActions, getActionLabel, type TransitionAction } from './stateMachine';
import type { ActivityStatus, MemberRole } from '@prisma/client';

const ALL_STATUSES: ActivityStatus[] = ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];
const ALL_ACTIONS: TransitionAction[] = ['SCHEDULE', 'START', 'COMPLETE'];

describe('validateTransition', () => {
  describe('valid transitions', () => {
    it('allows FULL → SCHEDULED by LEADER via SCHEDULE', () => {
      const result = validateTransition('FULL', 'SCHEDULE', 'LEADER');
      expect(result).toEqual({ valid: true, to: 'SCHEDULED' });
    });

    it('allows SCHEDULED → IN_PROGRESS by LEADER via START', () => {
      const result = validateTransition('SCHEDULED', 'START', 'LEADER');
      expect(result).toEqual({ valid: true, to: 'IN_PROGRESS' });
    });

    it('allows IN_PROGRESS → COMPLETED by LEADER via COMPLETE', () => {
      const result = validateTransition('IN_PROGRESS', 'COMPLETE', 'LEADER');
      expect(result).toEqual({ valid: true, to: 'COMPLETED' });
    });
  });

  describe('invalid source status', () => {
    it('rejects SCHEDULE from OPEN', () => {
      const result = validateTransition('OPEN', 'SCHEDULE', 'LEADER');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('Cannot schedule');
    });

    it('rejects SCHEDULE from SCHEDULED', () => {
      const result = validateTransition('SCHEDULED', 'SCHEDULE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects SCHEDULE from IN_PROGRESS', () => {
      const result = validateTransition('IN_PROGRESS', 'SCHEDULE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects START from OPEN', () => {
      const result = validateTransition('OPEN', 'START', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects START from FULL', () => {
      const result = validateTransition('FULL', 'START', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects START from IN_PROGRESS', () => {
      const result = validateTransition('IN_PROGRESS', 'START', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects COMPLETE from OPEN', () => {
      const result = validateTransition('OPEN', 'COMPLETE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects COMPLETE from FULL', () => {
      const result = validateTransition('FULL', 'COMPLETE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects COMPLETE from SCHEDULED', () => {
      const result = validateTransition('SCHEDULED', 'COMPLETE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('rejects any action from COMPLETED (terminal state)', () => {
      for (const action of ALL_ACTIONS) {
        const result = validateTransition('COMPLETED', action, 'LEADER');
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('role enforcement', () => {
    it('rejects MEMBER trying to SCHEDULE', () => {
      const result = validateTransition('FULL', 'SCHEDULE', 'MEMBER');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('leader');
    });

    it('rejects MEMBER trying to START', () => {
      const result = validateTransition('SCHEDULED', 'START', 'MEMBER');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('leader');
    });

    it('rejects MEMBER trying to COMPLETE', () => {
      const result = validateTransition('IN_PROGRESS', 'COMPLETE', 'MEMBER');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain('leader');
    });

    it('rejects null role (non-member) for all valid transitions', () => {
      const validPairs: [ActivityStatus, TransitionAction][] = [
        ['FULL', 'SCHEDULE'],
        ['SCHEDULED', 'START'],
        ['IN_PROGRESS', 'COMPLETE'],
      ];
      for (const [status, action] of validPairs) {
        const result = validateTransition(status, action, null);
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.error).toContain('not a member');
      }
    });
  });

  describe('state skipping prevention', () => {
    it('cannot skip from FULL directly to IN_PROGRESS', () => {
      const result = validateTransition('FULL', 'START', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('cannot skip from FULL directly to COMPLETED', () => {
      const result = validateTransition('FULL', 'COMPLETE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('cannot skip from OPEN to SCHEDULED', () => {
      const result = validateTransition('OPEN', 'SCHEDULE', 'LEADER');
      expect(result.valid).toBe(false);
    });

    it('cannot skip from SCHEDULED to COMPLETED', () => {
      const result = validateTransition('SCHEDULED', 'COMPLETE', 'LEADER');
      expect(result.valid).toBe(false);
    });
  });

  describe('error message quality', () => {
    it('includes action name in invalid status error', () => {
      const result = validateTransition('OPEN', 'SCHEDULE', 'LEADER');
      if (!result.valid) {
        expect(result.error).toMatch(/schedule/i);
        expect(result.error).toMatch(/OPEN/);
      }
    });

    it('includes role name in permission error', () => {
      const result = validateTransition('FULL', 'SCHEDULE', 'MEMBER');
      if (!result.valid) {
        expect(result.error).toMatch(/leader/i);
      }
    });
  });

  describe('exhaustive transition matrix', () => {
    // Exactly 3 valid transitions exist; everything else is invalid
    it('has exactly 3 valid transitions in the entire matrix', () => {
      let validCount = 0;
      for (const status of ALL_STATUSES) {
        for (const action of ALL_ACTIONS) {
          const result = validateTransition(status, action, 'LEADER');
          if (result.valid) validCount++;
        }
      }
      expect(validCount).toBe(3);
    });
  });
});

describe('getAvailableActions', () => {
  it('returns SCHEDULE for LEADER in FULL status', () => {
    expect(getAvailableActions('FULL', 'LEADER')).toEqual(['SCHEDULE']);
  });

  it('returns START for LEADER in SCHEDULED status', () => {
    expect(getAvailableActions('SCHEDULED', 'LEADER')).toEqual(['START']);
  });

  it('returns COMPLETE for LEADER in IN_PROGRESS status', () => {
    expect(getAvailableActions('IN_PROGRESS', 'LEADER')).toEqual(['COMPLETE']);
  });

  it('returns empty for LEADER in OPEN status (auto-transition only)', () => {
    expect(getAvailableActions('OPEN', 'LEADER')).toEqual([]);
  });

  it('returns empty for LEADER in COMPLETED status (terminal)', () => {
    expect(getAvailableActions('COMPLETED', 'LEADER')).toEqual([]);
  });

  it('returns empty for MEMBER in every status', () => {
    for (const status of ALL_STATUSES) {
      expect(getAvailableActions(status, 'MEMBER')).toEqual([]);
    }
  });

  it('returns empty for non-member (null) in every status', () => {
    for (const status of ALL_STATUSES) {
      expect(getAvailableActions(status, null)).toEqual([]);
    }
  });

  it('each status has at most one available action for LEADER', () => {
    for (const status of ALL_STATUSES) {
      expect(getAvailableActions(status, 'LEADER').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('getActionLabel', () => {
  it('returns "Schedule Meeting" for SCHEDULE', () => {
    expect(getActionLabel('SCHEDULE')).toBe('Schedule Meeting');
  });

  it('returns "Start Meeting" for START', () => {
    expect(getActionLabel('START')).toBe('Start Meeting');
  });

  it('returns "Complete Meeting" for COMPLETE', () => {
    expect(getActionLabel('COMPLETE')).toBe('Complete Meeting');
  });
});

describe('Full lifecycle', () => {
  it('supports the complete happy path: FULL → SCHEDULED → IN_PROGRESS → COMPLETED', () => {
    let status: ActivityStatus = 'FULL';

    const r1 = validateTransition(status, 'SCHEDULE', 'LEADER');
    expect(r1.valid).toBe(true);
    if (r1.valid) status = r1.to;
    expect(status).toBe('SCHEDULED');

    const r2 = validateTransition(status, 'START', 'LEADER');
    expect(r2.valid).toBe(true);
    if (r2.valid) status = r2.to;
    expect(status).toBe('IN_PROGRESS');

    const r3 = validateTransition(status, 'COMPLETE', 'LEADER');
    expect(r3.valid).toBe(true);
    if (r3.valid) status = r3.to;
    expect(status).toBe('COMPLETED');

    // No more transitions from COMPLETED
    for (const action of ALL_ACTIONS) {
      expect(validateTransition(status, action, 'LEADER').valid).toBe(false);
    }
  });
});
