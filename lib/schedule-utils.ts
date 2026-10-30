/**
 * Utilidades compartidas (cliente y servidor) para el manejo de horarios del
 * salón (BusinessHours), fechas especiales/festivos (SpecialDate), turnos de
 * profesionales (EmployeeSchedule) y cálculo de disponibilidad de citas.
 */
import type {
  Appointment,
  BusinessHour,
  BusinessInfo,
  EmployeeSchedule,
  SpecialDate,
  UserProfile,
} from '@/lib/types';

export interface WeekDayMeta {
  /** 0 = Domingo, 1 = Lunes, ..., 6 = Sábado (coincide con Date.prototype.getDay). */
  dayOfWeek: number;
  /** Nombre canónico guardado en base de datos. */
  day: string;
  /** Etiqueta con tilde para mostrar en interfaz. */
  label: string;
  /** Abreviatura corta. */
  shortLabel: string;
  defaultOpen: boolean;
  defaultOpenTime: string;
  defaultCloseTime: string;
}

/** Orden de lunes a domingo para tablas y selectores semanales. */
export const WEEK_DAYS: WeekDayMeta[] = [
  {
    dayOfWeek: 1,
    day: 'Lunes',
    label: 'Lunes',
    shortLabel: 'Lun',
    defaultOpen: true,
    defaultOpenTime: '08:00',
    defaultCloseTime: '18:00',
  },
  {
    dayOfWeek: 2,
    day: 'Martes',
    label: 'Martes',
    shortLabel: 'Mar',
    defaultOpen: true,
    defaultOpenTime: '08:00',
    defaultCloseTime: '18:00',
  },
  {
    dayOfWeek: 3,
    day: 'Miercoles',
    label: 'Miércoles',
    shortLabel: 'Mié',
    defaultOpen: true,
    defaultOpenTime: '08:00',
    defaultCloseTime: '18:00',
  },
  {
    dayOfWeek: 4,
    day: 'Jueves',
    label: 'Jueves',
    shortLabel: 'Jue',
    defaultOpen: true,
    defaultOpenTime: '08:00',
    defaultCloseTime: '18:00',
  },
  {
    dayOfWeek: 5,
    day: 'Viernes',
    label: 'Viernes',
    shortLabel: 'Vie',
    defaultOpen: true,
    defaultOpenTime: '08:00',
    defaultCloseTime: '19:00',
  },
  {
    dayOfWeek: 6,
    day: 'Sabado',
    label: 'Sábado',
    shortLabel: 'Sáb',
    defaultOpen: true,
    defaultOpenTime: '09:00',
    defaultCloseTime: '17:00',
  },
  {
    dayOfWeek: 0,
    day: 'Domingo',
    label: 'Domingo',
    shortLabel: 'Dom',
    defaultOpen: false,
    defaultOpenTime: '09:00',
    defaultCloseTime: '15:00',
  },
];

/** Normaliza texto quitando tildes y pasando a minúsculas para comparar nombres de días. */
const normalizeDayKey = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/** Convierte `HH:mm` a minutos desde las 00:00. Devuelve `null` si el formato no es válido. */
export const parseTimeToMinutes = (time?: string | null): number | null => {
  if (!time || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null;
  const [h, m] = time.trim().split(':').map(Number);
  return h * 60 + m;
};

/** Convierte minutos desde las 00:00 a formato `HH:mm`. */
export const minutesToTime = (totalMinutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
};

/** Obtiene el día de la semana (0 = Domingo ... 6 = Sábado) de una fecha `YYYY-MM-DD`. */
export const getDayOfWeekFromISODate = (dateIso: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso || '')) return null;
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCDay();
};

/** Obtiene la metadata de un día de la semana (0..6). */
export const getWeekDayMeta = (dayOfWeek: number): WeekDayMeta =>
  WEEK_DAYS.find((item) => item.dayOfWeek === dayOfWeek) || WEEK_DAYS[0];

/**
 * Normaliza el arreglo `hours` del negocio garantizando los 7 días de la semana
 * con `isOpen`, `openTime`, `closeTime` y los campos legados `open` / `close`.
 */
