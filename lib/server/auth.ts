/**
 * Autenticacion y control de acceso basado en roles (RBAC) para los Route Handlers.
 *
 * Sustituye al middleware `verifyAuth` de Express:
 *  1. Extrae el token Bearer de la cabecera `Authorization`.
 *  2. Lo valida con Firebase Admin (`verifyIdToken`).
 *  3. Obtiene el rol real desde el documento del usuario en Firestore
 *     (coleccion `users`) -> el rol nunca se toma del token del cliente.
 *  4. Comprueba que el rol este en la lista permitida (si la hay).
 */
import { firebaseAuth, isFirebaseReady, isFirebaseConfigured } from '@/lib/server/firebase-admin';
import { AppError } from '@/lib/server/errors';
import { getOrCreateUser } from '@/lib/server/models/user';
import { createLogger } from '@/lib/server/logger';
import type { Role, UserProfile } from '@/lib/types';

const logger = createLogger('auth');

export interface AuthUser {
  uid: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: Role;
  profile: UserProfile;
}

/** Extrae el token Bearer de la cabecera `authorization`. */
export const extractBearerToken = (authorization: string | null | undefined): string | null => {
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
};

export interface AuthOptions {
  /** Roles permitidos. Vacio = cualquier usuario autenticado. */
  allowedRoles?: Role[];
  /** Si es `true`, no autenticar no es un error (rutas publicas con dato extra). */
  optional?: boolean;
}

/**
 * Autentica la peticion.
 *
 * @returns El usuario autenticado, o `null` si la ruta es opcional y no hay token.
 * @throws {AppError} 401/403/503 segun el caso.
 */
export const authenticate = async (
  authorization: string | null | undefined,
  { allowedRoles = [], optional = false }: AuthOptions = {},
): Promise<AuthUser | null> => {
  const token = extractBearerToken(authorization);

  if (!token) {
    if (optional) return null;
    throw new AppError('Debes iniciar sesion para continuar.', 401);
  }

  if (!isFirebaseReady() || !isFirebaseConfigured()) {
    throw new AppError(
      'La autenticacion no esta disponible en este momento. Revisa la configuracion de Firebase en el servidor.',
      503,
    );
  }

  let decoded: { uid: string; email?: string; name?: string; picture?: string };
  try {
    decoded = await firebaseAuth!.verifyIdToken(token);
  } catch (error) {
    logger.warn('Token rechazado', (error as { code?: string })?.code || (error as Error)?.message);
    throw new AppError('Tu sesion expiro o no es valida. Inicia sesion nuevamente.', 401);
  }

  const profile = await getOrCreateUser({
    uid: decoded.uid,
    email: decoded.email,
    displayName: decoded.name || decoded.email,
    photoURL: decoded.picture || null,
  });

  const role = profile.role || 'client';

  if (profile.active === false) {
    throw new AppError('Tu cuenta esta desactivada. Contacta al administrador.', 403);
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    logger.warn(`Acceso denegado. Rol=${role}, permitidos=${allowedRoles.join(',')}`);
    throw new AppError('No tienes permisos para realizar esta accion.', 403);
  }

  return {
    uid: decoded.uid,
    email: decoded.email || profile.email || null,
    phone: profile.phone || null,
    name: profile.displayName || decoded.name || 'Usuario',
    role,
    profile,
  };
};
