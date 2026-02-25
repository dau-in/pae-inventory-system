import { useState, useEffect } from 'react'
import { supabase, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { Package, AlertTriangle, CalendarClock, Users } from 'lucide-react'

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    expiringSoon: 0,
    todayAttendance: 0
  })
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      // Total productos
      const { count: totalProducts } = await supabase
        .from('product')
        .select('*', { count: 'exact', head: true })

      // Productos con stock bajo
      const { count: lowStock } = await supabase
        .from('product')
        .select('*', { count: 'exact', head: true })
        .lt('stock', 10)

      // Lotes próximos a vencer (30 días) — consulta desde input.lotes_detalle via RPC
      const { data: lotesVencer } = await supabase.rpc('get_lotes_por_vencer', { p_dias: 30 })
      const expiringSoon = lotesVencer?.length || 0

      // Asistencia de hoy - CORRECCIÓN: usar maybeSingle() en vez de single()
      const today = getLocalDate()
      const { data: todayData, error: attendanceError } = await supabase
        .from('asistencia_diaria')
        .select('total_alumnos')
        .eq('fecha', today)
        .maybeSingle() // maybeSingle() permite que no haya datos

      // No lanzar error si no hay asistencia registrada
      if (attendanceError && attendanceError.code !== 'PGRST116') {
        console.error('Error cargando asistencia:', attendanceError)
      }
        
      // Actividad reciente (últimos 10 registros de auditoría)
      const { data: activity } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10)
      
      // Obtener nombres de usuarios por separado
      let activityWithUsers = activity || []
      if (activity && activity.length > 0) {
        const userIds = [...new Set(activity.map(log => log.id_user).filter(Boolean))]
        
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id_user, full_name')
            .in('id_user', userIds)
          
          const usersMap = {}
          usersData?.forEach(user => {
            usersMap[user.id_user] = user
          })
          
          activityWithUsers = activity.map(log => ({
            ...log,
            users: usersMap[log.id_user] || null
          }))
        }
      }

      setStats({
        totalProducts: totalProducts || 0,
        lowStock: lowStock || 0,
        expiringSoon: expiringSoon || 0,
        todayAttendance: todayData?.total_alumnos || 0 // Si no hay datos, será 0
      })

      setRecentActivity(activityWithUsers)
    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <GlobalLoader text="Cargando dashboard..." />

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-2 mb-4">
        <div className="card">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package className="w-6 h-6 text-blue-600" /> Total de Rubros</h3>
          <p className="text-2xl font-heading font-bold text-blue-600">{stats.totalProducts}</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-amber-500" /> Stock Bajo</h3>
          <p className="text-2xl font-heading font-bold text-amber-500">{stats.lowStock}</p>
          <p className="text-sm text-secondary">Rubros con menos de 10 unidades</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><CalendarClock className="w-6 h-6 text-red-500" /> Lotes por Vencer</h3>
          <p className="text-2xl font-heading font-bold text-red-500">{stats.expiringSoon}</p>
          <p className="text-sm text-secondary">Lotes que vencen en los próximos 30 días</p>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Users className="w-6 h-6 text-emerald-500" /> Asistencia Hoy</h3>
          <p className="text-2xl font-heading font-bold text-emerald-500">{stats.todayAttendance}</p>
          <p className="text-sm text-secondary">
            {stats.todayAttendance === 0 ? 'Sin registro' : 'Alumnos presentes'}
          </p>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
        {recentActivity.length === 0 ? (
          <p className="text-secondary">No hay actividad reciente</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Tabla</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((log) => (
                  <tr key={log.id_log}>
                    <td>{log.users?.full_name || 'Desconocido'}</td>
                    <td>
                      <span className={`badge ${
                        log.action_type === 'INSERT' ? 'badge-success' :
                        log.action_type === 'UPDATE' ? 'badge-warning' :
                        log.action_type === 'APPROVE' ? 'badge-success' :
                        log.action_type === 'REJECT' ? 'badge-danger' :
                        'badge-danger'
                      }`}>
                        {log.action_type === 'APPROVE' ? 'APROBAR' :
                         log.action_type === 'REJECT' ? 'RECHAZAR' :
                         log.action_type}
                      </span>
                    </td>
                    <td>{log.table_affected}</td>
                    <td className="text-sm text-secondary">
                      {new Date(log.timestamp).toLocaleString('es-VE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard