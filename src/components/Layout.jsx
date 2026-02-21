import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { signOut, getUserData } from '../supabaseClient'
import './Layout.css'

function Layout() {
  const navigate = useNavigate()
  const [userData, setUserData] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadUserData()
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
            📦 Productos
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
          <NavLink to="/asistencia" className={({ isActive }) => isActive ? 'active' : ''}>
            👥 Asistencia
          </NavLink>
          <NavLink to="/menu-diario" className={({ isActive }) => isActive ? 'active' : ''}>
            🍴 Menú Diario
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
