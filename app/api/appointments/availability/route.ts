import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { getOccupiedIntervalsForDate } from '@/lib/server/services/appointment';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    await authenticate(authorization, { optional: true });
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '';
    const employeeId = searchParams.get('employeeId') || null;

    if (!date) {
      return NextResponse.json({ ok: true, occupied: [] });
    }

    const occupied = await getOccupiedIntervalsForDate({ date, employeeId });
    return NextResponse.json({ ok: true, occupied });
  });
}
