'use client';

/**
 * Reportes de citas y pagos (admin) + asignacion de profesionales.
 */
import { useCallback, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth } from '@/components/AuthProvider';
import StatusBadge from '@/components/StatusBadge';
import {
  buildWhatsAppConfirmUrl,
  extractPhoneFromAuthEmail,
  formatCurrency,
  formatLongDate,
  formatTime,
} from '@/lib/format';
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
          {appointments.map((appointment) => {
            const clientPhone =
              appointment.userPhone || extractPhoneFromAuthEmail(appointment.userEmail) || '';
            const whatsappUrl = buildWhatsAppConfirmUrl({
              phone: clientPhone,
              clientName: appointment.userName || 'Cliente',
              serviceName: appointment.serviceName,
              date: appointment.date,
              time: appointment.time,
            });

            return (
              <div key={appointment.id} className="rounded-xl border border-brand-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {formatLongDate(appointment.date)} · {formatTime(appointment.time)} · {appointment.serviceName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Cliente: {appointment.userName}
                      {clientPhone ? ` · 📱 ${clientPhone}` : ''} · {formatCurrency(appointment.servicePrice)}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-50 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
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

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.44-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.85 9.85 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 6.99 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.88 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                    </svg>
                    Confirmar por WhatsApp
                  </a>
                </div>
              </div>
            );
          })}

          {appointments.length === 0 && <p className="text-sm text-slate-500">No hay citas registradas.</p>}
        </div>
      </section>
    </div>
  );
}
