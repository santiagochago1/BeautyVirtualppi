/**
 * Tipos de dominio compartidos entre el cliente (componentes) y el servidor
 * (Route Handlers de `app/api`).
 */

export type Role = 'client' | 'employee' | 'admin';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface UserProfile {
  id: string;
  uid: string;
  email: string | null;
  displayName: string;
  photoURL?: string | null;
  phone?: string | null;
  role: Role;
  active?: boolean;
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
  createdAt: string;
  updatedAt: string;
  statusUpdatedBy?: string | null;
}

export interface BusinessHour {
  day: string;
  open: string;
  close: string;
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
  name: string;
  role: Role;
  profile: UserProfile;
}
