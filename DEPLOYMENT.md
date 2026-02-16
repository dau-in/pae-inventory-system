# Guía de Deployment en Vercel

## Opción 1: Deployment desde GitHub (RECOMENDADO)

### Paso 1: Subir código a GitHub

1. **Crea un repositorio en GitHub:**
   - Ve a https://github.com/new
   - Nombre: `pae-inventory-system`
   - Descripción: "Sistema de Inventario PAE"
   - Público o Privado (como prefieras)
   - NO marques "Add a README file"
   - Click "Create repository"

2. **Sube tu código:**
   ```bash
   # En la terminal, dentro de la carpeta pae-inventory
   git init
   git add .
   git commit -m "Initial commit: Sistema PAE completo"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/pae-inventory-system.git
   git push -u origin main
   ```

### Paso 2: Conectar con Vercel

1. **Ve a Vercel:**
   - Visita https://vercel.com
   - Click "Sign up" o "Log in"
   - Elige "Continue with GitHub"
   - Autoriza Vercel en tu cuenta de GitHub

2. **Importar proyecto:**
   - Click en "Add New..." → "Project"
   - Selecciona tu repositorio `pae-inventory-system`
   - Click "Import"

3. **Configurar el proyecto:**
   - **Framework Preset:** Vite (debería detectarlo automáticamente)
   - **Root Directory:** `./` (dejar como está)
   - **Build Command:** `npm run build` (ya viene configurado)
   - **Output Directory:** `dist` (ya viene configurado)

4. **Agregar variables de entorno:**
   - Click en "Environment Variables"
   - Agrega estas dos variables:
     ```
     VITE_SUPABASE_URL = tu-url-de-supabase
     VITE_SUPABASE_ANON_KEY = tu-key-de-supabase
     ```
   - IMPORTANTE: Copia los valores EXACTOS desde tu proyecto Supabase (Settings > API)

5. **Deploy:**
   - Click "Deploy"
   - Espera 2-3 minutos
   - ¡Listo! Te dará una URL como `https://pae-inventory-system.vercel.app`

### Paso 3: Configurar dominio personalizado (OPCIONAL)

1. En el dashboard de Vercel de tu proyecto
2. Ve a Settings > Domains
3. Agrega tu dominio personalizado si tienes uno
4. Sigue las instrucciones para configurar DNS

---

## Opción 2: Deployment manual (sin GitHub)

### Si NO quieres usar GitHub:

1. **Instala Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Haz login:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   # Desde la carpeta pae-inventory
   vercel
   ```

4. **Sigue las preguntas:**
   - Set up and deploy? → `Y`
   - Which scope? → (tu usuario)
   - Link to existing project? → `N`
   - Project name? → `pae-inventory`
   - In which directory? → `./` (enter)
   - Want to override settings? → `N`

5. **Agrega variables de entorno:**
   ```bash
   vercel env add VITE_SUPABASE_URL
   # Pega tu URL cuando te lo pida
   
   vercel env add VITE_SUPABASE_ANON_KEY
   # Pega tu key cuando te lo pida
   ```

6. **Deploy de producción:**
   ```bash
   vercel --prod
   ```

---

## Actualizar el sistema después del primer deploy

### Si usaste GitHub:
1. Haz cambios en tu código local
2. Sube los cambios:
   ```bash
   git add .
   git commit -m "Descripción de los cambios"
   git push
   ```
3. ¡Vercel lo desplegará automáticamente! (toma 2-3 min)

### Si usaste Vercel CLI:
```bash
vercel --prod
```

---

## Solución de problemas

### Error: "Failed to load environment variables"
- Verifica que agregaste las variables de entorno en Vercel
- Asegúrate que empiecen con `VITE_`
- Redeploy el proyecto

### Error: "Cannot connect to Supabase"
- Verifica las URLs en las variables de entorno
- Asegúrate que no hay espacios extras
- Verifica que el proyecto Supabase esté activo

### La página carga pero no funciona
- Abre la consola del navegador (F12)
- Busca errores
- Verifica que las credenciales de Supabase sean correctas

### Cambios no aparecen
- Si usas GitHub: espera unos minutos, Vercel auto-deploya
- Si usas CLI: ejecuta `vercel --prod` de nuevo
- Limpia la caché del navegador (Ctrl + Shift + R)

---

## URLs importantes

- **Tu app:** La URL que te dio Vercel (ej: `https://pae-inventory-system.vercel.app`)
- **Dashboard Vercel:** https://vercel.com/dashboard
- **Dashboard Supabase:** https://app.supabase.com
- **Documentación Vercel:** https://vercel.com/docs

---

## Configuración de dominio personalizado

Si tienes un dominio (ej: `pae.tuescuela.com`):

1. Ve a tu proyecto en Vercel > Settings > Domains
2. Agrega tu dominio
3. Sigue las instrucciones para configurar los DNS
4. Espera propagación (puede tomar hasta 48 horas, usualmente minutos)

---

## Ventajas de usar Vercel

✅ Gratis para proyectos personales/educativos
✅ SSL/HTTPS automático
✅ Dominio .vercel.app incluido
✅ Deploy automático desde GitHub
✅ Fácil de usar
✅ Rápido (CDN global)
✅ Compatible con GitHub Students

---

## Monitoreo y analytics

Vercel te da estadísticas básicas gratis:
- Ve a tu proyecto > Analytics
- Verás visitas, países, etc.
