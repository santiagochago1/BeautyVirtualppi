# Beauty Virtual

Asistente virtual e integracion web completa para el salon de estetica **Beauty Salón** (Barbosa, Antioquia).

- **Frontend + Backend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4.
- **Backend nativo:** el antiguo servidor Express se reimplemento **dentro de Next.js** usando Route Handlers (`app/api/**`) y capas de servidor en `lib/server/**`. Ya no hay un proceso/servidor separado.
- **Datos y autenticacion:** Firebase Firestore + Firebase Auth (plan gratuito).
- **IA:** Google Gemini API (`@google/genai`, modelo `gemini-2.5-flash`) con contexto verificado (RAG ligero) y anti-alucinaciones.
- **Seguridad:** RBAC con roles `client`, `employee` y `admin`, limitador de peticiones y token siempre validado en el servidor.

---

## 1. Estructura del proyecto

```
beauty_virual_ppi/
├── app/                          # App Router (rutas + Route Handlers)
│   ├── api/                      # Backend (antes server/src/routes + controllers)
│   │   ├── appointments/         #   /api/appointments, /stats, /[id]/status, /[id]/assign
│   │   ├── auth/                 #   /api/auth/me, /users, /users/[uid]/role, /employees
│   │   ├── business/             #   /api/business
│   │   ├── chat/                 #   /api/chat
│   │   ├── health/               #   /api/health
│   │   └── services/             #   /api/services, /[id]
│   ├── admin/ dashboard/ employee/ login/   # Paginas
│   ├── layout.tsx  page.tsx  globals.css  not-found.tsx
├── components/                   # UI migrada desde client/src/components (TypeScript)
│   ├── AuthProvider.tsx  Navbar.tsx  Footer.tsx  LoadingSpinner.tsx  ProtectedRoute.tsx
│   ├── ServiceCard.tsx  StatusBadge.tsx  AppointmentForm.tsx  AppointmentList.tsx
│   └── ChatbotWidget.tsx  AdminUsers.tsx  AdminServices.tsx  AdminReports.tsx
├── lib/                          # Codigo compartido (antes client/src/lib + server/src)
│   ├── api.ts  firebase.ts  format.ts  types.ts
│   ├── hooks/useAsyncData.ts
│   └── server/                   # Solo servidor (antes server/src/*)
│       ├── env.ts  logger.ts  errors.ts  validators.ts  datetime.ts  defaults.ts
│       ├── firebase-admin.ts  http.ts  rate-limit.ts  auth.ts  year.ts
│       ├── models/               #   user, service, business-info, appointment
│       └── services/             #   conversation, context, ai, chat, appointment
├── scripts/seed.ts               # Carga inicial de Firestore
├── firestore.rules               # Reglas de seguridad de Firestore
└── .env.example                  # Plantilla de variables de entorno
```

---

## 2. Puesta en marcha

### 2.1 Requisitos
- Node.js 20 o superior.
- Un proyecto de Firebase (plan gratuito) con **Authentication** (correo/contrasena) y **Firestore** habilitados.
- Una API key de Google Gemini (gratis): <https://aistudio.google.com/app/apikey>.

### 2.2 Instalacion

```bash
npm install
```

### 2.3 Variables de entorno

```bash
copy .env.example .env.local   # Windows
cp .env.example .env.local     # Linux / macOS
```

Completa como minimo:

