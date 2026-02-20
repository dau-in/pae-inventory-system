import { createClient } from '@supabase/supabase-js'

// Obtener las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validar que existan
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERROR: Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Crear el cliente de Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
