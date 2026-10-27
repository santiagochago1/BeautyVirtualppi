'use client';

/**
 * Barra de navegacion superior, sensible al rol del usuario.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const NAV_LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#agenda', label: 'Agendar' },
];

const ROLE_LINKS: Record<string, Array<{ href: string; label: string }>> = {
  client: [{ href: '/dashboard', label: 'Mi agenda' }],
  employee: [{ href: '/employee', label: 'Agenda diaria' }],
  admin: [
    { href: '/employee', label: 'Agenda diaria' },
    { href: '/admin', label: 'Administracion' },
  ],
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, profile, role, roleLabel, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isStaff = role === 'admin' || role === 'employee';
  const links = isStaff
    ? ROLE_LINKS[role] || []
    : [...NAV_LINKS, ...(role ? ROLE_LINKS[role] || [] : [])];
  const brandHref = isStaff ? '/employee' : '/';

  const handleSignOut = async () => {
    await signOut();
    setIsMenuOpen(false);
    router.push('/');
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href.split('#')[0]) && href !== '/#servicios' && href !== '/#agenda';

  return (
    <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={brandHref} className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-plum-600 text-lg">
            💅
          </span>
          <span className="font-display text-lg font-semibold text-brand-700">Beauty Virtual</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition ${
                isActive(link.href) ? 'text-brand-700' : 'text-slate-600 hover:text-brand-600'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-slate-700">{profile?.name || 'Usuario'}</p>
                <p className="text-xs text-brand-600">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-brand-200 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-brand-500 to-plum-600 px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:brightness-110"
            >
              Iniciar sesión
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-lg p-2 text-slate-600 md:hidden"
          aria-label="Abrir menu"
          aria-expanded={isMenuOpen}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {isMenuOpen ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
          </svg>
        </button>
      </nav>

      {isMenuOpen && (
        <div className="border-t border-brand-100 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-medium text-slate-700 hover:text-brand-600"
              >
                {link.label}
              </Link>
            ))}

            {isAuthenticated ? (
              <div className="mt-2 flex items-center justify-between border-t border-brand-100 pt-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{profile?.name}</p>
                  <p className="text-xs text-brand-600">{roleLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-full border border-brand-200 px-4 py-1.5 text-sm text-brand-700"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsMenuOpen(false)}
                className="mt-2 rounded-full bg-gradient-to-r from-brand-500 to-plum-600 px-5 py-2 text-center text-sm font-semibold text-white"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