export const normalizeBusinessHours = (rawHours?: BusinessHour[] | null): BusinessHour[] => {
  const list = Array.isArray(rawHours) ? rawHours : [];

  return WEEK_DAYS.map((meta) => {
    const found = list.find(
      (item) =>
        (typeof item.dayOfWeek === 'number' && item.dayOfWeek === meta.dayOfWeek) ||
        normalizeDayKey(item.day) === normalizeDayKey(meta.day),
    );

    if (!found) {
      return {
        day: meta.day,
        dayOfWeek: meta.dayOfWeek,
        isOpen: meta.defaultOpen,
        openTime: meta.defaultOpenTime,
        closeTime: meta.defaultCloseTime,
        open: meta.defaultOpen ? meta.defaultOpenTime : '00:00',
        close: meta.defaultOpen ? meta.defaultCloseTime : '00:00',
      };
    }

    const legacyOpen = found.open && found.open !== '00:00' ? found.open : '';
    const legacyClose = found.close && found.close !== '00:00' ? found.close : '';

    const isOpen =
      typeof found.isOpen === 'boolean'
        ? found.isOpen
        : Boolean(legacyOpen && legacyClose && legacyOpen < legacyClose);

    const openTime = found.openTime || legacyOpen || meta.defaultOpenTime;
    const closeTime = found.closeTime || legacyClose || meta.defaultCloseTime;

    return {
      day: meta.day,
      dayOfWeek: meta.dayOfWeek,
      isOpen,
      openTime,
      closeTime,
      open: isOpen ? openTime : '00:00',
      close: isOpen ? closeTime : '00:00',
    };
  });
};

/** Horario por defecto de un empleado cuando aún no tiene turno personalizado. */
export const DEFAULT_EMPLOYEE_SCHEDULE: EmployeeSchedule = {
  workDays: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
  startTime: '08:00',
  endTime: '18:00',
};

/** Normaliza la configuración de jornada de un empleado. */
export const normalizeEmployeeSchedule = (
  schedule?: EmployeeSchedule | null,
): EmployeeSchedule => {
  if (!schedule || typeof schedule !== 'object') {
    return { ...DEFAULT_EMPLOYEE_SCHEDULE };
  }

  const workDays = Array.isArray(schedule.workDays)
    ? Array.from(
        new Set(
          schedule.workDays
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
        ),
      )
    : [...DEFAULT_EMPLOYEE_SCHEDULE.workDays];

  const startTime =
    parseTimeToMinutes(schedule.startTime) !== null
      ? schedule.startTime
      : DEFAULT_EMPLOYEE_SCHEDULE.startTime;
  const endTime =
    parseTimeToMinutes(schedule.endTime) !== null
      ? schedule.endTime
      : DEFAULT_EMPLOYEE_SCHEDULE.endTime;

  return {
    workDays,
    startTime,
    endTime,
  };
};

export interface DayAvailabilityWindow {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  reason?: string;
  specialDate?: SpecialDate | null;
}

/**
 * Calcula el horario efectivo de apertura del salón para una fecha `YYYY-MM-DD`,
 * evaluando primero `specialDates` (excepciones/festivos) y luego `hours` semanal.
 */
export const resolveSalonDayWindow = (
  dateIso: string,
  business?: Pick<BusinessInfo, 'hours' | 'specialDates'> | null,
): DayAvailabilityWindow => {
  const dayOfWeek = getDayOfWeekFromISODate(dateIso);
  if (dayOfWeek === null) {
    return { isOpen: false, openTime: '00:00', closeTime: '00:00', reason: 'Fecha inválida.' };
  }

  const specialDates = Array.isArray(business?.specialDates) ? business!.specialDates! : [];
  const special = specialDates.find((item) => item.date === dateIso) || null;

  if (special) {
    if (special.isClosed) {
      return {
        isOpen: false,
        openTime: '00:00',
        closeTime: '00:00',
        reason: `El salón permanece cerrado en esta fecha (${special.note || 'Excepción / Festivo'}).`,
        specialDate: special,
      };
    }

    const openMins = parseTimeToMinutes(special.customOpenTime);
    const closeMins = parseTimeToMinutes(special.customCloseTime);
    if (openMins !== null && closeMins !== null && openMins < closeMins) {
      return {
        isOpen: true,
        openTime: special.customOpenTime!,
        closeTime: special.customCloseTime!,
        specialDate: special,
      };
    }
  }

  const normalizedHours = normalizeBusinessHours(business?.hours);
  const dayConfig = normalizedHours.find((h) => h.dayOfWeek === dayOfWeek);
  const meta = getWeekDayMeta(dayOfWeek);

  if (!dayConfig || !dayConfig.isOpen) {
    return {
      isOpen: false,
      openTime: '00:00',
      closeTime: '00:00',
      reason: `El salón permanece cerrado los días ${meta.label.toLowerCase()}.`,
    };
  }

  const openMins = parseTimeToMinutes(dayConfig.openTime || dayConfig.open);
  const closeMins = parseTimeToMinutes(dayConfig.closeTime || dayConfig.close);
  if (openMins === null || closeMins === null || openMins >= closeMins) {
    return {
      isOpen: false,
      openTime: '00:00',
      closeTime: '00:00',
      reason: `El salón permanece cerrado los días ${meta.label.toLowerCase()}.`,
    };
  }

  return {
    isOpen: true,
    openTime: dayConfig.openTime || dayConfig.open,
    closeTime: dayConfig.closeTime || dayConfig.close,
    specialDate: special,
  };
};

