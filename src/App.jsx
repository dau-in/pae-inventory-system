import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Importar páginas
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import GuiasEntrada from './pages/GuiasEntrada'
import RegistroDiario from './pages/RegistroDiario'
import Porciones from './pages/Porciones'
import Reportes from './pages/Reportes'
import AuditLog from './pages/AuditLog'
import AprobarGuias from './pages/AprobarGuias'
import Usuarios from './pages/Usuarios'

// Importar componentes
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
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

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <GlobalLoader text="Iniciando sesión..." />
  }

  return (
    <Router>
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
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/auditoria" element={<AuditLog />} />
            <Route path="/aprobar-guias" element={<AprobarGuias />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>
        </Route>

        {/* Ruta por defecto */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
