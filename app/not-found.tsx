import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-display text-6xl font-bold text-brand-500">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-brand-800">No encontramos esta pagina</h1>
      <p className="mt-2 max-w-md text-slate-600">
        La direccion que buscas no existe. Vuelve al inicio o habla con nuestro asistente virtual.
      </p>
      <Link href="/" className="btn-primary mt-8">
        Volver al inicio
      </Link>
    </div>
  );
}
