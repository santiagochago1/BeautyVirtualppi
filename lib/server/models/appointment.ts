/**
 * Modelo (capa de datos) de citas.
 *
 * Coleccion: `appointments`
 * Estados: 'pending' | 'confirmed' | 'completed' | 'cancelled'
 *
 * Campos clave: date (YYYY-MM-DD), time (HH:mm) y startsAt (ISO UTC) en hora
 * local del salon (America/Bogota).
 */
import { assertFirebaseReady } from '@/lib/server/firebase-admin';
import { AppError } from '@/lib/server/errors';
import { cleanString } from '@/lib/server/validators';
import { isValidDate, isValidTime, salonStartToIso } from '@/lib/server/datetime';
import type { Appointment, AppointmentStats, AppointmentStatus } from '@/lib/types';

const APPOINTMENTS_COLLECTION = 'appointments';

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const serialize = (id: string, data: Record<string, unknown>): Appointment =>
  ({ id, ...data }) as Appointment;

const sortByStart = (list: Appointment[], direction: 'asc' | 'desc' = 'asc'): Appointment[] =>
  list.sort((a: Appointment, b: Appointment) =>
    direction === 'desc'
      ? String(b.startsAt).localeCompare(String(a.startsAt))
      : String(a.startsAt).localeCompare(String(b.startsAt)),
  );

export interface CreateAppointmentInput {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  serviceId: string;
  serviceName: string;
  servicePrice?: number;
  durationMinutes?: number;
  date: string;
  time: string;
  employeeId?: string | null;
  employeeName?: string | null;
  notes?: string;
}

/** Crea una cita validando servicio, fecha y disponibilidad. */
export const createAppointment = async ({
  userId,
  userName,
  userEmail,
  userPhone = null,
  serviceId,
  serviceName,
  servicePrice = 0,
  durationMinutes = 60,
  date,
  time,
  employeeId = null,
  employeeName = null,
  notes = '',
}: CreateAppointmentInput): Promise<Appointment> => {
  const db = assertFirebaseReady();

  if (!isValidDate(date)) throw new AppError('La fecha de la cita no es valida.', 400);
  if (!isValidTime(time)) throw new AppError('La hora de la cita no es valida.', 400);

  const startsAt = salonStartToIso(date, time);
  if (!startsAt) throw new AppError('No fue posible interpretar la fecha y hora de la cita.', 400);

  const conflict = await findConflict({ date, time, employeeId });
  if (conflict) {
    throw new AppError(
      employeeId
        ? 'Ese horario ya esta ocupado para el profesional seleccionado. Por favor elige otra hora.'
        : 'Ese horario ya esta tomado. Por favor elige otra hora.',
      409,
    );
  }

  const now = new Date().toISOString();
  const payload = {
    userId,
    userName: cleanString(userName, 120),
    userEmail: cleanString(userEmail, 160),
    userPhone: cleanString(userPhone, 30),
    serviceId,
    serviceName: cleanString(serviceName, 120),
    servicePrice: Number(servicePrice) || 0,
    durationMinutes: Number(durationMinutes) || 60,
    date,
    time,
    startsAt,
    employeeId,
    employeeName: cleanString(employeeName, 120),
    notes: cleanString(notes, 500),
    status: 'pending' as AppointmentStatus,
    createdAt: now,
    updatedAt: now,
  };

  const ref = db.collection(APPOINTMENTS_COLLECTION).doc();
  await ref.set(payload);
  return { id: ref.id, ...payload };
};

/** Busca un conflicto de agenda para un profesional (o global si no hay). */
export const findConflict = async ({
  date,
  time,
  employeeId = null,
}: {
  date: string;
  time: string;
  employeeId?: string | null;
}): Promise<Appointment | null> => {
  const db = assertFirebaseReady();
  // Consulta de igualdad en un solo campo: no requiere indices compuestos.
  const snapshot = await db.collection(APPOINTMENTS_COLLECTION).where('date', '==', date).get();

  return (
    snapshot.docs
      .map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>))
      .find(
        (appointment: Appointment) =>
          appointment.time === time &&
          appointment.status !== 'cancelled' &&
          (employeeId ? appointment.employeeId === employeeId : true),
      ) || null
  );
};

/** Citas de un cliente. */
export const listAppointmentsByUser = async (userId: string): Promise<Appointment[]> => {
  const db = assertFirebaseReady();
  const snapshot = await db
    .collection(APPOINTMENTS_COLLECTION)
    .where('userId', '==', userId)
    .get();
  return sortByStart(snapshot.docs.map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>)), 'desc');
};

