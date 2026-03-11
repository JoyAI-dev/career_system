import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const STUDENT_ID_BUCKET = 'student-ids';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

let _supabaseAdmin: SupabaseClient | null = null;

// Lazy initialization to avoid throwing during build when env vars are absent
function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return _supabaseAdmin;
}

export { getSupabaseAdmin as supabaseAdmin };

export function getStudentIdPath(userId: string): string {
  return `${userId}/${Date.now()}`;
}

export async function createSignedUrl(
  filePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(STUDENT_ID_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('Failed to create signed URL:', error.message);
    return null;
  }

  return data.signedUrl;
}
