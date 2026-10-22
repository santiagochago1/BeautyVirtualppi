import { cacheLife } from 'next/cache';

/**
 * Año en curso usado en el pie de pagina.
 *
 * `new Date()` es un valor inestable: Next.js 16 aborta el prerender cuando lo
 * evalua fuera de un scope cacheado. Envolviendolo en `"use cache"` el valor se
 * calcula una vez, se guarda en el shell estatico y el pie de pagina sigue
 * siendo estatico (sin `Suspense` ni `connection()`).
 */
export async function getCurrentYear(): Promise<number> {
  'use cache';
  cacheLife('days');
  return new Date().getFullYear();
}
