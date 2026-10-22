/**
 * Tarjeta de un servicio del catalogo.
 */
import { formatCurrency } from '@/lib/format';
import type { Service } from '@/lib/types';

interface ServiceCardProps {
  service: Service;
  onSelect?: (service: Service) => void;
  selected?: boolean;
}

export default function ServiceCard({ service, onSelect, selected = false }: ServiceCardProps) {
  return (
    <article
      className={`group flex h-full flex-col rounded-2xl border bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg ${
        selected ? 'border-brand-400 ring-2 ring-brand-100' : 'border-brand-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {service.category || 'General'}
          </span>
          <h3 className="mt-3 font-display text-lg font-semibold text-slate-800">{service.name}</h3>
        </div>
        <span className="shrink-0 rounded-xl bg-plum-50 px-3 py-1.5 text-sm font-bold text-plum-700">
          {formatCurrency(service.price)}
        </span>
      </div>

      {service.description && (
        <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{service.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-brand-50 pt-4">
        <span className="text-xs font-medium text-slate-500">⏱ {service.durationMinutes} min</span>
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(service)}
            className="rounded-full bg-gradient-to-r from-brand-500 to-plum-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
          >
            {selected ? 'Seleccionado' : 'Agendar'}
          </button>
        )}
      </div>
    </article>
  );
}
