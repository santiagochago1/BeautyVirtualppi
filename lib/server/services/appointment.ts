/**
 * Servicio de agenda: crea y actualiza citas aplicando reglas de negocio.
 */
import {
  createAppointment,
  createBreakBlock,
  listAppointments,
  listAppointmentsByEmployee,
  listAppointmentsByUser,
  listOccupiedByDate,
  updateAppointmentStatus,
  assignEmployee,
  getAppointmentById,
  getAppointmentStats,
  APPOINTMENT_STATUSES,
} from '@/lib/server/models/appointment';
import { getServiceById } from '@/lib/server/models/service';
import { getBusinessInfo } from '@/lib/server/models/business-info';
import { getUser } from '@/lib/server/models/user';
import { AppError } from '@/lib/server/errors';
import { cleanString, extractPhoneFromAuthEmail } from '@/lib/server/validators';
import { isValidDate, isValidTime, todaySalon } from '@/lib/server/datetime';
import {
  parseTimeToMinutes,
  resolveEffectiveScheduleWindow,
} from '@/lib/schedule-utils';
import type { AuthUser } from '@/lib/server/auth';
import type { Appointment, AppointmentStats, AppointmentStatus, UserProfile } from '@/lib/types';

/** Crea una cita solicitada por un cliente. */
export const bookAppointment = async ({
  user,
  serviceId,
  date,
  time,
  notes = '',
  employeeId = null,
}: {
  user: AuthUser;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
  employeeId?: string | null;
}): Promise<Appointment> => {
  const service = await getServiceById(serviceId);
  if (!service) throw new AppError('El servicio seleccionado no existe.', 404);
  if (service.active === false) throw new AppError('El servicio seleccionado ya no esta disponible.', 400);

  if (!isValidDate(date) || !isValidTime(time)) {
    throw new AppError('La fecha y la hora de la cita son obligatorias y deben tener un formato valido.', 400);
  }
  if (date < (todaySalon() ?? '')) {
    throw new AppError('No puedes agendar citas en fechas pasadas.', 400);
  }

  let employeeName: string | null = null;
  let employeeProfile: UserProfile | null = null;
  if (employeeId) {
    employeeProfile = await getUser(employeeId);
    if (!employeeProfile || employeeProfile.role !== 'employee') {
      throw new AppError('El profesional seleccionado no es valido.', 400);
    }
    employeeName = employeeProfile.displayName;
  }

  // Validación contra horario general del salón, fechas especiales/festivos y turno del profesional
  const business = await getBusinessInfo();
  const window = resolveEffectiveScheduleWindow({
    dateIso: date,
    business,
    employee: employeeProfile,
  });

  if (!window.isOpen) {
    throw new AppError(
      window.reason || 'El salón o el profesional seleccionado no atiende en la fecha elegida.',
      400,
    );
  }

  const startMins = parseTimeToMinutes(time);
  const openMins = parseTimeToMinutes(window.openTime);
  const closeMins = parseTimeToMinutes(window.closeTime);
  const duration = Math.max(15, Number(service.durationMinutes) || 60);

  if (
    startMins === null ||
    openMins === null ||
    closeMins === null ||
    startMins < openMins ||
    startMins + duration > closeMins
  ) {
    throw new AppError(
      `La hora seleccionada (${time}) está fuera del horario de atención disponible (${window.openTime} a ${window.closeTime}).`,
      400,
    );
  }

  return createAppointment({
    userId: user.uid,
    userName: user.name,
    userEmail: user.email ?? '',
    userPhone: user.phone || user.profile?.phone || extractPhoneFromAuthEmail(user.email) || null,
    serviceId: service.id,
    serviceName: service.name,
    servicePrice: service.price,
    durationMinutes: service.durationMinutes,
    date,
    time,
    employeeId,
    employeeName,
    notes: cleanString(notes, 500),
  });
};

/**
 * Registra un bloqueo de descanso / pausa en la agenda de un profesional.
 */
export const blockEmployeeBreak = async ({
  actor,
  date,
  time,
  durationMinutes = 60,
  notes = '',
  employeeId = null,
}: {
  actor: AuthUser;
  date: string;
  time: string;
  durationMinutes?: number;
  notes?: string;
  employeeId?: string | null;
}): Promise<Appointment> => {
  if (actor.role !== 'employee' && actor.role !== 'admin') {
    throw new AppError('Solo el personal del salón puede registrar bloqueos de descanso.', 403);
  }

  const targetEmployeeId =
    actor.role === 'admin' && employeeId ? employeeId : actor.uid;

  let targetEmployeeName = actor.name;
  let employeeProfile: UserProfile | null = actor.profile || null;

  if (targetEmployeeId !== actor.uid) {
    const found = await getUser(targetEmployeeId);
    if (!found) throw new AppError('El profesional seleccionado no existe.', 404);
    targetEmployeeName = found.displayName;
    employeeProfile = found;
  }

  const business = await getBusinessInfo();
  const window = resolveEffectiveScheduleWindow({
    dateIso: date,
    business,
    employee: employeeProfile,
  });

  if (!window.isOpen) {
    throw new AppError(
      window.reason || 'No se puede registrar un descanso en un día cerrado o no laborable.',
      400,
    );
  }

  const duration = Math.max(15, Math.min(240, Number(durationMinutes) || 60));
  const startMins = parseTimeToMinutes(time);
  const openMins = parseTimeToMinutes(window.openTime);
  const closeMins = parseTimeToMinutes(window.closeTime);

  if (
    startMins === null ||
    openMins === null ||
    closeMins === null ||
    startMins < openMins ||
    startMins + duration > closeMins
  ) {
    throw new AppError(
      `El descanso (${time}, ${duration} min) debe estar dentro de la jornada activa (${window.openTime} a ${window.closeTime}).`,
      400,
    );
  }

  return createBreakBlock({
    employeeId: targetEmployeeId,
    employeeName: targetEmployeeName,
    date,
    time,
    durationMinutes: duration,
    notes: cleanString(notes, 300) || 'Descanso / Almuerzo',
    createdByUid: actor.uid,
  });
};

