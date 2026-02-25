import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { signOut, getUserData, supabase } from '../supabaseClient'
import { LayoutDashboard, Package, ClipboardList, CheckSquare, Utensils, Scale, BarChart3, Search, User, Code, Palette, LogOut, Menu, X } from 'lucide-react'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/logo.png" alt="PAE Logo" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.375rem' }} />
            <h2 style={{ margin: 0 }}>PAE System</h2>
          </div>
          <button className="close-menu" onClick={toggleMenu}><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
            <LayoutDashboard className="w-5 h-5 mr-3" /> Dashboard
          </NavLink>
          <NavLink to="/productos" className={({ isActive }) => isActive ? 'active' : ''}>
            <Package className="w-5 h-5 mr-3" /> Inventario
          </NavLink>
          <NavLink to="/guias-entrada" className={({ isActive }) => isActive ? 'active' : ''}>
            <ClipboardList className="w-5 h-5 mr-3" /> Guías de Entrada
          </NavLink>
          {/* Aprobar Guías: solo Director (id_rol=1) o Desarrollador (id_rol=4) */}
          {[1, 4].includes(userData?.id_rol) && (
            <NavLink to="/aprobar-guias" className={({ isActive }) => isActive ? 'active' : ''}>
              <CheckSquare className="w-5 h-5 mr-3" /> Aprobar Guías
            </NavLink>
          )}
          <NavLink to="/registro-diario" className={({ isActive }) => isActive ? 'active' : ''}>
            <Utensils className="w-5 h-5 mr-3" /> Registro Diario
          </NavLink>
          <NavLink to="/porciones" className={({ isActive }) => isActive ? 'active' : ''}>
            <Scale className="w-5 h-5 mr-3" /> Porciones
          </NavLink>
          <NavLink to="/reportes" className={({ isActive }) => isActive ? 'active' : ''}>
            <BarChart3 className="w-5 h-5 mr-3" /> Reportes
          </NavLink>
          {/* Auditoría: solo Director (id_rol=1) o Desarrollador (id_rol=4) */}
          {[1, 4].includes(userData?.id_rol) && (
            <NavLink to="/auditoria" className={({ isActive }) => isActive ? 'active' : ''}>
              <Search className="w-5 h-5 mr-3" /> Auditoría
            </NavLink>
          )}
          {/* Gestión de Usuarios: solo Director (id_rol=1) o Desarrollador (id_rol=4) */}
          {[1, 4].includes(userData?.id_rol) && (
            <NavLink to="/usuarios" className={({ isActive }) => isActive ? 'active' : ''}>
              <User className="w-5 h-5 mr-3" /> Usuarios
            </NavLink>
          )}
        </nav>

        <div className="sidebar-credits">
          <span className="flex items-center gap-1"><Code className="w-3.5 h-3.5" /> Desarrollado por: <a href="https://github.com/dau-in/pae-inventory-system" target="_blank" rel="noopener noreferrer">Darwin Aguirre</a></span><br/>
          <span className="flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Arte por: <a href="https://ghostyentity.carrd.co/" target="_blank" rel="noopener noreferrer">Isabella Martínez</a></span>
        </div>

        <div className="sidebar-footer">
          {userData && (
            <div className="user-info">
              <p className="font-semibold">{userData.full_name}</p>
              <p className="text-sm text-secondary">{userData.rol?.rol_name}</p>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-danger btn-sm flex items-center justify-center gap-2" style={{ width: '100%' }}>
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        {/* Mobile menu toggle */}
        <button className="menu-toggle" onClick={toggleMenu}>
          <Menu className="w-6 h-6" />
        </button>

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
