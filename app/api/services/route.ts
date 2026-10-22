import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { listServices, createService } from '@/lib/server/models/service';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { optional: true });
    const { searchParams } = new URL(request.url);
    const includeInactive = user?.role === 'admin' && searchParams.get('includeInactive') === 'true';
    const services = await listServices({ includeInactive });
    return NextResponse.json({ ok: true, services });
  });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const body = await request.json().catch(() => ({}));
    const service = await createService(body);
    return NextResponse.json({ ok: true, service }, { status: 201 });
  });
}
