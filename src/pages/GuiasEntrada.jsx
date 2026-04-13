import { useState, useEffect, useRef } from 'react'
import { supabase, getCurrentUser, getUserData, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError, notifyWarning } from '../utils/notifications'
import { exportPDF } from '../utils/pdfGenerator'
import { ClipboardList, X, Plus, Package, Trash2, AlertTriangle, Save, Filter, Calendar, User, CheckCircle, XCircle, Clock, Info, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import './GuiasEntrada.css'

function GuiasEntrada() {
  const [loading, setLoading] = useState(true)
  const [guias, setGuias] = useState([])
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [formData, setFormData] = useState({
    numero_guia_sunagro: '',
    numero_guia_sisecal: '',
    fecha: getLocalDate(),
    vocera_nombre: '',
    telefono_operadora: '0414',
    telefono_numero: '',
    notas: ''
  })
  const [detalles, setDetalles] = useState([])

  // Filtros de historial
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [searchSunagro, setSearchSunagro] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const isInitialMount = useRef(true)
  const tableRef = useRef(null)

  useEffect(() => {
    loadGuias()
    loadProducts()
    getUserData().then(data => {
      setUserRole(data?.id_rol)
      setUserName(data?.username || '')
    })
  }, [])

  // Scroll to table header on page change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (!loading && tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentPage, loading])

  const loadGuias = async () => {
    try {
      let query = supabase
        .from('guia_entrada')
        .select(`
          *,
          input(
            id_input,
            amount,
            unit_amount,
            lotes_detalle,
            product(product_name, unit_measure)
          ),
          creador:users!created_by(username),
          aprobador:users!aprobado_por(username)
        `)
        .order('fecha', { ascending: false })

      if (fechaDesde) {
        query = query.gte('fecha', fechaDesde)
      }
      if (fechaHasta) {
        query = query.lte('fecha', fechaHasta)
      }

      if (searchSunagro.trim()) {
        query = query.ilike('numero_guia_sunagro', `%${searchSunagro.trim()}%`)
      }

      const { data, error } = await query

      if (error) throw error
      setGuias(data || [])
    } catch (error) {
      console.error('Error cargando guías:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBuscar = () => {
    setCurrentPage(1)
    setLoading(true)
    loadGuias()
  }


  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const columns = [
        { header: 'Nº Guía', dataKey: 'numero_guia' },
        { header: 'Fecha', dataKey: 'fecha' },
        { header: 'Recibió', dataKey: 'vocera' },
        { header: 'Estado', dataKey: 'estado' },
        { header: 'Aprobado/Rechazado Por', dataKey: 'aprobador' },
      ]
      const rows = guias.map(g => ({
        numero_guia: g.numero_guia_sunagro || '-',
        fecha: g.fecha ? new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-VE') : '-',
        vocera: g.vocera_nombre || '-',
        estado: g.estado || '-',
        aprobador: g.aprobador?.username || '-',
      }))
      await exportPDF({
        title: 'REPORTE DE GUÍAS DE ENTRADA',
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

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('product')
        .select('*')
        .order('product_name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error cargando productos:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    const numericFields = ['numero_guia_sunagro', 'numero_guia_sisecal', 'telefono_numero']
    if (numericFields.includes(name)) {
      const filtered = value.replace(/[^0-9]/g, '')
      if (name === 'telefono_numero' && filtered.length > 7) return
      setFormData(prev => ({ ...prev, [name]: filtered }))
      return
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const addDetalle = () => {
    setDetalles([...detalles, {
      id_product: '',
      amount: '',
      unit_amount: '',
      lotes: [{
        cantidad: '',
        fecha_vencimiento: ''
      }]
    }])
  }

  const removeDetalle = (index) => {
    setDetalles(detalles.filter((_, i) => i !== index))
  }

  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles]
    newDetalles[index][field] = value
    setDetalles(newDetalles)
  }

  const addLote = (detalleIndex) => {
    const newDetalles = [...detalles]
    newDetalles[detalleIndex].lotes.push({
      cantidad: '',
      fecha_vencimiento: ''
    })
    setDetalles(newDetalles)
  }

  const removeLote = (detalleIndex, loteIndex) => {
    const newDetalles = [...detalles]
    if (newDetalles[detalleIndex].lotes.length > 1) {
      newDetalles[detalleIndex].lotes = newDetalles[detalleIndex].lotes.filter((_, i) => i !== loteIndex)
      setDetalles(newDetalles)
    }
  }

  const handleLoteChange = (detalleIndex, loteIndex, field, value) => {
    const newDetalles = [...detalles]
    newDetalles[detalleIndex].lotes[loteIndex][field] = value
    setDetalles(newDetalles)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (detalles.length === 0) {
      notifyWarning('Campo requerido', 'Debe agregar al menos un rubro')
      return
    }

    if (formData.telefono_numero.length !== 7) {
      notifyWarning('Teléfono incompleto', 'El número de teléfono debe tener exactamente 7 dígitos')
      return
    }

    // Validar lotes (siempre obligatorios)
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i]

      for (let j = 0; j < detalle.lotes.length; j++) {
        const lote = detalle.lotes[j]
        if (!lote.cantidad || !lote.fecha_vencimiento) {
          notifyWarning('Datos incompletos', `Rubro ${i + 1}, Lote ${j + 1}: Complete cantidad y fecha de vencimiento`)
          return
        }
      }

      const sumaLotes = detalle.lotes.reduce((sum, lote) => sum + parseFloat(lote.cantidad || 0), 0)
      const cantidadTotal = parseFloat(detalle.amount || 0)

      if (Math.abs(sumaLotes - cantidadTotal) > 0.01) {
        notifyWarning('Lotes no coinciden', `Rubro ${i + 1}: La suma de lotes (${sumaLotes}) no coincide con la cantidad total (${cantidadTotal})`)
        return
      }
    }

    setLoading(true)

    try {
      const user = await getCurrentUser()

      // Insertar guía en estado PENDIENTE
      const { data: guiaData, error: guiaError } = await supabase
        .from('guia_entrada')
        .insert({
          numero_guia_sunagro: formData.numero_guia_sunagro,
          numero_guia_sisecal: formData.numero_guia_sisecal || null,
          fecha: formData.fecha,
          vocera_nombre: formData.vocera_nombre,
          telefono_vocera: formData.telefono_operadora + formData.telefono_numero,
          notas: formData.notas || null,
          created_by: user.id,
          estado: 'Pendiente'
        })
        .select()
        .single()

      if (guiaError) {
        if (guiaError.message.includes('unique_numero_guia_sunagro') || guiaError.code === '23505') {
          notifyError('Guía duplicada', `Ya existe una guía con el número SUNAGRO "${formData.numero_guia_sunagro}"`)
          setLoading(false)
          return
        }
        throw guiaError
      }

      // Insertar detalles — lotes_detalle SIEMPRE tiene valor
      const inputData = detalles.map(detalle => ({
        id_guia: guiaData.id_guia,
        id_product: parseInt(detalle.id_product),
        amount: parseFloat(detalle.amount),
        unit_amount: detalle.unit_amount ? parseInt(detalle.unit_amount) : null,
        fecha: formData.fecha,
        lotes_detalle: detalle.lotes.map(lote => ({
          cantidad: parseFloat(lote.cantidad),
          fecha_vencimiento: lote.fecha_vencimiento
        }))
      }))

      const { error: inputError } = await supabase
        .from('input')
        .insert(inputData)

      if (inputError) throw inputError

      notifySuccess('Guía registrada', `Guía #${formData.numero_guia_sunagro} registrada. Estado: Pendiente de aprobación. El inventario se actualizará cuando el Director la apruebe.`)

      resetForm()
      loadGuias()
    } catch (error) {
      console.error('Error guardando guía:', error)
      notifyError('Error al guardar guía', error.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      numero_guia_sunagro: '',
      numero_guia_sisecal: '',
      fecha: getLocalDate(),
      vocera_nombre: '',
      telefono_operadora: '0414',
      telefono_numero: '',
      notas: ''
    })
    setDetalles([])
    setShowForm(false)
  }

  const getEstadoBadge = (estado) => {
    const styles = {
      'Pendiente': { bg: '#fef3c7', color: '#92400e' },
      'Aprobada': { bg: '#d1fae5', color: '#065f46' },
      'Rechazada': { bg: '#fee2e2', color: '#991b1b' }
    }
    const icons = {
      'Pendiente': <Clock className="w-4 h-4" />,
      'Aprobada': <CheckCircle className="w-4 h-4" />,
      'Rechazada': <XCircle className="w-4 h-4" />
    }
    const style = styles[estado] || styles['Pendiente']
    return (
      <span style={{
        padding: '0.5rem 1rem',
        background: style.bg,
        color: style.color,
        borderRadius: '6px',
        fontSize: '0.85rem',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem'
      }}>
        {icons[estado] || icons['Pendiente']} {estado}
      </span>
    )
  }

  if (loading) return <GlobalLoader text="Consultando la base de datos..." />

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Guías de Entrada CNAE</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Las guías quedan pendientes hasta que el Director las apruebe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting || guias.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            style={{ background: '#FFF7ED', color: '#9a3412', border: '1px solid #fed7aa' }}
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Generando...' : 'Generar Reporte'}
          </button>
          {userRole !== 3 && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-colors text-sm"
              style={{ background: '#FFD9A8', color: '#0f172a' }}
            >
              <Plus className="w-4 h-4" /> Nueva Guía
            </button>
          )}
        </div>
      </div>

      {/* ═══ MODAL: Nueva Guía ═══ */}
      {showForm && userRole !== 3 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* — Encabezado del modal — */}
            <div
              className="flex items-center justify-between sticky top-0 z-10"
              style={{
                padding: '1.25rem 1.5rem',
                background: '#FFF7ED',
                borderBottom: '1px solid #fed7aa',
                borderRadius: '12px 12px 0 0'
              }}
            >
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#9a3412', margin: 0 }}>
                <ClipboardList className="w-5 h-5" /> Registrar Nueva Guía
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

            {/* — Cuerpo del modal — */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{
                padding: '0.75rem 1rem',
                background: '#FFF7ED',
                border: '1px solid rgba(254, 215, 170, 0.5)',
                borderRadius: '8px',
                marginBottom: '1.25rem'
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#9a3412' }}>
                  <Info className="w-4 h-4 inline" /> <strong>Importante:</strong> Esta guía quedará en estado <strong>PENDIENTE</strong> hasta que el Director la apruebe.
                  El inventario NO se actualizará automáticamente.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                      Nº Guía SUNAGRO <span className="text-red-500 ml-1">●</span>
                    </label>
                    <input
                      type="text"
                      name="numero_guia_sunagro"
                      value={formData.numero_guia_sunagro}
                      onChange={handleInputChange}
                      required
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Ej: 91"
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                      Nº Guía SISECAL
                    </label>
                    <input
                      type="text"
                      name="numero_guia_sisecal"
                      value={formData.numero_guia_sisecal}
                      onChange={handleInputChange}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Opcional"
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                      Fecha de Entrega <span className="text-red-500 ml-1">●</span>
                    </label>
                    <input
                      type="date"
                      name="fecha"
                      value={formData.fecha}
                      onChange={handleInputChange}
                      required
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        border: '2px solid #ddd',
                        borderRadius: '8px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                      Vocera que Recibió <span className="text-red-500 ml-1">●</span>
                    </label>
                    <input
                      type="text"
                      name="vocera_nombre"
                      value={formData.vocera_nombre}
                      onChange={handleInputChange}
                      required
                      placeholder="Ej: María Villalobos"
                      style={{
                        width: '100%',
                        padding: '0.65rem',
                        border: '2px solid #ddd',
                        borderRadius: '8px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                      Teléfono de Contacto <span className="text-red-500 ml-1">●</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0' }}>
                      <select
                        name="telefono_operadora"
                        value={formData.telefono_operadora}
                        onChange={handleInputChange}
                        required
                        style={{
                          padding: '0.65rem',
                          border: '2px solid #ddd',
                          borderRight: 'none',
                          borderRadius: '8px 0 0 8px',
                          background: '#f8fafc',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          minWidth: '85px'
                        }}
                      >
                        <option value="0414">0414</option>
                        <option value="0424">0424</option>
                        <option value="0412">0412</option>
                        <option value="0416">0416</option>
                        <option value="0426">0426</option>
                        <option value="0212">0212</option>
                      </select>
                      <input
                        type="text"
                        name="telefono_numero"
                        value={formData.telefono_numero}
                        onChange={handleInputChange}
                        required
                        inputMode="numeric"
                        pattern="[0-9]{7}"
                        maxLength={7}
                        placeholder="1234567"
                        style={{
                          flex: 1,
                          padding: '0.65rem',
                          border: '2px solid #ddd',
                          borderRadius: '0 8px 8px 0',
                          fontSize: '0.95rem',
                          letterSpacing: '0.05em'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                    Observaciones Generales
                  </label>
                  <textarea
                    name="notas"
                    value={formData.notas}
                    onChange={handleInputChange}
                    rows={2}
                    placeholder="Cualquier observación sobre la entrega..."
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Productos */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Rubros Recibidos</h4>
                    <button
                      type="button"
                      onClick={addDetalle}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
                      style={{ background: '#FFD9A8', color: '#0f172a' }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Rubro
                    </button>
                  </div>

                  {detalles.length === 0 && (
                    <div style={{
                      padding: '1.5rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      color: '#64748b',
                      fontSize: '0.9rem'
                    }}>
                      No hay rubros agregados. Click en "Agregar Rubro" para comenzar.
                    </div>
                  )}

                  {detalles.map((detalle, index) => (
                    <div
                      key={index}
                      style={{
                        background: '#f8fafc',
                        padding: '1.25rem',
                        borderRadius: '8px',
                        marginBottom: '0.75rem',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h5 style={{ color: '#475569', margin: 0, fontSize: '0.95rem' }}>Rubro #{index + 1}</h5>
                        <button
                          type="button"
                          onClick={() => removeDetalle(index)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>

                      <div className="rubro-fields-grid">
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                            Rubro <span className="text-red-500 ml-1">●</span>
                          </label>
                          <select
                            value={detalle.id_product}
                            onChange={(e) => handleDetalleChange(index, 'id_product', e.target.value)}
                            required
                            style={{
                              width: '100%',
                              padding: '0.65rem',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              background: 'white'
                            }}
                          >
                            <option value="">Seleccionar...</option>
                            {products.map(product => {
                              const yaUsado = detalles.some((d, i) => i !== index && String(d.id_product) === String(product.id_product))
                              return (
                                <option key={product.id_product} value={product.id_product} disabled={yaUsado}>
                                  {product.product_name} ({product.unit_measure}){yaUsado ? ' — ya agregado' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                            Cantidad Total <span className="text-red-500 ml-1">●</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={detalle.amount}
                            onChange={(e) => handleDetalleChange(index, 'amount', e.target.value)}
                            required
                            placeholder="100"
                            style={{
                              width: '100%',
                              padding: '0.65rem',
                              border: '1px solid #ddd',
                              borderRadius: '8px'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                            Bultos
                          </label>
                          <input
                            type="number"
                            value={detalle.unit_amount}
                            onChange={(e) => handleDetalleChange(index, 'unit_amount', e.target.value)}
                            placeholder="10"
                            style={{
                              width: '100%',
                              padding: '0.65rem',
                              border: '1px solid #ddd',
                              borderRadius: '8px'
                            }}
                          />
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                            Opcional. Sacos, pacas o cajas físicas.
                          </p>
                        </div>
                      </div>

                      {/* Sección de lotes (siempre visible) */}
                      <div style={{
                        background: 'white',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '2px dashed #3b82f6'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                          <h6 style={{ color: '#3b82f6', margin: 0, fontSize: '0.9rem' }}>
                            <span className="flex items-center gap-1"><Package className="w-4 h-4" /> Lotes / Vencimientos</span>
                          </h6>
                          <button
                            type="button"
                            onClick={() => addLote(index)}
                            className="px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                            style={{ background: '#3b82f6', color: 'white' }}
                          >
                            + Lote
                          </button>
                        </div>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.72rem', color: '#64748b' }}>
                          Múltiples lotes solo si el rubro llegó con diferentes fechas de caducidad.
                        </p>

                        {detalle.lotes.map((lote, loteIndex) => (
                          <div
                            key={loteIndex}
                            className="lote-row-grid"
                            style={{
                              marginBottom: '0.5rem',
                              padding: '0.6rem',
                              background: '#f8fafc',
                              borderRadius: '6px'
                            }}
                          >
                            <div>
                              <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.8rem' }}>
                                Cantidad Lote {loteIndex + 1} <span className="text-red-500 ml-1">●</span>
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={lote.cantidad}
                                onChange={(e) => handleLoteChange(index, loteIndex, 'cantidad', e.target.value)}
                                required
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.8rem' }}>
                                Vencimiento <span className="text-red-500 ml-1">●</span>
                              </label>
                              <input
                                type="date"
                                value={lote.fecha_vencimiento}
                                onChange={(e) => handleLoteChange(index, loteIndex, 'fecha_vencimiento', e.target.value)}
                                required
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px'
                                }}
                              />
                              <small style={{ display: 'block', marginTop: '0.15rem', color: '#64748b', fontSize: '0.7rem' }}>
                                Sin fecha visible: estime fecha máxima de consumo.
                              </small>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                              {detalle.lotes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLote(index, loteIndex)}
                                  className="p-1.5 rounded transition-colors"
                                  style={{ background: '#fee2e2', color: '#991b1b' }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Resumen */}
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.6rem',
                          background: '#FFF7ED',
                          borderRadius: '6px',
                          fontSize: '0.85rem'
                        }}>
                          <strong>Resumen:</strong>{' '}
                          Suma: {detalle.lotes.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0).toFixed(2)}
                          {' | '}
                          Total: {detalle.amount || 0}
                          {Math.abs((detalle.lotes.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)) - (parseFloat(detalle.amount) || 0)) > 0.01 && (
                            <span style={{ color: '#ef4444', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle className="w-4 h-4" /> No coinciden</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* — Pie del modal: botones de acción — */}
                <div
                  className="flex gap-3 justify-end sticky bottom-0 z-10"
                  style={{
                    padding: '1rem 0 0',
                    borderTop: '1px solid #e5e7eb',
                    background: 'white'
                  }}
                >
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
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                    style={{
                      background: loading ? '#cbd5e1' : '#FFD9A8',
                      color: loading ? '#94a3b8' : '#431407',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#ffc885' }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#FFD9A8' }}
                  >
                    {loading ? 'Guardando...' : <><Save className="w-4 h-4" /> Registrar Guía (Pendiente)</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Filtros del historial (compactos) */}
      <div
        className="flex flex-wrap items-end gap-3"
        style={{
          padding: '1rem 1.25rem',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          marginBottom: '1.25rem',
          border: '1px solid #e2e8f0'
        }}
      >
        <div className="flex items-center gap-1.5" style={{ color: '#78716c', fontSize: '0.85rem', fontWeight: '600' }}>
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div style={{ flex: '1 1 140px', minWidth: '120px' }}>
          <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>Nº SUNAGRO</label>
          <input
            type="text"
            value={searchSunagro}
            onChange={(e) => setSearchSunagro(e.target.value)}
            placeholder="Buscar..."
            style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ flex: '0 1 150px', minWidth: '130px' }}>
          <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
        <div style={{ flex: '0 1 150px', minWidth: '130px' }}>
          <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.75rem', fontWeight: '500', color: '#64748b' }}>Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
        <button
          onClick={handleBuscar}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
          style={{ background: '#FFD9A8', color: '#0f172a' }}
        >
          Buscar
        </button>
      </div>

      {/* Lista de guías */}
      <div>
        <div ref={tableRef} className="flex justify-between items-center mb-4 scroll-mt-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">Historial de Guías <span className="ml-3 bg-[#FFD9A8] text-[#9a3412] text-xs font-bold px-2.5 py-1 rounded-full">{guias.length}</span></h3>
          {guias.length > 0 && (() => {
            const tp = Math.ceil(guias.length / itemsPerPage)
            const sp = Math.min(currentPage, tp)
            const iLast = sp * itemsPerPage
            const iFirst = iLast - itemsPerPage
            return <span className="text-sm font-medium text-slate-500">Mostrando {iFirst + 1} - {Math.min(iLast, guias.length)}</span>
          })()}
        </div>

        {guias.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '12px'
          }}>
            <div style={{ margin: '0 0 1rem 0' }}><ClipboardList className="w-12 h-12 text-slate-400 mx-auto" /></div>
            <p>No hay guías en el rango seleccionado.</p>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(guias.length / itemsPerPage)
          const safePage = Math.min(currentPage, totalPages)
          const indexOfLastItem = safePage * itemsPerPage
          const indexOfFirstItem = indexOfLastItem - itemsPerPage
          const currentItems = guias.slice(indexOfFirstItem, indexOfLastItem)
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
          <div style={{ display: 'grid', gap: '1rem' }}>
            {currentItems.map(guia => (
              <div
                key={guia.id_guia}
                style={{
                  background: 'white',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  border: guia.estado === 'Pendiente' ? '2px solid #fbbf24' : '1px solid #e2e8f0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0' }}>
                      Guía SUNAGRO #{guia.numero_guia_sunagro}
                      {guia.numero_guia_sisecal && ` | SISECAL ${guia.numero_guia_sisecal}`}
                    </h4>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1" style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(guia.fecha).toLocaleDateString('es-VE')}</span>
                      <span>|</span>
                      <span className="inline-flex items-center gap-1"><User className="w-4 h-4" /> Recibió: {guia.vocera_nombre}</span>
                    </div>
                  </div>
                  {getEstadoBadge(guia.estado)}
                </div>

                {guia.estado === 'Aprobada' && guia.aprobador && (
                  <div className="flex items-center gap-1 flex-wrap" style={{
                    padding: '0.75rem',
                    background: '#d1fae5',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    marginBottom: '1rem'
                  }}>
                    <CheckCircle className="w-4 h-4" /> Aprobado por: <strong>{guia.aprobador.username}</strong> el{' '}
                    {new Date(guia.fecha_aprobacion).toLocaleDateString('es-VE')}
                  </div>
                )}

                {guia.estado === 'Rechazada' && guia.aprobador && (
                  <div className="flex flex-col gap-1" style={{
                    padding: '0.75rem',
                    background: '#fee2e2',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    marginBottom: '1rem'
                  }}>
                    <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4" /> Rechazado por: <strong>{guia.aprobador.username}</strong></span>
                    <span className="inline-flex items-start gap-1"><FileText className="w-4 h-4 shrink-0 mt-0.5" /> Motivo: {guia.comentarios_aprobacion}</span>
                  </div>
                )}

                <div>
                  <h5 style={{ marginBottom: '0.75rem' }}>
                    Rubros ({guia.input?.length || 0})
                  </h5>
                  {guia.input?.map(item => (
                    <div
                      key={item.id_input}
                      style={{
                        padding: '0.75rem',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>{item.product?.product_name}</strong></span>
                        <span style={{ color: '#059669', fontWeight: '600' }}>
                          {item.amount} {item.product?.unit_measure}
                          {item.unit_amount && ` (${item.unit_amount} bultos)`}
                        </span>
                      </div>
                      {item.lotes_detalle && item.lotes_detalle.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                          <span className="inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {item.lotes_detalle.length} lote(s)</span> — Vence: {item.lotes_detalle.map(l =>
                            new Date(l.fecha_vencimiento).toLocaleDateString('es-VE')
                          ).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
            </div>
          </div>

          {/* Paginación */}
          {totalPages >= 1 && (
            <div className="flex items-center justify-center gap-3" style={{
              padding: '1rem',
              marginTop: '1rem',
              background: 'white',
              borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: safePage <= 1 ? '#f1f5f9' : '#FFF7ED',
                  color: safePage <= 1 ? '#94a3b8' : '#9a3412',
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-sm text-slate-600 font-medium">
                Página {safePage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: safePage >= totalPages ? '#f1f5f9' : '#FFF7ED',
                  color: safePage >= totalPages ? '#94a3b8' : '#9a3412',
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer'
                }}
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

export default GuiasEntrada
