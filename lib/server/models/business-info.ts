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
import { isValidDate, isValidTime } from '@/lib/server/datetime';
import { normalizeBusinessHours, parseTimeToMinutes } from '@/lib/schedule-utils';
import type { BusinessHour, BusinessInfo, SpecialDate } from '@/lib/types';

const BUSINESS_COLLECTION = 'business_info';
const BUSINESS_DOC_ID = 'main';

export { DEFAULT_BUSINESS_INFO };

const sanitizeSpecialDates = (raw: unknown): SpecialDate[] => {
  if (!Array.isArray(raw)) return [];
  const byDate = new Map<string, SpecialDate>();

  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item !== 'object') continue;
    const date = cleanString(item.date, 10);
    if (!isValidDate(date)) continue;

    const isClosed = Boolean(item.isClosed);
    const customOpenTime = !isClosed && isValidTime(item.customOpenTime) ? String(item.customOpenTime) : null;
    const customCloseTime = !isClosed && isValidTime(item.customCloseTime) ? String(item.customCloseTime) : null;

    if (!isClosed) {
      const openM = parseTimeToMinutes(customOpenTime);
      const closeM = parseTimeToMinutes(customCloseTime);
      if (openM === null || closeM === null || openM >= closeM) {
        throw new AppError(
          `En la fecha especial ${date}, la hora de apertura debe ser anterior a la hora de cierre.`,
          400,
        );
      }
    }

    const note = cleanString(item.note, 120) || (isClosed ? 'Cerrado / Festivo' : 'Horario especial');

    byDate.set(date, {
      id: cleanString(item.id, 60) || date,
      date,
      isClosed,
      customOpenTime,
      customCloseTime,
      note,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/** Obtiene la informacion del negocio (con valores por defecto). */
export const getBusinessInfo = async (): Promise<BusinessInfo> => {
  // Modo solo lectura: sin credenciales de Firebase se responden los valores por defecto.
  if (!isFirebaseConfigured()) {
    return {
      ...DEFAULT_BUSINESS_INFO,
      hours: normalizeBusinessHours(DEFAULT_BUSINESS_INFO.hours),
      specialDates: DEFAULT_BUSINESS_INFO.specialDates || [],
      updatedAt: null,
      demoMode: true,
    };
  }

  const db = assertFirebaseReady();
  const snapshot = await db.collection(BUSINESS_COLLECTION).doc(BUSINESS_DOC_ID).get();
  if (!snapshot.exists) {
    return {
      ...DEFAULT_BUSINESS_INFO,
      hours: normalizeBusinessHours(DEFAULT_BUSINESS_INFO.hours),
      specialDates: [],
      updatedAt: null,
    };
  }

  const data = snapshot.data() as Record<string, unknown>;
  const hours = normalizeBusinessHours((data.hours as BusinessHour[] | undefined) || DEFAULT_BUSINESS_INFO.hours);
  const specialDates = Array.isArray(data.specialDates) ? (data.specialDates as SpecialDate[]) : [];

  return {
    ...DEFAULT_BUSINESS_INFO,
    ...data,
    id: BUSINESS_DOC_ID,
    hours,
    specialDates,
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
    const normalized = normalizeBusinessHours(patch.hours as BusinessHour[]);
    for (const dayItem of normalized) {
      if (dayItem.isOpen) {
        const openM = parseTimeToMinutes(dayItem.openTime);
        const closeM = parseTimeToMinutes(dayItem.closeTime);
        if (openM === null || closeM === null || openM >= closeM) {
          throw new AppError(
            `El horario de ${dayItem.day} no es válido: la hora de apertura debe ser menor que la de cierre.`,
            400,
          );
        }
      }
    }
    update.hours = normalized;
  }

  if (patch.specialDates !== undefined) {
    update.specialDates = sanitizeSpecialDates(patch.specialDates);
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

  const merged = { id: BUSINESS_DOC_ID, ...current, ...update } as BusinessInfo;
  return {
    ...merged,
    hours: normalizeBusinessHours(merged.hours),
    specialDates: Array.isArray(merged.specialDates) ? merged.specialDates : [],
  };
};
