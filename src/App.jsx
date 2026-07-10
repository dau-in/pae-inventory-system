import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './supabaseClient'

// Importar páginas
// Login se importa estático (primera pantalla); el resto se divide en
// chunks independientes que el navegador descarga al navegar a cada módulo
import Login from './pages/Login'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Products = lazy(() => import('./pages/Products'))
const GuiasEntrada = lazy(() => import('./pages/GuiasEntrada'))
const RegistroDiario = lazy(() => import('./pages/RegistroDiario'))
const Porciones = lazy(() => import('./pages/Porciones'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const AprobarGuias = lazy(() => import('./pages/AprobarGuias'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const DatosPlantel = lazy(() => import('./pages/DatosPlantel'))

// Importar componentes
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import RoleRoute from './components/RoleRoute'
import GlobalLoader from './components/GlobalLoader'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obtener sesión actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    // Bloquear clic derecho en imágenes
    const blockImgContext = (e) => {
      if (e.target.tagName === 'IMG') e.preventDefault()
    }
    document.addEventListener('contextmenu', blockImgContext)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('contextmenu', blockImgContext)
    }
  }, [])

  if (loading) {
    return <GlobalLoader text="Iniciando sesión..." />
  }

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<GlobalLoader />}>
      <Routes>
        {/* Ruta pública - Login */}
        <Route 
          path="/login" 
          element={!session ? <Login /> : <Navigate to="/" />} 
        />

        {/* Rutas privadas - requieren autenticación */}
        <Route element={<PrivateRoute session={session} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/productos" element={<Products />} />
            <Route path="/guias-entrada" element={<GuiasEntrada />} />
            <Route path="/registro-diario" element={<RegistroDiario />} />
            <Route path="/porciones" element={<Porciones />} />
            <Route path="/datos-plantel" element={<DatosPlantel />} />

            {/* Rutas restringidas — solo Director (1) y Desarrollador (4) */}
            <Route element={<RoleRoute allowedRoles={[1, 4]} />}>
              <Route path="/auditoria" element={<AuditLog />} />
              <Route path="/aprobar-guias" element={<AprobarGuias />} />
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>
          </Route>
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </Suspense>
    </Router>
  )
}

export default App
