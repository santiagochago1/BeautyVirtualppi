import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { changeStatus } from '@/lib/server/services/appointment';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization');
  const { id } = await params;

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['client', 'employee', 'admin'] });
    const body = await request.json().catch(() => ({}));
    const { status } = body;
    const appointment = await changeStatus({ actor: user!, appointmentId: id, status });
    return NextResponse.json({ ok: true, appointment });
  });
}
