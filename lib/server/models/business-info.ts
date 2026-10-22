/**
 * Modelo (capa de datos) de la informacion del negocio.
 *
 * Coleccion: `business_info`, documento unico con id 'main'.
 * Contiene: nombre, direccion, telefono, whatsapp, correo, horarios,
 * politicas (cancelacion, pagos) y redes sociales.
 */
import { assertFirebaseReady, isFirebaseConfigured } from '@/lib/server/firebase-admin';
import { DEFAULT_BUSINESS_INFO } from '@/lib/server/defaults';
import { AppError } from '@/lib/server/errors';
import { cleanString } from '@/lib/server/validators';
import type { BusinessInfo } from '@/lib/types';

const BUSINESS_COLLECTION = 'business_info';
const BUSINESS_DOC_ID = 'main';

export { DEFAULT_BUSINESS_INFO };

/** Obtiene la informacion del negocio (con valores por defecto). */
export const getBusinessInfo = async (): Promise<BusinessInfo> => {
  // Modo solo lectura: sin credenciales de Firebase se responden los valores por defecto.
  if (!isFirebaseConfigured()) {
    return { ...DEFAULT_BUSINESS_INFO, updatedAt: null, demoMode: true };
  }

  const db = assertFirebaseReady();
  const snapshot = await db.collection(BUSINESS_COLLECTION).doc(BUSINESS_DOC_ID).get();
  if (!snapshot.exists) {
    return { ...DEFAULT_BUSINESS_INFO, updatedAt: null };
  }

  const data = snapshot.data() as Record<string, unknown>;
  return {
    ...DEFAULT_BUSINESS_INFO,
    ...data,
    id: BUSINESS_DOC_ID,
    policies: { ...DEFAULT_BUSINESS_INFO.policies, ...((data.policies as object) || {}) },
  } as BusinessInfo;
};

/** Actualiza la informacion del negocio (admin). */
export const updateBusinessInfo = async (patch: Record<string, unknown> = {}): Promise<BusinessInfo> => {
  const db = assertFirebaseReady();
  const ref = db.collection(BUSINESS_COLLECTION).doc(BUSINESS_DOC_ID);
  const snapshot = await ref.get();
  const current = (snapshot.exists ? snapshot.data() : DEFAULT_BUSINESS_INFO) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  const simpleFields = [
    'name',
    'legalName',
    'slogan',
    'description',
    'address',
    'city',
    'department',
    'country',
    'phone',
    'whatsapp',
    'email',
    'instagram',
  ];

  simpleFields.forEach((field) => {
    if (patch[field] !== undefined) update[field] = cleanString(patch[field], 400);
  });

  if (Array.isArray(patch.hours)) {
    update.hours = (patch.hours as Array<Record<string, unknown>>)
      .filter((item) => item && item.day)
      .map((item) => ({
        day: cleanString(item.day, 20),
        open: cleanString(item.open, 5),
        close: cleanString(item.close, 5),
      }));
  }

  if (patch.policies && typeof patch.policies === 'object') {
    update.policies = Object.entries(patch.policies as Record<string, unknown>).reduce<
      Record<string, string>
    >((acc, [key, value]) => {
      acc[key] = cleanString(value, 400);
      return acc;
    }, {});
  }

  if (Object.keys(update).length === 0) {
    throw new AppError('No hay informacion para actualizar.', 400);
  }

  update.updatedAt = new Date().toISOString();
  await ref.set({ ...current, ...update }, { merge: true });

  return { id: BUSINESS_DOC_ID, ...current, ...update } as BusinessInfo;
};
