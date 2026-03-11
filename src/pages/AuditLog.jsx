import { useState, useEffect } from 'react'
import { supabase, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifyError } from '../utils/notifications'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'

const TABLE_LABELS = {
  product: 'Rubros',
  guia_entrada: 'Guías de entrada',
  menu_diario: 'Menú diario',
  menu_detalle: 'Detalle de menú',
  output: 'Salidas',
  input: 'Entradas',
  asistencia_diaria: 'Asistencia',
  users: 'Usuarios',
  category: 'Categorías'
}

function formatAuditDetails(accion, tabla, detalles, recordId) {
  try {
    const modulo = TABLE_LABELS[tabla] || tabla || 'desconocido'

    // Sin detalles: respuesta genérica con ID
    if (!detalles) return `Operación en ${modulo} (ID: ${recordId || '-'})`

    // Garantizar objeto — JSONB llega como objeto, pero defensivo por si llega string
    const d = typeof detalles === 'string' ? JSON.parse(detalles) : detalles

    // DELETE — siempre simple, no intentar leer propiedades internas
    if (accion === 'DELETE') {
      const nombre = d?.product_name || d?.numero_guia_sunagro || d?.full_name || null
      return nombre
        ? `Se eliminó "${nombre}" de ${modulo} (ID: ${recordId || '-'})`
        : `Se eliminó un registro de ${modulo} (ID: ${recordId || '-'})`
    }

    // UPDATE — triggers guardan old/new o old_record/new_record
    if (accion === 'UPDATE') {
      const newData = d?.new || d?.new_record || null
      const nombre = newData?.product_name || newData?.numero_guia_sunagro || newData?.full_name
        || d?.product_name || d?.numero_guia_sunagro || d?.full_name || null

      if (nombre) {
        return `Se actualizó "${nombre}" en ${modulo} (ID: ${recordId || '-'})`
      }
      return `Se actualizó registro en ${modulo} (ID: ${recordId || '-'})`
    }

    // INSERT — lógica detallada por tabla
    if (accion === 'INSERT') {
      switch (tabla) {
        case 'product': {
          const nombre = d?.product_name
          if (!nombre) return `Se registró un rubro (ID: ${recordId || '-'})`
          const stock = d?.stock !== undefined ? ` (stock: ${d.stock} ${d?.unit_measure || ''})` : ''
          return `Se registró el rubro "${nombre}"${stock}`
        }
        case 'guia_entrada': {
          const guia = d?.numero_guia_sunagro
          if (!guia) return `Se registró guía SUNAGRO (ID: ${recordId || '-'})`
          const fecha = d?.fecha ? ` del ${new Date(d.fecha).toLocaleDateString('es-VE')}` : ''
          const estado = d?.estado ? ` — Estado: ${d.estado}` : ''
          return `Se registró guía SUNAGRO N° ${guia}${fecha}${estado}`
        }
        case 'input': {
          const nombre = d?.product_name || d?.product?.product_name
          const cantidad = d?.amount ? ` por ${d.amount} ${d?.unit_measure || d?.product?.unit_measure || 'unidades'}` : ''
          const lote = d?.numero_lote ? ` (lote: ${d.numero_lote})` : ''
          return nombre
            ? `Se registró entrada de "${nombre}"${cantidad}${lote}`
            : `Se registró entrada de inventario (ID: ${recordId || '-'})`
        }
        case 'output': {
          const nombre = d?.product_name || d?.product?.product_name
          const cantidad = d?.amount ? ` por ${d.amount} ${d?.unit_measure || 'unidades'}` : ''
          const motivo = d?.motivo ? ` — Motivo: ${d.motivo}` : ''
          return nombre
            ? `Se registró salida de "${nombre}"${cantidad}${motivo}`
            : `Se registró salida de inventario (ID: ${recordId || '-'})`
        }
        case 'menu_diario': {
          const fecha = d?.fecha ? ` del ${new Date(d.fecha).toLocaleDateString('es-VE')}` : ''
          const asist = d?.asistencia ? ` (${d.asistencia} alumnos)` : ''
          return `Se registró menú del día${fecha}${asist}`
        }
        case 'menu_detalle': {
          const nombre = d?.product_name
          const cant = d?.cantidad_real_usada || '?'
          const unidad = d?.unit_measure || 'unidades'
          return nombre
            ? `Se usaron ${cant} ${unidad} de "${nombre}"`
            : `Se registró detalle de menú (ID: ${recordId || '-'})`
        }
        case 'asistencia_diaria': {
          const fecha = d?.fecha ? ` del ${new Date(d.fecha).toLocaleDateString('es-VE')}` : ''
          const alumnos = d?.alumnos_presentes ? ` — ${d.alumnos_presentes} alumnos presentes` : ''
          return `Se registró asistencia${fecha}${alumnos}`
        }
        case 'users': {
          const nombre = d?.full_name
          const user = d?.username ? ` (@${d.username})` : ''
          return nombre
            ? `Se registró usuario "${nombre}"${user}`
            : `Se registró usuario (ID: ${recordId || '-'})`
        }
        default:
          return `Se creó registro en ${modulo} (ID: ${recordId || '-'})`
      }
    }

    // Acción desconocida
    return `Operación técnica en ${modulo} (ID: ${recordId || '-'})`
  } catch {
    // Fallback absoluto — nunca rompe
    return `Operación técnica en ${TABLE_LABELS[tabla] || tabla || 'sistema'} (ID: ${recordId || '-'})`
  }
}