/**
 * Calcula la ventana efectiva de atención para una fecha `YYYY-MM-DD` y un
 * profesional opcional, intersectando el horario del salón con el turno del empleado.
 */
export const resolveEffectiveScheduleWindow = ({
  dateIso,
  business,
  employee,
}: {
  dateIso: string;
  business?: Pick<BusinessInfo, 'hours' | 'specialDates'> | null;
  employee?: Pick<UserProfile, 'displayName' | 'schedule'> | null;
}): DayAvailabilityWindow => {
  const salonWindow = resolveSalonDayWindow(dateIso, business);
  if (!salonWindow.isOpen) {
    return salonWindow;
  }

  if (!employee || !employee.schedule) {
    return salonWindow;
  }

  const dayOfWeek = getDayOfWeekFromISODate(dateIso)!;
  const meta = getWeekDayMeta(dayOfWeek);
  const empSchedule = normalizeEmployeeSchedule(employee.schedule);

  if (!empSchedule.workDays.includes(dayOfWeek)) {
    return {
      isOpen: false,
      openTime: '00:00',
      closeTime: '00:00',
      reason: `${employee.displayName || 'El profesional seleccionado'} tiene día libre los ${meta.label.toLowerCase()}.`,
      specialDate: salonWindow.specialDate,
    };
  }

  const salonOpenMins = parseTimeToMinutes(salonWindow.openTime)!;
  const salonCloseMins = parseTimeToMinutes(salonWindow.closeTime)!;
  const empStartMins = parseTimeToMinutes(empSchedule.startTime)!;
  const empEndMins = parseTimeToMinutes(empSchedule.endTime)!;

  const effectiveStart = Math.max(salonOpenMins, empStartMins);
  const effectiveEnd = Math.min(salonCloseMins, empEndMins);

  if (effectiveStart >= effectiveEnd) {
    return {
      isOpen: false,
      openTime: '00:00',
      closeTime: '00:00',
      reason: `${employee.displayName || 'El profesional'} no tiene horario disponible dentro de la jornada del salón en esta fecha.`,
      specialDate: salonWindow.specialDate,
    };
  }

  return {
    isOpen: true,
    openTime: minutesToTime(effectiveStart),
    closeTime: minutesToTime(effectiveEnd),
    specialDate: salonWindow.specialDate,
  };
};

/** Verifica si dos intervalos `[startA, endA)` y `[startB, endB)` se solapan. */
export const intervalsOverlap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean => startA < endB && startB < endA;

export interface OccupiedSlotInterval {
  id?: string;
  time: string;
  durationMinutes: number;
  status?: string;
  appointmentType?: 'appointment' | 'break';
}

/**
 * Genera las horas disponibles (`HH:mm`, cada `stepMinutes`) dentro del horario
 * activo del día, excluyendo cualquier franja que se solape con citas activas o
 * descansos bloqueados, y garantizando que el servicio termine antes del cierre.
 */
