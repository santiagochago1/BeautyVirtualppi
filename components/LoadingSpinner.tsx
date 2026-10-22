/**
 * Spinner de carga reutilizable.
 */
export default function LoadingSpinner({ label = 'Cargando...', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-sm text-slate-500 ${className}`} role="status">
      <span
        className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
