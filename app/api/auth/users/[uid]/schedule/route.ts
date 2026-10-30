import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { updateEmployeeSchedule } from '@/lib/server/models/user';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const authorization = request.headers.get('authorization');
  const { uid } = await params;

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const body = await request.json().catch(() => ({}));
    const schedule = body.schedule || body;
    const updated = await updateEmployeeSchedule(uid, schedule);
    return NextResponse.json({ ok: true, user: updated });
  });
}

export const PUT = PATCH;
