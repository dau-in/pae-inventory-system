// db-seed.js — Script para poblar la BD local de Supabase
// Ejecutar con: node db-seed.js
// Usa service_role key para bypass total de RLS.
// Para el INSERT del usuario Desarrollador usa psql directo (bypass trigger).

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

// ── Validación de variables de entorno ──
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ Variable de entorno VITE_SUPABASE_URL no encontrada en .env')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY) {
  console.error('❌ Variable de entorno SUPABASE_SERVICE_ROLE_KEY no encontrada en .env')
  process.exit(1)
}

// ── Descubrimiento dinámico del contenedor de PostgreSQL ──
function findDbContainer() {
  try {
    const output = execSync(
      'docker ps --filter "name=supabase_db" --format "{{.ID}}"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()

    if (!output) {
      console.error('❌ No se encontró un contenedor de Supabase PostgreSQL corriendo.')
      console.error('   Asegúrate de ejecutar "npx supabase start" antes de este script.')
      process.exit(1)
    }

    // Si hay varias líneas, tomar el primero
    const containerId = output.split('\n')[0].trim()
    console.log(`🐳 Contenedor PostgreSQL detectado: ${containerId}`)
    return containerId
  } catch (err) {
    console.error('❌ Error al buscar el contenedor de Docker:', err.message)
    console.error('   Verifica que Docker Desktop esté corriendo.')
    process.exit(1)
  }
}

const DB_CONTAINER = findDbContainer()

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Helpers ──
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const futureDateDays = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Ejecutar SQL directo contra el contenedor PostgreSQL de Docker */
function execSQL(sql) {
  const escaped = sql.replace(/"/g, '\\"')
  execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -c "${escaped}"`, {
    stdio: 'pipe',
  })
}

// ── Credenciales del usuario de prueba ──
const SEED_EMAIL = 'admin@pae.local'
const SEED_PASSWORD = 'PaeLocal#2026!'
const SEED_USERNAME = 'Administrador'

async function seed() {
  console.log('🌱 Iniciando seed de la base de datos local...\n')

  // ================================================================
  // 1. CREAR USUARIO EN AUTH
  // ================================================================
  console.log('👤 Creando usuario en Auth...')
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,
  })

  if (authError) {
    console.error('❌ Error creando usuario en Auth:', authError.message)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log(`   ✅ Usuario creado — UUID: ${userId}\n`)

  // ================================================================
  // 2. INSERTAR CATÁLOGO DE ROLES (vía API — sin trigger bloqueante)
  // ================================================================
  console.log('🔐 Insertando catálogo de roles...')
  const { error: rolError } = await supabase.from('rol').upsert([
    { id_rol: 1, rol_name: 'Director', description: 'CRUD total, aprobar/rechazar guías, gestión de usuarios, auditoría' },
    { id_rol: 2, rol_name: 'Madre Procesadora', description: 'Registrar guías, registro diario, porciones, inventario' },
    { id_rol: 3, rol_name: 'Viewer', description: 'Solo lectura en todo. Sin botones de acción' },
    { id_rol: 4, rol_name: 'Desarrollador', description: 'Todos los permisos del Director + acceso total' },
  ], { onConflict: 'id_rol' })

  if (rolError) {
    console.error('❌ Error insertando roles:', rolError.message)
    process.exit(1)
  }
  console.log('   ✅ 4 roles insertados\n')

  // ================================================================
  // 3. INSERTAR PERFIL DE USUARIO EN TABLA USERS
  //    El trigger protect_director_insert bloquea rol=4 desde la API,
  //    así que ejecutamos SQL directo contra PostgreSQL vía Docker.
  // ================================================================
  console.log('👤 Insertando perfil en tabla users (vía psql directo)...')
  try {
    execSQL(`ALTER TABLE public.users DISABLE TRIGGER trigger_protect_director_insert;`)
    execSQL(`INSERT INTO public.users (id_user, username, id_rol) VALUES ('${userId}', '${SEED_USERNAME}', 4) ON CONFLICT (id_user) DO NOTHING;`)
    execSQL(`ALTER TABLE public.users ENABLE TRIGGER trigger_protect_director_insert;`)
    console.log(`   ✅ Perfil "${SEED_USERNAME}" (Desarrollador) vinculado\n`)
  } catch (err) {
    // Re-enable trigger even on failure
    try { execSQL(`ALTER TABLE public.users ENABLE TRIGGER trigger_protect_director_insert;`) } catch (_) {}
    console.error('❌ Error insertando perfil via psql:', err.message)
    process.exit(1)
  }

  // ================================================================
  // 4. INSERTAR CATÁLOGO OFICIAL DE CATEGORÍAS
  // ================================================================
  console.log('📦 Insertando catálogo oficial de categorías...')
  const { data: categories, error: catError } = await supabase.from('category').insert([
    { category_name: 'Aceites / Grasas' },
    { category_name: 'Azúcar / Dulces' },
    { category_name: 'Bebidas' },
    { category_name: 'Carnes / Proteínas' },
    { category_name: 'Frutas / Verduras' },
    { category_name: 'Granos / Cereales' },
    { category_name: 'Lácteos / Huevos' },
    { category_name: 'Otros Alimenticios' },
    { category_name: 'Panadería / Pastelería' },
    { category_name: 'Pescados / Mariscos' },
  ]).select()

  if (catError) {
    console.error('❌ Error insertando categorías:', catError.message)
    process.exit(1)
  }
  console.log(`   ✅ ${categories.length} categorías oficiales insertadas\n`)

  const catMap = new Map()
  for (const c of categories) catMap.set(c.category_name, c.id_category)

  // ================================================================
  // 5. INSERTAR PRODUCTOS (stock en 0, se sumará al aprobar la guía)
  // ================================================================
  console.log('🏷️  Insertando productos...')
  const { data: products, error: prodError } = await supabase.from('product').insert([
    { product_name: 'Arroz', stock: 0, unit_measure: 'Kg', description: 'Arroz blanco tipo 1', id_category: catMap.get('Granos / Cereales') },
    { product_name: 'Pasta', stock: 0, unit_measure: 'Kg', description: 'Pasta larga tipo espagueti', id_category: catMap.get('Granos / Cereales') },
    { product_name: 'Pollo', stock: 0, unit_measure: 'Kg', description: 'Pollo entero beneficiado', id_category: catMap.get('Carnes / Proteínas') },
    { product_name: 'Aceite', stock: 0, unit_measure: 'Lt', description: 'Aceite vegetal comestible', id_category: catMap.get('Aceites / Grasas') },
  ]).select()

  if (prodError) {
    console.error('❌ Error insertando productos:', prodError.message)
    process.exit(1)
  }
  console.log(`   ✅ ${products.length} productos insertados\n`)

  const prodMap = new Map()
  for (const p of products) prodMap.set(p.product_name, p.id_product)

  // ================================================================
  // 6. CREAR GUÍA DE ENTRADA + INPUTS + APROBAR
  // ================================================================
  console.log('📋 Creando guía de entrada...')
  const { data: guia, error: guiaError } = await supabase.from('guia_entrada').insert({
    numero_guia_sunagro: 'SNG-2026-00001',
    numero_guia_sisecal: 'SSC-2026-00001',
    fecha: today(),
    vocera_nombre: 'María González',
    telefono_vocera: '04141234567',
    notas: 'Primer despacho de prueba — entorno local',
    created_by: userId,
    estado: 'Pendiente',
  }).select().single()

  if (guiaError) {
    console.error('❌ Error creando guía:', guiaError.message)
    process.exit(1)
  }
  console.log(`   ✅ Guía #${guia.id_guia} creada (Pendiente)\n`)

  // 6b. Insertar inputs con lotes JSONB
  console.log('📥 Insertando entradas de inventario (inputs con lotes)...')
  const inputsData = [
    {
      id_guia: guia.id_guia, id_product: prodMap.get('Arroz'), amount: 50, unit_amount: 1, fecha: today(),
      lotes_detalle: [
        { cantidad: 30, fecha_vencimiento: futureDateDays(90) },
        { cantidad: 20, fecha_vencimiento: futureDateDays(120) },
      ],
    },
    {
      id_guia: guia.id_guia, id_product: prodMap.get('Pasta'), amount: 30, unit_amount: 1, fecha: today(),
      lotes_detalle: [
        { cantidad: 30, fecha_vencimiento: futureDateDays(180) },
      ],
    },
    {
      id_guia: guia.id_guia, id_product: prodMap.get('Pollo'), amount: 25, unit_amount: 1, fecha: today(),
      lotes_detalle: [
        { cantidad: 15, fecha_vencimiento: futureDateDays(15) },
        { cantidad: 10, fecha_vencimiento: futureDateDays(45) },
      ],
    },
    {
      id_guia: guia.id_guia, id_product: prodMap.get('Aceite'), amount: 20, unit_amount: 1, fecha: today(),
      lotes_detalle: [
        { cantidad: 20, fecha_vencimiento: futureDateDays(365) },
      ],
    },
  ]

  const { error: inputError } = await supabase.from('input').insert(inputsData)
  if (inputError) {
    console.error('❌ Error insertando inputs:', inputError.message)
    process.exit(1)
  }
  console.log(`   ✅ ${inputsData.length} entradas insertadas\n`)

  // 6c. Aprobar la guía + sumar stock manualmente
  //     (no usamos RPC aprobar_guia porque requiere auth.uid())
  console.log('✅ Aprobando guía y sumando stock...')
  const { error: approveError } = await supabase.from('guia_entrada').update({
    estado: 'Aprobada',
    aprobado_por: userId,
    fecha_aprobacion: new Date().toISOString(),
    comentarios_aprobacion: 'Aprobada automáticamente por seed local',
  }).eq('id_guia', guia.id_guia)

  if (approveError) {
    console.error('❌ Error aprobando guía:', approveError.message)
    process.exit(1)
  }

  // Sumar stock directamente a cada producto
  for (const inp of inputsData) {
    const { error: updateErr } = await supabase
      .from('product')
      .update({ stock: inp.amount })
      .eq('id_product', inp.id_product)

    if (updateErr) {
      console.error(`   ⚠️  Error actualizando stock para producto ${inp.id_product}:`, updateErr.message)
    }
  }
  console.log('   ✅ Guía aprobada — stock actualizado\n')

  // ================================================================
  // 7. INSERTAR RECETA DE PORCIONES
  // ================================================================
  console.log('🍽️  Insertando recetas de porciones...')
  const { error: porcionError } = await supabase.from('receta_porcion').insert([
    { id_product: prodMap.get('Arroz'), rendimiento_por_unidad: 8, unit_measure: 'Kg', notas: '1 Kg rinde ~8 porciones' },
    { id_product: prodMap.get('Pasta'), rendimiento_por_unidad: 6, unit_measure: 'Kg', notas: '1 Kg rinde ~6 porciones' },
    { id_product: prodMap.get('Pollo'), rendimiento_por_unidad: 5, unit_measure: 'Kg', notas: '1 Kg rinde ~5 porciones' },
    { id_product: prodMap.get('Aceite'), rendimiento_por_unidad: 40, unit_measure: 'Lt', notas: '1 Lt rinde ~40 porciones' },
  ])

  if (porcionError) {
    console.error('❌ Error insertando porciones:', porcionError.message)
    process.exit(1)
  }
  console.log('   ✅ Porciones configuradas\n')

  // ================================================================
  // 8. INSERTAR ASISTENCIA DIARIA
  // ================================================================
  console.log('📊 Insertando asistencia diaria...')
  const { error: asistError } = await supabase.from('asistencia_diaria').insert({
    fecha: today(),
    total_alumnos: 120,
    notas: 'Asistencia normal del día — seed local',
    created_by: userId,
  }).select().single()

  if (asistError) {
    console.error('❌ Error insertando asistencia:', asistError.message)
    process.exit(1)
  }
  console.log('   ✅ Asistencia registrada: 120 alumnos\n')

  // ================================================================
  // 9. INSERTAR INSTITUCIÓN (fila única)
  // ================================================================
  console.log('🏫 Insertando datos del plantel...')
  const { error: instError } = await supabase.from('institucion').upsert({
    id: 1,
    nombre: 'U.E.N. Simón Bolívar',
    rif: 'J-12345678-0',
    codigo_dea: 'DEA-001234',
    direccion: 'Av. Principal, Sector Centro',
    director_actual: 'Prof. Ana Martínez',
    estado: 'Guárico',
    ciudad: 'San Juan de los Morros',
    municipio: 'Juan Germán Roscio',
    parroquia: 'San Juan',
    correo_electronico: 'uen.simonbolivar@gmail.com',
    codigo_postal: '2301',
  }, { onConflict: 'id' })

  if (instError) {
    console.error('❌ Error insertando institución:', instError.message)
    process.exit(1)
  }
  console.log('   ✅ Datos del plantel insertados\n')

  // ================================================================
  // RESUMEN FINAL
  // ================================================================
  console.log('═══════════════════════════════════════════════════')
  console.log('🎉 ¡Seed completado exitosamente!')
  console.log('═══════════════════════════════════════════════════')
  console.log('')
  console.log('📋 Datos insertados:')
  console.log(`   • 1 usuario Auth (${SEED_EMAIL})`)
  console.log('   • 4 roles (Director, Madre Procesadora, Viewer, Desarrollador)')
  console.log(`   • 1 perfil "${SEED_USERNAME}" con rol Desarrollador`)
  console.log('   • 10 categorías oficiales del PAE')
  console.log('   • 4 productos con stock (Arroz 50, Pasta 30, Pollo 25, Aceite 20)')
  console.log('   • 1 guía de entrada aprobada con lotes FIFO')
  console.log('   • 4 recetas de porciones')
  console.log('   • 1 registro de asistencia (120 alumnos)')
  console.log('   • 1 fila de institución')
  console.log('')
  console.log('🔑 Credenciales de acceso:')
  console.log(`   Email:    ${SEED_EMAIL}`)
  console.log(`   Password: ${SEED_PASSWORD}`)
  console.log('')
}

seed().catch(err => {
  console.error('💥 Error fatal:', err)
  process.exit(1)
})
