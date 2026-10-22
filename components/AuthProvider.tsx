'use client';

/**
 * Proveedor de autenticacion (Firebase Auth + perfil/rol del backend).
 *
 * El rol SIEMPRE se lee del backend (`/api/auth/me`), que a su vez lo toma
 * del documento del usuario en Firestore. El cliente nunca decide el rol.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { apiRequest, getErrorMessage } from '@/lib/api';
import type { AuthMeUser, Role } from '@/lib/types';

export interface AuthContextValue {
  /** Usuario autenticado de Firebase (null si la sesion no esta activa). */
  user: FirebaseUser | null;
  /** Datos de `/api/auth/me` (nombre, rol y perfil de Firestore). */
  profile: AuthMeUser | null;
  role: Role | null;
  roleLabel: string;
  isAuthenticated: boolean;
  isConfigured: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<FirebaseUser>;
  signUp: (name: string, email: string, password: string) => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthMeUser | null>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ROLE_LABELS: Record<Role, string> = {
  client: 'Cliente',
  employee: 'Profesional',
  admin: 'Administrador',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AuthMeUser | null>(null);
  // Sin Firebase configurado no hay nada que esperar: arrancamos listo.
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (user: FirebaseUser | null): Promise<AuthMeUser | null> => {
    if (!user) {
      setProfile(null);
      return null;
    }
    try {
      const token = await user.getIdToken();
      const data = await apiRequest<{ user: AuthMeUser }>('/auth/me', { token });
      setProfile(data.user);
      return data.user;
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'No fue posible cargar tu perfil.'));
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void (async () => {
        setFirebaseUser(user);
        await loadProfile(user);
        setLoading(false);
      })();
    });

    return () => unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      if (!isFirebaseConfigured) {
        throw new Error('Firebase no esta configurado. Revisa las variables NEXT_PUBLIC_FIREBASE_*');
      }
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await loadProfile(credential.user);
      return credential.user;
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      if (!isFirebaseConfigured) {
        throw new Error('Firebase no esta configurado. Revisa las variables NEXT_PUBLIC_FIREBASE_*');
      }
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(credential.user, { displayName: name });
      }
      await loadProfile(credential.user);
      return credential.user;
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    setError(null);
    if (isFirebaseConfigured) await firebaseSignOut(auth);
    setProfile(null);
    setFirebaseUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return null;
    return loadProfile(firebaseUser);
  }, [firebaseUser, loadProfile]);

  const getIdToken = useCallback(async () => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: firebaseUser,
      profile,
      role: profile?.role ?? null,
      roleLabel: profile?.role ? ROLE_LABELS[profile.role] : 'Invitado',
      isAuthenticated: Boolean(firebaseUser),
      isConfigured: isFirebaseConfigured,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      getIdToken,
    }),
    [firebaseUser, profile, loading, error, signIn, signUp, signOut, refreshProfile, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
};

export default AuthProvider;
