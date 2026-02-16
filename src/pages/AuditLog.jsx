import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Loading from '../components/Loading'

function AuditLog() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [filters, setFilters] = useState({
    action_type: '',
    table_affected: '',
    desde: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadLogs()
  }, [filters])

  const loadLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_log')
        .select('*')
        .gte('timestamp', filters.desde + 'T00:00:00')
        .lte('timestamp', filters.hasta + 'T23:59:59')
        .order('timestamp', { ascending: false })
        .limit(100)

      if (filters.action_type) {
        query = query.eq('action_type', filters.action_type)
      }

      if (filters.table_affected) {
        query = query.eq('table_affected', filters.table_affected)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Obtener nombres de usuarios por separado
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(log => log.id_user).filter(Boolean))]
        
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id_user, full_name, username')
            .in('id_user', userIds)
          
          // Mapear usuarios a los logs
          const usersMap = {}
          usersData?.forEach(user => {
            usersMap[user.id_user] = user
          })
          
          // Agregar info de usuario a cada log
          const logsWithUsers = data.map(log => ({
            ...log,
            users: usersMap[log.id_user] || null
          }))
          
          setLogs(logsWithUsers)
        } else {
          setLogs(data || [])
        }
      } else {
        setLogs(data || [])
      }
    } catch (error) {
      console.error('Error cargando logs:', error)
      alert('Error al cargar auditoría: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const exportToCSV = () => {
    let csv = 'Fecha y hora,Usuario,Acción,Tabla,ID Registro,Detalles\n'
    
    logs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString('es-VE')
      const user = log.users?.full_name || 'Sistema'
      const details = (log.details || '').replace(/"/g, '""') // Escapar comillas
      
      csv += `"${timestamp}","${user}","${log.action_type}","${log.table_affected || '-'}","${log.record_id || '-'}","${details}"\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Auditoría del Sistema</h2>
          <p className="text-secondary">Registro completo de todas las acciones</p>
        </div>
        <button className="btn btn-success" onClick={exportToCSV}>
          📥 Exportar
        </button>
      </div>

      {/* Filtros */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-4">Filtros</h3>
        <div className="grid grid-2 gap-4">
          <div className="form-group">
            <label>Tipo de acción</label>
            <select name="action_type" value={filters.action_type} onChange={handleFilterChange}>
              <option value="">Todas</option>
              <option value="INSERT">INSERT (Crear)</option>
              <option value="UPDATE">UPDATE (Actualizar)</option>
              <option value="DELETE">DELETE (Eliminar)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Tabla afectada</label>
            <select name="table_affected" value={filters.table_affected} onChange={handleFilterChange}>
              <option value="">Todas</option>
              <option value="product">Productos</option>
              <option value="guia_entrada">Guías de entrada</option>
              <option value="menu_diario">Menús</option>
              <option value="output">Salidas</option>
              <option value="asistencia_diaria">Asistencia</option>
            </select>
          </div>

          <div className="form-group">
            <label>Desde</label>
            <input
              type="date"
              name="desde"
              value={filters.desde}
              onChange={handleFilterChange}
            />
          </div>

          <div className="form-group">
            <label>Hasta</label>
            <input
              type="date"
              name="hasta"
              value={filters.hasta}
              onChange={handleFilterChange}
            />
          </div>
        </div>
      </div>

      {/* Tabla de logs */}
      <div className="card">
        <div className="flex-between mb-4">
          <h3 className="font-semibold">Últimos 100 registros</h3>
          <span className="text-sm text-secondary">Total: {logs.length}</span>
        </div>

        {loading ? (
          <Loading />
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <p>No hay registros de auditoría</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Tabla</th>
                  <th>ID</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id_log}>
                    <td className="text-sm">
                      {new Date(log.timestamp).toLocaleString('es-VE')}
                    </td>
                    <td>{log.users?.full_name || 'Sistema'}</td>
                    <td>
                      <span className={`badge ${
                        log.action_type === 'INSERT' ? 'badge-success' :
                        log.action_type === 'UPDATE' ? 'badge-warning' :
                        'badge-danger'
                      }`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="text-sm">{log.table_affected || '-'}</td>
                    <td className="text-sm">{log.record_id || '-'}</td>
                    <td className="text-sm" style={{ maxWidth: '300px' }}>
                      <details>
                        <summary style={{ cursor: 'pointer' }}>Ver detalles</summary>
                        <pre style={{ 
                          fontSize: '0.75rem', 
                          marginTop: '0.5rem', 
                          padding: '0.5rem',
                          background: '#f8fafc',
                          borderRadius: '4px',
                          overflow: 'auto',
                          maxHeight: '200px'
                        }}>
                          {log.details || 'Sin detalles'}
                        </pre>
                      </details>
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

export default AuditLog
