import type { ActivityStatus, MemberRole } from '@prisma/client';

export type TransitionAction =
  | 'SCHEDULE'
  | 'START'
  | 'COMPLETE';

type TransitionDef = {
  from: ActivityStatus;
  to: ActivityStatus;
  requiredRole: MemberRole;
  action: TransitionAction;
};

/**
 * Activity state machine transitions.
 * OPEN → FULL is handled automatically by join logic (not a manual transition).
 * FULL → SCHEDULED: leader confirms time/location
 * SCHEDULED → IN_PROGRESS: leader starts the meeting
 * IN_PROGRESS → COMPLETED: leader marks complete
 */
const TRANSITIONS: TransitionDef[] = [
  { from: 'FULL', to: 'SCHEDULED', requiredRole: 'LEADER', action: 'SCHEDULE' },
  { from: 'SCHEDULED', to: 'IN_PROGRESS', requiredRole: 'LEADER', action: 'START' },
  { from: 'IN_PROGRESS', to: 'COMPLETED', requiredRole: 'LEADER', action: 'COMPLETE' },
];

export type TransitionResult =
  | { valid: true; to: ActivityStatus }
  | { valid: false; error: string };

/**
 * Validate whether a state transition is allowed.
 */
export function validateTransition(
  currentStatus: ActivityStatus,
  action: TransitionAction,
  userRole: MemberRole | null,
): TransitionResult {
  const transition = TRANSITIONS.find(
    (t) => t.from === currentStatus && t.action === action,
  );

  if (!transition) {
    return {
      valid: false,
      error: `Cannot ${action.toLowerCase()} from ${currentStatus} status.`,
    };
  }

  if (!userRole) {
    return { valid: false, error: 'You are not a member of this activity.' };
  }

  if (userRole !== transition.requiredRole) {
    return {
      valid: false,
      error: `Only the ${transition.requiredRole.toLowerCase()} can ${action.toLowerCase()} this activity.`,
    };
  }

  return { valid: true, to: transition.to };
}

/**
 * Get available actions for a user based on activity status and their role.
 */
export function getAvailableActions(
  currentStatus: ActivityStatus,
  userRole: MemberRole | null,
): TransitionAction[] {
  if (!userRole) return [];

  return TRANSITIONS
    .filter((t) => t.from === currentStatus && t.requiredRole === userRole)
    .map((t) => t.action);
}

/**
 * Get the human-readable label for a transition action.
 */
export function getActionLabel(action: TransitionAction): string {
  switch (action) {
    case 'SCHEDULE':
      return 'Schedule Meeting';
    case 'START':
      return 'Start Meeting';
    case 'COMPLETE':
      return 'Complete Meeting';
  }
}
