# 🚀 INICIO RÁPIDO (5 PASOS)

## ⏱️ Tiempo estimado: 15-20 minutos

### 1️⃣ CONFIGURAR SUPABASE (5 min)

```
✅ Ir a https://supabase.com
✅ Crear cuenta
✅ New Project → nombre: pae-inventory
✅ Guardar la contraseña de base de datos
✅ Esperar 2 minutos que se cree
```

**Obtener credenciales:**
- Settings > API
- Copiar "Project URL" → guardar
- Copiar "anon public key" → guardar

**Crear tablas:**
- SQL Editor > New Query
- Copiar TODO el contenido de `supabase_schema.sql`
- Pegar y click "Run"
- Debe decir "Success"

### 2️⃣ INSTALAR NODE.JS (3 min)

Si NO tienes Node.js:
```
✅ Ir a https://nodejs.org
✅ Descargar versión LTS
✅ Instalar (siguiente, siguiente, instalar)
✅ Verificar: abrir terminal y escribir: node --version
```

### 3️⃣ CONFIGURAR PROYECTO (5 min)

En la terminal, dentro de la carpeta `pae-inventory`:

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo .env
# Copia .env.example a .env
# En Windows: copy .env.example .env
# En Mac/Linux: cp .env.example .env

# 3. Editar .env con tus credenciales de Supabase
# Abre .env con cualquier editor de texto
# Pega tu URL y tu Key
```

Tu archivo `.env` debe verse así:
```
VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci....(tu key larga)
```

### 4️⃣ CREAR USUARIO ADMIN (2 min)

En Supabase:
```
✅ Authentication > Users > Add user
✅ Email: tu@correo.com
✅ Password: tu contraseña segura
✅ Create user
```

Luego, en SQL Editor, ejecutar:
```sql
INSERT INTO users (id_user, username, full_name, id_rol)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'tu@correo.com'),
  'admin',
  'Administrador',
  1
);
```

### 5️⃣ EJECUTAR! 🎉

```bash
npm run dev
```

**Abrir en navegador:**
```
http://localhost:5173
```

**Login con:**
- Email: tu@correo.com
- Password: la que pusiste

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de empezar, asegúrate de tener:

- [ ] Cuenta en Supabase creada
- [ ] Proyecto Supabase funcionando
- [ ] Credenciales guardadas (URL + Key)
- [ ] Tablas creadas (ejecutaste supabase_schema.sql)
- [ ] Node.js instalado
- [ ] Código descargado en tu computadora
- [ ] Archivo .env configurado
- [ ] Usuario admin creado

---

## 🆘 PROBLEMAS COMUNES

### "npm: command not found"
→ No tienes Node.js instalado. Ve al paso 2.

### "Error connecting to Supabase"
→ Revisa tu archivo .env, las credenciales deben ser exactas.

### "Cannot find module"
→ Ejecuta `npm install` de nuevo.

### "No se puede iniciar sesión"
→ Verifica que creaste el usuario en Supabase Y lo insertaste en la tabla users.

### El sitio carga pero está vacío
→ Abre la consola del navegador (F12) y busca errores en rojo.

---

## 📱 PRÓXIMOS PASOS

Después de que funcione localmente:

1. **Agregar productos:** Ve a "Productos" y agrega algunos productos de ejemplo
2. **Configurar porciones:** Ve a "Porciones" y configura cuántas porciones da cada producto
3. **Registrar asistencia:** Ve a "Asistencia" y registra la asistencia del día
4. **Crear menú:** Ve a "Menú Diario" y crea tu primer menú

---

## 🌐 PONER EN INTERNET

Cuando todo funcione en tu computadora, sigue la guía `DEPLOYMENT.md` para:
- Subir a GitHub
- Deployar en Vercel
- Tener tu URL pública

---

## 📚 DOCUMENTACIÓN COMPLETA

- `README.md` - Guía completa paso a paso
- `DEPLOYMENT.md` - Cómo poner en internet
- `supabase_schema.sql` - Script de base de datos

---

## 💬 NECESITAS AYUDA?

1. Lee los mensajes de error completos
2. Busca en Google el error específico
3. Revisa este documento de nuevo
4. Verifica el README.md completo
