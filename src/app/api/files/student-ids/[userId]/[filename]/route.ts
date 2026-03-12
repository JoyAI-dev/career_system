import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readFile, mimeFromFilename } from '@/lib/storage';
import { mapErrorToResponse } from '@/lib/errors';

type RouteParams = {
  params: Promise<{ userId: string; filename: string }>;
};

/**
 * Serve student ID images from local storage.
 * Access: the user themselves or any ADMIN.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const { userId, filename } = await params;

    // Path traversal protection: reject anything with slashes or ..
    if (/[/\\]|\.\./.test(userId) || /[/\\]|\.\./.test(filename)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid path' } },
        { status: 400 },
      );
    }

    // Authorization: self or admin
    if (session.user.id !== userId && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 },
      );
    }

    const relativePath = `uploads/student-ids/${userId}/${filename}`;
    const buffer = await readFile(relativePath);

    if (!buffer) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found' } },
        { status: 404 },
      );
    }

    const contentType = mimeFromFilename(filename);

    // Only serve image types
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Invalid file type' } },
        { status: 403 },
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return NextResponse.json(body, { status });
  }
}
