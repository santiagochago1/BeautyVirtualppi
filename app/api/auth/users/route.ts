import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { listUsers, ROLES } from '@/lib/server/models/user';
import { consume, getClientIp, buildKey } from '@/lib/server/rate-limit';
import type { Role } from '@/lib/types';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['admin'] });
    const ip = getClientIp(request);
    const key = buildKey(user!.uid, ip);
    const limit = consume(`admin:${key}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: 'Demasiadas solicitudes. Intenta en un momento.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');
    const role = roleParam && (ROLES as string[]).includes(roleParam) ? (roleParam as Role) : null;
    const search = searchParams.get('search') || '';
    const users = await listUsers({ role, search });
    return NextResponse.json({ ok: true, users });
  });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['admin'] });
    const ip = getClientIp(request);
    const key = buildKey(user!.uid, ip);
    const limit = consume(`admin:${key}`, 30, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { ok: false, error: 'Demasiadas solicitudes. Intenta en un momento.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }

    const { firebaseAuth, isFirebaseReady } = await import('@/lib/server/firebase-admin');
    const { AppError } = await import('@/lib/server/errors');
    const { isValidPhone, normalizePhone, phoneToAuthEmail, cleanString } = await import('@/lib/server/validators');
    const { provisionUser } = await import('@/lib/server/models/user');

    if (!isFirebaseReady()) throw new AppError('La autenticacion no esta disponible en este momento.', 503);

    const body = await request.json().catch(() => ({}));
    const { phone, email, password, displayName, role = 'client' } = body;

    const rawPhone = phone || email || '';
    const cleanPhone = normalizePhone(rawPhone);
    if (!isValidPhone(cleanPhone)) {
      throw new AppError('Ingresa un numero de telefono / WhatsApp valido (ej: 3001234567).', 400);
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new AppError('La contrase\u00f1a debe tener al menos 6 caracteres.', 400);
    }
    if (!['client', 'employee', 'admin'].includes(role)) {
      throw new AppError('Rol invalido. Usa client, employee o admin.', 400);
    }

    const syntheticEmail = phoneToAuthEmail(cleanPhone);

    let userRecord: Awaited<ReturnType<NonNullable<typeof firebaseAuth>['createUser']>>;
    try {
      userRecord = await firebaseAuth!.createUser({
        email: syntheticEmail,
        password,
        displayName: cleanString(displayName, 120) || cleanPhone,
      });
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === 'auth/email-already-exists') {
        throw new AppError('Ya existe un usuario registrado con ese numero de telefono.', 409);
      }
      throw new AppError('No fue posible crear el usuario. Intenta nuevamente.', 500);
    }

    const normalizedRole: Role = role as Role;

    const profile = await provisionUser({
      uid: userRecord.uid,
      email: userRecord.email || syntheticEmail,
      displayName: userRecord.displayName,
      role: normalizedRole,
      phone: cleanPhone,
    });

    return NextResponse.json({ ok: true, user: profile }, { status: 201 });
  });
}
