'use client';

/**
 * Administracion de usuarios, roles y jornadas de empleados (admin).
 */
import { useCallback, useEffect, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth, ROLE_LABELS } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { extractPhoneFromAuthEmail } from '@/lib/format';
import {
  WEEK_DAYS,
  normalizeBusinessHours,
  normalizeEmployeeSchedule,
  validateEmployeeScheduleAgainstSalon,
} from '@/lib/schedule-utils';
import type {
  BusinessHour,
  BusinessInfo,
  EmployeeSchedule,
  Role,
  UserProfile,
} from '@/lib/types';

const ROLE_OPTIONS: Role[] = ['client', 'employee', 'admin'];

export default function AdminUsers() {
  const { getIdToken } = useAuth();
  const toast = useToast();

  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '', displayName: '', role: 'client' });

  // Estado para configurar la jornada desde la ficha de un empleado
  const [salonHours, setSalonHours] = useState<BusinessHour[]>(() => normalizeBusinessHours([]));
  const [editingScheduleUser, setEditingScheduleUser] = useState<UserProfile | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<EmployeeSchedule>(() =>
    normalizeEmployeeSchedule(null),
  );
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    let active = true;
    const loadBusiness = async () => {
      try {
        const data = await apiRequest<{ business: BusinessInfo }>('/business');
        if (!active) return;
        setSalonHours(normalizeBusinessHours(data.business?.hours));
      } catch {
        // Mantiene valores por defecto si falla
      }
    };
    void loadBusiness();
    return () => {
      active = false;
    };
  }, []);

  const fetchUsers = useCallback(async (): Promise<UserProfile[]> => {
    const token = await getIdToken();
    const data = await apiRequest<{ users: UserProfile[] }>(`/auth/users?search=${encodeURIComponent(search)}`, {
      token,
    });
    return data.users || [];
  }, [getIdToken, search]);

  const { data: users, error, loading, reload, setError } = useAsyncData(fetchUsers, {
    initialData: [] as UserProfile[],
    errorMessage: 'No fue posible cargar los usuarios.',
  });

  const changeRole = async (uid: string, role: string) => {
    setError(null);
    setMessage(null);
    try {
      const token = await getIdToken();
      await apiRequest(`/auth/users/${uid}/role`, { method: 'PATCH', token, body: { role } });
      setMessage('Rol actualizado correctamente.');
      toast.success('Rol actualizado', 'El rol del usuario se actualizó correctamente.');
      await reload();
    } catch (requestError: unknown) {
      const errMsg = getErrorMessage(requestError, 'No fue posible actualizar el rol.');
      setError(errMsg);
      toast.error('Error al actualizar rol', errMsg);
    }
  };

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setCreating(true);

    try {
      const token = await getIdToken();
      await apiRequest('/auth/users', { method: 'POST', token, body: form });
      setMessage('Usuario creado correctamente.');
      toast.success('Usuario creado', `Se registró a ${form.displayName} correctamente.`);
      setForm({ phone: '', password: '', displayName: '', role: 'client' });
      await reload();
    } catch (requestError: unknown) {
      const errMsg = getErrorMessage(requestError, 'No fue posible crear el usuario.');
      setError(errMsg);
      toast.error('Error al crear usuario', errMsg);
    } finally {
      setCreating(false);
    }
  };

  const openScheduleModal = (user: UserProfile) => {
    setEditingScheduleUser(user);
    setScheduleDraft(normalizeEmployeeSchedule(user.schedule));
  };

  const toggleDraftDay = (dayOfWeek: number) => {
    setScheduleDraft((prev) => {
      const exists = prev.workDays.includes(dayOfWeek);
      return {
        ...prev,
        workDays: exists
          ? prev.workDays.filter((d) => d !== dayOfWeek)
          : [...prev.workDays, dayOfWeek],
      };
    });
  };

  const saveEmployeeSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingScheduleUser) return;

    const validation = validateEmployeeScheduleAgainstSalon(scheduleDraft, salonHours);
    if (!validation.valid) {
      toast.error('Jornada fuera de rango', validation.error);
      return;
    }

    setSavingSchedule(true);
    try {
      const token = await getIdToken();
      const uid = editingScheduleUser.id || editingScheduleUser.uid;
      await apiRequest(`/auth/users/${uid}/schedule`, {
        method: 'PATCH',
        token,
        body: { schedule: scheduleDraft },
      });
      toast.success(
        'Jornada actualizada',
        `Se guardó el turno de ${editingScheduleUser.displayName}.`,
      );
      setEditingScheduleUser(null);
      await reload();
    } catch (err: unknown) {
      toast.error(
        'Error al guardar jornada',
        getErrorMessage(err, 'No fue posible actualizar la jornada del empleado.'),
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const formatEmployeeScheduleSummary = (user: UserProfile) => {
    const sched = normalizeEmployeeSchedule(user.schedule);
    const dayLabels = WEEK_DAYS.filter((d) => sched.workDays.includes(d.dayOfWeek)).map(
      (d) => d.shortLabel,
    );
    return `${dayLabels.join(', ') || 'Sin días'} · ${sched.startTime} - ${sched.endTime}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-brand-800">Usuarios</h2>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o teléfono..."
            className="input-field max-w-xs"
            aria-label="Buscar usuarios"
          />
        </div>

        {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {message && (
          <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando usuarios...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Usuario</th>
                  <th className="py-2">Teléfono / WhatsApp</th>
                  <th className="py-2">Rol</th>
                  <th className="py-2">Jornada / Turno</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-brand-50">
                    <td className="py-2.5 font-medium text-slate-700">{user.displayName}</td>
                    <td className="py-2.5 text-slate-500">
                      {user.phone || extractPhoneFromAuthEmail(user.email) || user.email || '—'}
                    </td>
                    <td className="py-2.5">
                      <select
                        value={user.role}
                        onChange={(event) => changeRole(user.id, event.target.value)}
                        className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-brand-400 focus:outline-none"
                        aria-label={`Rol de ${user.displayName}`}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5">
                      {user.role === 'employee' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-600">
                            {formatEmployeeScheduleSummary(user)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openScheduleModal(user)}
                            className="rounded-full border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100"
                          >
                            Configurar jornada
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-slate-500">
                      No se encontraron usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card h-fit">
        <h2 className="font-display text-lg font-semibold text-brand-800">Crear usuario</h2>
        <p className="mt-1 text-xs text-slate-500">Registra al personal del salon o a un nuevo cliente.</p>

        <form onSubmit={createUser} className="mt-4 space-y-3">
          <div>
            <label htmlFor="new-name" className="label-field">
              Nombre
            </label>
            <input
              id="new-name"
              className="input-field"
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="new-phone" className="label-field">
              Teléfono / WhatsApp
            </label>
            <input
              id="new-phone"
              type="tel"
              inputMode="tel"
              className="input-field"
              placeholder="3001234567"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="new-password" className="label-field">
              Contraseña temporal
            </label>
            <input
              id="new-password"
              type="text"
              className="input-field"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={6}
              required
            />
          </div>

          <div>
            <label htmlFor="new-role" className="label-field">
              Rol
            </label>
            <select
              id="new-role"
              className="input-field"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={creating} className="btn-primary w-full disabled:opacity-60">
            {creating && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            )}
            Crear usuario
          </button>
        </form>
      </section>

      {/* Modal de configuración de jornada de empleado */}
      {editingScheduleUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/40 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!savingSchedule) setEditingScheduleUser(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-schedule-modal-title"
        >
          <div
            className="w-full max-w-md animate-pop-in rounded-3xl border border-brand-100 bg-white p-6 shadow-chat"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  Ficha de empleado
                </span>
                <h3
                  id="employee-schedule-modal-title"
                  className="mt-2 font-display text-xl font-bold text-brand-800"
                >
                  Jornada de {editingScheduleUser.displayName}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Selecciona los días laborables y el horario de entrada y salida (dentro del horario general del salón).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingScheduleUser(null)}
                aria-label="Cerrar modal"
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-brand-50 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEmployeeSchedule} className="mt-5 space-y-4">
              <div>
                <p className="label-field">Días que labora</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEK_DAYS.map((meta) => {
                    const salonDay = salonHours.find((h) => h.dayOfWeek === meta.dayOfWeek);
                    const salonOpen = Boolean(salonDay?.isOpen);
                    const active = scheduleDraft.workDays.includes(meta.dayOfWeek);

                    return (
                      <button
                        key={meta.dayOfWeek}
                        type="button"
                        disabled={!salonOpen && !active}
                        onClick={() => toggleDraftDay(meta.dayOfWeek)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? 'border-brand-500 bg-gradient-to-r from-brand-500 to-plum-600 text-white shadow-xs'
                            : salonOpen
                              ? 'border-brand-200 bg-white text-slate-600 hover:bg-brand-50'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-emp-start" className="label-field">
                    Hora de entrada
                  </label>
                  <input
                    id="modal-emp-start"
                    type="time"
                    value={scheduleDraft.startTime}
                    onChange={(event) =>
                      setScheduleDraft({ ...scheduleDraft, startTime: event.target.value })
                    }
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="modal-emp-end" className="label-field">
                    Hora de salida
                  </label>
                  <input
                    id="modal-emp-end"
                    type="time"
                    value={scheduleDraft.endTime}
                    onChange={(event) =>
                      setScheduleDraft({ ...scheduleDraft, endTime: event.target.value })
                    }
                    required
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingScheduleUser(null)}
                  className="btn-secondary px-5 py-2 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="btn-primary px-5 py-2 text-xs disabled:opacity-60"
                >
                  Guardar jornada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
