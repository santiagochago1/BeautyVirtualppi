import { json } from '@/lib/server/http';
import { isFirebaseReady, isFirebaseConfigured } from '@/lib/server/firebase-admin';
import env from '@/lib/server/env';
import { connection } from 'next/server';

export async function GET() {
  // El reporte incluye la hora de la respuesta: es un valor por peticion, asi
  // que se espera a la request real en lugar de prerenderizarlo.
  await connection();

  return json({
    ok: true,
    status: 'up',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    services: {
      firestore: isFirebaseReady(),
      firestoreConfigured: isFirebaseConfigured(),
      gemini: Boolean(env.GEMINI_API_KEY),
      model: env.GEMINI_MODEL,
    },
  });
}
