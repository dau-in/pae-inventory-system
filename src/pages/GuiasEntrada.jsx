import { useState, useEffect } from 'react'
import { supabase, getCurrentUser, getLocalDate } from '../supabaseClient'
import Loading from '../components/Loading'

function GuiasEntrada() {
  const [loading, setLoading] = useState(true)
  const [guias, setGuias] = useState([])
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    numero_guia_sunagro: '',
    numero_guia_sisecal: '',
    fecha: getLocalDate(),
    vocera_nombre: '',
    telefono_vocera: '',
    notas: ''
  })
  const [detalles, setDetalles] = useState([])

  useEffect(() => {
    loadGuias()
    loadProducts()
  }, [])

  const loadGuias = async () => {
    try {
      const { data, error } = await supabase
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
        .order('fecha', { ascending: false })

      if (error) throw error
      setGuias(data || [])
    } catch (error) {
      console.error('Error cargando guías:', error)
    } finally {
      setLoading(false)
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
      tiene_lotes: false,
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
    
    if (field === 'tiene_lotes' && value === true) {
      if (newDetalles[index].lotes.length === 1 && newDetalles[index].amount) {
        newDetalles[index].lotes[0].cantidad = newDetalles[index].amount
      }
    }
    
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
      alert('❌ Debe agregar al menos un producto')
      return
    }

    // Validar lotes
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i]
      
      if (detalle.tiene_lotes) {
        for (let j = 0; j < detalle.lotes.length; j++) {
          const lote = detalle.lotes[j]
          if (!lote.cantidad || !lote.fecha_vencimiento) {
            alert(`❌ Producto ${i + 1}, Lote ${j + 1}: Complete cantidad y fecha de vencimiento`)
            return
          }
        }
        
        const sumaLotes = detalle.lotes.reduce((sum, lote) => sum + parseFloat(lote.cantidad || 0), 0)
        const cantidadTotal = parseFloat(detalle.amount || 0)
        
        if (Math.abs(sumaLotes - cantidadTotal) > 0.01) {
          alert(`❌ Producto ${i + 1}: La suma de lotes (${sumaLotes}) no coincide con cantidad total (${cantidadTotal})`)
          return
        }
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
          estado: 'Pendiente' // CRÍTICO: No actualiza inventario todavía
        })
        .select()
        .single()

      if (guiaError) throw guiaError

      // Insertar detalles con lotes en JSONB
      const inputData = detalles.map(detalle => {
        // Preparar lotes_detalle en formato JSON
        let lotesDetalle = null
        
        if (detalle.tiene_lotes && detalle.lotes.length > 0) {
          lotesDetalle = detalle.lotes.map(lote => ({
            cantidad: parseFloat(lote.cantidad),
            fecha_vencimiento: lote.fecha_vencimiento
          }))
        }

        return {
          id_guia: guiaData.id_guia,
          id_product: parseInt(detalle.id_product),
          amount: parseFloat(detalle.amount),
          unit_amount: detalle.unit_amount ? parseInt(detalle.unit_amount) : null,
          fecha: formData.fecha,
          lotes_detalle: lotesDetalle // Almacenar en JSONB
        }
      })

      const { error: inputError } = await supabase
        .from('input')
        .insert(inputData)

      if (inputError) throw inputError

      alert(`✅ Guía #${formData.numero_guia_sunagro} registrada exitosamente.

📋 ESTADO: PENDIENTE DE APROBACIÓN

⚠️ IMPORTANTE:
• El inventario NO se ha actualizado todavía
• El Director debe revisar y aprobar esta guía
• Solo después de la aprobación se sumará al stock

Guía creada por: ${user.email}`)
      
      resetForm()
      loadGuias()
    } catch (error) {
      console.error('Error guardando guía:', error)
      alert('❌ Error al guardar guía: ' + error.message)
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
      'Pendiente': { bg: '#fef3c7', color: '#92400e', icon: '⏳' },
      'Aprobada': { bg: '#d1fae5', color: '#065f46', icon: '✅' },
      'Rechazada': { bg: '#fee2e2', color: '#991b1b', icon: '❌' }
    }
    
    const style = styles[estado] || styles['Pendiente']
    
    return (
      <span style={{
        padding: '0.5rem 1rem',
        background: style.bg,
        color: style.color,
        borderRadius: '6px',
        fontSize: '0.85rem',
        fontWeight: '600'
      }}>
        {style.icon} {estado}
      </span>
    )
  }

  if (loading) return <Loading />

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>📋 Guías de Entrada CNAE</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Sistema de aprobación: Las guías quedan pendientes hasta que el Director las apruebe
          </p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '0.75rem 1.5rem',
            background: showForm ? '#64748b' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {showForm ? '❌ Cancelar' : '+ Nueva Guía'}
        </button>
      </div>

      {showForm && (
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '2rem',
          border: '2px solid #dbeafe'
        }}>
          <h3 style={{ marginBottom: '1rem' }}>Registrar Nueva Guía</h3>
          <div style={{
            padding: '1rem',
            background: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af' }}>
              ℹ️ <strong>Importante:</strong> Esta guía quedará en estado <strong>PENDIENTE</strong> hasta que el Director la apruebe. 
              El inventario NO se actualizará automáticamente.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Formulario simplificado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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

            {/* Productos - Igual que antes pero con los lotes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4>Productos Recibidos</h4>
                <button
                  type="button"
                  onClick={addDetalle}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  + Agregar Producto
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
                  No hay productos agregados. Click en "Agregar Producto" para comenzar.
                </div>
              )}

              {/* Aquí va todo el código de productos y lotes igual que en la versión anterior */}
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
                    <h5 style={{ color: '#475569' }}>Producto #{index + 1}</h5>
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

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Producto*
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
                        {products.map(product => (
                          <option key={product.id_product} value={product.id_product}>
                            {product.product_name} ({product.unit_measure})
                          </option>
                        ))}
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
                    </div>
                  </div>

                  {/* Checkbox de lotes */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      background: detalle.tiene_lotes ? '#dbeafe' : 'transparent',
                      borderRadius: '6px'
                    }}>
                      <input
                        type="checkbox"
                        checked={detalle.tiene_lotes}
                        onChange={(e) => handleDetalleChange(index, 'tiene_lotes', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>
                        📦 Este producto tiene <strong>múltiples lotes/bultos</strong> con fechas diferentes
                      </span>
                    </label>
                  </div>

                  {/* Sección de lotes (igual que antes) */}
                  {detalle.tiene_lotes && (
                    <div style={{
                      background: 'white',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '2px dashed #3b82f6'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h6 style={{ color: '#3b82f6', margin: 0 }}>
                          📦 Lotes/Bultos
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

                      {detalle.lotes.map((lote, loteIndex) => (
                        <div
                          key={loteIndex}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr auto',
                            gap: '0.75rem',
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
                              Vencimiento*
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
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Resumen */}
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: '#eff6ff',
                        borderRadius: '6px',
                        fontSize: '0.9rem'
                      }}>
                        <strong>Resumen:</strong> 
                        Suma: {detalle.lotes.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0).toFixed(2)}
                        {' | '}
                        Total: {detalle.amount || 0}
                        {Math.abs((detalle.lotes.reduce((s, l) => s + (parseFloat(l.cantidad) || 0), 0)) - (parseFloat(detalle.amount) || 0)) > 0.01 && (
                          <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>⚠️ No coinciden</span>
                        )}
                      </div>
                    </div>
                  )}
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
                  background: loading ? '#cbd5e1' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {loading ? 'Guardando...' : '💾 Registrar Guía (Pendiente)'}
              </button>
            </div>
          </form>
        </div>
      )}

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
            <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>📋</p>
            <p>No hay guías registradas.</p>
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
                      📅 {new Date(guia.fecha).toLocaleDateString('es-VE')} | 
                      👤 Recibió: {guia.vocera_nombre}
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
                    ✅ Aprobado por: <strong>{guia.aprobador.full_name}</strong> el{' '}
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
                    ❌ Rechazado por: <strong>{guia.aprobador.full_name}</strong><br/>
                    Motivo: {guia.comentarios_aprobacion}
                  </div>
                )}

                <div>
                  <h5 style={{ marginBottom: '0.75rem' }}>
                    Productos ({guia.input?.length || 0})
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
                          📦 {item.lotes_detalle.length} lote(s) registrado(s)
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
