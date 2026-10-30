import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['client', 'employee', 'admin'] });
    return NextResponse.json({
      ok: true,
      user: {
        uid: user!.uid,
        email: user!.email,
        phone: user!.phone,
        name: user!.name,
        role: user!.role,
        profile: user!.profile,
      },
    });
  });
}

export async function PATCH(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['client', 'employee', 'admin'] });
    const { updateUserProfile } = await import('@/lib/server/models/user');
    const body = await request.json().catch(() => ({}));
    const updated = await updateUserProfile(user!.uid, {
      displayName: body.displayName,
      phone: body.phone,
    });
    return NextResponse.json({ ok: true, user: updated });
  });
}

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['client', 'employee', 'admin'] });
    const { firebaseAuth, isFirebaseReady } = await import('@/lib/server/firebase-admin');
    const { AppError } = await import('@/lib/server/errors');
    if (!isFirebaseReady()) throw new AppError('La autenticacion no esta disponible.', 503);
    await firebaseAuth!.deleteUser(user!.uid);
    return NextResponse.json({ ok: true, message: 'Cuenta eliminada correctamente.' });
  });
}
