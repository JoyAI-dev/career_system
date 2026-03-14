import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  MEETING_MINUTES_ALLOWED_MIME_TYPES,
  MEETING_MINUTES_MAX_FILE_SIZE,
  buildMeetingMinutesPath,
  saveFile,
  deleteFile,
} from '@/lib/storage';
import { prisma } from '@/lib/db';
import { mapErrorToResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const formData = await request.formData();
    const activityId = formData.get('activityId') as string;
    const content = (formData.get('content') as string)?.trim() || null;
    const file = formData.get('file') as File | null;

    if (!activityId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Activity ID is required' } },
        { status: 400 },
      );
    }

    // Must have at least content or file
    if (!content && (!file || file.size === 0)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Content or file is required' } },
        { status: 400 },
      );
    }

    // Verify membership
    const membership = await prisma.membership.findUnique({
      where: { activityId_userId: { activityId, userId } },
    });
    if (!membership) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You are not a member of this activity' } },
        { status: 403 },
      );
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileMimeType: string | null = null;

    if (file && file.size > 0) {
      // Validate MIME type
      if (
        !MEETING_MINUTES_ALLOWED_MIME_TYPES.includes(
          file.type as (typeof MEETING_MINUTES_ALLOWED_MIME_TYPES)[number],
        )
      ) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: `Invalid file type: ${file.type}` } },
          { status: 400 },
        );
      }

      // Validate file size
      if (file.size > MEETING_MINUTES_MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum 20MB' } },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const paths = buildMeetingMinutesPath(activityId, file.name);

      // Save file to disk
      await saveFile(paths.relative, buffer);
      fileUrl = paths.relative;
      fileName = file.name;
      fileSize = file.size;
      fileMimeType = file.type;
    }

    // Create DB record
    try {
      const minutes = await prisma.meetingMinutes.create({
        data: {
          activityId,
          userId,
          content,
          fileName,
          fileUrl,
          fileSize,
          fileMimeType,
        },
      });

      return NextResponse.json({ success: true, minutesId: minutes.id });
    } catch (dbError) {
      // Rollback: delete uploaded file if DB write failed
      if (fileUrl) {
        try {
          await deleteFile(fileUrl);
        } catch {
          // Best effort cleanup
        }
      }
      throw dbError;
    }
  } catch (error) {
    const { status, body } = mapErrorToResponse(error);
    return NextResponse.json(body, { status });
  }
}