const ITEMS_PER_PAGE = 25

function AuditLog() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState({
    action_type: '',
    table_affected: '',
    desde: '',
    hasta: ''
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
        .order('timestamp', { ascending: false })
        .limit(100)

      if (filters.desde) {
        query = query.gte('timestamp', filters.desde + 'T00:00:00')
      }

      if (filters.hasta) {
        query = query.lte('timestamp', filters.hasta + 'T23:59:59')
      }

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
      notifyError('Error al cargar auditoría', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setCurrentPage(1)
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
      const details = formatAuditDetails(log.action_type, log.table_affected, log.details, log.record_id).replace(/"/g, '""')
      
      csv += `"${timestamp}","${user}","${log.action_type}","${log.table_affected || '-'}","${log.record_id || '-'}","${details}"\n`
    })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `auditoria_${getLocalDate()}.csv`
    link.click()
  }

  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE)
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE
  const currentLogs = logs.slice(indexOfFirstItem, indexOfLastItem)

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Auditoría del Sistema</h2>
          <p className="text-secondary">Registro completo de todas las acciones</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2" onClick={exportToCSV}>
          <Download className="w-4 h-4" /> Exportar
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
              <option value="product">Rubros</option>
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
          <h3 className="font-semibold">Registros de auditoría</h3>
          <span className="text-sm text-secondary">
            {logs.length > 0
              ? `${indexOfFirstItem + 1}–${Math.min(indexOfLastItem, logs.length)} de ${logs.length}`
              : 'Total: 0'}
          </span>
        </div>

        {loading ? (
          <GlobalLoader text="Cargando auditoría..." />
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
                {currentLogs.map((log) => {
                  let detalleTexto
                  try {
                    detalleTexto = formatAuditDetails(log.action_type, log.table_affected, log.details, log.record_id)
                  } catch {
                    detalleTexto = `Operación en ${log.table_affected || 'sistema'} (ID: ${log.record_id || '-'})`
                  }
                  return (
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
                    <td className="text-sm">{TABLE_LABELS[log.table_affected] || log.table_affected || '-'}</td>
                    <td className="text-sm">{log.record_id || '-'}</td>
                    <td className="text-sm" style={{ maxWidth: '400px' }}>
                      {detalleTexto}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Controles de paginación */}
        {!loading && logs.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-1"
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            <span className="text-sm text-secondary">
              Página {currentPage} de {totalPages}
            </span>

            <button
              className="btn btn-secondary btn-sm flex items-center gap-1"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={currentPage >= totalPages}
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditLog
