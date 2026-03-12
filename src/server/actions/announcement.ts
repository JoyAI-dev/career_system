'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_PATH = '/admin/announcements';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  countdownSeconds: z.coerce.number().int().min(0).max(300).default(20),
});

export async function createAnnouncement(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    countdownSeconds: formData.get('countdownSeconds') || 20,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await prisma.announcement.create({
    data: parsed.data,
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateAnnouncement(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get('id') as string;
  if (!id) return { errors: { _form: ['Missing ID.'] } };

  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    countdownSeconds: formData.get('countdownSeconds') || 20,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await prisma.announcement.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteAnnouncement(id: string): Promise<ActionState> {
  await requireAdmin();
  await prisma.announcement.delete({ where: { id } });
  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function toggleAnnouncementActive(id: string): Promise<ActionState> {
  await requireAdmin();

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) return { errors: { _form: ['Announcement not found.'] } };

  if (announcement.isActive) {
    await prisma.announcement.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.$transaction([
      prisma.announcement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.announcement.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath('/dashboard');
  return { success: true };
}

export async function markAnnouncementViewed(announcementId: string): Promise<ActionState> {
  const session = await requireAuth();

  try {
    await prisma.announcementView.upsert({
      where: {
        userId_announcementId: {
          userId: session.user.id,
          announcementId,
        },
      },
      update: {},
      create: {
        userId: session.user.id,
        announcementId,
      },
    });
  } catch {
    // Table may not exist pre-migration
  }

  return { success: true };
}
