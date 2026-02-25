import { useState, useEffect } from 'react'
import { supabase, getCurrentUser, getUserData, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError, confirmDanger } from '../utils/notifications'
import { X, Plus, Pencil, Trash2 } from 'lucide-react'

function Asistencia() {
  const [loading, setLoading] = useState(true)
  const [asistencias, setAsistencias] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingAsistencia, setEditingAsistencia] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({
    fecha: getLocalDate(),
    total_alumnos: '',
    notas: ''
  })

  useEffect(() => {
    loadAsistencias()
    getUserData().then(data => setUserRole(data?.id_rol))
  }, [])

  const loadAsistencias = async () => {
    try {
      const { data, error } = await supabase
        .from('asistencia_diaria')
        .select('*')
        .order('fecha', { ascending: false })

      if (error) throw error
      setAsistencias(data || [])
    } catch (error) {
      console.error('Error cargando asistencias:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const user = await getCurrentUser()
      const dataToSubmit = {
        ...formData,
        total_alumnos: parseInt(formData.total_alumnos),
        created_by: user.id
      }

      if (editingAsistencia) {
        const { error } = await supabase
          .from('asistencia_diaria')
          .update(dataToSubmit)
          .eq('id_asistencia', editingAsistencia.id_asistencia)

        if (error) throw error
        notifySuccess('Actualizado', 'Asistencia actualizada correctamente')
      } else {
        const { error } = await supabase
          .from('asistencia_diaria')
          .insert(dataToSubmit)

        if (error) throw error
        notifySuccess('Registrado', 'Asistencia registrada correctamente')
      }

      resetForm()
      loadAsistencias()
    } catch (error) {
      console.error('Error guardando asistencia:', error)
      notifyError('Error al guardar', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (asistencia) => {
    setEditingAsistencia(asistencia)
    setFormData({
      fecha: asistencia.fecha,
      total_alumnos: asistencia.total_alumnos,
      notas: asistencia.notas || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmDanger('¿Eliminar asistencia?', 'Este registro será eliminado permanentemente')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('asistencia_diaria')
        .delete()
        .eq('id_asistencia', id)

      if (error) throw error
      notifySuccess('Eliminado', 'Registro de asistencia eliminado')
      loadAsistencias()
    } catch (error) {
      console.error('Error eliminando asistencia:', error)
      notifyError('Error', error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      fecha: getLocalDate(),
      total_alumnos: '',
      notas: ''
    })
    setEditingAsistencia(null)
    setShowForm(false)
  }

  if (loading && asistencias.length === 0) return <GlobalLoader text="Cargando asistencias..." />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Asistencia Diaria</h2>
        {userRole !== 3 && (
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nueva Asistencia</>}
          </button>
        )}
      </div>

      {showForm && userRole !== 3 && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingAsistencia ? 'Editar Asistencia' : 'Nueva Asistencia'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Total de alumnos presentes *</label>
                <input
                  type="number"
                  name="total_alumnos"
                  value={formData.total_alumnos}
                  onChange={handleInputChange}
                  placeholder="Ej: 774"
                  required
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notas</label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleInputChange}
                rows="3"
                placeholder="Observaciones del día..."
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Historial</h3>
        {asistencias.length === 0 ? (
          <div className="empty-state">
            <p>No hay registros de asistencia</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Alumnos presentes</th>
                  <th>Notas</th>
                  {userRole !== 3 && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {asistencias.map((asistencia) => (
                  <tr key={asistencia.id_asistencia}>
                    <td className="font-semibold">
                      {new Date(asistencia.fecha).toLocaleDateString('es-VE', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </td>
                    <td>
                      <span className="text-xl font-bold text-primary">
                        {asistencia.total_alumnos}
                      </span>
                    </td>
                    <td className="text-sm">{asistencia.notas || '-'}</td>
                    {userRole !== 3 && (
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEdit(asistencia)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(asistencia.id_asistencia)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
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

export default Asistencia
