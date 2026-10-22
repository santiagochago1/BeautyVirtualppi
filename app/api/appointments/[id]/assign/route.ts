import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { assignProfessional } from '@/lib/server/services/appointment';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization');
  const { id } = await params;

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const body = await request.json().catch(() => ({}));
    const { employeeId } = body;
    const appointment = await assignProfessional({
      appointmentId: id,
      employeeId: employeeId || null,
    });
    return NextResponse.json({ ok: true, appointment });
  });
}
