import { describe, it, expect } from 'vitest';
import { validateTransition, getAvailableActions, getActionLabel } from './stateMachine';
import type { ActivityStatus, MemberRole } from '@prisma/client';

describe('validateTransition', () => {
  // Valid transitions
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

  // Invalid: wrong status
  it('rejects SCHEDULE from OPEN', () => {
    const result = validateTransition('OPEN', 'SCHEDULE', 'LEADER');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Cannot schedule');
  });

  it('rejects START from FULL', () => {
    const result = validateTransition('FULL', 'START', 'LEADER');
    expect(result.valid).toBe(false);
  });

  it('rejects COMPLETE from SCHEDULED', () => {
    const result = validateTransition('SCHEDULED', 'COMPLETE', 'LEADER');
    expect(result.valid).toBe(false);
  });

  it('rejects any action from COMPLETED', () => {
    for (const action of ['SCHEDULE', 'START', 'COMPLETE'] as const) {
      const result = validateTransition('COMPLETED', action, 'LEADER');
      expect(result.valid).toBe(false);
    }
  });

  // Invalid: wrong role
  it('rejects MEMBER trying to SCHEDULE', () => {
    const result = validateTransition('FULL', 'SCHEDULE', 'MEMBER');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('leader');
  });

  it('rejects MEMBER trying to START', () => {
    const result = validateTransition('SCHEDULED', 'START', 'MEMBER');
    expect(result.valid).toBe(false);
  });

  it('rejects MEMBER trying to COMPLETE', () => {
    const result = validateTransition('IN_PROGRESS', 'COMPLETE', 'MEMBER');
    expect(result.valid).toBe(false);
  });

  // Invalid: no membership
  it('rejects null role (non-member)', () => {
    const result = validateTransition('FULL', 'SCHEDULE', null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('not a member');
  });

  // Cannot skip states
  it('rejects skipping from FULL to IN_PROGRESS', () => {
    const result = validateTransition('FULL', 'START', 'LEADER');
    expect(result.valid).toBe(false);
  });

  it('rejects skipping from FULL to COMPLETED', () => {
    const result = validateTransition('FULL', 'COMPLETE', 'LEADER');
    expect(result.valid).toBe(false);
  });

  it('rejects skipping from OPEN to SCHEDULED', () => {
    const result = validateTransition('OPEN', 'SCHEDULE', 'LEADER');
    expect(result.valid).toBe(false);
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

  it('returns empty for MEMBER in any status', () => {
    for (const status of ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] as ActivityStatus[]) {
      expect(getAvailableActions(status, 'MEMBER')).toEqual([]);
    }
  });

  it('returns empty for non-member (null)', () => {
    expect(getAvailableActions('FULL', null)).toEqual([]);
  });

  it('returns empty for OPEN status (no manual transitions)', () => {
    expect(getAvailableActions('OPEN', 'LEADER')).toEqual([]);
  });

  it('returns empty for COMPLETED status', () => {
    expect(getAvailableActions('COMPLETED', 'LEADER')).toEqual([]);
  });
});

describe('getActionLabel', () => {
  it('returns correct labels', () => {
    expect(getActionLabel('SCHEDULE')).toBe('Schedule Meeting');
    expect(getActionLabel('START')).toBe('Start Meeting');
    expect(getActionLabel('COMPLETE')).toBe('Complete Meeting');
  });
});
