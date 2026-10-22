/**
 * Script de carga inicial de Firestore.
 *
 * Crea/actualiza:
 *  - `business_info/main`  : informacion del salon
 *  - `services/*`          : catalogo de servicios
 *  - `users/{uid}`         : usuario administrador (opcional)
 *
 * Uso:  npx tsx scripts/seed.ts
 */
import { database, firebaseAuth, isFirebaseReady, isFirebaseConfigured } from '@/lib/server/firebase-admin';
import { DEFAULT_BUSINESS_INFO, DEFAULT_SERVICES } from '@/lib/server/defaults';
import { createLogger } from '@/lib/server/logger';

const logger = createLogger('seed');

const seedBusiness = async () => {
  const ref = database!.collection('business_info').doc('main');
  const snapshot = await ref.get();
  const now = new Date().toISOString();

  await ref.set(
    {
      ...DEFAULT_BUSINESS_INFO,
      ...(snapshot.exists ? snapshot.data() : {}),
      updatedAt: now,
    },
    { merge: true },
  );
  logger.info('business_info/main actualizado');
};

const seedServices = async () => {
  const now = new Date().toISOString();

  for (const service of DEFAULT_SERVICES) {
    const ref = database!.collection('services').doc(service.id);
    const snapshot = await ref.get();

    await ref.set(
      {
        name: service.name,
        category: service.category,
        description: service.description,
        durationMinutes: service.durationMinutes,
        price: service.price,
        active: true,
        createdAt: snapshot.exists ? String(snapshot.data()?.createdAt ?? now) : now,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  logger.info(`${DEFAULT_SERVICES.length} servicios procesados`);
};

const seedAdmin = async () => {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const displayName = process.env.SEED_ADMIN_NAME || 'Administrador';

  if (!email || !password) {
    logger.warn('Define SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD para crear el usuario administrador.');
    return;
  }

  let uid: string;
  try {
    const user = await firebaseAuth!.createUser({ email, password, displayName });
    uid = user.uid;
    logger.info(`Usuario administrador creado: ${email}`);
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
    if (code === 'auth/email-already-exists') {
      uid = (await firebaseAuth!.getUserByEmail(email)).uid;
      logger.info(`El administrador ${email} ya existia; se actualizo su rol.`);
    } else {
      throw error;
    }
  }

  await database!.collection('users').doc(uid).set(
    {
      uid,
      email,
      displayName,
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  logger.info('Rol admin asignado');
};

const run = async () => {
  if (!isFirebaseReady() || !isFirebaseConfigured()) {
    logger.error(
      'Firebase no esta configurado. Define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env.local (o usa USE_FIRESTORE_EMULATOR=true) antes de ejecutar el seed.',
    );
    process.exitCode = 1;
    return;
  }

  await seedBusiness();
  await seedServices();
  await seedAdmin();
  logger.info('Seed completado correctamente.');
};

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    logger.error('Error durante el seed', error);
    process.exit(1);
  });
