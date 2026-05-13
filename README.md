# PAE Inventory System

Sistema de gestión de inventario para el **Programa de Alimentación Escolar (PAE)**. Diseñado para instituciones educativas que necesitan controlar entradas, salidas, vencimientos y operaciones diarias de rubros alimentarios.

## Características

- **Inventario con motor FIFO**: Control de stock con trazabilidad de lotes y fechas de vencimiento.
- **Guías de Entrada**: Registro y flujo de aprobación (Pendiente → Aprobada/Rechazada) con actualización transaccional de inventario.
- **Registro Diario**: Operaciones diarias por turno con descuento automático de stock y lotes.
- **Dashboard**: Panel ejecutivo con estadísticas en tiempo real.
- **RBAC (4 roles)**: Director, Madre Procesadora, Viewer y Desarrollador con políticas RLS en toda la BD.
- **Auditoría**: Bitácora completa de todas las operaciones del sistema.
- **Reportes**: Generación de reportes en Excel.
- **PWA**: Instalable y con soporte offline.

## Prerrequisitos

- [Node.js](https://nodejs.org/) >= 18
- Cuenta en [Supabase](https://supabase.com/) (proyecto creado)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (opcional, incluido como devDependency)

## Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd <nombre-del-repo>

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales de tu proyecto Supabase

# 4. Configurar la base de datos (ver sección siguiente)

# 5. Iniciar el servidor de desarrollo
npm run dev
```

## Base de Datos

Las migraciones SQL están en `supabase/migrations/`. Para montar la BD desde cero:

### Opción A — Supabase CLI (recomendado)

```bash
# Vincular con tu proyecto Supabase
npx supabase link --project-ref <tu-project-ref>

# Ejecutar todas las migraciones
npx supabase db push
```

### Opción B — Manual (SQL Editor)

1. Abrir el **SQL Editor** de tu proyecto en [app.supabase.com](https://app.supabase.com).
2. Ejecutar los archivos de `supabase/migrations/` en **orden cronológico**:
   - `20260220000000_baseline.sql` — Esquema completo (tablas, funciones, triggers, RLS, vistas)
   - `20260513000000_historico_traceability.sql` — Columnas de trazabilidad y demografía

## Variables de Entorno

| Variable | Descripción | Dónde encontrarla |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Llave pública (anon) | Settings > API > Project API keys |

> **Nota**: La `SUPABASE_SERVICE_ROLE_KEY` **no** se expone en el frontend. Se configura como un **secret** en la Edge Function (ver siguiente sección).

## Edge Functions

El sistema incluye una Edge Function para operaciones administrativas:

### `update-user-password`

Permite a Directores y Desarrolladores cambiar contraseñas de otros usuarios usando la Admin API de Supabase.

**Configurar el secret** (obligatorio):

```bash
# Establecer la Service Role Key como secret de la Edge Function
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
```

La Service Role Key se encuentra en: **Settings > API > Project API keys > service_role (secret)**.

> ⚠️ **Nunca** expongas la Service Role Key en el frontend ni en variables `VITE_*`.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite (SPA) |
| Estilos | Tailwind CSS v3 |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| PWA | vite-plugin-pwa |
| Iconos | lucide-react |
| Deploy | Vercel |

## Estructura del Proyecto

```
src/
├── main.jsx                 # Entry point
├── App.jsx                  # Router principal + PrivateRoute + RoleRoute
├── supabaseClient.js        # Clientes Supabase + helpers
├── index.css                # Tailwind directives + custom styles
├── components.css           # Clases CSS reutilizables
├── components/
│   ├── Layout.jsx           # Sidebar + Outlet (nav, heartbeat, RBAC)
│   ├── PrivateRoute.jsx     # Wrapper de autenticación
│   ├── RoleRoute.jsx        # Protector de rutas por rol
│   └── GlobalLoader.jsx     # Loader animado
├── pages/
│   ├── Login.jsx            # Autenticación
│   ├── Dashboard.jsx        # Panel ejecutivo
│   ├── Products.jsx         # CRUD de rubros + FIFO
│   ├── GuiasEntrada.jsx     # Registro de guías CNAE
│   ├── AprobarGuias.jsx     # Aprobación/rechazo de guías
│   ├── RegistroDiario.jsx   # Operaciones diarias
│   ├── Porciones.jsx        # Gestión de rendimientos
│   ├── MenuDiario.jsx       # Menú del día
│   ├── Asistencia.jsx       # Control de asistencia
│   ├── Reportes.jsx         # Generación de reportes
│   ├── AuditLog.jsx         # Bitácora de auditoría
│   ├── Usuarios.jsx         # Gestión de usuarios
│   └── DatosPlantel.jsx     # Perfil institucional
└── utils/
    └── notifications.js     # SweetAlert2 wrappers
supabase/
├── config.toml              # Configuración local Supabase CLI
├── migrations/              # Fuente de verdad del esquema de BD
│   ├── 20260220000000_baseline.sql
│   └── 20260513000000_historico_traceability.sql
└── functions/
    └── update-user-password/ # Edge Function para cambio de contraseñas
```

## Licencia

Consultar archivo [LICENSE](./LICENSE).