/**
 * Datos por defecto del salon.
 *
 * Se usan para:
 *  - El seed inicial de Firestore (`npm run seed`).
 *  - Un modo de solo lectura cuando Firebase aun no esta configurado
 *    (permite revisar el sitio y el chat sin credenciales).
 */
import type { BusinessInfo, Service } from '@/lib/types';

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  id: 'main',
  name: 'Beauty Salón',
  legalName: 'Beauty Salón',
  slogan: 'Tu belleza, nuestra pasion',
  description:
    'Salon de estetica y cuidado personal ubicado en Barbosa, Antioquia. Ofrecemos servicios de facial, corporales, manicure, pedicure, depilacion, quejas esteticas y mas.',
  address: 'Carrera 10 # 12-45, Centro',
  city: 'Barbosa',
  department: 'Antioquia',
  country: 'Colombia',
  phone: '+57 604 000 0000',
  whatsapp: '+57 300 000 0000',
  email: 'contacto@beautysalon.co',
  instagram: '@beautysalon',
  hours: [
    { day: 'Lunes', dayOfWeek: 1, isOpen: true, openTime: '08:00', closeTime: '18:00', open: '08:00', close: '18:00' },
    { day: 'Martes', dayOfWeek: 2, isOpen: true, openTime: '08:00', closeTime: '18:00', open: '08:00', close: '18:00' },
    { day: 'Miercoles', dayOfWeek: 3, isOpen: true, openTime: '08:00', closeTime: '18:00', open: '08:00', close: '18:00' },
    { day: 'Jueves', dayOfWeek: 4, isOpen: true, openTime: '08:00', closeTime: '18:00', open: '08:00', close: '18:00' },
    { day: 'Viernes', dayOfWeek: 5, isOpen: true, openTime: '08:00', closeTime: '19:00', open: '08:00', close: '19:00' },
    { day: 'Sabado', dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '17:00', open: '09:00', close: '17:00' },
    { day: 'Domingo', dayOfWeek: 0, isOpen: false, openTime: '09:00', closeTime: '15:00', open: '00:00', close: '00:00' },
  ],
  specialDates: [],
  policies: {
    cancellation:
      'Las citas se pueden cancelar o reprogramar hasta 12 horas antes de la hora agendada.',
    punctuality: 'Se recomienda llegar 10 minutos antes para iniciar el servicio a tiempo.',
    payments:
      'Aceptamos efectivo, transferencia y tarjeta. Los servicios de mas de 150.000 COP requieren anticipo del 50%.',
    minors: 'Los menores de edad deben ir acompañados por un adulto responsable.',
  },
  updatedAt: null,
};

export const DEFAULT_SERVICES: Service[] = [
  {
    id: 'limpieza-facial-profunda',
    name: 'Limpieza facial profunda',
    category: 'Facial',
    description:
      'Limpieza con activos, extraccion e hidratacion profunda. Indicada para piel con acne y exceso de grasa.',
    durationMinutes: 60,
    price: 120000,
    active: true,
  },
  {
    id: 'facial-rejuvenecedor',
    name: 'Facial rejuvenecedor con vitamina C',
    category: 'Facial',
    description:
      'Hidratacion luminosa con vitamina C y proteccion antioxidant. Mejora el tono y la luminosidad de la piel.',
    durationMinutes: 75,
    price: 165000,
    active: true,
  },
  {
    id: 'masaje-reductor',
    name: 'Masaje reductor de vientre',
    category: 'Corporal',
    description:
      'Masaje reductor con tecnicas de drenaje linfatico. Se recomienda un minimo de 5 sesiones para resultados visibles.',
    durationMinutes: 60,
    price: 110000,
    active: true,
  },
  {
    id: 'masaje-relajante',
    name: 'Masaje relajante corporal',
    category: 'Corporal',
    description: 'Masaje de cuerpo completo para reducir el estres y mejorar la circulacion.',
    durationMinutes: 60,
    price: 95000,
    active: true,
  },
  {
    id: 'manicure-gel',
    name: 'Manicure semipermanente en gel',
    category: 'Unas',
    description: 'Preparacion, nivelacion y esmaltado semipermanente con material en gel.',
    durationMinutes: 60,
    price: 55000,
    active: true,
  },
  {
    id: 'pedicure-spa',
    name: 'Pedicure spa',
    category: 'Unas',
    description: 'Pedicure profunda con exfoliacion, soaking, masaje de pies y esmaltado.',
    durationMinutes: 75,
    price: 75000,
    active: true,
  },
  {
    id: 'depilacion-laser',
    name: 'Depilacion laser (por zona)',
    category: 'Depilacion',
    description: 'Sesion de depilacion laser segun zona. Se recomienda una serie de 6 sesiones.',
    durationMinutes: 45,
    price: 90000,
    active: true,
  },
  {
    id: 'cejas-alizado',
    name: 'Disenado y alizado de cejas',
    category: 'Cejas y pestanas',
    description: 'Disenado de cejas con pinza y alizado con cera o hilo.',
    durationMinutes: 30,
    price: 35000,
    active: true,
  },
];
