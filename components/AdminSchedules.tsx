'use client';

/**
 * Gestión de horarios generales del salón (BusinessHours), excepciones/festivos
 * (SpecialDate) y turnos/jornadas de empleados (EmployeeSchedule) en el panel Admin.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatLongDate, todayISO } from '@/lib/format';
import {
  WEEK_DAYS,
  getWeekDayMeta,
  normalizeBusinessHours,
  normalizeEmployeeSchedule,
  validateEmployeeScheduleAgainstSalon,
} from '@/lib/schedule-utils';
import type {
  BusinessHour,
  BusinessInfo,
  EmployeeSchedule,
  SpecialDate,
  UserProfile,
} from '@/lib/types';

export default function AdminSchedules() {
  const { getIdToken } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del horario semanal del salón (BusinessHours)
  const [hours, setHours] = useState<BusinessHour[]>(() => normalizeBusinessHours([]));
  const [savingHours, setSavingHours] = useState(false);

  // Estado de excepciones y festivos (SpecialDate)
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [savingSpecial, setSavingSpecial] = useState(false);
  const [newSpecial, setNewSpecial] = useState<{
    date: string;
    isClosed: boolean;
    customOpenTime: string;
    customCloseTime: string;
    note: string;
  }>({
    date: '',
    isClosed: true,
    customOpenTime: '09:00',
    customCloseTime: '15:00',
    note: '',
  });

  // Estado de empleados y sus turnos (EmployeeSchedule)
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [schedulesByUid, setSchedulesByUid] = useState<Record<string, EmployeeSchedule>>({});
  const [savingEmployeeUid, setSavingEmployeeUid] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const [businessRes, employeesRes] = await Promise.all([
        apiRequest<{ business: BusinessInfo }>('/business', { token }),
        apiRequest<{ employees?: UserProfile[]; users?: UserProfile[] }>('/employees', { token }),
      ]);

      const normalizedHours = normalizeBusinessHours(businessRes.business?.hours);
      setHours(normalizedHours);
      setSpecialDates(businessRes.business?.specialDates || []);

      const empList = (employeesRes.employees || employeesRes.users || []).filter(
        (u) => u.role === 'employee',
      );
      setEmployees(empList);

      const initialSchedules: Record<string, EmployeeSchedule> = {};
      empList.forEach((emp) => {
        const uid = emp.id || emp.uid;
        initialSchedules[uid] = normalizeEmployeeSchedule(emp.schedule);
      });
      setSchedulesByUid(initialSchedules);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'No fue posible cargar la configuración de horarios.'));
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateDayHour = (dayOfWeek: number, patch: Partial<BusinessHour>) => {
    setHours((prev) =>
      prev.map((item) => {
        if (item.dayOfWeek !== dayOfWeek) return item;
        const nextIsOpen = patch.isOpen !== undefined ? patch.isOpen : Boolean(item.isOpen);
        const nextOpenTime = patch.openTime !== undefined ? patch.openTime : item.openTime || '08:00';
        const nextCloseTime = patch.closeTime !== undefined ? patch.closeTime : item.closeTime || '18:00';
        return {
          ...item,
          ...patch,
          isOpen: nextIsOpen,
          openTime: nextOpenTime,
          closeTime: nextCloseTime,
          open: nextIsOpen ? nextOpenTime : '00:00',
          close: nextIsOpen ? nextCloseTime : '00:00',
        };
      }),
    );
  };

  const handleSaveBusinessHours = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingHours(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await apiRequest<{ business: BusinessInfo }>('/business', {
        method: 'PUT',
        token,
        body: { hours },
      });
      setHours(normalizeBusinessHours(res.business?.hours));
      toast.success(
        'Horario general guardado',
        'El horario semanal del salón se actualizó correctamente.',
      );
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'No fue posible guardar el horario general.');
      setError(msg);
      toast.error('Error al guardar horario', msg);
    } finally {
      setSavingHours(false);
    }
  };

  const handleAddSpecialDate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newSpecial.date) {
      toast.error('Fecha requerida', 'Selecciona la fecha de la excepción o festivo.');
      return;
    }

    const entry: SpecialDate = {
      id: newSpecial.date,
      date: newSpecial.date,
      isClosed: newSpecial.isClosed,
      customOpenTime: newSpecial.isClosed ? null : newSpecial.customOpenTime,
      customCloseTime: newSpecial.isClosed ? null : newSpecial.customCloseTime,
      note: newSpecial.note.trim() || (newSpecial.isClosed ? 'Festivo / Cerrado' : 'Jornada especial'),
    };

    const nextList = [
      ...specialDates.filter((item) => item.date !== entry.date),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date));

    setSavingSpecial(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await apiRequest<{ business: BusinessInfo }>('/business', {
        method: 'PUT',
        token,
        body: { specialDates: nextList },
      });
      setSpecialDates(res.business?.specialDates || nextList);
      setNewSpecial({
        date: '',
        isClosed: true,
        customOpenTime: '09:00',
        customCloseTime: '15:00',
        note: '',
      });
      toast.success(
        'Fecha especial guardada',
        `Se configuró el día ${entry.date} (${entry.note}).`,
      );
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'No fue posible guardar la fecha especial.');
      setError(msg);
      toast.error('Error al guardar fecha especial', msg);
    } finally {
      setSavingSpecial(false);
    }
  };

  const handleRemoveSpecialDate = async (dateToRemove: string) => {
    const nextList = specialDates.filter((item) => item.date !== dateToRemove);
    setSavingSpecial(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await apiRequest<{ business: BusinessInfo }>('/business', {
        method: 'PUT',
        token,
        body: { specialDates: nextList },
      });
      setSpecialDates(res.business?.specialDates || nextList);
      toast.info('Excepción eliminada', `Se restauró el horario habitual para el ${dateToRemove}.`);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'No fue posible eliminar la fecha especial.');
      setError(msg);
      toast.error('Error al eliminar excepción', msg);
    } finally {
      setSavingSpecial(false);
    }
  };

  const toggleEmployeeDay = (uid: string, dayOfWeek: number) => {
    setSchedulesByUid((prev) => {
      const current = prev[uid] || normalizeEmployeeSchedule(null);
      const exists = current.workDays.includes(dayOfWeek);
      const nextDays = exists
        ? current.workDays.filter((d) => d !== dayOfWeek)
        : [...current.workDays, dayOfWeek];
      return {
        ...prev,
        [uid]: {
          ...current,
          workDays: nextDays,
        },
      };
    });
  };

  const updateEmployeeTime = (
    uid: string,
    field: 'startTime' | 'endTime',
    value: string,
  ) => {
    setSchedulesByUid((prev) => {
      const current = prev[uid] || normalizeEmployeeSchedule(null);
      return {
        ...prev,
        [uid]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleSaveEmployeeSchedule = async (employee: UserProfile) => {
    const uid = employee.id || employee.uid;
    const schedule = schedulesByUid[uid] || normalizeEmployeeSchedule(employee.schedule);

    const validation = validateEmployeeScheduleAgainstSalon(schedule, hours);
    if (!validation.valid) {
      toast.error('Horario fuera de rango', validation.error);
      return;
    }

    setSavingEmployeeUid(uid);
    setError(null);
    try {
      const token = await getIdToken();
      await apiRequest(`/auth/users/${uid}/schedule`, {
        method: 'PATCH',
        token,
        body: { schedule },
      });
      toast.success(
        'Turno actualizado',
        `La jornada de ${employee.displayName} se guardó correctamente.`,
      );
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'No fue posible guardar el turno del profesional.');
      toast.error('Error al guardar turno', msg);
    } finally {
      setSavingEmployeeUid(null);
    }
  };

  if (loading) {
    return (
      <div className="card flex min-h-[300px] items-center justify-center">
        <LoadingSpinner label="Cargando horarios y turnos..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {/* 1. HORARIO GENERAL DEL SALÓN + EXCEPCIONES Y FESTIVOS */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Tabla semanal interactiva (BusinessHours) */}
        <section className="card">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-brand-800">
              Horario general del salón
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Configura para cada día de la semana (lunes a domingo) si el salón está abierto y su horario de apertura y cierre.
            </p>
          </div>

          <form onSubmit={handleSaveBusinessHours} className="space-y-3">
            <div className="overflow-x-auto rounded-2xl border border-brand-100">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 bg-brand-50/50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Día</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Apertura</th>
                    <th className="px-4 py-3">Cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-50">
                  {WEEK_DAYS.map((meta) => {
                    const row =
                      hours.find((h) => h.dayOfWeek === meta.dayOfWeek) || {
                        day: meta.day,
                        dayOfWeek: meta.dayOfWeek,
                        isOpen: meta.defaultOpen,
                        openTime: meta.defaultOpenTime,
                        closeTime: meta.defaultCloseTime,
                        open: meta.defaultOpen ? meta.defaultOpenTime : '00:00',
                        close: meta.defaultOpen ? meta.defaultCloseTime : '00:00',
                      };

                    const isOpen = Boolean(row.isOpen);

                    return (
                      <tr
                        key={meta.dayOfWeek}
                        className={isOpen ? 'bg-white' : 'bg-slate-50/70 text-slate-400'}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {meta.label}
                        </td>
                        <td className="px-4 py-3">
                          <label className="inline-flex cursor-pointer items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isOpen}
                              onChange={(event) =>
                                updateDayHour(meta.dayOfWeek, { isOpen: event.target.checked })
                              }
                              className="peer sr-only"
                            />
                            <span className="relative h-6 w-11 rounded-full bg-slate-300 transition after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
                            <span
                              className={`text-xs font-semibold ${
                                isOpen ? 'text-emerald-700' : 'text-slate-500'
                              }`}
                            >
                              {isOpen ? 'Abierto' : 'Cerrado'}
                            </span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            disabled={!isOpen}
                            value={row.openTime || '08:00'}
                            onChange={(event) =>
                              updateDayHour(meta.dayOfWeek, { openTime: event.target.value })
                            }
                            aria-label={`Hora de apertura ${meta.label}`}
                            className="rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="time"
                            disabled={!isOpen}
                            value={row.closeTime || '18:00'}
                            onChange={(event) =>
                              updateDayHour(meta.dayOfWeek, { closeTime: event.target.value })
                            }
                            aria-label={`Hora de cierre ${meta.label}`}
                            className="rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingHours}
                className="btn-primary disabled:opacity-60"
              >
                {savingHours && (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                )}
                Guardar horario general
              </button>
            </div>
          </form>
        </section>

        {/* Excepciones y Festivos (SpecialDate) */}
        <section className="card space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-800">
              Excepciones y festivos
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Agrega fechas con cierre total (festivos, vacaciones) o jornadas reducidas especiales.
            </p>
          </div>

          <form onSubmit={handleAddSpecialDate} className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/30 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="special-date" className="label-field">
                  Fecha
                </label>
                <input
                  id="special-date"
                  type="date"
                  min={todayISO()}
                  value={newSpecial.date}
                  onChange={(event) =>
                    setNewSpecial({ ...newSpecial, date: event.target.value })
                  }
                  required
                  className="input-field bg-white"
                />
              </div>

              <div>
                <label htmlFor="special-note" className="label-field">
                  Motivo / Nota
                </label>
                <input
                  id="special-note"
                  type="text"
                  placeholder="Ej. Festivo, Navidad, Inventario..."
                  value={newSpecial.note}
                  onChange={(event) =>
                    setNewSpecial({ ...newSpecial, note: event.target.value })
                  }
                  required
                  className="input-field bg-white"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="inline-flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={newSpecial.isClosed}
                  onChange={(event) =>
                    setNewSpecial({ ...newSpecial, isClosed: event.target.checked })
                  }
                  className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-400"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Cierre total durante todo el día
                </span>
              </label>
            </div>

            {!newSpecial.isClosed && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="special-open" className="label-field">
                    Apertura especial
                  </label>
                  <input
                    id="special-open"
                    type="time"
                    value={newSpecial.customOpenTime}
                    onChange={(event) =>
                      setNewSpecial({ ...newSpecial, customOpenTime: event.target.value })
                    }
                    required
                    className="input-field bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="special-close" className="label-field">
                    Cierre especial
                  </label>
                  <input
                    id="special-close"
                    type="time"
                    value={newSpecial.customCloseTime}
                    onChange={(event) =>
                      setNewSpecial({ ...newSpecial, customCloseTime: event.target.value })
                    }
                    required
                    className="input-field bg-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={savingSpecial}
              className="btn-primary w-full py-2.5 text-xs disabled:opacity-60"
            >
              + Agregar fecha especial
            </button>
          </form>

          {/* Lista de fechas especiales configuradas */}
          <div className="space-y-2.5">
            {specialDates.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay fechas especiales o festivos programados.
              </p>
            ) : (
              specialDates.map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold capitalize text-slate-800">
                      📅 {formatLongDate(item.date)}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      <span
                        className={`mr-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.isClosed
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.isClosed
                          ? 'Cerrado todo el día'
                          : `Jornada: ${item.customOpenTime} – ${item.customCloseTime}`}
                      </span>
                      {item.note}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={savingSpecial}
                    onClick={() => void handleRemoveSpecialDate(item.date)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 2. TURNOS Y JORNADAS DE EMPLEADOS */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-800">
            Turnos y jornadas de profesionales
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Configura los días laborables y el horario de entrada y salida de cada profesional. El turno asignado no puede sobrepasar el horario general del salón.
          </p>
        </div>

        {employees.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay profesionales con rol &ldquo;Empleado&rdquo; registrados. Créalos en la pestaña Usuarios.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {employees.map((employee) => {
              const uid = employee.id || employee.uid;
              const schedule =
                schedulesByUid[uid] || normalizeEmployeeSchedule(employee.schedule);
              const isSavingThis = savingEmployeeUid === uid;

              return (
                <article
                  key={uid}
                  className="flex flex-col justify-between rounded-2xl border border-brand-100 bg-brand-50/20 p-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 border-b border-brand-100 pb-3">
                      <div>
                        <h3 className="font-display text-base font-bold text-slate-800">
                          👩‍💼 {employee.displayName}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {employee.phone || employee.email || 'Profesional'}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-800">
                        {schedule.startTime} – {schedule.endTime}
                      </span>
                    </div>

                    {/* Selector de días que labora */}
                    <div>
                      <p className="label-field">Días que labora</p>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEK_DAYS.map((meta) => {
                          const salonDay = hours.find(
                            (h) => h.dayOfWeek === meta.dayOfWeek,
                          );
                          const salonOpen = Boolean(salonDay?.isOpen);
                          const active = schedule.workDays.includes(meta.dayOfWeek);

                          return (
                            <button
                              key={meta.dayOfWeek}
                              type="button"
                              disabled={!salonOpen && !active}
                              onClick={() => toggleEmployeeDay(uid, meta.dayOfWeek)}
                              title={
                                salonOpen
                                  ? `${meta.label} (${salonDay?.openTime} - ${salonDay?.closeTime})`
                                  : `${meta.label}: Salón cerrado`
                              }
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                active
                                  ? 'border-brand-500 bg-gradient-to-r from-brand-500 to-plum-600 text-white shadow-xs'
                                  : salonOpen
                                    ? 'border-brand-200 bg-white text-slate-600 hover:bg-brand-50'
                                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                              }`}
                            >
                              {meta.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Activos:{' '}
                        {schedule.workDays.length === 0
                          ? 'Ninguno seleccionado'
                          : WEEK_DAYS.filter((m) =>
                              schedule.workDays.includes(m.dayOfWeek),
                            )
                              .map((m) => getWeekDayMeta(m.dayOfWeek).label)
                              .join(', ')}
                      </p>
                    </div>

                    {/* Horario de entrada y salida */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor={`emp-start-${uid}`}
                          className="label-field"
                        >
                          Hora de entrada
                        </label>
                        <input
                          id={`emp-start-${uid}`}
                          type="time"
                          value={schedule.startTime}
                          onChange={(event) =>
                            updateEmployeeTime(uid, 'startTime', event.target.value)
                          }
                          className="input-field bg-white py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`emp-end-${uid}`}
                          className="label-field"
                        >
                          Hora de salida
                        </label>
                        <input
                          id={`emp-end-${uid}`}
                          type="time"
                          value={schedule.endTime}
                          onChange={(event) =>
                            updateEmployeeTime(uid, 'endTime', event.target.value)
                          }
                          className="input-field bg-white py-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end border-t border-brand-100 pt-3">
                    <button
                      type="button"
                      disabled={isSavingThis}
                      onClick={() => void handleSaveEmployeeSchedule(employee)}
                      className="btn-primary px-5 py-2 text-xs disabled:opacity-60"
                    >
                      {isSavingThis && (
                        <span
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                          aria-hidden="true"
                        />
                      )}
                      Guardar jornada
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
