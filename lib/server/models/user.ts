/**
 * Modelo (capa de datos) de usuarios.
 *
 * Coleccion: `users`
 * Documento: { uid, email, displayName, phone, role, active, createdAt, updatedAt }
 *
 * Roles admitidos: 'client' | 'employee' | 'admin'.
 */
import { assertFirebaseReady } from '@/lib/server/firebase-admin';
import { AppError } from '@/lib/server/errors';
import { cleanString, isValidEmail } from '@/lib/server/validators';
import type { Role, UserProfile } from '@/lib/types';

export const ROLES: Role[] = ['client', 'employee', 'admin'];
export const DEFAULT_ROLE: Role = 'client';

const USERS_COLLECTION = 'users';

const sanitizeRole = (role: unknown): Role =>
  typeof role === 'string' && (ROLES as string[]).includes(role) ? (role as Role) : DEFAULT_ROLE;

const serialize = (id: string, data: Record<string, unknown>): UserProfile =>
  ({ id, ...data }) as UserProfile;

/**
 * Obtiene el perfil del usuario; si no existe, lo crea con rol 'client'.
 * Este es el punto unico de verdad del RBAC.
 */
export const getOrCreateUser = async ({
  uid,
  email,
  displayName,
  photoURL = null,
}: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<UserProfile> => {
  const db = assertFirebaseReady();
  if (!uid) throw new AppError('Identificador de usuario invalido.', 400);

  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snapshot = await ref.get();

  if (snapshot.exists) {
    const data = snapshot.data() as Record<string, unknown>;
    // Sincroniza datos basicos de Firebase Auth sin tocar el rol.
    const patch: Record<string, unknown> = {};
    if (email && data.email !== email) patch.email = email;
    if (displayName && data.displayName !== displayName) patch.displayName = displayName;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date().toISOString();
      await ref.update(patch);
      return serialize(uid, { ...data, ...patch });
    }
    return serialize(uid, data);
  }

  const profile = {
    uid,
    email: email || null,
    displayName: cleanString(displayName, 120) || (email ? email.split('@')[0] : 'Usuario'),
    photoURL,
    role: DEFAULT_ROLE,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ref.set(profile, { merge: true });
  return serialize(uid, profile);
};

/** Obtiene el perfil sin crearlo (null si no existe). */
export const getUser = async (uid: string): Promise<UserProfile | null> => {
  const db = assertFirebaseReady();
  const snapshot = await db.collection(USERS_COLLECTION).doc(uid).get();
  return snapshot.exists ? serialize(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
};

/** Lista usuarios (admin). Soporta filtro por rol y busqueda. */
export const listUsers = async ({
  role = null,
  search = '',
}: {
  role?: Role | null;
  search?: string;
} = {}): Promise<UserProfile[]> => {
  const db = assertFirebaseReady();
  const snapshot = await db.collection(USERS_COLLECTION).get();
  const needle = cleanString(search, 80).toLowerCase();

  return snapshot.docs
    .map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>))
    .filter((user: UserProfile) => (role ? user.role === role : true))
    .filter((user: UserProfile) =>
      needle
        ? [user.displayName, user.email].some((field) =>
            String(field || '').toLowerCase().includes(needle),
          )
        : true,
    )
    .sort((a: UserProfile, b: UserProfile) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'es'));
};

/** Actualiza el rol de un usuario (admin). */
export const updateUserRole = async (uid: string, role: Role): Promise<UserProfile> => {
  const db = assertFirebaseReady();
  if (!uid) throw new AppError('Usuario invalido.', 400);
  if (!ROLES.includes(role)) {
    throw new AppError(`Rol invalido. Roles permitidos: ${ROLES.join(', ')}.`, 400);
  }

  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError('El usuario no existe.', 404);

  await ref.update({ role, updatedAt: new Date().toISOString() });
  return serialize(uid, { ...(snapshot.data() as Record<string, unknown>), role });
};

/** Actualiza datos de perfil del propio usuario. */
export const updateUserProfile = async (
  uid: string,
  patch: { displayName?: unknown; phone?: unknown; photoURL?: unknown } = {},
): Promise<UserProfile> => {
  const db = assertFirebaseReady();
  const ref = db.collection(USERS_COLLECTION).doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError('El usuario no existe.', 404);

  const data = snapshot.data() as Record<string, unknown>;
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (patch.displayName !== undefined) update.displayName = cleanString(patch.displayName, 120);
  if (patch.phone !== undefined) update.phone = cleanString(patch.phone, 30);
  if (patch.photoURL !== undefined) update.photoURL = cleanString(patch.photoURL, 500);

  await ref.update(update);
  return serialize(uid, { ...data, ...update });
};

/** Crea (o actualiza) un usuario de Firebase Auth y su perfil en Firestore. */
export const provisionUser = async ({
  uid,
  email,
  displayName,
  role = DEFAULT_ROLE,
  phone = null,
  photoURL = null,
}: {
  uid: string;
  email: string;
  displayName?: string | null;
  role?: Role;
  phone?: string | null;
  photoURL?: string | null;
}): Promise<UserProfile> => {
  const db = assertFirebaseReady();
  if (!isValidEmail(email)) throw new AppError('El correo electronico no es valido.', 400);

  const profile = await getOrCreateUser({ uid, email, displayName, photoURL });
  if (role !== profile.role) {
    await db.collection(USERS_COLLECTION).doc(uid).update({
      role: sanitizeRole(role),
      updatedAt: new Date().toISOString(),
    });
  }

  return serialize(uid, {
    ...profile,
    email,
    displayName: cleanString(displayName, 120) || profile.displayName,
    role: sanitizeRole(role),
    phone,
    photoURL,
  });
};
