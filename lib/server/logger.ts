/**
 * Logger minimo con niveles y prefijo por modulo.
 * Evita dependencias externas y mantiene la salida legible en consola.
 */

type Level = 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info;
const stamp = () => new Date().toISOString();

const emit = (level: Level, scope: string, args: unknown[]) => {
  if (LEVELS[level] > currentLevel) return;
  const prefix = `[${stamp()}] ${level.toUpperCase().padEnd(5)} (${scope})`;
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(prefix, ...args);
};

export const createLogger = (scope = 'app') => ({
  error: (...args: unknown[]) => emit('error', scope, args),
  warn: (...args: unknown[]) => emit('warn', scope, args),
  info: (...args: unknown[]) => emit('info', scope, args),
  debug: (...args: unknown[]) => emit('debug', scope, args),
});

export const logger = createLogger('server');

export default logger;
