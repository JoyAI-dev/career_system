import { prisma } from '@/lib/db';
import { buildStudentIdPath, saveFile, deleteFile } from '@/lib/storage';
import { ocrStudentId } from '@/lib/zhipu-ocr';

export type UploadResult =
  | { success: true; ocrApplied: boolean }
  | { success: false; error: string };

export async function uploadStudentId(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const { relative: newFilePath } = buildStudentIdPath(userId, contentType);

  // Get previous file path before any changes
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { studentIdUrl: true },
  });
  const oldFilePath = user?.studentIdUrl ?? null;

  // Step 1: Save new file to local storage
  try {
    await saveFile(newFilePath, buffer);
  } catch (err) {
    console.error('File save failed:', err instanceof Error ? err.message : err);
    return { success: false, error: 'Upload failed. Please try again.' };
  }

  // Step 2: Update DB record — rollback file on failure
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { studentIdUrl: newFilePath },
    });
  } catch (dbError) {
    console.error(
      'DB update failed, rolling back upload:',
      dbError instanceof Error ? dbError.message : 'Unknown error',
    );
    await deleteFile(newFilePath);
    return { success: false, error: 'Upload failed. Please try again.' };
  }

  // Step 3: Best-effort delete old file (DB already updated)
  if (oldFilePath) {
    await deleteFile(oldFilePath).catch((err: unknown) => {
      console.error('Failed to delete old file (non-critical):', err);
    });
  }

  // Step 4: OCR recognition — best-effort, don't fail the upload
  // Only fill in fields that are currently empty (never overwrite manual edits)
  let ocrApplied = false;
  try {
    const info = await ocrStudentId(buffer, contentType);
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, school: true, major: true, grade: true },
    });
    const updates: Record<string, string> = {};
    if (info.name && !currentUser?.name) updates.name = info.name;
    if (info.school && !currentUser?.school) updates.school = info.school;
    if (info.major && !currentUser?.major) updates.major = info.major;
    if (info.grade && !currentUser?.grade) updates.grade = info.grade;

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updates,
      });
      ocrApplied = true;
      console.log(`[upload] OCR extracted for user ${userId}:`, updates);
    }
  } catch (ocrError) {
    console.error(
      '[upload] OCR failed (non-critical):',
      ocrError instanceof Error ? ocrError.message : ocrError,
    );
  }

  return { success: true, ocrApplied };
}
