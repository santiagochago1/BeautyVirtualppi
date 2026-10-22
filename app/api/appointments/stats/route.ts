import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { getStats } from '@/lib/server/services/appointment';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const report = await getStats();
    return NextResponse.json({ ok: true, stats: report });
  });
}
