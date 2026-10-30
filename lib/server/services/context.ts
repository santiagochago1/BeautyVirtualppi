/**
 * Servicio de contexto (RAG ligero).
 *
 * Consulta de forma ACOTADA las colecciones `services`, `business_info` y
 * `appointments` para construir un bloque de texto con datos REALES que se
 * inyecta en el System Instruction de Gemini. La IA nunca debe inventar
 * informacion que no este en este contexto.
 */
import { listServices } from '@/lib/server/models/service';
import { getBusinessInfo } from '@/lib/server/models/business-info';
import { DEFAULT_BUSINESS_INFO, DEFAULT_SERVICES } from '@/lib/server/defaults';
import { listAppointmentsByUser, listAppointmentsByEmployee } from '@/lib/server/models/appointment';
import { todaySalon, addDays } from '@/lib/server/datetime';
import { normalizeBusinessHours } from '@/lib/schedule-utils';
import { createLogger } from '@/lib/server/logger';
import type { AuthUser } from '@/lib/server/auth';
import type { BusinessHour, BusinessInfo, Service, SpecialDate } from '@/lib/types';

const logger = createLogger('context');

const formatPrice = (value: unknown): string => `$${Number(value || 0).toLocaleString('es-CO')} COP`;

const formatHours = (hours: BusinessHour[] = []): string => {
  const normalized = normalizeBusinessHours(hours);
  return normalized
    .map((item) => {
      const openTime = item.openTime || item.open;
      const closeTime = item.closeTime || item.close;
      const cerrado = item.isOpen === false || !openTime || !closeTime || openTime === '00:00';
      return `- ${item.day}: ${cerrado ? 'Cerrado' : `${openTime} a ${closeTime}`}`;
    })
    .join('\n');
};

const formatSpecialDates = (specialDates: SpecialDate[] = []): string => {
  if (!Array.isArray(specialDates) || specialDates.length === 0) return '';
  const lines = specialDates.map((item) =>
    item.isClosed
      ? `- ${item.date}: Cerrado todo el día (${item.note || 'Festivo / Excepción'})`
      : `- ${item.date}: Horario especial de ${item.customOpenTime} a ${item.customCloseTime} (${item.note || 'Jornada especial'})`,
  );
  return `\nFECHAS ESPECIALES Y FESTIVOS:\n${lines.join('\n')}`;
};

/** Catalogo de servicios activos (nombre, duracion, precio, descripcion). */
const buildServicesBlock = (services: Service[]): string => {
  const activeServices = services.filter((s) => s.active !== false);
  if (!activeServices.length) return 'CATÁLOGO DE SERVICIOS ACTIVOS: (no hay servicios activos registrados)';

  const lines = activeServices.map(
    (service) =>
      `- ${service.name} | Categoría: ${service.category || 'General'} | Duración: ${service.durationMinutes} minutos | Precio: ${formatPrice(
        service.price,
      )}${service.description ? ` | Descripción: ${service.description}` : ''}`,
  );

  return `CATÁLOGO DE SERVICIOS ACTIVOS (${activeServices.length} servicios):\n${lines.join('\n')}`;
};

