import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import {
  bookAppointment,
  blockEmployeeBreak,
  listAppointmentsFor,
  type AppointmentFilters,
} from '@/lib/server/services/appointment';
import { APPOINTMENT_STATUSES } from '@/lib/server/models/appointment';
import type { AppointmentStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['client', 'employee', 'admin'] });
    const { searchParams } = new URL(request.url);

    const filters: AppointmentFilters = {};
    const status = searchParams.get('status');
    if (status && (APPOINTMENT_STATUSES as string[]).includes(status)) {
      filters.status = status as AppointmentStatus;
    }
    const from = searchParams.get('from');
    if (from) filters.from = from;
    const to = searchParams.get('to');
    if (to) filters.to = to;
    const employeeId = searchParams.get('employeeId');
    if (employeeId) filters.employeeId = employeeId;

    const appointments = await listAppointmentsFor(user!, filters);
    return NextResponse.json({ ok: true, appointments });
  });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  return handle(async () => {
    const user = await authenticate(authorization, { allowedRoles: ['client', 'employee', 'admin'] });
    const body = await request.json().catch(() => ({}));

    if (body.type === 'break' || body.appointmentType === 'break' || body.status === 'blocked') {
      const { date, time, durationMinutes, notes, employeeId } = body;
      const appointment = await blockEmployeeBreak({
        actor: user!,
        date,
        time,
        durationMinutes: Number(durationMinutes) || 60,
        notes,
        employeeId,
      });
      return NextResponse.json({ ok: true, appointment }, { status: 201 });
    }

    const { serviceId, date, time, notes, employeeId } = body;
    const appointment = await bookAppointment({
      user: user!,
      serviceId,
      date,
      time,
      notes,
      employeeId,
    });
    return NextResponse.json({ ok: true, appointment }, { status: 201 });
  });
}
