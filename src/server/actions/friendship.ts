'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createNotification } from '@/server/notifications';

export async function sendFriendRequest(addresseeId: string) {
  const session = await requireAuth();
  const userId = session.user.id;
  const username = session.user.username;

  if (userId === addresseeId) {
    return { error: '不能添加自己为好友' };
  }

  // Check if friendship already exists (in either direction)
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId },
        { requesterId: addresseeId, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      return { error: '你们已经是好友了' };
    }
    if (existing.status === 'BLOCKED') {
      return { error: '无法发送好友请求' };
    }
    if (existing.status === 'PENDING') {
      // If the other person already sent us a request, auto-accept
      if (existing.requesterId === addresseeId) {
        await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
        await createNotification({
          userId: addresseeId,
          type: 'FRIEND_ACCEPTED',
          title: '好友请求已接受',
          message: `${username} 接受了你的好友请求`,
        });
        revalidatePath('/');
        return { success: true, autoAccepted: true };
      }
      return { error: '好友请求已发送，等待对方回复' };
    }
    // REJECTED - check if we can retry
    if (existing.status === 'REJECTED' && existing.requesterId === userId) {
      if (existing.rejectionCount >= 3) {
        return { error: '对方已多次拒绝，无法再次添加' };
      }
      // Reset to pending
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      });
      await createNotification({
        userId: addresseeId,
        type: 'FRIEND_REQUEST',
        title: '新的好友请求',
        message: `${username} 想添加你为好友`,
      });
      revalidatePath('/');
      return { success: true };
    }
  }

  // Create new friendship request
  await prisma.friendship.create({
    data: {
      requesterId: userId,
      addresseeId,
      status: 'PENDING',
    },
  });

  await createNotification({
    userId: addresseeId,
    type: 'FRIEND_REQUEST',
    title: '新的好友请求',
    message: `${username} 想添加你为好友`,
  });

  revalidatePath('/');
  return { success: true };
}

export async function acceptFriendRequest(friendshipId: string) {
  const session = await requireAuth();
  const userId = session.user.id;
  const username = session.user.username;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
    include: { requester: { select: { username: true } } },
  });

  if (!friendship || friendship.addresseeId !== userId) {
    return { error: '好友请求不存在' };
  }

  if (friendship.status !== 'PENDING') {
    return { error: '该请求已处理' };
  }

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: 'ACCEPTED' },
  });

  await createNotification({
    userId: friendship.requesterId,
    type: 'FRIEND_ACCEPTED',
    title: '好友请求已接受',
    message: `${username} 接受了你的好友请求`,
  });

  revalidatePath('/');
  return { success: true };
}

export async function rejectFriendRequest(friendshipId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.addresseeId !== userId) {
    return { error: '好友请求不存在' };
  }

  if (friendship.status !== 'PENDING') {
    return { error: '该请求已处理' };
  }

  const newCount = friendship.rejectionCount + 1;

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: {
      status: newCount >= 3 ? 'BLOCKED' : 'REJECTED',
      rejectionCount: newCount,
    },
  });

  revalidatePath('/');
  return { success: true };
}

export async function removeFriend(friendshipId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.addresseeId !== userId)
  ) {
    return { error: '好友关系不存在' };
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath('/');
  return { success: true };
}

export async function getFriendshipStatus(otherUserId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: otherUserId },
        { requesterId: otherUserId, addresseeId: userId },
      ],
    },
  });

  if (!friendship) return { status: 'NONE' as const };

  return {
    status: friendship.status,
    friendshipId: friendship.id,
    isRequester: friendship.requesterId === userId,
  };
}
