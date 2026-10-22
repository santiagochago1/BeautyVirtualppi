/**
 * Inicializacion de Firebase Admin SDK (Firestore + Auth).
 *
 * Prioridad de credenciales:
 *  1. Service Account desde variables de entorno (FIREBASE_*).
 *  2. Application Default Credentials (emulador local / gcloud auth).
 *
 * La inicializacion nunca detiene el proceso: si falla, `isFirebaseReady()`
 * devuelve false y los Route Handlers responden con un 503 explicito.
 */
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import env from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { createLogger } from '@/lib/server/logger';

const logger = createLogger('firebase');

const useServiceAccount = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
);

let app: App | null = null;
let database: Firestore | null = null;
let firebaseAuth: Auth | null = null;
let initError: unknown = null;

try {
  app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: useServiceAccount
            ? cert({
                projectId: env.FIREBASE_PROJECT_ID,
                clientEmail: env.FIREBASE_CLIENT_EMAIL,
                privateKey: env.FIREBASE_PRIVATE_KEY,
              })
            : applicationDefault(),
          databaseURL: `https://${env.FIREBASE_PROJECT_ID || 'demo-project'}.firestore.googleapis.com`,
          storageBucket: env.FIREBASE_STORAGE_BUCKET || undefined,
        });

  database = getFirestore(app);
  firebaseAuth = getAuth(app);

  if (env.USE_FIRESTORE_EMULATOR) {
    process.env.FIRESTORE_EMULATOR_HOST = env.FIRESTORE_EMULATOR_HOST;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = env.FIREBASE_AUTH_EMULATOR_HOST;
    logger.warn('Usando emuladores locales de Firestore/Auth', {
      firestore: env.FIRESTORE_EMULATOR_HOST,
      auth: env.FIREBASE_AUTH_EMULATOR_HOST,
    });
  }

  logger.info('Firebase Admin inicializado', { serviceAccount: useServiceAccount });
} catch (error) {
  initError = error;
  logger.error('No fue posible inicializar Firebase Admin', error);
}

/** Indica si Firestore/Auth estan inicializados en el proceso. */
export const isFirebaseReady = (): boolean => Boolean(database && firebaseAuth);

/**
 * Indica si existen credenciales utilizables: Service Account en .env o
 * emulador local. Sin esto, Firestore respondera con errores de credenciales.
 */
export const isFirebaseConfigured = (): boolean => useServiceAccount || env.USE_FIRESTORE_EMULATOR;

/** Lanza un error 503 controlado cuando la base de datos no esta disponible. */
export const assertFirebaseReady = (): Firestore => {
  if (!isFirebaseReady() || !isFirebaseConfigured() || !database) {
    throw new AppError(
      'La base de datos no esta configurada. Revisa las credenciales de Firebase Admin (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) en .env.local',
      503,
    );
  }
  return database;
};

export { app, database, firebaseAuth, initError, useServiceAccount };

const firebaseAdmin = {
  app,
  database,
  firebaseAuth,
  isFirebaseReady,
  isFirebaseConfigured,
  assertFirebaseReady,
};

export default firebaseAdmin;
