import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getUserData } from '../supabaseClient'
import GlobalLoader from './GlobalLoader'

/**
 * RoleRoute — Protector de rutas por rol.
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Si no tiene permiso, redirige al Panel de Control (/).
 *
 * Uso en App.jsx:
 *   <Route element={<RoleRoute allowedRoles={[1, 4]} />}>
 *     <Route path="/usuarios" element={<Usuarios />} />
 *   </Route>
 */
function RoleRoute({ allowedRoles = [] }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'allowed' | 'denied'

  useEffect(() => {
    let cancelled = false

    const checkRole = async () => {
      try {
        const data = await getUserData()
        if (cancelled) return

        if (data && allowedRoles.includes(data.id_rol)) {
          setStatus('allowed')
        } else {
          setStatus('denied')
        }
      } catch {
        if (!cancelled) setStatus('denied')
      }
    }

    checkRole()
    return () => { cancelled = true }
  }, [allowedRoles])

  if (status === 'loading') return <GlobalLoader text="Verificando permisos..." />
  if (status === 'denied') return <Navigate to="/" replace />

  return <Outlet />
}

export default RoleRoute