```env
# Backend
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-2.5-flash
FIREBASE_PROJECT_ID=beautyvirtual
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@beautyvirtual.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"

# Frontend
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=beautyvirtual.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=beautyvirtual
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=beautyvirtual.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> La API key de Gemini **solo** vive en el backend (`lib/server/env.ts`). Nunca se expone al navegador.
>
> Los valores `NEXT_PUBLIC_*` son publicos por diseno: la seguridad real esta en las reglas de Firestore (`firestore.rules`) y en la validacion de tokens del servidor.
>
> `NEXT_PUBLIC_API_URL` apunta a `/api` (mismo origen) porque el backend ahora vive dentro de Next.js.

### 2.4 Cargar los datos iniciales (seed)

```bash
npm run seed
# crea business_info/main, el catalogo de servicios y (opcional) un admin:
# SEED_ADMIN_EMAIL=admin@beautysalon.co SEED_ADMIN_PASSWORD=clave123 npm run seed
```

### 2.5 Ejecutar

```bash
npm run dev     # Next.js en http://localhost:3000 (web + API en el mismo proceso)
```

| Script | Descripcion |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (web + API) |
| `npm run build` | Build de produccion |
| `npm start` | Servidor de produccion |
| `npm run lint` | ESLint |
| `npm run seed` | Carga datos iniciales en Firestore |

Health check: <http://localhost:3000/api/health>

---

## 3. API (Route Handlers)

El contrato de respuesta se mantiene igual que en el backend Express: `{ ok: true, ... }` o `{ ok: false, error, code }`.

| Metodo | Ruta | Descripcion |
| --- | --- | --- |
| `GET` | `/api/health` | Estado del servicio y de sus dependencias |
| `POST` | `/api/chat` | Chat con Gemini (requiere sesion; limite 15 req/min) |
| `GET` `PATCH` `DELETE` | `/api/auth/me` | Perfil del usuario autenticado |
| `GET` `POST` | `/api/auth/users` | Listado / alta de usuarios (admin) |
| `PATCH` | `/api/auth/users/[uid]/role` | Cambio de rol (admin) |
| `GET` | `/api/auth/employees` | Listado de empleados (admin) |
| `GET` `POST` | `/api/services` | Catalogo de servicios |
| `GET` `PUT` `DELETE` | `/api/services/[id]` | Detalle / edicion / baja de un servicio |
| `GET` `POST` | `/api/appointments` | Citas del usuario / creación de citas |
| `GET` | `/api/appointments/stats` | Estadisticas para los paneles |
| `PATCH` | `/api/appointments/[id]/status` | Cambio de estado de una cita |
| `PATCH` | `/api/appointments/[id]/assign` | Asignacion de empleado a una cita |
| `GET` `PUT` | `/api/business` | Informacion del salon |

El token de Firebase se envia en la cabecera `Authorization: Bearer <idToken>` y se valida en el servidor en cada peticion (`lib/server/auth.ts`).

---

## 4. Motor de IA (Gemini) y anti-alucinaciones

1. **La API key nunca sale del backend** (`process.env.GEMINI_API_KEY`).
2. **Contexto acotado (RAG ligero):** antes de cada mensaje el backend consulta de forma limitada
   `services`, `business_info` y `appointments` del usuario y lo inyecta en el *System Instruction*
   (`lib/server/services/context.ts`).
3. **Reglas del prompt** (`lib/server/services/ai.ts`):
   - La unica fuente de verdad es el bloque de datos verificados.
   - Prohibido inventar precios, promociones, horarios o politicas.
   - Si no hay informacion, debe decirlo y ofrecer el contacto humano que si esta en los datos.
4. **Memoria conversacional:** ultimos 10 mensajes por usuario, con TTL de 30 minutos y mapa en memoria del proceso (`lib/server/services/conversation.ts`).

---

## 5. Roles y permisos

| Rol | Puede |
| --- | --- |
| `client` | Ver catalogo, agendar y cancelar sus citas, usar el chat |
| `employee` | Ver la agenda del salon, confirmar/completar citas asignadas |
| `admin` | Gestionar usuarios, roles, servicios, citas e informacion del salon |

Reglas heredadas del proyecto original:
- `chagopg826@gmail.com` -> `admin`.
- Cualquier correo `@tusalon.com` -> `employee`.

---

## 6. Notas de Next.js 16 (Cache Components)

El proyecto usa `cacheComponents: true` y `partialPrefetching: true` (`next.config.ts`). Algunas reglas a tener en cuenta al tocar el codigo:

- Los Route Handlers `GET` se prerenderizan si no leen datos de la peticion. Los que leen `request.headers` quedan dinamicos: **la lectura debe hacerse fuera de cualquier `try/catch`**, porque el abort del prerender se lanza como excepcion y un `catch` la tragaria.
- `new Date()`, `Date.now()`, `Math.random()` y `crypto.randomUUID()` abortan el prerender. Usa `"use cache"` para capturarlos en el shell estatico (ver `lib/server/year.ts`) o `await connection()` / `await io()` para calcularlos en tiempo de peticion.
- `dynamic`, `revalidate` y `fetchCache` ya no existen: usa `"use cache"` + `cacheLife(...)`.

---

## 7. Despliegue

El proyecto es una app Next.js estandar (`npm run build` + `npm start`), sin servidor Express adicional.
Remember to add `NEXT_PUBLIC_API_URL=/api` y las variables `NEXT_PUBLIC_FIREBASE_*` en el entorno de la plataforma.
