import { useState, useEffect, Fragment } from 'react'
import { supabase, getUserData, getLocalDate } from '../supabaseClient'
import Loading from '../components/Loading'
import { notifySuccess, notifyError } from '../utils/notifications'

function RegistroDiario() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [registros, setRegistros] = useState([])
  const [productosConRendimiento, setProductosConRendimiento] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [expandedRegistro, setExpandedRegistro] = useState(null)
  const [detallesRegistro, setDetallesRegistro] = useState({})

  const [formData, setFormData] = useState({
    fecha: getLocalDate(),
    turno: 'Almuerzo',
    asistencia_total: ''
  })
  const [rubrosSeleccionados, setRubrosSeleccionados] = useState([])

  useEffect(() => {
    loadRegistros()
    loadProductosConRendimiento()
    getUserData().then(data => setUserRole(data?.id_rol))
  }, [])

  const loadProductosConRendimiento = async () => {
    try {
      const { data, error } = await supabase
        .from('receta_porcion')
        .select('id_product, rendimiento_por_unidad, product(id_product, product_name, unit_measure, stock)')

      if (error) throw error
      setProductosConRendimiento(data || [])
    } catch (error) {
      console.error('Error cargando rubros con rendimiento:', error)
    }
  }

  const loadRegistros = async () => {
    try {
      const { data, error } = await supabase
        .from('registro_diario')
        .select('*, creador:users!created_by(full_name)')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setRegistros(data || [])
    } catch (error) {
      console.error('Error cargando registros:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDetallesRegistro = async (idRegistro) => {
    if (detallesRegistro[idRegistro]) return

    try {
      const { data, error } = await supabase
        .from('output')
        .select('*, product(product_name, unit_measure)')
        .eq('id_registro', idRegistro)
        .order('id_output')

      if (error) throw error
      setDetallesRegistro(prev => ({ ...prev, [idRegistro]: data || [] }))
    } catch (error) {
      console.error('Error cargando detalles:', error)
    }
  }

  const toggleExpand = (idRegistro) => {
    if (expandedRegistro === idRegistro) {
      setExpandedRegistro(null)
    } else {
      setExpandedRegistro(idRegistro)
      loadDetallesRegistro(idRegistro)
    }
  }

  const addRubro = () => {
    setRubrosSeleccionados(prev => [...prev, { id_product: '' }])
  }

  const removeRubro = (index) => {
    setRubrosSeleccionados(prev => prev.filter((_, i) => i !== index))
  }

  const handleRubroChange = (index, value) => {
    setRubrosSeleccionados(prev => {
      const updated = [...prev]
      updated[index] = { id_product: value }
      return updated
    })
  }

  const getCalculoRubro = (idProduct) => {
    if (!idProduct || !formData.asistencia_total) return null
    const porcion = productosConRendimiento.find(p => p.id_product === parseInt(idProduct))
    if (!porcion) return null
    const cantidad = parseFloat(formData.asistencia_total) / porcion.rendimiento_por_unidad
    return {
      cantidad: cantidad.toFixed(2),
      unit: porcion.product.unit_measure,
      stock: porcion.product.stock,
      nombre: porcion.product.product_name,
      suficiente: porcion.product.stock >= cantidad
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (rubrosSeleccionados.length === 0) {
      notifyError('Sin rubros', 'Debe agregar al menos un rubro para cocinar')
      return
    }

    const rubrosValidos = rubrosSeleccionados.filter(r => r.id_product)
    if (rubrosValidos.length === 0) {
      notifyError('Sin rubros', 'Seleccione al menos un rubro válido')
      return
    }

    // Check for duplicates
    const ids = rubrosValidos.map(r => parseInt(r.id_product))
    if (new Set(ids).size !== ids.length) {
      notifyError('Rubros duplicados', 'No puede seleccionar el mismo rubro más de una vez')
      return
    }

    setSubmitting(true)

    try {
      const { data, error } = await supabase.rpc('procesar_operacion_diaria', {
        p_fecha: formData.fecha,
        p_turno: formData.turno,
        p_asistencia: parseInt(formData.asistencia_total),
        p_rubros: ids
      })

      if (error) throw error

      notifySuccess('Operación registrada', data?.mensaje || 'Se procesó correctamente')
      resetForm()
      loadRegistros()
      loadProductosConRendimiento()
    } catch (error) {
      console.error('Error procesando operación:', error)
      notifyError('Error al procesar', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      fecha: getLocalDate(),
      turno: 'Almuerzo',
      asistencia_total: ''
    })
    setRubrosSeleccionados([])
    setShowForm(false)
  }

  if (loading && registros.length === 0) return <Loading />

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Registro Diario</h2>
          <p className="text-secondary">Registra asistencia, rubros cocinados y descuenta automáticamente del inventario</p>
        </div>
        {userRole !== 3 && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '❌ Cancelar' : '➕ Nueva Operación'}
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && userRole !== 3 && (
        <div className="card mb-4" style={{ border: '2px solid rgba(254, 215, 170, 0.5)' }}>
          <h3 className="text-lg font-semibold mb-4">Registrar Operación Diaria</h3>

          <form onSubmit={handleSubmit}>
            {/* Fecha / Turno / Asistencia */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={formData.fecha}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Turno *</label>
                <select
                  value={formData.turno}
                  onChange={(e) => setFormData(prev => ({ ...prev, turno: e.target.value }))}
                  required
                >
                  <option value="Desayuno">Desayuno</option>
                  <option value="Almuerzo">Almuerzo</option>
                  <option value="Merienda">Merienda</option>
                </select>
              </div>

              <div className="form-group">
                <label>Asistencia (alumnos) *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.asistencia_total}
                  onChange={(e) => setFormData(prev => ({ ...prev, asistencia_total: e.target.value }))}
                  placeholder="Ej: 774"
                  required
                />
              </div>
            </div>

            {/* Rubros a cocinar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="flex-between mb-2">
                <label className="font-semibold">Rubros a Cocinar</label>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={addRubro}
                >
                  + Agregar Rubro
                </button>
              </div>

              {rubrosSeleccionados.length === 0 && (
                <div className="text-center p-4 text-secondary" style={{ border: '2px dashed #e2e8f0', borderRadius: '8px' }}>
                  No hay rubros seleccionados. Presione "+ Agregar Rubro" para comenzar.
                </div>
              )}

              {rubrosSeleccionados.map((rubro, index) => {
                const calculo = getCalculoRubro(rubro.id_product)
                const rubrosYaSeleccionados = rubrosSeleccionados
                  .filter((_, i) => i !== index)
                  .map(r => parseInt(r.id_product))

                return (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <select
                      value={rubro.id_product}
                      onChange={(e) => handleRubroChange(index, e.target.value)}
                      required
                    >
                      <option value="">Seleccionar rubro...</option>
                      {productosConRendimiento
                        .filter(p => !rubrosYaSeleccionados.includes(p.id_product))
                        .map(p => (
                          <option key={p.id_product} value={p.id_product}>
                            {p.product.product_name} (stock: {p.product.stock} {p.product.unit_measure})
                          </option>
                        ))}
                    </select>

                    <div className="text-sm">
                      {calculo ? (
                        <span style={{ color: calculo.suficiente ? '#059669' : '#dc2626' }}>
                          {calculo.suficiente ? '✓' : '⚠️'} {calculo.cantidad} {calculo.unit} necesarios
                          {!calculo.suficiente && ` (stock: ${calculo.stock})`}
                        </span>
                      ) : (
                        <span className="text-secondary">
                          {rubro.id_product ? 'Ingrese asistencia para calcular' : 'Seleccione un rubro'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => removeRubro(index)}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Info box */}
            <div className="alert alert-warning mb-4">
              ℹ️ La operación descontará automáticamente del inventario usando <strong>FIFO</strong> (primero los lotes más antiguos).
              Cada rubro seleccionado consumirá: asistencia / rendimiento por unidad.
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Procesando...' : '🍳 Registrar Operación'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Historial */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Historial de Operaciones</h3>
        {registros.length === 0 ? (
          <div className="empty-state">
            <p>No hay operaciones registradas</p>
            {userRole !== 3 && (
              <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
                Registrar primera operación
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Asistencia</th>
                  <th>Registrado por</th>
                  <th>Notas</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((registro) => (
                  <Fragment key={registro.id_registro}>
                    <tr>
                      <td className="font-semibold">{registro.fecha}</td>
                      <td>
                        <span className="badge badge-primary">{registro.turno}</span>
                      </td>
                      <td>{registro.asistencia_total} alumnos</td>
                      <td className="text-sm">{registro.creador?.full_name || '-'}</td>
                      <td className="text-sm">{registro.notas || '-'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => toggleExpand(registro.id_registro)}
                        >
                          {expandedRegistro === registro.id_registro ? '▲ Ocultar' : '▼ Ver rubros'}
                        </button>
                      </td>
                    </tr>
                    {expandedRegistro === registro.id_registro && (
                      <tr>
                        <td colSpan="6" style={{ padding: '0.5rem 1rem', background: '#f8fafc' }}>
                          {!detallesRegistro[registro.id_registro] ? (
                            <p className="text-sm text-secondary">Cargando...</p>
                          ) : detallesRegistro[registro.id_registro].length === 0 ? (
                            <p className="text-sm text-secondary">Sin detalles de rubros</p>
                          ) : (
                            <table style={{ boxShadow: 'none', marginBottom: 0 }}>
                              <thead>
                                <tr>
                                  <th className="text-sm">Rubro</th>
                                  <th className="text-sm">Cantidad descontada</th>
                                  <th className="text-sm">Motivo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detallesRegistro[registro.id_registro].map(output => (
                                  <tr key={output.id_output}>
                                    <td>{output.product?.product_name || '-'}</td>
                                    <td>{output.amount} {output.product?.unit_measure || ''}</td>
                                    <td className="text-sm text-secondary">{output.motivo || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default RegistroDiario
