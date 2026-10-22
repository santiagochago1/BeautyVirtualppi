'use client';

/**
 * Reportes de citas y pagos (admin) + asignacion de profesionales.
 */
import { useCallback, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth } from '@/components/AuthProvider';
import StatusBadge from '@/components/StatusBadge';
import { formatCurrency, formatLongDate, formatTime } from '@/lib/format';
import type { Appointment, AppointmentStats, UserProfile } from '@/lib/types';

interface ReportsData {
  stats: AppointmentStats | null;
  appointments: Appointment[];
  employees: UserProfile[];
}

export default function AdminReports() {
  const { getIdToken } = useAuth();

  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReports = useCallback(async (): Promise<ReportsData> => {
    const token = await getIdToken();
    const [statsData, appointmentsData, employeesData] = await Promise.all([
      apiRequest<{ stats: AppointmentStats }>('/appointments/stats', { token }),
      apiRequest<{ appointments: Appointment[] }>('/appointments', { token }),
      apiRequest<{ users: UserProfile[] }>('/auth/employees', { token }),
    ]);
    return {
      stats: statsData.stats || null,
      appointments: appointmentsData.appointments || [],
      employees: employeesData.users || [],
    };
  }, [getIdToken]);

  const {
    data: { stats, appointments, employees },
    error,
    reload,
    setError,
  } = useAsyncData(fetchReports, {
    initialData: { stats: null, appointments: [], employees: [] } as ReportsData,
    errorMessage: 'No fue posible cargar los reportes.',
  });

  const assign = async (appointmentId: string, employeeId: string) => {
    setBusyId(appointmentId);
    setError(null);
    try {
      const token = await getIdToken();
      await apiRequest(`/appointments/${appointmentId}/assign`, {
        method: 'PATCH',
        token,
        body: { employeeId: employeeId || null },
      });
      await reload();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible asignar el profesional.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!stats) {
    return <div className="card text-sm text-slate-500">Cargando reportes...</div>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {/* Indicadores */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Citas totales', value: stats.total },
          { label: 'Pendientes', value: stats.byStatus?.pending || 0 },
          { label: 'Confirmadas', value: stats.byStatus?.confirmed || 0 },
          { label: 'Completadas', value: stats.byStatus?.completed || 0 },
          { label: 'Facturado', value: formatCurrency(stats.billedTotal) },
        ].map((card) => (
          <div key={card.label} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-bold text-brand-700">{card.value}</p>
          </div>
        ))}
      </section>

      {/* Servicios mas solicitados */}
      <section className="card">
        <h2 className="font-display text-lg font-semibold text-brand-800">Servicios mas solicitados</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Servicio</th>
                <th className="py-2">Citas</th>
                <th className="py-2">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {stats.byService.map((item) => (
                <tr key={item.serviceName} className="border-b border-brand-50">
                  <td className="py-2 font-medium text-slate-700">{item.serviceName}</td>
                  <td className="py-2 text-slate-500">{item.count}</td>
                  <td className="py-2 font-semibold text-brand-700">{formatCurrency(item.revenue)}</td>
                </tr>
              ))}
              {stats.byService.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-sm text-slate-500">
                    Aun no hay citas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Citas con asignacion de profesional */}
      <section className="card">
        <h2 className="font-display text-lg font-semibold text-brand-800">Citas y asignacion de profesionales</h2>

        <div className="mt-4 space-y-3">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="rounded-xl border border-brand-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {formatLongDate(appointment.date)} · {formatTime(appointment.time)} · {appointment.serviceName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Cliente: {appointment.userName} · {formatCurrency(appointment.servicePrice)}
                  </p>
                </div>
                <StatusBadge status={appointment.status} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-50 pt-3">
                <label htmlFor={`assign-${appointment.id}`} className="text-xs font-semibold text-slate-500">
                  Profesional:
                </label>
                <select
                  id={`assign-${appointment.id}`}
                  value={appointment.employeeId || ''}
                  disabled={busyId === appointment.id}
                  onChange={(event) => assign(appointment.id, event.target.value)}
                  className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:border-brand-400 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Sin asignar</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {appointments.length === 0 && <p className="text-sm text-slate-500">No hay citas registradas.</p>}
        </div>
      </section>
    </div>
  );
}
