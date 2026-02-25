import { useState, useEffect } from 'react'
import { supabase, getCurrentUser, getUserData, getLocalDate } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError, notifyWarning } from '../utils/notifications'
import { ClipboardList, X, Plus, Package, Trash2, AlertTriangle, Save, Filter, Calendar, User, CheckCircle, XCircle, Clock, Info } from 'lucide-react'
import './GuiasEntrada.css'

function GuiasEntrada() {
  const [loading, setLoading] = useState(true)
  const [guias, setGuias] = useState([])
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({
    numero_guia_sunagro: '',
    numero_guia_sisecal: '',
    fecha: getLocalDate(),
    vocera_nombre: '',
    telefono_vocera: '',
    notas: ''
  })
  const [detalles, setDetalles] = useState([])

  // Filtros de historial
  const getDefaultDesde = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const [fechaDesde, setFechaDesde] = useState(getDefaultDesde())
  const [fechaHasta, setFechaHasta] = useState(getLocalDate())
  const [searchSunagro, setSearchSunagro] = useState('')

  useEffect(() => {
    loadGuias()
    loadProducts()
    getUserData().then(data => setUserRole(data?.id_rol))
  }, [])

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
          creador:users!created_by(full_name),
          aprobador:users!aprobado_por(full_name)
        `)
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .order('fecha', { ascending: false })

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
    setLoading(true)
    loadGuias()
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
          telefono_vocera: formData.telefono_vocera || null,
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
      telefono_vocera: '',
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

  if (loading) return <GlobalLoader text="Cargando guías..." />

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 className="flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Guías de Entrada CNAE</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Sistema de aprobación: Las guías quedan pendientes hasta que el Director las apruebe
          </p>
        </div>
        {userRole !== 3 && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '0.75rem 1.5rem',
              background: showForm ? '#64748b' : '#FFD9A8',
              color: showForm ? 'white' : '#0f172a',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {showForm ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nueva Guía</>}
          </button>
        )}
      </div>

      {showForm && userRole !== 3 && (
        <div className="guia-form-card">
          <h3 style={{ marginBottom: '1rem' }}>Registrar Nueva Guía</h3>
          <div style={{
            padding: '1rem',
            background: '#FFF7ED',
            border: '1px solid rgba(254, 215, 170, 0.5)',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#9a3412' }}>
              <Info className="w-4 h-4 inline" /> <strong>Importante:</strong> Esta guía quedará en estado <strong>PENDIENTE</strong> hasta que el Director la apruebe.
              El inventario NO se actualizará automáticamente.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Formulario simplificado */}
            <div className="guia-form-grid">
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Nº Guía SUNAGRO* <span style={{ color: '#ef4444' }}>●</span>
                </label>
                <input
                  type="text"
                  name="numero_guia_sunagro"
                  value={formData.numero_guia_sunagro}
                  onChange={handleInputChange}
                  required
                  placeholder="Ej: 91"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Nº Guía SISECAL
                </label>
                <input
                  type="text"
                  name="numero_guia_sisecal"
                  value={formData.numero_guia_sisecal}
                  onChange={handleInputChange}
                  placeholder="Opcional"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Fecha de Entrega* <span style={{ color: '#ef4444' }}>●</span>
                </label>
                <input
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Vocera que Recibió* <span style={{ color: '#ef4444' }}>●</span>
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
                    padding: '0.75rem',
                    border: '2px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Teléfono de Contacto
                </label>
                <input
                  type="tel"
                  name="telefono_vocera"
                  value={formData.telefono_vocera}
                  onChange={handleInputChange}
                  placeholder="0412-XXX-XXXX"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
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
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Productos */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4>Rubros Recibidos</h4>
                <button
                  type="button"
                  onClick={addDetalle}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#FFD9A8',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  + Agregar Rubro
                </button>
              </div>

              {detalles.length === 0 && (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  color: '#64748b'
                }}>
                  No hay rubros agregados. Click en "Agregar Rubro" para comenzar.
                </div>
              )}

              {detalles.map((detalle, index) => (
                <div
                  key={index}
                  style={{
                    background: '#f8fafc',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h5 style={{ color: '#475569' }}>Rubro #{index + 1}</h5>
                    <button
                      type="button"
                      onClick={() => removeDetalle(index)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      Eliminar
                    </button>
                  </div>

                  <div className="rubro-fields-grid">
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Rubro*
                      </label>
                      <select
                        value={detalle.id_product}
                        onChange={(e) => handleDetalleChange(index, 'id_product', e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '0.75rem',
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
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Cantidad Total*
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
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '8px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Bultos
                      </label>
                      <input
                        type="number"
                        value={detalle.unit_amount}
                        onChange={(e) => handleDetalleChange(index, 'unit_amount', e.target.value)}
                        placeholder="10"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '8px'
                        }}
                      />
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        Opcional. Cantidad de sacos, pacas o cajas físicas que llegaron.
                      </p>
                    </div>
                  </div>

                  {/* Sección de lotes (siempre visible) */}
                  <div style={{
                    background: 'white',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '2px dashed #3b82f6'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <h6 style={{ color: '#3b82f6', margin: 0 }}>
                        <span className="flex items-center gap-1"><Package className="w-4 h-4" /> Lotes / Vencimientos</span>
                      </h6>
                      <button
                        type="button"
                        onClick={() => addLote(index)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        + Agregar Lote
                      </button>
                    </div>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
                      Usa múltiples lotes solo si el rubro llegó con diferentes fechas de caducidad.
                      De lo contrario, registra un solo lote con el total.
                    </p>

                    {detalle.lotes.map((lote, loteIndex) => (
                      <div
                        key={loteIndex}
                        className="lote-row-grid"
                        style={{
                          marginBottom: '0.75rem',
                          padding: '0.75rem',
                          background: '#f8fafc',
                          borderRadius: '6px'
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                            Cantidad Lote {loteIndex + 1}*
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
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                            Vencimiento / Vida Útil*
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
                          <small style={{ display: 'block', marginTop: '0.25rem', color: '#64748b', fontSize: '0.75rem' }}>
                            Para verduras o perecederos sin fecha, ingrese la fecha máxima estimada para su consumo.
                          </small>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          {detalle.lotes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLote(index, loteIndex)}
                              style={{
                                padding: '0.5rem 0.75rem',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Resumen */}
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: '#FFF7ED',
                      borderRadius: '6px',
                      fontSize: '0.9rem'
                    }}>
                      <strong>Resumen:</strong>
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

            {/* Botones */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loading ? '#cbd5e1' : 'linear-gradient(135deg, #FFD9A8 0%, #FDBA74 100%)',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {loading ? 'Guardando...' : <><Save className="w-4 h-4" /> Registrar Guía (Pendiente)</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros del historial */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        marginBottom: '1.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Filter className="w-5 h-5" /> Filtros</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Nº Guía SUNAGRO
            </label>
            <input
              type="text"
              value={searchSunagro}
              onChange={(e) => setSearchSunagro(e.target.value)}
              placeholder="Buscar por número..."
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid #ddd',
                borderRadius: '8px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid #ddd',
                borderRadius: '8px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}>
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid #ddd',
                borderRadius: '8px'
              }}
            />
          </div>
          <button
            onClick={handleBuscar}
            style={{
              padding: '0.6rem 1.5rem',
              background: '#FFD9A8',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Lista de guías */}
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Historial de Guías</h3>

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
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {guias.map(guia => (
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
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                      <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(guia.fecha).toLocaleDateString('es-VE')}</span> |
                      <span className="inline-flex items-center gap-1"><User className="w-4 h-4" /> Recibió:</span> {guia.vocera_nombre}
                    </div>
                  </div>
                  {getEstadoBadge(guia.estado)}
                </div>

                {guia.estado === 'Aprobada' && guia.aprobador && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#d1fae5',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    marginBottom: '1rem'
                  }}>
                    <span className="inline-flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Aprobado por:</span> <strong>{guia.aprobador.full_name}</strong> el{' '}
                    {new Date(guia.fecha_aprobacion).toLocaleDateString('es-VE')}
                  </div>
                )}

                {guia.estado === 'Rechazada' && guia.aprobador && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#fee2e2',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    marginBottom: '1rem'
                  }}>
                    <span className="inline-flex items-center gap-1"><XCircle className="w-4 h-4" /> Rechazado por:</span> <strong>{guia.aprobador.full_name}</strong><br/>
                    Motivo: {guia.comentarios_aprobacion}
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
        )}
      </div>
    </div>
  )
}

export default GuiasEntrada