export const computeAvailableTimeSlots = ({
  dateIso,
  business,
  employee,
  serviceDurationMinutes = 60,
  occupiedIntervals = [],
  stepMinutes = 30,
  nowLocalDateIso,
  nowLocalTime,
}: {
  dateIso: string;
  business?: Pick<BusinessInfo, 'hours' | 'specialDates'> | null;
  employee?: Pick<UserProfile, 'displayName' | 'schedule'> | null;
  serviceDurationMinutes?: number;
  occupiedIntervals?: OccupiedSlotInterval[];
  stepMinutes?: number;
  nowLocalDateIso?: string | null;
  nowLocalTime?: string | null;
}): {
  window: DayAvailabilityWindow;
  slots: string[];
} => {
  const window = resolveEffectiveScheduleWindow({ dateIso, business, employee });
  if (!window.isOpen) {
    return { window, slots: [] };
  }

  const startMins = parseTimeToMinutes(window.openTime);
  const endMins = parseTimeToMinutes(window.closeTime);
  const duration = Math.max(15, Number(serviceDurationMinutes) || 60);

  if (startMins === null || endMins === null || startMins + duration > endMins) {
    return { window, slots: [] };
  }

  const nowMins =
    nowLocalDateIso && dateIso === nowLocalDateIso && nowLocalTime
      ? parseTimeToMinutes(nowLocalTime)
      : null;

  const activeOccupied = occupiedIntervals
    .filter((item) => item.status !== 'cancelled')
    .map((item) => {
      const s = parseTimeToMinutes(item.time);
      const d = Math.max(15, Number(item.durationMinutes) || 60);
      return s === null ? null : { start: s, end: s + d };
    })
    .filter((item): item is { start: number; end: number } => item !== null);

  const slots: string[] = [];
  let cursor = startMins;

  while (cursor + duration <= endMins) {
    const slotEnd = cursor + duration;
    const isPastToday = nowMins !== null && cursor <= nowMins;
    const hasConflict = activeOccupied.some((occ) =>
      intervalsOverlap(cursor, slotEnd, occ.start, occ.end),
    );

    if (!isPastToday && !hasConflict) {
      slots.push(minutesToTime(cursor));
    }

    cursor += stepMinutes;
  }

  return { window, slots };
};

/**
 * Valida que el turno asignado a un empleado no sobrepase el horario general del salón
 * en los días que el empleado tiene marcados como laborables.
 */
export const validateEmployeeScheduleAgainstSalon = (
  schedule: EmployeeSchedule,
  businessHours?: BusinessHour[] | null,
): { valid: boolean; error?: string } => {
  const startMins = parseTimeToMinutes(schedule.startTime);
  const endMins = parseTimeToMinutes(schedule.endTime);

  if (startMins === null || endMins === null) {
    return { valid: false, error: 'El horario de entrada y salida debe tener formato HH:mm.' };
  }

  if (startMins >= endMins) {
    return {
      valid: false,
      error: 'La hora de entrada debe ser anterior a la hora de salida.',
    };
  }

  if (!Array.isArray(schedule.workDays) || schedule.workDays.length === 0) {
    return {
      valid: false,
      error: 'Selecciona al menos un día laborable para el profesional.',
    };
  }

  const normalizedSalon = normalizeBusinessHours(businessHours);

  for (const dayOfWeek of schedule.workDays) {
    const salonDay = normalizedSalon.find((h) => h.dayOfWeek === dayOfWeek);
    const meta = getWeekDayMeta(dayOfWeek);

    if (!salonDay || !salonDay.isOpen) {
      return {
        valid: false,
        error: `No se puede asignar el día ${meta.label} porque el salón permanece cerrado ese día.`,
      };
    }

    const salonOpen = parseTimeToMinutes(salonDay.openTime || salonDay.open)!;
    const salonClose = parseTimeToMinutes(salonDay.closeTime || salonDay.close)!;

    if (startMins < salonOpen || endMins > salonClose) {
      return {
        valid: false,
        error: `El turno (${schedule.startTime} - ${schedule.endTime}) sobrepasa el horario general del salón el día ${meta.label} (${salonDay.openTime} - ${salonDay.closeTime}).`,
      };
    }
  }

  return { valid: true };
};

/** Determina si un registro de cita corresponde a un bloqueo de descanso / pausa. */
export const isBreakAppointment = (
  appointment?: Pick<Appointment, 'status' | 'appointmentType' | 'serviceId'> | null,
): boolean =>
  Boolean(
    appointment &&
      (appointment.status === 'blocked' ||
        appointment.appointmentType === 'break' ||
        appointment.serviceId === 'break'),
  );
