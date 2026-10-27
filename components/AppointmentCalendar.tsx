'use client';

/**
 * Agenda Diaria tipo Time-Grid (08:00 a 20:00), exclusiva para Administrador y Empleados:
 * - Eje vertical horario proporcional: 60 min = 80px (15 min = 20px, 30 min = 40px,
 *   45 min = 60px, 60 min = 80px, 90 min = 120px).
 * - Vista Administrador: columnas paralelas por cada profesional en el dia seleccionado,
 *   diferenciadas por color y mostrando cliente, servicio y duracion.
 * - Vista Profesional (empleado): una sola columna con su propia agenda del dia seleccionado.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import StatusBadge from '@/components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatCurrency, formatLongDate, formatShortDate, formatTime, todayISO } from '@/lib/format';
import type { Appointment, AppointmentStatus, UserProfile } from '@/lib/types';

/** Constantes del eje horario (08:00 a 20:00, 60 min = 80px). */
const START_HOUR = 8;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 12 horas
const HOUR_HEIGHT_PX = 80; // 60 min = 80px -> 15m=20px, 20m=26.67px, 30m=40px, 45m=60px, 90m=120px
const TOTAL_GRID_HEIGHT_PX = TOTAL_HOURS * HOUR_HEIGHT_PX; // 960px

interface ColumnPalette {
  id: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
  headerBg: string;
  badgeBg: string;
  hoverBg: string;
}

const EMPLOYEE_PALETTES: ColumnPalette[] = [
  {
    id: 'brand',
    bg: 'bg-brand-50/95',
    border: 'border-brand-300',
    text: 'text-brand-900',
    dot: 'bg-brand-500',
    headerBg: 'bg-brand-50/80',
    badgeBg: 'bg-brand-100 text-brand-800 border-brand-200',
    hoverBg: 'hover:bg-brand-100',
  },
  {
    id: 'plum',
    bg: 'bg-plum-50/95',
    border: 'border-plum-300',
    text: 'text-plum-900',
    dot: 'bg-plum-500',
    headerBg: 'bg-plum-50/80',
    badgeBg: 'bg-plum-100 text-plum-700 border-plum-200',
    hoverBg: 'hover:bg-plum-100',
  },
  {
    id: 'emerald',
    bg: 'bg-emerald-50/95',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-50/80',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    hoverBg: 'hover:bg-emerald-100',
  },
  {
    id: 'sky',
    bg: 'bg-sky-50/95',
    border: 'border-sky-300',
    text: 'text-sky-900',
    dot: 'bg-sky-500',
    headerBg: 'bg-sky-50/80',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
    hoverBg: 'hover:bg-sky-100',
  },
  {
    id: 'amber',
    bg: 'bg-amber-50/95',
    border: 'border-amber-300',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
    headerBg: 'bg-amber-50/80',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    hoverBg: 'hover:bg-amber-100',
  },
  {
    id: 'indigo',
    bg: 'bg-indigo-50/95',
    border: 'border-indigo-300',
    text: 'text-indigo-900',
    dot: 'bg-indigo-500',
    headerBg: 'bg-indigo-50/80',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    hoverBg: 'hover:bg-indigo-100',
  },
  {
    id: 'teal',
    bg: 'bg-teal-50/95',
    border: 'border-teal-300',
    text: 'text-teal-900',
    dot: 'bg-teal-500',
    headerBg: 'bg-teal-50/80',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
    hoverBg: 'hover:bg-teal-100',
  },
];

const UNASSIGNED_PALETTE: ColumnPalette = {
  id: 'unassigned',
  bg: 'bg-slate-100/95',
  border: 'border-slate-300',
  text: 'text-slate-800',
  dot: 'bg-slate-400',
  headerBg: 'bg-slate-50',
  badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
  hoverBg: 'hover:bg-slate-200/80',
};

