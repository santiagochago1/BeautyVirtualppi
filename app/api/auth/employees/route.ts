import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { listUsers } from '@/lib/server/models/user';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['employee', 'admin'] });
    const users = await listUsers({ role: 'employee' });
    return NextResponse.json({ ok: true, users });
  });
}
