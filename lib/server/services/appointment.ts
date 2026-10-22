/**
 * Servicio de agenda: crea y actualiza citas aplicando reglas de negocio.
 */
import {
  createAppointment,
  listAppointments,
  listAppointmentsByEmployee,
  listAppointmentsByUser,
  updateAppointmentStatus,
  assignEmployee,
  getAppointmentById,
  getAppointmentStats,
  APPOINTMENT_STATUSES,
} from '@/lib/server/models/appointment';
import { getServiceById } from '@/lib/server/models/service';
import { getUser } from '@/lib/server/models/user';
import { AppError } from '@/lib/server/errors';
import { cleanString } from '@/lib/server/validators';
import { isValidDate, isValidTime, todaySalon } from '@/lib/server/datetime';
import type { AuthUser } from '@/lib/server/auth';
import type { Appointment, AppointmentStats, AppointmentStatus } from '@/lib/types';

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
  if (employeeId) {
    const employee = await getUser(employeeId);
    if (!employee || employee.role !== 'employee') {
      throw new AppError('El profesional seleccionado no es valido.', 400);
    }
    employeeName = employee.displayName;
  }

  return createAppointment({
    userId: user.uid,
    userName: user.name,
    userEmail: user.email ?? '',
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

export interface AppointmentFilters {
  status?: AppointmentStatus | null;
  from?: string | null;
  to?: string | null;
  employeeId?: string | null;
}

/** Lista citas segun el rol del actor. */
export const listAppointmentsFor = async (
  user: AuthUser,
  filters: AppointmentFilters = {},
): Promise<Appointment[]> => {
  if (user.role === 'admin') return listAppointments(filters);
  if (user.role === 'employee') {
    const { from, to } = filters;
    return listAppointmentsByEmployee(user.uid, { from, to });
  }
  return listAppointmentsByUser(user.uid);
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
  listAppointmentsFor,
  changeStatus,
  assignProfessional,
  getStats,
};

export default appointmentService;
