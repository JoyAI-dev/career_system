import { prisma } from '@/lib/db';
import { createSignedUrl } from '@/lib/supabase';

export type SignedUrlResult =
  | { success: true; url: string }
  | { success: false; error: string; status: 404 | 500 };

export async function getStudentIdSignedUrl(
  userId: string,
): Promise<SignedUrlResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studentIdUrl: true },
  });

  if (!user?.studentIdUrl) {
    return { success: false, error: 'No student ID uploaded', status: 404 };
  }

  const signedUrl = await createSignedUrl(user.studentIdUrl, 3600);

  if (!signedUrl) {
    return { success: false, error: 'Failed to generate viewing URL', status: 500 };
  }

  return { success: true, url: signedUrl };
}