const STATUS_PALETTES: Record<AppointmentStatus, ColumnPalette> = {
  pending: {
    id: 'pending',
    bg: 'bg-amber-50/95',
    border: 'border-amber-300',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
    headerBg: 'bg-amber-50',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
    hoverBg: 'hover:bg-amber-100',
  },
  confirmed: {
    id: 'confirmed',
    bg: 'bg-brand-50/95',
    border: 'border-brand-300',
    text: 'text-brand-900',
    dot: 'bg-brand-500',
    headerBg: 'bg-brand-50',
    badgeBg: 'bg-brand-100 text-brand-800 border-brand-200',
    hoverBg: 'hover:bg-brand-100',
  },
  completed: {
    id: 'completed',
    bg: 'bg-emerald-50/95',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    headerBg: 'bg-emerald-50',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    hoverBg: 'hover:bg-emerald-100',
  },
  cancelled: {
    id: 'cancelled',
    bg: 'bg-rose-50/80',
    border: 'border-rose-200',
    text: 'text-rose-700 line-through opacity-75',
    dot: 'bg-rose-400',
    headerBg: 'bg-rose-50',
    badgeBg: 'bg-rose-100 text-rose-700 border-rose-200',
    hoverBg: 'hover:bg-rose-100',
  },
};

const EMPLOYEE_ACTIONS: Array<{ status: AppointmentStatus; label: string; className: string }> = [
  { status: 'confirmed', label: 'Confirmar cita', className: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { status: 'completed', label: 'Marcar completada', className: 'bg-brand-600 text-white hover:bg-brand-700' },
  { status: 'cancelled', label: 'Cancelar cita', className: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50' },
];

/** Convierte `HH:mm` en minutos totales desde las 00:00. */
const timeToMinutes = (time: string): number => {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return START_HOUR * 60;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Calcula la hora de fin en formato `HH:mm` a partir de hora de inicio y duracion. */
const computeEndTime = (time: string, durationMinutes = 60): string => {
  const startMins = timeToMinutes(time);
  const total = startMins + (Number(durationMinutes) || 60);
  const endH = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const endM = String(total % 60).padStart(2, '0');
  return `${endH}:${endM}`;
};

/** Calcula posicion vertical (`top`) y altura (`height`) en pixeles segun hora y duracion. */
const computeBlockGeometry = (time: string, durationMinutes = 60) => {
  const startMinutesFromAxis = timeToMinutes(time) - START_HOUR * 60;
  const clampedStart = Math.max(0, Math.min(startMinutesFromAxis, TOTAL_HOURS * 60 - 15));
  const duration = Math.max(15, Number(durationMinutes) || 60);
  const maxAvailableMinutes = TOTAL_HOURS * 60 - clampedStart;
  const effectiveDuration = Math.min(duration, maxAvailableMinutes);

  const topPx = (clampedStart / 60) * HOUR_HEIGHT_PX;
  const heightPx = (effectiveDuration / 60) * HOUR_HEIGHT_PX;

  return { topPx, heightPx, duration };
};

/** Distribuye citas que se solapan en una misma columna en sub-carriles horizontales. */
interface PositionedAppointment {
  appointment: Appointment;
  topPx: number;
  heightPx: number;
  duration: number;
  laneIndex: number;
  totalLanes: number;
}

const layoutColumnAppointments = (appointments: Appointment[]): PositionedAppointment[] => {
  const sorted = [...appointments].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time) || (b.durationMinutes || 60) - (a.durationMinutes || 60),
  );

  interface TempItem {
    appointment: Appointment;
    startMin: number;
    endMin: number;
    topPx: number;
    heightPx: number;
    duration: number;
    laneIndex: number;
    groupId: number;
  }

  const items: TempItem[] = [];
  let currentGroupEnd = -1;
  let currentGroupId = -1;
  let laneEnds: number[] = [];

  sorted.forEach((appointment) => {
    const startMin = timeToMinutes(appointment.time);
    const duration = Math.max(15, Number(appointment.durationMinutes) || 60);
    const endMin = startMin + duration;
    const { topPx, heightPx } = computeBlockGeometry(appointment.time, duration);

    if (startMin >= currentGroupEnd) {
      currentGroupId += 1;
      currentGroupEnd = endMin;
      laneEnds = [endMin];
      items.push({
        appointment,
        startMin,
        endMin,
        topPx,
        heightPx,
        duration,
        laneIndex: 0,
        groupId: currentGroupId,
      });
    } else {
      currentGroupEnd = Math.max(currentGroupEnd, endMin);
      let assignedLane = laneEnds.findIndex((laneEnd) => laneEnd <= startMin);
      if (assignedLane === -1) {
        assignedLane = laneEnds.length;
        laneEnds.push(endMin);
      } else {
        laneEnds[assignedLane] = endMin;
      }
      items.push({
        appointment,
        startMin,
        endMin,
        topPx,
        heightPx,
        duration,
        laneIndex: assignedLane,
        groupId: currentGroupId,
      });
    }
  });

  const maxLanesByGroup = new Map<number, number>();
  items.forEach((item) => {
    const currentMax = maxLanesByGroup.get(item.groupId) || 1;
    maxLanesByGroup.set(item.groupId, Math.max(currentMax, item.laneIndex + 1));
  });

  return items.map((item) => ({
    appointment: item.appointment,
    topPx: item.topPx,
    heightPx: item.heightPx,
    duration: item.duration,
    laneIndex: item.laneIndex,
    totalLanes: maxLanesByGroup.get(item.groupId) || 1,
  }));
};

/** Suma o resta dias a una fecha `YYYY-MM-DD`. */
const shiftISODate = (iso: string, deltaDays: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, (d || 1) + deltaDays, 12, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface AppointmentCalendarProps {
  /** Lista de citas provista por el padre. Si se omite, consulta `/api/appointments`. */
  appointments?: Appointment[];
  /** Si es `true`, deshabilita las acciones de cambio de estado en el modal. */
  readOnly?: boolean;
  /** Callback al actualizar el estado de una cita. */
  onUpdated?: (appointment: Appointment) => void;
}

interface AgendaColumn {
  key: string;
  title: string;
  subtitle?: string;
  palette: ColumnPalette;
  appointments: Appointment[];
}

export default function AppointmentCalendar({
  appointments: externalAppointments,
  readOnly = false,
  onUpdated,
}: AppointmentCalendarProps) {
  const { role, profile, getIdToken } = useAuth();
  const isAdmin = role === 'admin';
  const isClientRole = role === 'client' || readOnly;

  const today = useMemo(() => todayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showCancelled, setShowCancelled] = useState<boolean>(false);

  const [internalAppointments, setInternalAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(externalAppointments === undefined);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /* Carga de citas cuando el componente se usa de forma autonoma */
  const loadAppointments = useCallback(async () => {
    if (externalAppointments !== undefined) return;
    setLoading(true);
    setFetchError(null);
    try {
      const token = await getIdToken();
      const data = await apiRequest<{ appointments: Appointment[] }>('/appointments', { token });
      setInternalAppointments(data.appointments || []);
    } catch (err: unknown) {
      setFetchError(getErrorMessage(err, 'No fue posible cargar las citas de la agenda.'));
    } finally {
      setLoading(false);
    }
  }, [externalAppointments, getIdToken]);

  useEffect(() => {
    if (externalAppointments === undefined) {
      void loadAppointments();
    }
  }, [externalAppointments, loadAppointments]);

  /* Carga de la lista de profesionales para las columnas paralelas del Administrador */
  useEffect(() => {
    if (!isAdmin) return undefined;
    let active = true;
    const loadEmployees = async () => {
      try {
        const token = await getIdToken();
        const data = await apiRequest<{ employees?: UserProfile[]; users?: UserProfile[] }>('/employees', { token });
        if (!active) return;
        setEmployees((data.employees || data.users || []).filter((emp) => emp.active !== false));
      } catch {
        if (!active) return;
        setEmployees([]);
      }
    };
    void loadEmployees();
    return () => {
      active = false;
    };
  }, [isAdmin, getIdToken]);

  const allAppointments = externalAppointments ?? internalAppointments;

  /** Citas correspondientes al dia seleccionado. */
  const dayAppointments = useMemo(() => {
    return allAppointments.filter((item) => {
      if (item.date !== selectedDate) return false;
      if (!showCancelled && item.status === 'cancelled') return false;
      return true;
    });
  }, [allAppointments, selectedDate, showCancelled]);

  /** Fechas con citas activas (accesos rapidos para navegar a dias con actividad). */
  const upcomingDatesWithAppointments = useMemo(() => {
    const counts = new Map<string, number>();
    allAppointments.forEach((item) => {
      if (!showCancelled && item.status === 'cancelled') return;
      counts.set(item.date, (counts.get(item.date) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 8);
  }, [allAppointments, showCancelled]);

  /**
   * Construccion de las columnas del Time-Grid:
   * - Admin: una columna paralela por cada empleado registrado (mas columna "Sin asignar" si aplica).
   * - Empleado / Cliente: una sola columna con su propia agenda del dia.
   */
  const columns = useMemo<AgendaColumn[]>(() => {
    if (isAdmin) {
      const columnMap = new Map<string, { id: string; name: string; appointments: Appointment[] }>();

      employees.forEach((emp) => {
        const key = emp.id || emp.uid;
        if (key) {
          columnMap.set(key, {
            id: key,
            name: emp.displayName || 'Profesional',
            appointments: [],
          });
        }
      });

      const unassigned: Appointment[] = [];

      dayAppointments.forEach((appointment) => {
        const key = appointment.employeeId || appointment.employeeName || '';
        if (!key) {
          unassigned.push(appointment);
          return;
        }
        const existing = columnMap.get(key);
        if (existing) {
          existing.appointments.push(appointment);
        } else {
          columnMap.set(key, {
            id: key,
            name: appointment.employeeName || 'Profesional',
            appointments: [appointment],
          });
        }
      });

      const result: AgendaColumn[] = Array.from(columnMap.values()).map((col, idx) => ({
        key: col.id,
        title: col.name,
        subtitle: `${col.appointments.length} cita${col.appointments.length === 1 ? '' : 's'}`,
        palette: EMPLOYEE_PALETTES[idx % EMPLOYEE_PALETTES.length],
        appointments: col.appointments,
      }));

      if (unassigned.length > 0 || result.length === 0) {
        result.push({
          key: 'unassigned',
          title: result.length === 0 && unassigned.length === 0 ? 'Agenda general' : 'Sin profesional asignado',
          subtitle: `${unassigned.length} cita${unassigned.length === 1 ? '' : 's'}`,
          palette: UNASSIGNED_PALETTE,
          appointments: unassigned,
        });
      }

      return result;
    }

    // Vista de una sola columna para Empleado o Cliente
    return [
      {
        key: 'single-agenda',
        title: isClientRole ? 'Mis citas del día' : profile?.name || 'Mi agenda del día',
        subtitle: `${dayAppointments.length} cita${dayAppointments.length === 1 ? '' : 's'} programada${
          dayAppointments.length === 1 ? '' : 's'
        }`,
        palette: EMPLOYEE_PALETTES[0],
        appointments: dayAppointments,
      },
    ];
  }, [dayAppointments, employees, isAdmin, isClientRole, profile?.name]);

  /** Marcas horarias de 08:00 a 20:00. */
  const hourLabels = useMemo(
    () =>
      Array.from({ length: TOTAL_HOURS + 1 }, (_, idx) => {
        const hour = START_HOUR + idx;
        return {
          hour,
          label: `${String(hour).padStart(2, '0')}:00`,
          topPx: idx * HOUR_HEIGHT_PX,
        };
      }),
    [],
  );

  const handleStatusChange = async (appointmentId: string, status: AppointmentStatus) => {
    setBusyId(appointmentId);
    setActionError(null);
    try {
      const token = await getIdToken();
      const data = await apiRequest<{ appointment: Appointment }>(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      setActiveAppointment(data.appointment);
      if (externalAppointments === undefined) {
        setInternalAppointments((prev) =>
          prev.map((item) => (item.id === appointmentId ? data.appointment : item)),
        );
      }
      onUpdated?.(data.appointment);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, 'No fue posible actualizar el estado de la cita.'));
    } finally {
      setBusyId(null);
    }
  };

  if (role === 'client') {
    return null;
  }

  if (loading) {
    return (
      <div className="card flex min-h-[360px] items-center justify-center">
        <LoadingSpinner label="Cargando agenda diaria..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {fetchError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{fetchError}</p>
      )}

      <div className="card space-y-5">
        {/* Barra superior de navegacion de fecha */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-brand-200 bg-white p-1 shadow-xs">
              <button
                type="button"
                onClick={() => setSelectedDate((prev) => shiftISODate(prev, -1))}
                aria-label="Día anterior"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedDate === today
                    ? 'bg-gradient-to-r from-brand-500 to-plum-600 text-white'
                    : 'text-brand-700 hover:bg-brand-50'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate((prev) => shiftISODate(prev, 1))}
                aria-label="Día siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
              >
                ›
              </button>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold capitalize text-brand-800 sm:text-xl">
                {formatLongDate(selectedDate)}
              </h2>
              <p className="text-xs text-slate-500">
                Horario de 08:00 a 20:00 · {dayAppointments.length} cita{dayAppointments.length === 1 ? '' : 's'} en el día
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="agenda-date-picker" className="sr-only">
              Seleccionar fecha
            </label>
            <input
              id="agenda-date-picker"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value);
              }}
              className="rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-400 focus:bg-white"
            />

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(event) => setShowCancelled(event.target.checked)}
                className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-400"
              />
              Ver canceladas
            </label>
          </div>
        </div>

        {/* Accesos rapidos a dias con citas registradas */}
        {upcomingDatesWithAppointments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Días con citas:</span>
            {upcomingDatesWithAppointments.map(([dateIso, count]) => {
              const active = dateIso === selectedDate;
              return (
                <button
                  key={dateIso}
                  type="button"
                  onClick={() => setSelectedDate(dateIso)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? 'border-brand-500 bg-gradient-to-r from-brand-500 to-plum-600 text-white shadow-xs'
                      : 'border-brand-100 bg-brand-50/40 text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  <span>{dateIso === today ? 'Hoy' : formatShortDate(dateIso)}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Leyenda de colores por profesional (Admin) o por estado (Empleado/Cliente) */}
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Profesionales:</span>
            {columns.map((col) => (
              <span
                key={col.key}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${col.palette.badgeBg}`}
              >
                <span className={`h-2 w-2 rounded-full ${col.palette.dot}`} />
                <span>{col.title}</span>
                <span className="text-[10px] opacity-75">({col.appointments.length})</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 border-t border-brand-100 pt-3 text-xs text-slate-600">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Estados:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pendiente
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Confirmada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Completada
            </span>
          </div>
        )}

        {/* CONTENEDOR DEL TIME-GRID (08:00 a 20:00) */}
        <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white">
          <div
            className="min-w-[640px]"
            style={{
              minWidth: isAdmin && columns.length > 2 ? `${Math.max(640, columns.length * 240 + 72)}px` : undefined,
            }}
          >
            {/* Cabecera de columnas (Eje horario + Columnas de empleados o columna unica) */}
            <div
              className="grid border-b border-brand-100 bg-brand-50/50"
              style={{
                gridTemplateColumns: `72px repeat(${columns.length}, minmax(210px, 1fr))`,
              }}
            >
              <div className="flex items-center justify-center border-r border-brand-100 px-2 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Hora
              </div>

              {columns.map((column) => (
                <div
                  key={column.key}
                  className={`flex items-center justify-between gap-2 border-r border-brand-100 px-3.5 py-3 last:border-r-0 ${column.palette.headerBg}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${column.palette.dot}`} />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-slate-800">{column.title}</p>
                      {column.subtitle && <p className="text-[11px] text-slate-500">{column.subtitle}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cuerpo del Time-Grid con altura proporcional (60 min = 80px) */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `72px repeat(${columns.length}, minmax(210px, 1fr))`,
              }}
            >
              {/* Columna izquierda: etiquetas de hora (08:00 a 20:00) */}
              <div
                className="relative border-r border-brand-100 bg-brand-50/20 select-none"
                style={{ height: `${TOTAL_GRID_HEIGHT_PX}px` }}
              >
                {hourLabels.map(({ hour, label, topPx }) => (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-2 text-[11px] font-semibold text-slate-400"
                    style={{ top: `${Math.max(4, Math.min(topPx, TOTAL_GRID_HEIGHT_PX - 16))}px` }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Columnas paralelas (1 por empleado para Admin, 1 sola columna para Empleado/Cliente) */}
              {columns.map((column) => {
                const positioned = layoutColumnAppointments(column.appointments);

                return (
                  <div
                    key={column.key}
                    className="relative border-r border-brand-100 bg-white last:border-r-0"
                    style={{ height: `${TOTAL_GRID_HEIGHT_PX}px` }}
                  >
                    {/* Lineas guia de cada hora (60 min = 80px) y media hora (30 min = 40px) */}
                    {Array.from({ length: TOTAL_HOURS }, (_, idx) => {
                      const topHour = idx * HOUR_HEIGHT_PX;
                      const topHalf = topHour + HOUR_HEIGHT_PX / 2;
                      return (
                        <div key={idx}>
                          <div
                            className="pointer-events-none absolute inset-x-0 border-t border-brand-100/80"
                            style={{ top: `${topHour}px` }}
                          />
                          <div
                            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brand-100/50"
                            style={{ top: `${topHalf}px` }}
                          />
                        </div>
                      );
                    })}

                    {/* Bloques de citas posicionados con `top` y `height` proporcionales */}
                    {positioned.map(({ appointment, topPx, heightPx, duration, laneIndex, totalLanes }) => {
                      const blockPalette = isAdmin
                        ? column.palette
                        : STATUS_PALETTES[appointment.status] || STATUS_PALETTES.pending;

                      const endTime = computeEndTime(appointment.time, duration);
                      const isCompact = duration <= 25;
                      const isMedium = duration > 25 && duration <= 45;

                      const widthPercent = 100 / totalLanes;
                      const leftPercent = laneIndex * widthPercent;

                      return (
                        <button
                          key={appointment.id}
                          type="button"
                          onClick={() => {
                            setActionError(null);
                            setActiveAppointment(appointment);
                          }}
                          title={`${appointment.time} - ${endTime} (${duration} min) · ${appointment.serviceName} · Cliente: ${appointment.userName}`}
                          style={{
                            top: `${topPx}px`,
                            height: `${Math.max(heightPx - 2, 18)}px`,
                            left: `calc(${leftPercent}% + 4px)`,
                            width: `calc(${widthPercent}% - 8px)`,
                          }}
                          className={`group absolute z-10 flex flex-col justify-between overflow-hidden rounded-xl border-l-4 border px-2.5 text-left shadow-xs transition ${
                            isCompact ? 'py-0.5' : 'py-1.5'
                          } ${blockPalette.bg} ${blockPalette.border} ${blockPalette.text} ${blockPalette.hoverBg}`}
                        >
                          {isCompact ? (
                            /* Diseño ultra-compacto para citas de 15 o 20 minutos */
                            <div className="flex items-center justify-between gap-1.5 truncate text-[11px] leading-none">
                              <span className="font-bold">
                                {appointment.time} · {appointment.serviceName}
                              </span>
                              <span className="shrink-0 opacity-80">
                                {!isClientRole && appointment.userName ? `${appointment.userName} · ` : ''}
                                {duration}m
                              </span>
                            </div>
                          ) : isMedium ? (
                            /* Diseño medio para citas de 30 o 45 minutos */
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1 text-[11px] leading-tight">
                                <span className="font-bold">
                                  {appointment.time} – {endTime}
                                </span>
                                <span className="shrink-0 rounded-full bg-white/75 px-1.5 py-0.2 text-[10px] font-semibold">
                                  {duration} min
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs font-semibold">
                                {appointment.serviceName}
                                {!isClientRole && appointment.userName ? ` · ${appointment.userName}` : ''}
                              </p>
                            </div>
                          ) : (
                            /* Diseño completo para citas de 60, 90 o mas minutos */
                            <>
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-1 text-[11px] leading-tight">
                                  <span className="font-bold">
                                    {appointment.time} – {endTime}
                                  </span>
                                  <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold">
                                    {duration} min
                                  </span>
                                </div>
                                <p className="mt-1 truncate font-display text-xs font-bold sm:text-sm">
                                  {appointment.serviceName}
                                </p>
                                {!isClientRole && appointment.userName && (
                                  <p className="mt-0.5 truncate text-[11px] opacity-90">
                                    👤 Cliente: <strong>{appointment.userName}</strong>
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-1 pt-1 text-[10px] opacity-80">
                                <span className="truncate">
                                  {isAdmin
                                    ? `👩‍💼 ${appointment.employeeName || 'Sin asignar'}`
                                    : formatCurrency(appointment.servicePrice)}
                                </span>
                                <span className="font-semibold underline group-hover:opacity-100">Detalles</span>
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalles al hacer clic en una cita */}
      {activeAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/40 p-4 backdrop-blur-xs"
          onClick={() => setActiveAppointment(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-modal-title"
        >
          <div
            className="w-full max-w-md animate-pop-in rounded-3xl border border-brand-100 bg-white p-6 shadow-chat"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  Detalle de la cita
                </span>
                <h3 id="appointment-modal-title" className="mt-2 font-display text-xl font-bold text-brand-800">
                  {activeAppointment.serviceName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveAppointment(null)}
                aria-label="Cerrar modal"
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between border-y border-brand-100 py-3">
              <StatusBadge status={activeAppointment.status} />
              <span className="font-display text-lg font-bold text-plum-700">
                {formatCurrency(activeAppointment.servicePrice)}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-500">📅 Fecha</dt>
                <dd className="text-right font-semibold capitalize text-slate-800">
                  {formatLongDate(activeAppointment.date)}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-500">🕒 Horario y duración</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {formatTime(activeAppointment.time)} –{' '}
                  {formatTime(computeEndTime(activeAppointment.time, activeAppointment.durationMinutes))}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({activeAppointment.durationMinutes} min)
                  </span>
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-500">👤 Cliente</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {activeAppointment.userName || 'No especificado'}
                  {activeAppointment.userEmail && (
                    <span className="block text-xs font-normal text-slate-500">{activeAppointment.userEmail}</span>
                  )}
                  {activeAppointment.userPhone && (
                    <span className="block text-xs font-normal text-slate-500">Tel: {activeAppointment.userPhone}</span>
                  )}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4">
                <dt className="font-medium text-slate-500">👩‍💼 Profesional</dt>
                <dd className="text-right font-semibold text-brand-700">
                  {activeAppointment.employeeName || 'Sin asignar'}
                </dd>
              </div>

              {activeAppointment.notes && (
                <div className="rounded-2xl bg-brand-50/60 p-3 text-xs text-slate-600">
                  <dt className="font-semibold uppercase tracking-wide text-brand-700">Notas</dt>
                  <dd className="mt-1 italic">“{activeAppointment.notes}”</dd>
                </div>
              )}
            </dl>

            {actionError && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {actionError}
              </p>
            )}

            {!isClientRole &&
              activeAppointment.status !== 'cancelled' &&
              activeAppointment.status !== 'completed' && (
                <div className="mt-5 border-t border-brand-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Cambiar estado
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EMPLOYEE_ACTIONS.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        disabled={busyId === activeAppointment.id || activeAppointment.status === action.status}
                        onClick={() => handleStatusChange(activeAppointment.id, action.status)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${action.className}`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAppointment(null)}
                className="btn-secondary px-5 py-2 text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
