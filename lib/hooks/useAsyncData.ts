'use client';

/**
 * Hook `useAsyncData`: carga datos desde la API y expone un `reload()` para
 * refrescarlos tras una mutacion.
 *
 * La carga inicial se ejecuta dentro del efecto con una bandera `active`
 * para ignorar respuestas que lleguen despues de desmontar el componente.
 * `fetchData` debe ser estable (memorizalo con `useCallback`).
 */
import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/api';

export interface UseAsyncDataOptions<T> {
  /** Valor inicial de `data` mientras se realiza la primera carga. */
  initialData: T;
  /** Mensaje mostrado cuando la peticion falla. */
  errorMessage: string;
}

export interface UseAsyncDataResult<T> {
  /** Datos cargados (o `initialData` mientras carga). */
  data: T;
  /** Ultimo error de la carga. */
  error: string | null;
  /** `true` durante la primera carga. */
  loading: boolean;
  /** Vuelve a ejecutar `fetchData` y actualiza `data`. */
  reload: () => Promise<void>;
  /** Fija (o limpia) el mensaje de error. */
  setError: (message: string | null) => void;
}

export const useAsyncData = <T,>(
  fetchData: () => Promise<T>,
  { initialData, errorMessage }: UseAsyncDataOptions<T>,
): UseAsyncDataResult<T> => {
  const [data, setData] = useState<T>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const next = await fetchData();
        if (!active) return;
        setData(next);
        setError(null);
      } catch (requestError: unknown) {
        if (!active) return;
        setError(getErrorMessage(requestError, errorMessage));
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [fetchData, errorMessage]);

  const reload = useCallback(async () => {
    try {
      setData(await fetchData());
      setError(null);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, errorMessage));
    }
  }, [fetchData, errorMessage]);

  return { data, error, loading, reload, setError };
};

export default useAsyncData;
