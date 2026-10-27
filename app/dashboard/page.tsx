'use client';

/**
 * Panel del cliente: agendar citas y consultar su historial.
 */
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppointmentForm from '@/components/AppointmentForm';
import AppointmentList from '@/components/AppointmentList';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiRequest } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth } from '@/components/AuthProvider';
import type { Appointment, Service } from '@/lib/types';

interface DashboardData {
  services: Service[];
  appointments: Appointment[];
}

function DashboardContent() {
  const router = useRouter();
  const { profile, role, roleLabel, getIdToken } = useAuth();

  useEffect(() => {
    if (role === 'admin' || role === 'employee') {
      router.replace('/employee');
    }
  }, [role, router]);

  const fetchDashboard = useCallback(async (): Promise<DashboardData> => {
    const token = await getIdToken();
    const [servicesData, appointmentsData] = await Promise.all([
      apiRequest<{ services: Service[] }>('/services'),
      token
        ? apiRequest<{ appointments: Appointment[] }>('/appointments', { token })
        : Promise.resolve({ appointments: [] as Appointment[] }),
    ]);
    return {
      services: servicesData.services || [],
      appointments: appointmentsData.appointments || [],
    };
  }, [getIdToken]);

  const {
    data: { services, appointments },
    error,
    loading,
    reload,
  } = useAsyncData(fetchDashboard, {
    initialData: { services: [], appointments: [] } as DashboardData,
    errorMessage: 'No fue posible cargar tu informacion.',
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Cargando tu agenda..." />
      </div>
    );
  }

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{roleLabel}</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-brand-800">
          Hola, {profile?.name?.split(' ')[0] || 'bienvenida'} 👋
        </h1>
        <p className="mt-2 text-slate-600">
          {role === 'client'
            ? 'Aqui puedes agendar tus citas y revisar tu historial.'
            : 'Este es tu espacio personal. Usa el menu para ir a tu area de trabajo.'}
        </p>
      </header>

      {error && <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <AppointmentForm services={services} onCreated={() => void reload()} />
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-brand-800">Mis citas</h2>
          <AppointmentList appointments={appointments} onUpdated={() => void reload()} showClient={false} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute roles={['client', 'admin', 'employee']}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
