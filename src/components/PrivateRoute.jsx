import { Navigate, Outlet } from 'react-router-dom'

function PrivateRoute({ session }) {
  // Si no hay sesión, redirigir al login
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Si hay sesión, mostrar el contenido (Outlet renderiza las rutas hijas)
  return <Outlet />
}

export default PrivateRoute
