import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { readFile, mimeFromFilename } from '@/lib/storage';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ activityId: string; filename: string }> },
) {
  try {
    const session = await requireAuth();
    const { activityId, filename } = await params;

    // Path traversal protection
    if (/[/\\]|\.\./.test(activityId) || /[/\\]|\.\./.test(filename)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { activityId_userId: { activityId, userId: session.user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const relativePath = `uploads/meeting-minutes/${activityId}/${filename}`;
    const buffer = await readFile(relativePath);
    if (!buffer) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const contentType = mimeFromFilename(filename);

    // Extract original filename: strip the timestamp prefix (e.g. "1710250800000_report.pdf" -> "report.pdf")
    const originalName = filename.replace(/^\d+_/, '');
    const encodedName = encodeURIComponent(originalName);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
