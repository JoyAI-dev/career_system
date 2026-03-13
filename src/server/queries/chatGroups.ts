import { prisma } from '@/lib/db';

export async function getUserChatGroups(userId: string) {
  // Get user's community memberships
  const communityMemberships = await prisma.communityMember.findMany({
    where: { userId },
    include: {
      community: {
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Get user's virtual group memberships
  const virtualGroupMemberships = await prisma.virtualGroupMember.findMany({
    where: { userId },
    include: {
      virtualGroup: {
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, name: true } },
            },
          },
          community: { select: { name: true } },
        },
      },
    },
  });

  const groups: {
    id: string;
    name: string;
    type: 'community' | 'virtualGroup';
    memberCount: number;
    members: { userId: string; username: string; name: string | null }[];
  }[] = [];

  // Add communities
  for (const cm of communityMemberships) {
    groups.push({
      id: cm.community.id,
      name: cm.community.name,
      type: 'community',
      memberCount: cm.community.memberCount,
      members: cm.community.members.map((m: { user: { id: string; username: string; name: string | null } }) => ({
        userId: m.user.id,
        username: m.user.username,
        name: m.user.name,
      })),
    });
  }

  // Add virtual groups
  for (const vgm of virtualGroupMemberships) {
    const vg = vgm.virtualGroup;
    groups.push({
      id: vg.id,
      name: vg.name || `${vg.community.name} - 小组`,
      type: 'virtualGroup',
      memberCount: vg.members.length,
      members: vg.members.map((m: { user: { id: string; username: string; name: string | null } }) => ({
        userId: m.user.id,
        username: m.user.username,
        name: m.user.name,
      })),
    });
  }

  return groups;
}
