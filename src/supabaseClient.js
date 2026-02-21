import { createClient } from '@supabase/supabase-js'

// Obtener las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Validar que existan
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERROR: Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Crear el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente admin para operaciones de administración de usuarios
// Usa service_role key si está disponible (necesaria para cambiar contraseñas)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false, storageKey: 'supabase-admin' }
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

// Helper para crear una cuenta de usuario (usa cliente separado para no cerrar sesión del Director)
export const createUserAccount = async (email, password, fullName, username, idRol) => {
  // 1. Crear usuario en auth.users con cliente separado
  const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
    email,
    password,
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('No se pudo crear el usuario en autenticación')

  // 2. Insertar en tabla users con el cliente principal (tiene permisos RLS del Director)
  const { error: insertError } = await supabase
    .from('users')
    .insert({
      id_user: authData.user.id,
      username,
      full_name: fullName,
      id_rol: idRol,
    })

  if (insertError) {
    // Si falla la inserción en users, el auth.user queda huérfano
    // pero no podemos borrarlo sin service_role key
    throw new Error('Usuario creado en autenticación pero falló al registrar en el sistema: ' + insertError.message)
  }

  return authData.user
}

// Helper para cambiar la contraseña de un usuario (requiere service_role key)
export const changeUserPassword = async (userId, newPassword) => {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { password: newPassword }
  )

  if (error) throw error
  return data
}
