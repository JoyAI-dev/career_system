import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getStudentIdSignedUrl } from '@/server/services/studentId';
import { mapErrorToResponse } from '@/lib/errors';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'userId parameter required' } },
        { status: 400 },
      );
    }

    const result = await getStudentIdSignedUrl(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: result.status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR', message: result.error } },
        { status: result.status },
      );
    }

    // Audit log: record student ID access
    await (prisma as any).auditLog.create({
      data: {
        adminId: session.user.id,
        action: 'VIEW_STUDENT_ID',
        targetId: userId,
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
      },
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return NextResponse.json(body, { status });
  }
}