/** Citas asignadas a un profesional, opcionalmente dentro de un rango de fechas. */
export const listAppointmentsByEmployee = async (
  employeeId: string,
  { from = null, to = null }: { from?: string | null; to?: string | null } = {},
): Promise<Appointment[]> => {
  const db = assertFirebaseReady();
  // Solo igualdad en un campo: evita la necesidad de indices compuestos.
  const snapshot = await db
    .collection(APPOINTMENTS_COLLECTION)
    .where('employeeId', '==', employeeId)
    .get();

  const list = snapshot.docs.map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>));
  return sortByStart(
    list.filter((item: Appointment) => (from && to ? item.date >= from && item.date <= to : true)),
    'asc',
  );
};

/** Todas las citas (admin) con filtros opcionales. */
export const listAppointments = async ({
  status = null,
  from = null,
  to = null,
  employeeId = null,
}: {
  status?: AppointmentStatus | null;
  from?: string | null;
  to?: string | null;
  employeeId?: string | null;
} = {}): Promise<Appointment[]> => {
  const db = assertFirebaseReady();
  const snapshot = await db.collection(APPOINTMENTS_COLLECTION).get();

  const list = snapshot.docs.map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>)).filter((item: Appointment) => {
    if (status && item.status !== status) return false;
    if (employeeId && item.employeeId !== employeeId) return false;
    if (from && to && (item.date < from || item.date > to)) return false;
    return true;
  });

  return sortByStart(list, 'desc');
};

/** Obtiene una cita por id. */
export const getAppointmentById = async (id: string): Promise<Appointment | null> => {
  const db = assertFirebaseReady();
  const snapshot = await db.collection(APPOINTMENTS_COLLECTION).doc(id).get();
  return snapshot.exists ? serialize(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
};

/** Actualiza el estado de una cita. */
export const updateAppointmentStatus = async (
  id: string,
  status: AppointmentStatus,
  { actorUid = null }: { actorUid?: string | null } = {},
): Promise<Appointment> => {
  const db = assertFirebaseReady();
  if (!APPOINTMENT_STATUSES.includes(status)) {
    throw new AppError(`Estado invalido. Estados permitidos: ${APPOINTMENT_STATUSES.join(', ')}.`, 400);
  }

  const ref = db.collection(APPOINTMENTS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError('La cita no existe.', 404);

  const current = snapshot.data() as Record<string, unknown>;
  const update = {
    status,
    updatedAt: new Date().toISOString(),
    statusUpdatedBy: actorUid,
  };

  await ref.update(update);
  return { id, ...current, ...update } as Appointment;
};

/** Asigna (o reasigna) un profesional a una cita. */
export const assignEmployee = async (
  id: string,
  { employeeId, employeeName }: { employeeId: string | null; employeeName: string | null },
): Promise<Appointment> => {
  const db = assertFirebaseReady();
  const ref = db.collection(APPOINTMENTS_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError('La cita no existe.', 404);

  const current = snapshot.data() as Record<string, unknown>;
  if (current.status === 'cancelled') {
    throw new AppError('No se puede asignar un profesional a una cita cancelada.', 400);
  }

  if (employeeId) {
    const conflict = await findConflict({
      date: String(current.date),
      time: String(current.time),
      employeeId,
    });
    if (conflict && conflict.id !== id) {
      throw new AppError('El profesional ya tiene una cita en ese horario.', 409);
    }
  }

  const update = {
    employeeId: employeeId || null,
    employeeName: employeeName ? cleanString(employeeName, 120) : null,
    updatedAt: new Date().toISOString(),
  };

  await ref.update(update);
  return { id, ...current, ...update } as Appointment;
};

/** Resumen para reportes (admin). */
export const getAppointmentStats = async (): Promise<AppointmentStats> => {
  const db = assertFirebaseReady();
  const snapshot = await db.collection(APPOINTMENTS_COLLECTION).get();
  const list = snapshot.docs.map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>));

  const byStatus = APPOINTMENT_STATUSES.reduce<Record<AppointmentStatus, number>>((acc, status) => {
    acc[status] = list.filter((item: Appointment) => item.status === status).length;
    return acc;
  }, { pending: 0, confirmed: 0, completed: 0, cancelled: 0 });

  const billed = list
    .filter((item: Appointment) => item.status === 'completed')
    .reduce((acc: number, item: Appointment) => acc + (Number(item.servicePrice) || 0), 0);

  const byService = list.reduce<Record<string, { serviceName: string; count: number; revenue: number }>>(
    (acc: Record<string, { serviceName: string; count: number; revenue: number }>, item: Appointment) => {
      const key = item.serviceName || 'Sin servicio';
      acc[key] = acc[key] || { serviceName: key, count: 0, revenue: 0 };
      acc[key].count += 1;
      if (item.status === 'completed') acc[key].revenue += Number(item.servicePrice) || 0;
      return acc;
    },
    {},
  );

  return {
    total: list.length,
    byStatus,
    billedTotal: billed,
    byService: (Object.values(byService) as Array<{ serviceName: string; count: number; revenue: number }>).sort(
      (a, b) => b.count - a.count,
    ),
  };
};