/** Devuelve los intervalos ocupados (citas activas y descansos) para una fecha y profesional. */
export const getOccupiedIntervalsForDate = async ({
  date,
  employeeId = null,
}: {
  date: string;
  employeeId?: string | null;
}) => {
  const items = await listOccupiedByDate({ date, employeeId });
  return items.map((item) => ({
    id: item.id,
    time: item.time,
    durationMinutes: item.durationMinutes || 60,
    status: item.status,
    appointmentType: item.appointmentType || (item.status === 'blocked' ? 'break' : 'appointment'),
    employeeId: item.employeeId,
  }));
};

export interface AppointmentFilters {
  status?: AppointmentStatus | null;
  from?: string | null;
  to?: string | null;
  employeeId?: string | null;
}

/** Lista citas segun el rol del actor, asegurando el telefono del cliente cuando exista en su perfil. */
export const listAppointmentsFor = async (
  user: AuthUser,
  filters: AppointmentFilters = {},
): Promise<Appointment[]> => {
  let list: Appointment[];
  if (user.role === 'admin') {
    list = await listAppointments(filters);
  } else if (user.role === 'employee') {
    const { status, from, to } = filters;
    list = await listAppointmentsByEmployee(user.uid, { status, from, to });
  } else {
    const { status, from, to } = filters;
    list = await listAppointmentsByUser(user.uid, { status, from, to });
  }

  // Completa `userPhone` si la cita fue creada antes o tiene el telefono en el perfil/correo sintetico
  const missingUserIds = Array.from(
    new Set(
      list
        .filter((item) => !item.userPhone && !extractPhoneFromAuthEmail(item.userEmail) && item.userId)
        .map((item) => item.userId),
    ),
  );

  const phoneByUid = new Map<string, string>();
  await Promise.all(
    missingUserIds.map(async (uid) => {
      const clientProfile = await getUser(uid).catch(() => null);
      if (clientProfile?.phone) {
        phoneByUid.set(uid, clientProfile.phone);
      }
    }),
  );

  return list.map((item) => ({
    ...item,
    userPhone:
      item.userPhone ||
      extractPhoneFromAuthEmail(item.userEmail) ||
      phoneByUid.get(item.userId) ||
      '',
  }));
};

/** Cambia el estado de una cita validando permisos y transiciones. */
export const changeStatus = async ({
  actor,
  appointmentId,
  status,
}: {
  actor: AuthUser;
  appointmentId: string;
  status: AppointmentStatus;
}): Promise<Appointment> => {
  if (!APPOINTMENT_STATUSES.includes(status)) {
    throw new AppError('Estado de cita invalido.', 400);
  }

  const appointment = await getAppointmentById(appointmentId);
  if (!appointment) throw new AppError('La cita no existe.', 404);

  const isOwner = appointment.userId === actor.uid;
  const isAdmin = actor.role === 'admin';
  const isAssignedEmployee = actor.role === 'employee' && appointment.employeeId === actor.uid;

  if (!isAdmin && !isAssignedEmployee && !(isOwner && status === 'cancelled')) {
    throw new AppError('No tienes permisos para actualizar esta cita.', 403);
  }

  if (isOwner && status !== 'cancelled') {
    throw new AppError('Solo puedes cancelar tus propias citas desde el portal.', 403);
  }

  if (appointment.status === 'completed' && status !== 'cancelled') {
    throw new AppError('Una cita completada no puede volver a un estado pendiente.', 400);
  }

  return updateAppointmentStatus(appointmentId, status, { actorUid: actor.uid });
};

/** Asigna un profesional a una cita (admin). */
export const assignProfessional = async ({
  appointmentId,
  employeeId,
}: {
  appointmentId: string;
  employeeId: string | null;
}): Promise<Appointment> => {
  let employeeName: string | null = null;
  if (employeeId) {
    const employee = await getUser(employeeId);
    if (!employee || employee.role !== 'employee') {
      throw new AppError('El profesional seleccionado no es valido.', 400);
    }
    employeeName = employee.displayName;
  }
  return assignEmployee(appointmentId, { employeeId, employeeName });
};

export const getStats = (): Promise<AppointmentStats> => getAppointmentStats();

const appointmentService = {
  bookAppointment,
  blockEmployeeBreak,
  getOccupiedIntervalsForDate,
  listAppointmentsFor,
  changeStatus,
  assignProfessional,
  getStats,
};

export default appointmentService;
