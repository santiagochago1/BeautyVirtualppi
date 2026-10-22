import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { updateUserRole } from '@/lib/server/models/user';
import { AppError } from '@/lib/server/errors';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const authorization = request.headers.get('authorization');
  const { uid } = await params;

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['admin'] });
    const body = await request.json().catch(() => ({}));
    const { role } = body;

    if (!['client', 'employee', 'admin'].includes(role)) {
      throw new AppError('Rol invalido. Usa client, employee o admin.', 400);
    }
    if (uid === user!.uid && role !== 'admin') {
      throw new AppError('No puedes quitarte a ti mismo el rol de administrador.', 400);
    }

    const updated = await updateUserRole(uid, role);
    return NextResponse.json({ ok: true, user: updated });
  });
}
