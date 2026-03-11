import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/supabase';
import { uploadStudentId } from '@/server/services/upload';
import { mapErrorToResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 },
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid file type. Allowed: JPEG, PNG, WebP' } },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 5MB' } },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadStudentId(session.user.id, buffer, file.type);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'UPLOAD_FAILED', message: result.error } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return NextResponse.json(body, { status });
  }
}
