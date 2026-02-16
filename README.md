# Sistema de Inventario PAE - Escuela Nacional Maestro Carlos González

Sistema web simple para gestionar el inventario del Programa de Alimentación Escolar.

## 🚀 GUÍA DE INSTALACIÓN COMPLETA (PASO A PASO)

### PASO 1: Configurar Supabase (Base de Datos)

1. **Crear cuenta en Supabase:**
   - Ve a https://supabase.com
   - Click en "Start your project"
   - Usa tu correo de GitHub Students para registrarte

2. **Crear nuevo proyecto:**
   - Click en "New Project"
   - Nombre: `pae-inventory`
   - Database Password: **GUARDA ESTA CONTRASEÑA** (la necesitarás)
   - Region: South America (São Paulo) - el más cercano
   - Click "Create new project" y espera 2-3 minutos

3. **Obtener credenciales:**
   - En tu proyecto, ve a Settings > API
   - Copia y guarda:
     - `Project URL` (algo como https://xxxxx.supabase.co)
     - `anon public` key (una clave larga)

4. **Crear las tablas:**
   - Ve a "SQL Editor" en el menú lateral
   - Click "New Query"
   - Copia y pega el contenido del archivo `supabase_schema.sql` (está en esta carpeta)
   - Click "Run" (botón verde abajo a la derecha)
   - Deberías ver "Success. No rows returned"

5. **Configurar autenticación:**
   - Ve a Authentication > Providers
   - Asegúrate que "Email" esté habilitado
   - En Authentication > URL Configuration:
     - Site URL: dejarlo como está por ahora

### PASO 2: Instalar Node.js (si no lo tienes)

1. Ve a https://nodejs.org
2. Descarga la versión LTS (recomendada)
3. Instala con las opciones por defecto
4. Abre terminal/CMD y verifica: `node --version` (debe mostrar v18 o superior)

### PASO 3: Configurar el proyecto React

1. **Descargar el código:**
   - Si tienes Git: `git clone [tu-repositorio]`
   - O descarga esta carpeta completa

2. **Abrir terminal en la carpeta del proyecto:**
   - Windows: Click derecho en la carpeta > "Abrir en Terminal" o "Git Bash here"
   - Mac/Linux: botón derecho > "Abrir terminal aquí"

3. **Instalar dependencias:**
   ```bash
   npm install
   ```
   (Esto tomará 1-2 minutos, descarga todo lo necesario)

4. **Configurar variables de entorno:**
   - Renombra el archivo `.env.example` a `.env`
   - Abre `.env` y pega tus credenciales de Supabase:
   ```
   VITE_SUPABASE_URL=tu_project_url_aquí
   VITE_SUPABASE_ANON_KEY=tu_anon_key_aquí
   ```

### PASO 4: Crear usuario administrador inicial

1. En Supabase, ve a Authentication > Users
2. Click "Add user" > "Create new user"
3. Email: tu correo
4. Password: tu contraseña
5. Click "Create user"

6. Ahora asignar rol de admin:
   - Ve a SQL Editor
   - Ejecuta:
   ```sql
   INSERT INTO users (id_user, username, full_name, id_rol)
   VALUES (
     (SELECT id FROM auth.users WHERE email = 'tu_correo@ejemplo.com'),
     'admin',
     'Administrador',
     1
   );
   ```

### PASO 5: Ejecutar el proyecto localmente

```bash
npm run dev
```

- Abre tu navegador en: http://localhost:5173
- ¡Deberías ver la pantalla de login!
- Inicia sesión con tu correo y contraseña

### PASO 6: Deployear en Vercel (ponerlo en internet)

1. **Crear cuenta en Vercel:**
   - Ve a https://vercel.com
   - Click "Sign up" con GitHub
   - Autoriza Vercel

2. **Subir tu código a GitHub:**
   - Crea un nuevo repositorio en GitHub
   - En terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin [URL-de-tu-repo]
   git push -u origin main
   ```

3. **Importar en Vercel:**
   - En Vercel, click "Add New" > "Project"
   - Importa tu repositorio de GitHub
   - En "Environment Variables" agrega:
     - `VITE_SUPABASE_URL` = tu URL
     - `VITE_SUPABASE_ANON_KEY` = tu key
   - Click "Deploy"
   - Espera 2-3 minutos
   - ¡Listo! Te dará una URL como https://tu-proyecto.vercel.app

## 📱 Cómo usar el sistema

### Login
- Usa el correo y contraseña que creaste en Supabase

### Roles:
- **Administrador (1)**: Acceso completo
- **Cocinera/Madre (2)**: Puede registrar menús y ver inventario
- **Director/Inspector (3)**: Solo lectura

### Flujo diario típico:

1. **Registrar asistencia:**
   - Menú lateral > "Asistencia"
   - Click "Nueva Asistencia"
   - Ingresar fecha y número de alumnos presentes
   - Guardar

2. **Registrar menú del día:**
   - Menú lateral > "Menú Diario"
   - Click "Nuevo Menú"
   - Seleccionar fecha (debe tener asistencia registrada)
   - Agregar productos: el sistema calculará automáticamente las porciones
   - Confirmar: esto descuenta del inventario

3. **Registrar guía de entrada (cuando llegan alimentos):**
   - Menú lateral > "Guías de Entrada"
   - Click "Nueva Guía"
   - Llenar datos de la guía
   - Agregar productos con cantidades
   - Guardar: aumenta el stock automáticamente

4. **Ver inventario:**
   - Menú lateral > "Productos"
   - Ver alertas de vencimiento y stock bajo

## 🔒 Seguridad

- Todas las acciones se registran en `audit_log`
- Los roles tienen permisos limitados por RLS (Row Level Security)
- Las contraseñas están encriptadas por Supabase

## 📊 Reportes disponibles

- Stock actual de productos
- Historial de entradas (guías)
- Historial de salidas (menús)
- Log de auditoría completo

## 🆘 Solución de problemas

**Error: "No se puede conectar a Supabase"**
- Verifica que las variables en `.env` estén correctas
- Revisa que el proyecto Supabase esté activo

**Error: "No se pudo iniciar sesión"**
- Verifica que el usuario exista en Authentication > Users
- Verifica que tenga registro en la tabla `users`

**El cálculo de porciones no funciona:**
- Ve a "Porciones" y configura cuántas porciones da cada producto
- Ejemplo: 1 kg de arroz = 12 porciones

## 📞 Contacto

Proyecto desarrollado para la Escuela Nacional Maestro Carlos González
Universidad Politécnica Territorial de Maracaibo

---

## Estructura del proyecto

```
pae-inventory/
├── src/
│   ├── components/         # Componentes reutilizables
│   │   ├── Layout.jsx      # Layout principal con menú
│   │   ├── PrivateRoute.jsx # Protección de rutas
│   │   └── ...
│   ├── pages/              # Páginas principales
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Products.jsx
│   │   ├── GuiasEntrada.jsx
│   │   ├── Asistencia.jsx
│   │   ├── MenuDiario.jsx
│   │   └── ...
│   ├── supabaseClient.js   # Configuración Supabase
│   ├── App.jsx             # Componente principal
│   └── main.jsx            # Punto de entrada
├── public/
├── .env                    # Variables de entorno (NO SUBIR A GITHUB)
├── .gitignore
├── package.json
└── README.md
```
