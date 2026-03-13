import { prisma } from '@/lib/db';

export async function getUserFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId },
        { addresseeId: userId },
      ],
    },
    include: {
      requester: { select: { id: true, username: true, name: true } },
      addressee: { select: { id: true, username: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  type FriendUser = { id: string; username: string; name: string | null };
  return friendships.map((f: { id: string; requesterId: string; addresseeId: string; requester: FriendUser; addressee: FriendUser }) => {
    const friend = f.requesterId === userId ? f.addressee : f.requester;
    return {
      friendshipId: f.id,
      userId: friend.id,
      username: friend.username,
      name: friend.name,
    };
  });
}

export async function getPendingFriendRequests(userId: string) {
  return prisma.friendship.findMany({
    where: {
      addresseeId: userId,
      status: 'PENDING',
    },
    include: {
      requester: { select: { id: true, username: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFriendshipBetween(userId1: string, userId2: string) {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId1, addresseeId: userId2 },
        { requesterId: userId2, addresseeId: userId1 },
      ],
    },
  });
}

export async function getUserFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId },
        { addresseeId: userId },
      ],
    },
    select: {
      requesterId: true,
      addresseeId: true,
    },
  });

  return friendships.map((f: { requesterId: string; addresseeId: string }) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId,
  );
}
