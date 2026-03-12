import path from 'node:path';
import { prisma } from '@/lib/db';

export type StudentIdUrlResult =
  | { success: true; url: string }
  | { success: false; error: string; status: 404 | 500 };

/**
 * Get the API URL for viewing a user's student ID image.
 * The file is served via /api/files/student-ids/[userId]/[filename].
 */
export async function getStudentIdUrl(
  userId: string,
): Promise<StudentIdUrlResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studentIdUrl: true },
  });

  if (!user?.studentIdUrl) {
    return { success: false, error: 'No student ID uploaded', status: 404 };
  }

  // studentIdUrl is stored as relative path: "uploads/student-ids/{userId}/{filename}"
  const filename = path.basename(user.studentIdUrl);
  const url = `/api/files/student-ids/${userId}/${filename}`;

  return { success: true, url };
}
