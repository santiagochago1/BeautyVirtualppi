'use client';

/**
 * Pagina de acceso y registro.
 *
 * El registro crea el usuario en Firebase Auth; el rol inicial es 'client' y
 * solo un administrador puede promoverlo a 'employee' o 'admin'.
 */
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getErrorMessage } from '@/lib/api';

/** Firebase Auth agrega un `code` (p. ej. `auth/invalid-credential`) al error. */
const getAuthErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/dashboard';

  const { signIn, signUp, isConfigured, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  const isRegister = mode === 'register';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
      router.push(nextPath);
    } catch (authError: unknown) {
      const code = getAuthErrorCode(authError);
      if (code === 'auth/invalid-credential') setError('Correo o contraseña incorrectos.');
      else if (code === 'auth/email-already-in-use') setError('Ese correo ya tiene una cuenta registrada.');
      else if (code === 'auth/weak-password') setError('La contraseña debe tener al menos 6 caracteres.');
      else if (code === 'auth/too-many-requests') setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      else setError(getErrorMessage(authError, 'No pudimos completar la operacion. Intenta de nuevo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si no estamos en el cliente todavía, mostramos un mensaje de carga o nada
  if (!isClient) {
    return <p className="text-sm text-slate-500">Cargando...</p>;
  }

  if (!isConfigured) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h1 className="font-display text-xl font-semibold text-amber-800">Falta configurar Firebase</h1>
        <p className="mt-3 text-sm text-amber-700">
          Copia <code className="font-mono">.env.example</code> a <code className="font-mono">.env.local</code> y completa
          las variables <code className="font-mono">NEXT_PUBLIC_FIREBASE_*</code>.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-700 underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl border border-brand-100 bg-white p-8 shadow-soft">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-plum-600 text-2xl">
            💅
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-brand-800">
            {isRegister ? 'Crea tu cuenta' : 'Bienvenida de nuevo'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isRegister ? 'Registrate para agendar tus citas' : 'Inicia sesion para ver tu agenda'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isRegister && (
            <div>
              <label htmlFor="name" className="label-field">
                Nombre completo
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="input-field"
                placeholder="Maria Lopez"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="label-field">
              Correo electronico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="label-field">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}

          <button type="submit" disabled={isSubmitting || authLoading} className="btn-primary w-full disabled:opacity-60">
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            ) : null}
            {isRegister ? 'Crear cuenta' : 'Iniciar sesion'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? 'login' : 'register');
              setError(null);
            }}
            className="font-semibold text-brand-700 underline"
          >
            {isRegister ? 'Inicia sesion' : 'Registrate'}
          </button>
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Los roles de profesional y administrador son asignados por el administrador del salon.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-16">
      <Suspense fallback={<p className="text-sm text-slate-500">Cargando formulario...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
