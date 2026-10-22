'use client';

/**
 * Administracion de usuarios y roles (admin).
 */
import { useCallback, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth, ROLE_LABELS } from '@/components/AuthProvider';
import type { Role, UserProfile } from '@/lib/types';

const ROLE_OPTIONS: Role[] = ['client', 'employee', 'admin'];

export default function AdminUsers() {
  const { getIdToken } = useAuth();

  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', role: 'client' });

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
      await reload();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible actualizar el rol.'));
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
      setForm({ email: '', password: '', displayName: '', role: 'client' });
      await reload();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible crear el usuario.'));
    } finally {
      setCreating(false);
    }
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
            placeholder="Buscar por nombre o correo..."
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
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Usuario</th>
                  <th className="py-2">Correo</th>
                  <th className="py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-brand-50">
                    <td className="py-2 font-medium text-slate-700">{user.displayName}</td>
                    <td className="py-2 text-slate-500">{user.email}</td>
                    <td className="py-2">
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
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-sm text-slate-500">
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
            <label htmlFor="new-email" className="label-field">
              Correo
            </label>
            <input
              id="new-email"
              type="email"
              className="input-field"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
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
    </div>
  );
}
