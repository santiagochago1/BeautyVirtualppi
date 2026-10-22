/**
 * Configuracion centralizada del backend (dentro de Next.js).
 *
 * Lee las variables de entorno y las normaliza para el resto de la aplicacion.
 * Si falta una variable critica (Gemini / Firebase) el proceso NO se detiene:
 * se registra una advertencia y los modulos afectados responden con un error
 * 503 explicito, de modo que el resto de la app (catalogo, agenda, panel)
 * siga siendo usable durante el desarrollo.
 */

const toBool = (value: string | undefined | null, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'on'].includes(String(value).trim().toLowerCase());
};

const toNumber = (value: string | undefined | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const raw = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Google Gemini (exclusivamente backend)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  AI_TIMEOUT_MS: toNumber(process.env.AI_TIMEOUT_MS, 20_000),
  AI_MAX_OUTPUT_TOKENS: toNumber(process.env.AI_MAX_OUTPUT_TOKENS, 900),

  // Chat
  CHAT_RATE_LIMIT_MAX: toNumber(process.env.CHAT_RATE_LIMIT_MAX, 15),
  CHAT_RATE_LIMIT_WINDOW_MS: toNumber(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000),
  CHAT_HISTORY_LIMIT: toNumber(process.env.CHAT_HISTORY_LIMIT, 10),

  // Firebase Admin
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
  USE_FIRESTORE_EMULATOR: toBool(process.env.USE_FIRESTORE_EMULATOR, false),
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',

  // Seed (opcional)
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || '',
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || '',
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME || 'Administrador',
};

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
};

export type Env = typeof env;

/** Lista de advertencias de configuracion (se imprime en el arranque). */
export const configWarnings: string[] = [];

if (!env.GEMINI_API_KEY) {
  configWarnings.push(
    'GEMINI_API_KEY no configurada: el chat con IA respondera 503 hasta que la definas en .env.local',
  );
}

if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
  configWarnings.push(
    'Credenciales de Firebase Admin incompletas: se intentara usar Application Default Credentials (emulador o gcloud auth)',
  );
}

export default env;
