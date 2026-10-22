'use client';

/**
 * Ruta protegida: exige sesion iniciada y (opcionalmente) un rol concreto.
 */
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ProtectedRoute({
  children,
  roles = [],
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (roles.length > 0 && role && !roles.includes(role)) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, role, roles, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner label="Verificando tu sesion..." />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (roles.length > 0 && role && !roles.includes(role)) return null;

  return <>{children}</>;
}
