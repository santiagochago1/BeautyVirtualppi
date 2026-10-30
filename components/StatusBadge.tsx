/**
 * Etiqueta de estado de una cita.
 */
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completada', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelada', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  blocked: { label: 'Descanso / Pausa', className: 'bg-slate-200 text-slate-700 border-slate-300' },
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { label: status, className: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}
