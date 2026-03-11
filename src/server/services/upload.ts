import { prisma } from '@/lib/db';
import {
  supabaseAdmin,
  STUDENT_ID_BUCKET,
  getStudentIdPath,
} from '@/lib/supabase';

export type UploadResult =
  | { success: true }
  | { success: false; error: string };

export async function uploadStudentId(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const newFilePath = getStudentIdPath(userId);

  // Get previous file path before any changes
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studentIdUrl: true },
  });
  const oldFilePath = user?.studentIdUrl ?? null;

  // Step 1: Upload new file first (old file preserved)
  const { error: uploadError } = await supabaseAdmin()
    .storage.from(STUDENT_ID_BUCKET)
    .upload(newFilePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload failed:', uploadError.message);
    return { success: false, error: 'Upload failed. Please try again.' };
  }

  // Step 2: Update DB record — rollback new file on failure
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { studentIdUrl: newFilePath },
    });
  } catch (dbError) {
    // Rollback: delete the newly uploaded file
    console.error('DB update failed, rolling back upload:', dbError instanceof Error ? dbError.message : 'Unknown error');
    await supabaseAdmin()
      .storage.from(STUDENT_ID_BUCKET)
      .remove([newFilePath]);
    return { success: false, error: 'Upload failed. Please try again.' };
  }

  // Step 3: Best-effort delete old file (DB already updated)
  if (oldFilePath) {
    await supabaseAdmin()
      .storage.from(STUDENT_ID_BUCKET)
      .remove([oldFilePath])
      .catch((err: unknown) => {
        console.error('Failed to delete old file (non-critical):', err);
      });
  }

  return { success: true };
}
