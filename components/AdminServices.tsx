'use client';

/**
 * Administracion del catalogo de servicios (admin).
 */
import { useCallback, useState } from 'react';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { useAsyncData } from '@/lib/hooks/useAsyncData';
import { useAuth } from '@/components/AuthProvider';
import { formatCurrency } from '@/lib/format';
import type { Service } from '@/lib/types';

interface ServiceForm {
  name: string;
  category: string;
  description: string;
  durationMinutes: number | string;
  price: number | string;
  active: boolean;
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  category: '',
  description: '',
  durationMinutes: 60,
  price: 0,
  active: true,
};

export default function AdminServices() {
  const { getIdToken } = useAuth();

  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchServices = useCallback(async (): Promise<Service[]> => {
    const token = await getIdToken();
    const data = await apiRequest<{ services: Service[] }>('/services?includeInactive=true', { token });
    return data.services || [];
  }, [getIdToken]);

  const {
    data: services,
    error,
    reload,
    setError,
  } = useAsyncData(fetchServices, {
    initialData: [] as Service[],
    errorMessage: 'No fue posible cargar los servicios.',
  });

  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const token = await getIdToken();
      const payload = {
        ...form,
        price: Number(form.price) || 0,
        durationMinutes: Number(form.durationMinutes) || 60,
      };

      if (editingId) {
        await apiRequest(`/services/${editingId}`, { method: 'PUT', token, body: payload });
        setMessage('Servicio actualizado.');
      } else {
        await apiRequest('/services', { method: 'POST', token, body: payload });
        setMessage('Servicio creado.');
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      await reload();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible guardar el servicio.'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (service: Service) => {
    setError(null);
    try {
      const token = await getIdToken();
      await apiRequest(`/services/${service.id}`, {
        method: 'PUT',
        token,
        body: { active: !(service.active !== false) },
      });
      await reload();
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible actualizar el servicio.'));
    }
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name || '',
      category: service.category || '',
      description: service.description || '',
      durationMinutes: service.durationMinutes ?? 60,
      price: service.price ?? 0,
      active: service.active !== false,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="card">
        <h2 className="font-display text-lg font-semibold text-brand-800">Catalogo de servicios</h2>

        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        {message && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {services.map((service) => (
            <div key={service.id} className="rounded-xl border border-brand-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">
                    {service.name}{' '}
                    {service.active === false && (
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        Inactivo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {service.category} · {service.durationMinutes} min · {formatCurrency(service.price)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(service)}
                    className="rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(service)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {service.active === false ? 'Activar' : 'Desactivar'}
                  </button>
                </div>
              </div>
              {service.description && <p className="mt-2 text-xs text-slate-500">{service.description}</p>}
            </div>
          ))}

          {services.length === 0 && <p className="text-sm text-slate-500">Todavia no hay servicios en el catalogo.</p>}
        </div>
      </section>

      <section className="card h-fit">
        <h2 className="font-display text-lg font-semibold text-brand-800">
          {editingId ? 'Editar servicio' : 'Nuevo servicio'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="service-name" className="label-field">
              Nombre
            </label>
            <input
              id="service-name"
              className="input-field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="service-category" className="label-field">
              Categoria
            </label>
            <input
              id="service-category"
              className="input-field"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Facial, Corporal, Unas..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="service-price" className="label-field">
                Precio (COP)
              </label>
              <input
                id="service-price"
                type="number"
                min={0}
                step={1000}
                className="input-field"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                required
              />
            </div>

            <div>
              <label htmlFor="service-duration" className="label-field">
                Duracion (min)
              </label>
              <input
                id="service-duration"
                type="number"
                min={5}
                max={600}
                className="input-field"
                value={form.durationMinutes}
                onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="service-description" className="label-field">
              Descripcion
            </label>
            <textarea
              id="service-description"
              rows={3}
              maxLength={600}
              className="input-field resize-none"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="btn-primary flex-1 disabled:opacity-60">
              {isSaving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              )}
              Guardar
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
