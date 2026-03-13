'use server';

/**
 * Pairing Server Actions
 *
 * Authenticated endpoints for the pairing system.
 */

import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  createPairing,
  acceptPairing,
  dissolvePairing,
  autoPairGroup,
  getGroupPairingStatus,
} from '@/server/services/pairing';

/** Request to pair with another group member for an activity type */
export async function requestPairing(
  virtualGroupId: string,
  activityTypeId: string,
  partnerId: string,
) {
  try {
    const session = await requireAuth();
    const pairingId = await createPairing(
      virtualGroupId,
      activityTypeId,
      session.user.id,
      partnerId,
      session.user.id,
    );
    revalidatePath('/dashboard');
    revalidatePath('/activities');
    return { success: true, pairingId };
  } catch (error) {
    const message = error instanceof Error ? error.message : '配对请求失败';
    return { errors: { _form: [message] } };
  }
}

/** Accept a pairing request */
export async function acceptPairingRequest(pairingId: string) {
  try {
    const session = await requireAuth();
    await acceptPairing(pairingId, session.user.id);
    revalidatePath('/dashboard');
    revalidatePath('/activities');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '接受配对请求失败';
    return { errors: { _form: [message] } };
  }
}

/** Dissolve a pairing (leader only) */
export async function dissolvePairingAction(pairingId: string) {
  try {
    const session = await requireAuth();
    await dissolvePairing(pairingId, session.user.id);
    revalidatePath('/dashboard');
    revalidatePath('/activities');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '解散配对失败';
    return { errors: { _form: [message] } };
  }
}

/** Auto-pair all unpaired members (leader only) */
export async function autoPairGroupAction(
  virtualGroupId: string,
  activityTypeId: string,
) {
  try {
    const session = await requireAuth();
    await autoPairGroup(virtualGroupId, activityTypeId, session.user.id);
    revalidatePath('/dashboard');
    revalidatePath('/activities');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '自动配对失败';
    return { errors: { _form: [message] } };
  }
}

/** Get pairing status for a group and activity type */
export async function getPairingStatus(
  virtualGroupId: string,
  activityTypeId: string,
) {
  await requireAuth();
  return getGroupPairingStatus(virtualGroupId, activityTypeId);
}
