'use client';

/**
 * Panel de administracion (solo admin): usuarios, servicios y reportes.
 */
import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminUsers from '@/components/AdminUsers';
import AdminServices from '@/components/AdminServices';
import AdminReports from '@/components/AdminReports';

const TABS = [
  { id: 'reports', label: 'Reportes' },
  { id: 'users', label: 'Usuarios' },
  { id: 'services', label: 'Servicios' },
];

function AdminPanel() {
  const [tab, setTab] = useState('reports');

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Administrador</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-brand-800">Panel de control</h1>
        <p className="mt-2 text-slate-600">Gestion de usuarios, catalogo de servicios y reportes de citas y pagos.</p>
      </header>

      <div className="mb-6 flex w-fit gap-2 rounded-full border border-brand-100 bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
              tab === item.id ? 'bg-gradient-to-r from-brand-500 to-plum-600 text-white' : 'text-slate-600 hover:text-brand-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'reports' && <AdminReports />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'services' && <AdminServices />}
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute roles={['admin']}>
      <AdminPanel />
    </ProtectedRoute>
  );
}

