import { createClient } from '@supabase/supabase-js'

// Obtener las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validar que existan
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERROR: Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Crear el cliente de Supabase (anon key — respeta RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente secundario para operaciones de registro de usuarios.
// Usa la MISMA anon key pero con sesión NO persistida para evitar
// que el signUp() cierre la sesión del Director/Admin actual.
// NOTA DE SEGURIDAD: Este cliente NUNCA usa service_role key.
// Todas las operaciones pasan por RLS normalmente.
const supabaseAuthHelper = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false, storageKey: 'supabase-auth-helper' }
})

// Helper para obtener el usuario actual
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper para obtener datos del usuario con rol
export const getUserData = async () => {
  const user = await getCurrentUser()
  if (!user) return null
  
  const { data, error } = await supabase
    .from('users')
    .select('*, rol(rol_name)')
    .eq('id_user', user.id)
    .single()
  
  if (error) {
    console.error('Error obteniendo datos del usuario:', error)
    return null
  }
  
  return data
}

// Helper para cerrar sesión
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Error al cerrar sesión:', error)
}

// Helper para obtener la fecha local en formato YYYY-MM-DD
// (evita el problema de toISOString() que usa UTC y puede dar la fecha del día siguiente en Venezuela UTC-4)
export const getLocalDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper para obtener el primer día del mes actual en formato YYYY-MM-DD
export const getFirstDayOfMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

// Helper para crear una cuenta de usuario.
// Usa el cliente auxiliar (anon key, sin sesión persistida) para que
// el signUp() no cierre la sesión activa del Director/Admin.
// El INSERT en la tabla users se hace con el cliente principal
// (sesión del Director) para que RLS valide los permisos.
export const createUserAccount = async (email, password, username, idRol) => {
  // 1. Crear usuario en auth.users con cliente auxiliar (no afecta sesión actual)
  const { data: authData, error: authError } = await supabaseAuthHelper.auth.signUp({
    email,
    password,
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('No se pudo crear el usuario en autenticación')

  // 2. Insertar en tabla users con el cliente principal (permisos RLS del Director)
  const { error: insertError } = await supabase
    .from('users')
    .insert({
      id_user: authData.user.id,
      username,
      id_rol: idRol,
    })

  if (insertError) {
    throw new Error('Usuario creado en autenticación pero falló al registrar en el sistema: ' + insertError.message)
  }

  return authData.user
}

// Helper para cambiar la contraseña de un usuario.
// SEGURIDAD: Solo el propio usuario puede cambiar su contraseña desde el frontend.
// Cambiar la contraseña de OTRO usuario requiere una Edge Function server-side
// con service_role key (nunca expuesta al cliente).
export const changeUserPassword = async (userId, newPassword) => {
  const currentUser = await getCurrentUser()

  if (currentUser && currentUser.id === userId) {
    // El usuario cambia su PROPIA contraseña — permitido por Supabase Auth
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return data
  }

  // Cambiar contraseña de OTRO usuario no es posible sin service_role key.
  // Esta operación debe implementarse como Edge Function en Supabase.
  throw new Error(
    'Cambiar la contraseña de otro usuario requiere permisos de servidor. ' +
    'Esta operación debe realizarse desde el panel de Supabase (Authentication > Users) ' +
    'o mediante una Edge Function configurada con service_role key.'
  )
}

