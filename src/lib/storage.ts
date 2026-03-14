import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Local file storage utility.
 *
 * Root data directory: /var/lib/career_system (production) or .data (development).
 * Override with DATA_DIR environment variable.
 *
 * Directory layout:
 *   {DATA_DIR}/
 *     uploads/
 *       student-ids/{userId}/{timestamp}.{ext}
 *       ... (future upload categories go here)
 *
 * IMPORTANT: Never store files directly in DATA_DIR root.
 * Always use a subdirectory under uploads/ for each file category.
 */

const PROJECT_ROOT = path.resolve(process.cwd());

export function getDataDir(): string {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }
  return process.env.NODE_ENV === 'production'
    ? '/var/lib/career_system'
    : path.join(PROJECT_ROOT, '.data');
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/** Meeting minutes: broad set of allowed MIME types */
export const MEETING_MINUTES_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/json',
  'text/yaml',
  'application/x-yaml',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MEETING_MINUTES_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Build the on-disk path for a student ID image.
 * Returns both the relative path (stored in DB) and the absolute path.
 */
export function buildStudentIdPath(
  userId: string,
  mimeType: string,
): { relative: string; absolute: string } {
  const ext = MIME_TO_EXT[mimeType] || 'bin';
  const relative = `uploads/student-ids/${userId}/${Date.now()}.${ext}`;
  const absolute = path.join(getDataDir(), relative);
  return { relative, absolute };
}

/**
 * Save a buffer to the data directory.
 * Creates parent directories as needed.
 */
export async function saveFile(relativePath: string, buffer: Buffer): Promise<void> {
  const absolute = path.join(getDataDir(), relativePath);
  await ensureDir(path.dirname(absolute));
  await fs.writeFile(absolute, buffer);
}

/**
 * Read a file from the data directory.
 * Returns null if file does not exist.
 */
export async function readFile(relativePath: string): Promise<Buffer | null> {
  const absolute = path.join(getDataDir(), relativePath);
  try {
    return await fs.readFile(absolute);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Delete a file from the data directory.
 * Silently ignores missing files.
 */
export async function deleteFile(relativePath: string): Promise<void> {
  const absolute = path.join(getDataDir(), relativePath);
  try {
    await fs.unlink(absolute);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Resolve a relative storage path to its absolute path on disk.
 */
export function resolveAbsolute(relativePath: string): string {
  return path.join(getDataDir(), relativePath);
}

/**
 * Get the MIME type from a file extension.
 */
export function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    json: 'application/json',
    yaml: 'text/yaml',
    yml: 'text/yaml',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Sanitize a file name: remove path separators, null bytes, and limit length.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, '_')      // Remove path separators
    .replace(/\.\./g, '_')       // Remove parent-dir traversals
    .replace(/\0/g, '')          // Remove null bytes
    .replace(/[<>:"|?*]/g, '_')  // Remove Windows-unsafe chars
    .slice(0, 200);              // Limit length
}

/**
 * Build the on-disk path for a meeting minutes file.
 * Returns both the relative path (stored in DB) and the absolute path.
 */
export function buildMeetingMinutesPath(
  activityId: string,
  fileName: string,
): { relative: string; absolute: string } {
  const sanitized = sanitizeFileName(fileName);
  const timestampedName = `${Date.now()}_${sanitized}`;
  const relative = `uploads/meeting-minutes/${activityId}/${timestampedName}`;
  const absolute = path.join(getDataDir(), relative);
  return { relative, absolute };
}