/** Informacion del negocio (contacto, horarios, politicas). */
const buildBusinessBlock = (business: BusinessInfo): string => {
  const contact = [
    `- Nombre: ${business.name || 'Beauty Virtual / Beauty Salón'}`,
    `- Ubicación: ${business.address}, ${business.city || 'Barbosa'}, ${business.department || 'Antioquia'}`,
    `- Teléfono: ${business.phone}`,
    `- WhatsApp: ${business.whatsapp}`,
    `- Correo: ${business.email}`,
    business.instagram ? `- Instagram: ${business.instagram}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  const policies = Object.entries(business.policies || {})
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  return [
    'INFORMACIÓN DEL NEGOCIO:',
    contact,
    '',
    'HORARIOS DE ATENCIÓN SEMANAL:',
    formatHours(business.hours),
    formatSpecialDates(business.specialDates),
    '',
    'POLÍTICAS DEL SALÓN:',
    policies,
  ]
    .filter((section) => section !== null)
    .join('\n');
};

/** Citas del usuario (cliente) o agenda asignada (empleado). */
const buildAppointmentsBlock = async (user?: AuthUser | null): Promise<string> => {
  if (!user || !user.uid) {
    return 'ESTADO DE SESIÓN DEL VISITANTE: El usuario aún no ha iniciado sesión. Si desea agendar una cita, invítalo amablemente a pulsar "Agendar mi cita" o "Iniciar sesión" para elegir servicio, profesional, fecha y hora.';
  }

  try {
    const today = todaySalon() ?? '';
    const limit = addDays(today, 90);

    if (user.role === 'employee') {
      const appointments = await listAppointmentsByEmployee(user.uid, { from: today, to: limit });
      const lines = appointments.map(
        (item) =>
          `- ${item.date} ${item.time} | ${item.serviceName} | cliente: ${item.userName} | estado: ${item.status} | id: ${item.id}`,
      );
      return `MI AGENDA (empleado) DESDE HOY:\n${
        lines.length ? lines.join('\n') : 'No tienes citas asignadas por ahora.'
      }`;
    }

    const appointments = await listAppointmentsByUser(user.uid);
    const lines = appointments.map(
      (item) =>
        `- ${item.date} ${item.time} | ${item.serviceName} | precio: ${formatPrice(
          item.servicePrice,
        )} | estado: ${item.status}${item.employeeName ? ` | profesional: ${item.employeeName}` : ''} | id: ${item.id}`,
    );

    return `MIS CITAS:\n${lines.length ? lines.join('\n') : 'El usuario no tiene citas registradas aún.'}`;
  } catch (error) {
    logger.warn(
      `No fue posible cargar las citas del usuario para el contexto: ${(error as Error)?.message}`,
    );
    return 'MIS CITAS: (no disponible en este momento)';
  }
};

export interface ChatContext {
  business: BusinessInfo;
  services: Service[];
  appointments: string;
  text: string;
}

/**
 * Construye el contexto completo en texto plano.
 */
export const buildChatContext = async (user?: AuthUser | null): Promise<ChatContext> => {
  const [businessResult, servicesResult] = await Promise.allSettled([
    getBusinessInfo(),
    listServices({ includeInactive: false }),
  ]);

  const business: BusinessInfo =
    businessResult.status === 'fulfilled' ? businessResult.value : { ...DEFAULT_BUSINESS_INFO };
  const services: Service[] =
    servicesResult.status === 'fulfilled' && servicesResult.value.length > 0
      ? servicesResult.value
      : DEFAULT_SERVICES;

  if (businessResult.status === 'rejected') {
    logger.warn(`Informacion del negocio no disponible: ${businessResult.reason?.message}`);
  }
  if (servicesResult.status === 'rejected') {
    logger.warn(`Catalogo de servicios no disponible: ${servicesResult.reason?.message}`);
  }

  const appointments = await buildAppointmentsBlock(user);

  return {
    business,
    services,
    appointments,
    text: [
      '=== DATOS VERIFICADOS DE BEAUTY VIRTUAL (fuente: base de datos en tiempo real) ===',
      buildBusinessBlock(business),
      '',
      buildServicesBlock(services),
      '',
      appointments,
      '=== FIN DE LOS DATOS VERIFICADOS ===',
    ].join('\n'),
  };
};

/**
 * Datos del usuario en texto (para el prompt).
 */
export const buildUserBlock = (user?: AuthUser | null): string => {
  if (!user || !user.uid) {
    return 'DATOS DEL USUARIO: Visitante en la página web (sin sesión iniciada).';
  }
  return [
    'DATOS DEL USUARIO EN SESIÓN:',
    `- Nombre: ${user.name || 'Cliente'}`,
    `- Rol: ${user.role}`,
    user.phone ? `- Teléfono: ${user.phone}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
};

export default buildChatContext;
