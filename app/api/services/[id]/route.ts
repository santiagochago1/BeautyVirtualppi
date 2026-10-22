import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/server/auth';
import { handle } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { getServiceById, updateService, removeService } from '@/lib/server/models/service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization');
  const { id } = await params;

  return handle(async () => {
    await authenticate(authorization, { optional: true });
    const service = await getServiceById(id);
    if (!service) {
      return NextResponse.json({ ok: false, error: 'El servicio no existe.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, service });
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization');
  const { id } = await params;

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const body = await request.json().catch(() => ({}));
    const service = await updateService(id, body);
    return NextResponse.json({ ok: true, service });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get('authorization');
  const { id } = await params;

  return handle(async () => {
    await authenticate(authorization, { allowedRoles: ['admin'] });
    const service = await removeService(id);
    return NextResponse.json({ ok: true, service });
  });
}
