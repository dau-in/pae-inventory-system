import { useState, useEffect } from 'react'
import { supabase, getCurrentUser } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError, notifyWarning, notifyInfo } from '../utils/notifications'
import { Lock, CheckSquare, CheckCircle, Calendar, User, FileText, Package, Lightbulb, XCircle, Clock } from 'lucide-react'

function AprobarGuias() {
  const [loading, setLoading] = useState(true)
  const [guiasPendientes, setGuiasPendientes] = useState([])
  const [guiaSeleccionada, setGuiaSeleccionada] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [accion, setAccion] = useState(null) // 'aprobar' o 'rechazar'
  const [comentarios, setComentarios] = useState('')
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    loadGuiasPendientes()
    checkUserRole()
  }, [])

  const checkUserRole = async () => {
    try {
      const user = await getCurrentUser()
      const { data } = await supabase
        .from('users')
        .select('id_rol')
        .eq('id_user', user.id)
        .single()
      
      setUserRole(data?.id_rol)
    } catch (error) {
      console.error('Error verificando rol:', error)
    }
  }

  const loadGuiasPendientes = async () => {
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
            product(
              product_name,
              unit_measure,
              stock
            )
          ),
          creador:users!created_by(full_name, username)
        `)
        .eq('estado', 'Pendiente')
        .order('fecha', { ascending: false })

      if (error) throw error
      setGuiasPendientes(data || [])
    } catch (error) {
      console.error('Error cargando guías pendientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const abrirModal = (guia, tipoAccion) => {
    setGuiaSeleccionada(guia)
    setAccion(tipoAccion)
    setComentarios('')
    setShowModal(true)
  }

  const cerrarModal = () => {
    setShowModal(false)
    setGuiaSeleccionada(null)
    setAccion(null)
    setComentarios('')
  }

  const handleAprobar = async () => {
    if (!guiaSeleccionada) return

    // Verificar que es Director o Desarrollador
    if (userRole !== 1 && userRole !== 4) {
      notifyWarning('Sin permisos', 'Solo el Director puede aprobar guías')
      return
    }

    setLoading(true)

    try {
      // Llamar a la función RPC de aprobación
      const { data, error } = await supabase.rpc('aprobar_guia', {
        p_id_guia: guiaSeleccionada.id_guia,
        p_comentarios: comentarios || null
      })

      if (error) throw error

      notifySuccess('Guía aprobada', `Guía #${guiaSeleccionada.numero_guia_sunagro} aprobada. ${data.productos_procesados} rubros actualizados en inventario.`)

      cerrarModal()
      loadGuiasPendientes()
    } catch (error) {
      console.error('Error al aprobar guía:', error)
      notifyError('Error al aprobar', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRechazar = async () => {
    if (!guiaSeleccionada) return

    if (!comentarios || comentarios.trim() === '') {
      notifyWarning('Campo requerido', 'Debe especificar el motivo del rechazo')
      return
    }

    // Verificar que es Director o Desarrollador
    if (userRole !== 1 && userRole !== 4) {
      notifyWarning('Sin permisos', 'Solo el Director puede rechazar guías')
      return
    }

    setLoading(true)

    try {
      // Llamar a la función RPC de rechazo
      const { data, error } = await supabase.rpc('rechazar_guia', {
        p_id_guia: guiaSeleccionada.id_guia,
        p_motivo: comentarios
      })

      if (error) throw error

      notifyInfo('Guía rechazada', `Guía #${guiaSeleccionada.numero_guia_sunagro} rechazada. Motivo: ${comentarios}`)

      cerrarModal()
      loadGuiasPendientes()
    } catch (error) {
      console.error('Error al rechazar guía:', error)
      notifyError('Error al rechazar', error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && guiasPendientes.length === 0) return <GlobalLoader text="Cargando guías pendientes..." />

  // Verificar permisos - solo Director o Desarrollador
  if (userRole !== null && userRole !== 1 && userRole !== 4) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#fee2e2',
          borderRadius: '12px',
          border: '2px solid #ef4444'
        }}>
          <div style={{ margin: '0 0 1rem 0' }}><Lock className="w-12 h-12 text-red-400 mx-auto" /></div>
          <h3>Acceso Denegado</h3>
          <p>Solo el Director puede aprobar guías.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="flex items-center gap-2"><CheckSquare className="w-6 h-6" /> Aprobar Guías de Entrada</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Revise y apruebe las guías pendientes. El inventario se actualizará automáticamente al aprobar.
        </p>
      </div>

      {guiasPendientes.length === 0 ? (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '12px'
        }}>
          <div style={{ margin: '0 0 1rem 0' }}><CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" /></div>
          <h3>No hay guías pendientes</h3>
          <p style={{ color: '#64748b' }}>
            Todas las guías han sido revisadas.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {guiasPendientes.map(guia => (
            <div
              key={guia.id_guia}
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                border: '2px solid #fbbf24'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>
                      Guía SUNAGRO #{guia.numero_guia_sunagro}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Clock className="w-4 h-4" /> PENDIENTE
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                    <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> Fecha:</span> {new Date(guia.fecha).toLocaleDateString('es-VE')} |
                    <span className="inline-flex items-center gap-1"><User className="w-4 h-4" /> Creado por:</span> <strong>{guia.creador?.full_name || 'Desconocido'}</strong>
                  </div>
                  {guia.numero_guia_sisecal && (
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                      SISECAL: {guia.numero_guia_sisecal}
                    </div>
                  )}
                </div>
              </div>

              {/* Detalles de la guía */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: '#64748b' }}>Vocera que recibió:</strong>
                  <div>{guia.vocera_nombre}</div>
                </div>
                {guia.telefono_vocera && (
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#64748b' }}>Teléfono:</strong>
                    <div>{guia.telefono_vocera}</div>
                  </div>
                )}
              </div>

              {guia.notas && (
                <div style={{
                  padding: '1rem',
                  background: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem'
                }}>
                  <strong className="inline-flex items-center gap-1"><FileText className="w-4 h-4" /> Observaciones:</strong><br/>
                  {guia.notas}
                </div>
              )}

              {/* Productos */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>
                  <span className="inline-flex items-center gap-1"><Package className="w-5 h-5" /> Rubros a Ingresar</span> ({guia.input?.length || 0})
                </h4>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {guia.input?.map(item => (
                    <div
                      key={item.id_input}
                      style={{
                        padding: '1rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '1.05rem' }}>
                            {item.product?.product_name}
                          </strong>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                            Stock actual: {item.product?.stock || 0} {item.product?.unit_measure}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                            fontSize: '1.25rem', 
                            fontWeight: '700', 
                            color: '#059669' 
                          }}>
                            +{item.amount} {item.product?.unit_measure}
                          </div>
                          {item.unit_amount && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                              ({item.unit_amount} bultos)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lotes */}
                      {item.lotes_detalle && item.lotes_detalle.length > 0 && (
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          background: 'white',
                          borderRadius: '6px',
                          border: '1px dashed #3b82f6'
                        }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: '#3b82f6' }}>
                            <span className="inline-flex items-center gap-1"><Package className="w-4 h-4" /> Lotes registrados:</span>
                          </div>
                          {item.lotes_detalle.map((lote, idx) => (
                            <div 
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.85rem',
                                padding: '0.5rem',
                                background: '#f8fafc',
                                borderRadius: '4px',
                                marginBottom: idx < item.lotes_detalle.length - 1 ? '0.25rem' : 0
                              }}
                            >
                              <span>Lote {idx + 1}: {lote.cantidad} {item.product?.unit_measure}</span>
                              <span>Vence: {new Date(lote.fecha_vencimiento).toLocaleDateString('es-VE')}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Nuevo stock después de aprobar */}
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem',
                        background: '#d1fae5',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#065f46'
                      }}>
                        <span className="inline-flex items-center gap-1"><Lightbulb className="w-4 h-4" /> Después de aprobar:</span> <strong>{(parseFloat(item.product?.stock || 0) + parseFloat(item.amount)).toFixed(2)} {item.product?.unit_measure}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => abrirModal(guia, 'rechazar')}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <XCircle className="w-4 h-4" /> Rechazar
                </button>
                <button
                  onClick={() => abrirModal(guia, 'aprobar')}
                  disabled={loading}
                  style={{
                    padding: '0.75rem 2rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <CheckCircle className="w-4 h-4" /> Aprobar y Actualizar Inventario
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      {showModal && guiaSeleccionada && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>
              {accion === 'aprobar' ? <span className="flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Confirmar Aprobación</span> : <span className="flex items-center gap-2"><XCircle className="w-5 h-5" /> Confirmar Rechazo</span>}
            </h3>

            {/* CORRECCIÓN: <ul> fuera de <p> */}
            <div style={{ marginBottom: '1.5rem', color: '#64748b' }}>
              {accion === 'aprobar' ? (
                <>
                  <p>
                    Está a punto de aprobar la guía <strong>#{guiaSeleccionada.numero_guia_sunagro}</strong>.
                  </p>
                  <p>
                    <strong>Esta acción:</strong>
                  </p>
                  <ul style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                    <li>Actualizará el inventario (+{guiaSeleccionada.input?.length || 0} rubros)</li>
                    <li>Sumará las cantidades al stock actual</li>
                    <li>Registrará la aprobación en auditoría</li>
                  </ul>
                </>
              ) : (
                <>
                  <p>
                    Está a punto de rechazar la guía <strong>#{guiaSeleccionada.numero_guia_sunagro}</strong>.
                  </p>
                  <p>
                    El inventario NO se actualizará y el creador será notificado.
                  </p>
                </>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                {accion === 'aprobar' ? 'Comentarios (opcional):' : 'Motivo del rechazo*:'}
              </label>
              <textarea
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                rows={3}
                required={accion === 'rechazar'}
                placeholder={accion === 'aprobar' ? 
                  'Observaciones adicionales...' : 
                  'Explique por qué se rechaza esta guía...'
                }
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

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={cerrarModal}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={accion === 'aprobar' ? handleAprobar : handleRechazar}
                disabled={loading || (accion === 'rechazar' && !comentarios.trim())}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: loading ? '#cbd5e1' : 
                    accion === 'aprobar' ? 
                    'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                    '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (loading || (accion === 'rechazar' && !comentarios.trim())) ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {loading ? 'Procesando...' : 
                  accion === 'aprobar' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AprobarGuias