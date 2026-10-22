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
import { createLogger } from '@/lib/server/logger';
import type { AuthUser } from '@/lib/server/auth';
import type { BusinessInfo, Service } from '@/lib/types';

const logger = createLogger('context');

const formatPrice = (value: unknown): string => `$${Number(value || 0).toLocaleString('es-CO')}`;

const formatHours = (hours: Array<{ day: string; open: string; close: string }> = []): string =>
  hours
    .map((item) => {
      const cerrado = !item.open || !item.close || item.open === '00:00';
      return `- ${item.day}: ${cerrado ? 'Cerrado' : `${item.open} a ${item.close}`}`;
    })
    .join('\n');

/** Catalogo de servicios (nombre, duracion, precio, descripcion). */
const buildServicesBlock = (services: Service[]): string => {
  if (!services.length) return 'CATALOGO DE SERVICIOS: (no hay servicios registrados)';

  const lines = services.map(
    (service) =>
      `- ${service.name} | categoria: ${service.category || 'General'} | duracion: ${service.durationMinutes} min | precio: ${formatPrice(
        service.price,
      )}${service.description ? ` | descripcion: ${service.description}` : ''}`,
  );

  return `CATALOGO DE SERVICIOS:\n${lines.join('\n')}`;
};

/** Informacion del negocio (contacto, horarios, politicas). */
const buildBusinessBlock = (business: BusinessInfo): string => {
  const contact = [
    `- Nombre: ${business.name}`,
    `- Direccion: ${business.address}, ${business.city}, ${business.department}`,
    `- Telefono: ${business.phone}`,
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
    'INFORMACION DEL NEGOCIO:',
    contact,
    '',
    'HORARIOS DE ATENCION:',
    formatHours(business.hours),
    '',
    'POLITICAS:',
    policies,
  ].join('\n');
};

/** Citas del usuario (cliente) o agenda asignada (empleado). */
const buildAppointmentsBlock = async (user: AuthUser): Promise<string> => {
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

    return `MIS CITAS:\n${lines.length ? lines.join('\n') : 'El usuario no tiene citas registradas.'}`;
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
export const buildChatContext = async (user: AuthUser): Promise<ChatContext> => {
  // Si alguna fuente falla se continua con los valores por defecto: la IA nunca
  // debe quedarse sin contexto, pero tampoco inventar informacion.
  const [businessResult, servicesResult] = await Promise.allSettled([
    getBusinessInfo(),
    listServices({ includeInactive: false }),
  ]);

  const business: BusinessInfo =
    businessResult.status === 'fulfilled' ? businessResult.value : { ...DEFAULT_BUSINESS_INFO };
  const services: Service[] =
    servicesResult.status === 'fulfilled' ? servicesResult.value : DEFAULT_SERVICES;

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
      '=== DATOS VERIFICADOS DEL NEGOCIO (fuente: base de datos) ===',
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
export const buildUserBlock = (user: AuthUser): string =>
  [
    'DATOS DEL USUARIO EN SESION:',
    `- Nombre: ${user.name || 'Usuario'}`,
    `- Rol: ${user.role}`,
    user.email ? `- Correo: ${user.email}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

export default buildChatContext;
