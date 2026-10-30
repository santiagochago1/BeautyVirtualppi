/**
 * Tipos de dominio compartidos entre el cliente (componentes) y el servidor
 * (Route Handlers de `app/api`).
 */

export type Role = 'client' | 'employee' | 'admin';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'blocked';

export interface EmployeeSchedule {
  /** Días de la semana que labora: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado. */
  workDays: number[];
  /** Hora de entrada en formato `HH:mm` (ej. '09:00'). */
  startTime: string;
  /** Hora de salida en formato `HH:mm` (ej. '17:00'). */
  endTime: string;
}

export interface UserProfile {
  id: string;
  uid: string;
  email: string | null;
  displayName: string;
  photoURL?: string | null;
  phone?: string | null;
  role: Role;
  active?: boolean;
  schedule?: EmployeeSchedule | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description?: string;
  durationMinutes: number;
  price: number;
  active?: boolean;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Indica que el dato proviene de los valores por defecto (sin Firebase). */
  demoMode?: boolean;
}

export interface Appointment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  durationMinutes: number;
  /** Dia local del salon, formato `YYYY-MM-DD`. */
  date: string;
  /** Hora local del salon, formato `HH:mm`. */
  time: string;
  /** Instante absoluto (ISO 8601 UTC) de inicio de la cita. */
  startsAt: string;
  employeeId: string | null;
  employeeName: string | null;
  notes: string;
  status: AppointmentStatus;
  /** Tipo de registro en la agenda: cita de cliente o bloqueo de descanso/pausa. */
  appointmentType?: 'appointment' | 'break';
  createdAt: string;
  updatedAt: string;
  statusUpdatedBy?: string | null;
}

export interface BusinessHour {
  day: string;
  /** Día numérico opcional (0 = Domingo, 1 = Lunes, ..., 6 = Sábado). */
  dayOfWeek?: number;
  /** Indica si el salón abre este día de la semana. */
  isOpen?: boolean;
  /** Hora de apertura (`HH:mm`). */
  openTime?: string;
  /** Hora de cierre (`HH:mm`). */
  closeTime?: string;
  /** Campos legados sincronizados para compatibilidad (`00:00` cuando está cerrado). */
  open: string;
  close: string;
}

export interface SpecialDate {
  id?: string;
  /** Fecha en formato `YYYY-MM-DD`. */
  date: string;
  /** `true` si el salón cierra todo el día. */
  isClosed: boolean;
  /** Hora de apertura especial si `isClosed` es `false`. */
  customOpenTime?: string | null;
  /** Hora de cierre especial si `isClosed` es `false`. */
  customCloseTime?: string | null;
  /** Motivo o etiqueta (ej. "Festivo", "Navidad"). */
  note: string;
}

export interface BusinessPolicies {
  cancellation?: string;
  punctuality?: string;
  payments?: string;
  minors?: string;
  [key: string]: string | undefined;
}

export interface BusinessInfo {
  id: string;
  name: string;
  legalName: string;
  slogan: string;
  description: string;
  address: string;
  city: string;
  department: string;
  country: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  hours: BusinessHour[];
  specialDates?: SpecialDate[];
  policies: BusinessPolicies;
  updatedAt: string | null;
  demoMode?: boolean;
}

export interface AppointmentStats {
  total: number;
  byStatus: Record<AppointmentStatus, number>;
  billedTotal: number;
  byService: Array<{ serviceName: string; count: number; revenue: number }>;
}

/** Mensaje de historial del chat (formato Gemini). */
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/** Opciones de `apiRequest` (cliente HTTP del frontend). */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Cuerpo serializado como JSON. */
  body?: unknown;
  /** Token de Firebase Auth (`Bearer`). */
  token?: string | null;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/** Envoltura de error estandar de la API: `{ ok: false, error, code }`. */
export interface ApiErrorPayload {
  ok: false;
  error: string;
  code?: string | null;
}

/**
 * Usuario devuelto por `GET /api/auth/me`.
 * Incluye el perfil completo de Firestore dentro de `profile`.
 */
export interface AuthMeUser {
  uid: string;
  email: string | null;
  phone?: string | null;
  name: string;
  role: Role;
  profile: UserProfile;
}
