import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { signOut, getUserData, supabase } from '../supabaseClient'
import './Layout.css'

function Layout() {
  const navigate = useNavigate()
  const [userData, setUserData] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  // Heartbeat: registrar actividad e IP cada 2 minutos
  useEffect(() => {
    let intervalId = null
    let userIp = ''
    let userId = null

    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json')
        const data = await response.json()
        userIp = data.ip || ''
      } catch (error) {
        console.error('Error obteniendo IP:', error)
        userIp = ''
      }
    }

    const sendHeartbeat = async () => {
      try {
        if (!userId) {
          const { data: { session } } = await supabase.auth.getSession()
          userId = session?.user?.id
        }
        if (!userId) return
        await supabase
          .from('users')
          .update({ last_seen: new Date().toISOString(), last_ip: userIp })
          .eq('id_user', userId)
      } catch (error) {
        console.error('Error enviando heartbeat:', error)
      }
    }

    const startHeartbeat = async () => {
      await fetchIp()
      await sendHeartbeat()
      intervalId = setInterval(sendHeartbeat, 2 * 60 * 1000)
    }

    startHeartbeat()

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const loadUserData = async () => {
    const data = await getUserData()
    setUserData(data)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>🍽️ PAE System</h2>
          <button className="close-menu" onClick={toggleMenu}>✕</button>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
            📊 Dashboard
          </NavLink>
          <NavLink to="/productos" className={({ isActive }) => isActive ? 'active' : ''}>
            📦 Inventario
          </NavLink>
          <NavLink to="/guias-entrada" className={({ isActive }) => isActive ? 'active' : ''}>
            📋 Guías de Entrada
          </NavLink>
          {/* Aprobar Guías: solo Director (id_rol=1) o Desarrollador (id_rol=4) */}
          {[1, 4].includes(userData?.id_rol) && (
            <NavLink to="/aprobar-guias" className={({ isActive }) => isActive ? 'active' : ''}>
              ✅ Aprobar Guías
            </NavLink>
          )}
          <NavLink to="/registro-diario" className={({ isActive }) => isActive ? 'active' : ''}>
            🍴 Registro Diario
          </NavLink>
          <NavLink to="/porciones" className={({ isActive }) => isActive ? 'active' : ''}>
            ⚖️ Porciones
          </NavLink>
          <NavLink to="/reportes" className={({ isActive }) => isActive ? 'active' : ''}>
            📈 Reportes
          </NavLink>
          {/* Auditoría: solo Director (id_rol=1) o Desarrollador (id_rol=4) */}
          {[1, 4].includes(userData?.id_rol) && (
            <NavLink to="/auditoria" className={({ isActive }) => isActive ? 'active' : ''}>
              🔍 Auditoría
            </NavLink>
          )}
          {/* Gestión de Usuarios: solo Director (id_rol=1) o Desarrollador (id_rol=4) */}
          {[1, 4].includes(userData?.id_rol) && (
            <NavLink to="/usuarios" className={({ isActive }) => isActive ? 'active' : ''}>
              👤 Usuarios
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          {userData && (
            <div className="user-info">
              <p className="font-semibold">{userData.full_name}</p>
              <p className="text-sm text-secondary">{userData.rol?.rol_name}</p>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-danger btn-sm" style={{ width: '100%' }}>
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <button className="menu-toggle" onClick={toggleMenu}>
            ☰
          </button>
          <h1>Escuela Nacional Maestro Carlos González</h1>
        </header>

        {/* Page content */}
        <main className="content">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile */}
      {menuOpen && <div className="overlay" onClick={toggleMenu}></div>}
    </div>
  )
}

export default Layout
