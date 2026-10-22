import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { getBusinessInfo, updateBusinessInfo } from '@/lib/server/models/business-info';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    await authenticate(authorization, { optional: true });
    const business = await getBusinessInfo();
    return NextResponse.json({ ok: true, business });
  });
}

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const body = await request.json().catch(() => ({}));
    const business = await updateBusinessInfo(body);
    return NextResponse.json({ ok: true, business });
  });
}
