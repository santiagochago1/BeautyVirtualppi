/**
 * Pie de pagina del sitio.
 */
import Link from 'next/link';
import { getCurrentYear } from '@/lib/server/year';

export default async function Footer() {
  const year = await getCurrentYear();

  return (
    <footer className="mt-16 border-t border-brand-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold text-brand-700">Beauty Virtual</p>
          <p className="mt-2 text-sm text-slate-600">
            Asistente virtual y agenda online para <strong>Beauty Salón</strong>, Barbosa, Antioquia.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">Navegación</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <Link href="/#servicios" className="transition hover:text-brand-600">
                Catálogo de servicios
              </Link>
            </li>
            <li>
              <Link href="/#agenda" className="transition hover:text-brand-600">
                Agendar cita
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition hover:text-brand-600">
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>📍 Carrera 10 # 12-45, Centro, Barbosa</li>
            <li>📞 +57 604 000 0000</li>
            <li>💬 WhatsApp +57 300 000 0000</li>
            <li>✉️ contacto@beautysalon.co</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-brand-100 py-4 text-center text-xs text-slate-500">
        © {year} Beauty Salón · Todos los derechos reservados
      </div>
    </footer>
  );
}
