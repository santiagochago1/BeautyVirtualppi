/**
 * Modelo (capa de datos) del catalogo de servicios.
 *
 * Coleccion: `services`
 * Documento: { name, category, description, durationMinutes, price, active, createdAt, updatedAt }
 */
import { assertFirebaseReady, isFirebaseConfigured } from '@/lib/server/firebase-admin';
import { DEFAULT_SERVICES } from '@/lib/server/defaults';
import { AppError } from '@/lib/server/errors';
import { cleanString, toNumber } from '@/lib/server/validators';
import type { Service } from '@/lib/types';

const SERVICES_COLLECTION = 'services';

const serialize = (id: string, data: Record<string, unknown>): Service =>
  ({ id, ...data }) as Service;

const normalizeService = (payload: Record<string, unknown> = {}, partial = false): Partial<Service> => {
  const data: Partial<Service> = {};

  if (payload.name !== undefined || !partial) {
    const name = cleanString(payload.name, 120);
    if (!name) throw new AppError('El nombre del servicio es obligatorio.', 400);
    data.name = name;
  }

  if (payload.category !== undefined || !partial) {
    data.category = cleanString(payload.category, 60) || 'General';
  }

  if (payload.description !== undefined || !partial) {
    data.description = cleanString(payload.description, 600);
  }

  if (payload.durationMinutes !== undefined || !partial) {
    const duration = toNumber(payload.durationMinutes, 0);
    if (duration <= 0 || duration > 600) {
      throw new AppError('La duracion debe estar entre 1 y 600 minutos.', 400);
    }
    data.durationMinutes = Math.round(duration);
  }

  if (payload.price !== undefined || !partial) {
    const price = toNumber(payload.price, 0);
    if (price < 0) throw new AppError('El precio no puede ser negativo.', 400);
    data.price = Math.round(price);
  }

  if (payload.active !== undefined) data.active = Boolean(payload.active);
  if (payload.imageUrl !== undefined) data.imageUrl = cleanString(payload.imageUrl, 500);

  return data;
};

/** Lista servicios. Por defecto solo los activos (catalogo publico). */
export const listServices = async ({ includeInactive = false } = {}): Promise<Service[]> => {
  // Modo solo lectura: sin credenciales de Firebase se responde el catalogo por defecto.
  if (!isFirebaseConfigured()) {
    return DEFAULT_SERVICES.filter((service) => (includeInactive ? true : service.active !== false)).map(
      (service) => ({ ...service, demoMode: true }),
    );
  }

  const db = assertFirebaseReady();
  const snapshot = await db.collection(SERVICES_COLLECTION).get();

  return snapshot.docs
    .map((doc) => serialize(doc.id, doc.data() as Record<string, unknown>))
    .filter((service: Service) => (includeInactive ? true : service.active !== false))
    .sort(
      (a: Service, b: Service) =>
        String(a.category || '').localeCompare(String(b.category || ''), 'es') ||
        String(a.name || '').localeCompare(String(b.name || ''), 'es'),
    );
};

/** Obtiene un servicio por id. */
export const getServiceById = async (id: string): Promise<Service | null> => {
  if (!isFirebaseConfigured()) {
    return DEFAULT_SERVICES.find((service) => service.id === id) || null;
  }

  const db = assertFirebaseReady();
  const snapshot = await db.collection(SERVICES_COLLECTION).doc(id).get();
  return snapshot.exists ? serialize(snapshot.id, snapshot.data() as Record<string, unknown>) : null;
};

/** Crea un servicio (admin). */
export const createService = async (payload: Record<string, unknown>): Promise<Service> => {
  const db = assertFirebaseReady();
  const data = normalizeService(payload, false);
  const now = new Date().toISOString();
  const ref = db.collection(SERVICES_COLLECTION).doc();

  const payloadToSave = {
    ...data,
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(payloadToSave);

  return { id: ref.id, ...payloadToSave } as Service;
};

/** Actualiza un servicio (admin). */
export const updateService = async (
  id: string,
  payload: Record<string, unknown>,
): Promise<Service> => {
  const db = assertFirebaseReady();
  const ref = db.collection(SERVICES_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError('El servicio no existe.', 404);

  const data = normalizeService(payload, true);
  data.updatedAt = new Date().toISOString();
  await ref.update(data as Record<string, unknown>);

  return { id, ...(snapshot.data() as Record<string, unknown>), ...data } as Service;
};

/** Elimina (desactiva) un servicio (admin). */
export const removeService = async (id: string): Promise<Service> => {
  const db = assertFirebaseReady();
  const ref = db.collection(SERVICES_COLLECTION).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError('El servicio no existe.', 404);

  await ref.update({ active: false, updatedAt: new Date().toISOString() });
  return { id, ...(snapshot.data() as Record<string, unknown>), active: false } as Service;
};
