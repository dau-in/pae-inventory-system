import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase, getUserData, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError } from '../utils/notifications'
import { exportPDF } from '../utils/pdfGenerator'
import { X, Plus, Utensils, AlertTriangle, Check, Info, Loader2, Save, FileText, ChevronLeft, ChevronRight, Clock, Pencil, ChevronDown, ChevronUp, Ban } from 'lucide-react'

function RegistroDiario() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [registros, setRegistros] = useState([])
  const [productosConRendimiento, setProductosConRendimiento] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [expandedRegistro, setExpandedRegistro] = useState(null)
  const [detallesRegistro, setDetallesRegistro] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [editingRecord, setEditingRecord] = useState(null)
  const [annulling, setAnnulling] = useState(false)

  const prevPage = useRef(currentPage)
  const tableRef = useRef(null)

  const [formData, setFormData] = useState({
    fecha: getLocalDate(),
    hora: new Date().toTimeString().slice(0, 5),
    turno: 'Almuerzo',
    asistencia_total: '',
    notas: ''
  })
  const [rubrosSeleccionados, setRubrosSeleccionados] = useState([])

  useEffect(() => {
    loadRegistros()
    loadProductosConRendimiento()
    getUserData().then(data => {
      setUserRole(data?.id_rol)
      setUserName(data?.username || '')
    })
  }, [])

  // Scroll to table header on page change (skip initial load)
  useEffect(() => {
    if (prevPage.current === currentPage) return
    if (!loading && tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      prevPage.current = currentPage
    }
  }, [currentPage, loading])

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
        .select('*, creador:users!created_by(username)')
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

    // --- EDIT MODE: update metadata only (safe, no FIFO reversal) ---
    if (editingRecord) {
      setSubmitting(true)
      try {
        const { error } = await supabase
          .from('registro_diario')
          .update({
            asistencia_total: parseInt(formData.asistencia_total),
            notas: formData.notas || null
          })
          .eq('id_registro', editingRecord.id_registro)

        if (error) throw error
        notifySuccess('Registro actualizado', 'Los datos del registro se actualizaron correctamente.')
        resetForm()
        loadRegistros()
      } catch (error) {
        console.error('Error actualizando registro:', error)
        notifyError('Error al actualizar', error.message)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // --- CREATE MODE: full FIFO processing ---
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
      // Resolve fecha based on role: Madre Procesadora uses real-time, Director/Dev uses manual input
      const fechaFinal = userRole === 2 ? getLocalDate() : formData.fecha

      const { data, error } = await supabase.rpc('procesar_operacion_diaria', {
        p_fecha: fechaFinal,
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

  const handleAnular = async (idRegistro) => {
    if (!window.confirm('¿Está seguro de anular este registro? Los ingredientes volverán al inventario.')) return
    setAnnulling(true)
    try {
      const { data, error } = await supabase.rpc('anular_operacion_diaria', {
        p_id_registro: idRegistro
      })
      if (error) throw error
      notifySuccess('Registro anulado', data?.mensaje || 'Los rubros fueron devueltos al inventario.')
      resetForm()
      loadRegistros()
      loadProductosConRendimiento()
    } catch (error) {
      console.error('Error anulando registro:', error)
      notifyError('Error al anular', error.message)
    } finally {
      setAnnulling(false)
    }
  }

  const handleEditClick = (record) => {
    setEditingRecord(record)
    setFormData({
      fecha: record.fecha,
      hora: record.created_at ? new Date(record.created_at).toTimeString().slice(0, 5) : '12:00',
      turno: record.turno,
      asistencia_total: String(record.asistencia_total),
      notas: record.notas || ''
    })
    setRubrosSeleccionados([])
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      fecha: getLocalDate(),
      hora: new Date().toTimeString().slice(0, 5),
      turno: 'Almuerzo',
      asistencia_total: '',
      notas: ''
    })
    setRubrosSeleccionados([])
    setEditingRecord(null)
    setShowForm(false)
  }

  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const columns = [
        { header: 'Fecha', dataKey: 'fecha' },
        { header: 'Turno', dataKey: 'turno' },
        { header: 'Asistencia', dataKey: 'asistencia' },
        { header: 'Registrado por', dataKey: 'creador' },
        { header: 'Notas', dataKey: 'notas' },
      ]
      const rows = registros.map(r => ({
        fecha: r.fecha ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-VE') : '-',
        turno: r.turno || '-',
        asistencia: r.asistencia_total ? `${r.asistencia_total} alumnos` : '-',
        creador: r.creador?.username || '-',
        notas: r.notas || '-',
      }))
      await exportPDF({
        title: 'REPORTE DE REGISTRO DIARIO',
        columns,
        data: rows,
        userName,
      })
    } catch (err) {
      console.error('Error exportando PDF:', err)
      notifyError('Error', 'No se pudo generar el reporte PDF')
    } finally {
      setExporting(false)
    }
  }

  if (loading && registros.length === 0) return <GlobalLoader text="Consultando la base de datos..." />

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Registro Diario</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Registra asistencia, rubros cocinados y descuenta automáticamente del inventario</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting || registros.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            style={{ background: '#FFF7ED', color: '#9a3412', border: '1px solid #fed7aa' }}
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Generando...' : 'Generar Reporte'}
          </button>
          {userRole !== 3 && (
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
              style={{ background: '#FFD9A8', color: '#0f172a' }}
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4" /> Nueva Operación
            </button>
          )}
        </div>
      </div>

      {/* ═══ MODAL: Nueva Operación Diaria ═══ */}
      {showForm && userRole !== 3 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            {/* — Encabezado del modal — */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '1rem 1.5rem',
                background: '#FFF7ED',
                borderBottom: '1px solid #fed7aa'
              }}
            >
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#9a3412', margin: 0 }}>
                <Utensils className="w-5 h-5" /> {editingRecord ? 'Editar Registro de Consumo' : 'Registrar Consumo Diario'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#9a3412' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ffedd5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* — Cuerpo scrollable — */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleSubmit}>
                {/* Fecha / Hora / Turno / Asistencia */}
                {userRole === 2 && !editingRecord ? (
                  <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> La fecha y hora se registrarán automáticamente.
                  </p>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {/* Fecha — oculto para Madre Procesadora en creación */}
                  {(userRole !== 2 || editingRecord) && (
                  <div className="form-group">
                    <label style={{ fontSize: '0.9rem' }}>Fecha <span className="text-red-500 ml-1">●</span></label>
                    <input
                      className="w-full"
                      type="date"
                      value={editingRecord ? formData.fecha : formData.fecha}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                      disabled={editingRecord && userRole === 2}
                      required
                    />
                  </div>
                  )}

                  {/* Hora — oculto para Madre Procesadora en creación */}
                  {(userRole !== 2 || editingRecord) && (
                  <div className="form-group">
                    <label style={{ fontSize: '0.9rem' }}>Hora</label>
                    <input
                      className="w-full"
                      type="time"
                      value={formData.hora}
                      onChange={(e) => setFormData(prev => ({ ...prev, hora: e.target.value }))}
                      disabled={editingRecord && userRole === 2}
                    />
                  </div>
                  )}

                  <div className="form-group">
                    <label style={{ fontSize: '0.9rem' }}>Turno <span className="text-red-500 ml-1">●</span></label>
                    <select
                      className="w-full"
                      value={formData.turno}
                      onChange={(e) => setFormData(prev => ({ ...prev, turno: e.target.value }))}
                      disabled={editingRecord && userRole === 2}
                      required
                    >
                      <option value="Desayuno">Desayuno</option>
                      <option value="Almuerzo">Almuerzo</option>
                      <option value="Merienda">Merienda</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.9rem' }}>Asistencia (alumnos) <span className="text-red-500 ml-1">●</span></label>
                    <input
                      className="w-full"
                      type="number"
                      min="1"
                      value={formData.asistencia_total}
                      onChange={(e) => setFormData(prev => ({ ...prev, asistencia_total: e.target.value }))}
                      placeholder="Ingrese el total de alumnos asistentes"
                      required
                    />
                  </div>

                  {editingRecord && (
                    <div className="form-group md:col-span-2">
                      <label style={{ fontSize: '0.9rem' }}>Notas</label>
                      <textarea
                        className="w-full"
                        value={formData.notas}
                        onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                        rows="2"
                        placeholder="Observaciones opcionales"
                      />
                    </div>
                  )}
                </div>

                {/* Rubros a cocinar — SOLO en modo creación */}
                {!editingRecord && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div className="flex-between mb-2">
                    <label className="font-semibold" style={{ fontSize: '0.95rem' }}>Rubros a Cocinar</label>
                    <button
                      type="button"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
                      style={{ background: '#FFD9A8', color: '#0f172a' }}
                      onClick={addRubro}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Rubro
                    </button>
                  </div>

                  {rubrosSeleccionados.length === 0 && (
                    <div className="text-center p-4 text-secondary" style={{ border: '2px dashed #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}>
                      No hay rubros seleccionados. Presione "Agregar Rubro" para comenzar.
                    </div>
                  )}

                  {rubrosSeleccionados.map((rubro, index) => {
                    const calculo = getCalculoRubro(rubro.id_product)
                    const rubrosYaSeleccionados = rubrosSeleccionados
                      .filter((_, i) => i !== index)
                      .map(r => parseInt(r.id_product))

                    return (
                      <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: '0.75rem', marginBottom: '0.6rem', alignItems: 'center' }}>
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
                            <span style={{ color: calculo.suficiente ? '#059669' : '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              {calculo.suficiente ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {calculo.cantidad} {calculo.unit} necesarios
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
                          className="p-1.5 rounded transition-colors"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                          onClick={() => removeRubro(index)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                )}

                {/* Info box — SOLO en modo creación */}
                {!editingRecord && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#FFF7ED',
                  border: '1px solid rgba(254, 215, 170, 0.5)',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  color: '#9a3412'
                }}>
                  <Info className="w-4 h-4 inline" /> La operación descontará automáticamente del inventario usando <strong>FIFO</strong> (primero los lotes más antiguos).
                  Cada rubro: asistencia / rendimiento por unidad.
                </div>
                )}

                {/* Edit mode callout */}
                {editingRecord && (
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#FFF7ED',
                  border: '1px solid rgba(254, 215, 170, 0.5)',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem',
                  color: '#9a3412'
                }}>
                  <AlertTriangle className="w-4 h-4 inline mr-1" /> Por seguridad e integridad del inventario <strong>FIFO</strong>, los rubros descontados no pueden modificarse. Para corregir rubros, <strong>anule este registro</strong> y cree uno nuevo.
                </div>
                )}

                {/* — Pie del modal: botones de acción — */}
                <div
                  className="flex gap-3 justify-between"
                  style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}
                >
                  {/* Lado izquierdo: Anular (solo en edit mode) */}
                  <div>
                    {editingRecord && (
                      <button
                        type="button"
                        onClick={() => handleAnular(editingRecord.id_registro)}
                        disabled={annulling}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Ban className="w-4 h-4" /> {annulling ? 'Anulando...' : 'Anular Registro'}
                      </button>
                    )}
                  </div>

                  {/* Lado derecho: Cancelar + Guardar */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                      style={{ background: '#f3f4f6', color: '#374151' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
                    >
                      <X className="w-4 h-4" /> Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                      style={{
                        background: submitting ? '#cbd5e1' : '#FFD9A8',
                        color: submitting ? '#94a3b8' : '#431407',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                      onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#ffc885' }}
                      onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#FFD9A8' }}
                    >
                      {submitting ? 'Procesando...' : <><Save className="w-4 h-4" /> {editingRecord ? 'Guardar Cambios' : 'Registrar Operación'}</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="card">
        <div ref={tableRef} className="flex justify-between items-center mb-4 scroll-mt-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">Historial de Operaciones <span className="ml-3 bg-[#FFD9A8] text-[#9a3412] text-xs font-bold px-2.5 py-1 rounded-full">{registros.length}</span></h3>
          {registros.length > 0 && (() => {
            const tp = Math.ceil(registros.length / itemsPerPage)
            const sp = Math.min(currentPage, tp)
            const iLast = sp * itemsPerPage
            const iFirst = iLast - itemsPerPage
            return <span className="text-sm font-medium text-slate-500">Mostrando {iFirst + 1} - {Math.min(iLast, registros.length)}</span>
          })()}
        </div>
        {registros.length === 0 ? (
          <div className="empty-state">
            <p>No hay operaciones registradas</p>
            {userRole !== 3 && (
              <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
                Registrar primera operación
              </button>
            )}
          </div>
        ) : (() => {
          const totalPages = Math.ceil(registros.length / itemsPerPage)
          const safePage = Math.min(currentPage, totalPages)
          const indexOfLastItem = safePage * itemsPerPage
          const indexOfFirstItem = indexOfLastItem - itemsPerPage
          const currentItems = registros.slice(indexOfFirstItem, indexOfLastItem)
          return (
          <>
          <div className="relative min-h-[400px]">
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-lg">
                <div className="flex gap-2 mb-2">
                  <div className="w-3 h-3 bg-orange-200 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-slate-500 font-medium">Consultando la base de datos...</span>
              </div>
            )}
            <div className={`transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Asistencia</th>
                  <th>Registrado por</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((registro) => (
                  <Fragment key={registro.id_registro}>
                    {(() => {
                      const isAnulado = registro.notas && registro.notas.startsWith('[ANULADO]')
                      return (
                      <>
                    <tr className={isAnulado ? 'opacity-50' : ''}>
                      <td className="font-semibold">{registro.fecha}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="badge badge-primary">{registro.turno}</span>
                          {isAnulado && <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Anulado</span>}
                        </div>
                      </td>
                      <td>{registro.asistencia_total} alumnos</td>
                      <td className="text-sm">{registro.creador?.username || '-'}</td>
                      <td className="text-sm">{isAnulado ? <span className="text-red-500 italic">{registro.notas}</span> : (registro.notas || '-')}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#ea580c] bg-[#fff7ed] border border-[#fed7aa] rounded-md hover:bg-[#ffedd5] transition-colors"
                            onClick={() => toggleExpand(registro.id_registro)}
                          >
                            {expandedRegistro === registro.id_registro
                              ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar</>
                              : <><ChevronDown className="w-3.5 h-3.5" /> Ver rubros</>}
                          </button>
                          {(userRole === 1 || userRole === 4) && !isAnulado && (
                            <button
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                              onClick={() => handleEditClick(registro)}
                            >
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedRegistro === registro.id_registro && (
                      <tr>
                        <td colSpan="6" style={{ padding: '0.5rem 1rem', background: '#f8fafc' }}>
                          {!detallesRegistro[registro.id_registro] ? (
                            <p className="text-sm text-secondary flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando la base de datos...</p>
                          ) : detallesRegistro[registro.id_registro].length === 0 ? (
                            <p className="text-sm text-secondary">Sin detalles de rubros</p>
                          ) : (
                            <table style={{ boxShadow: 'none', marginBottom: 0 }}>
                              <thead>
                                <tr>
                                  <th className="text-sm">Producto</th>
                                  <th className="text-sm">Cantidad</th>
                                  <th className="text-sm">Unidad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detallesRegistro[registro.id_registro].map(output => (
                                  <tr key={output.id_output}>
                                    <td>{output.product?.product_name || '-'}</td>
                                    <td>{output.amount}</td>
                                    <td className="text-sm text-secondary">{output.product?.unit_measure || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                    </>
                      )
                    })()}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
            </div>
          </div>

          {totalPages >= 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 mt-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safePage <= 1}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#FFF7ED', color: '#9a3412' }}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-sm font-medium text-gray-600">Página {safePage} de {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safePage >= totalPages}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#FFF7ED', color: '#9a3412' }}
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          </>
          )
        })()}
      </div>
    </div>
  )
}

export default RegistroDiario
