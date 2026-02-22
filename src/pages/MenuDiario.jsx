import { useState, useEffect } from 'react'
import { supabase, getCurrentUser, getUserData, getLocalDate } from '../supabaseClient'
import Loading from '../components/Loading'
import { notifySuccess, notifyError, notifyWarning, confirmAction } from '../utils/notifications'

function MenuDiario() {
  const [loading, setLoading] = useState(true)
  const [menus, setMenus] = useState([])
  const [asistencias, setAsistencias] = useState([])
  const [products, setProducts] = useState([])
  const [porciones, setPorciones] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({
    fecha: getLocalDate(),
    id_asistencia: '',
    notas: ''
  })
  const [detalles, setDetalles] = useState([])
  const [selectedAsistencia, setSelectedAsistencia] = useState(null)

  useEffect(() => {
    loadMenus()
    loadAsistencias()
    loadProducts()
    loadPorciones()
    getUserData().then(data => setUserRole(data?.id_rol))
  }, [])

  const loadMenus = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_diario')
        .select(`
          *,
          asistencia_diaria(total_alumnos),
          menu_detalle(
            *,
            product(product_name, unit_measure)
          )
        `)
        .order('fecha', { ascending: false })

      if (error) throw error
      setMenus(data || [])
    } catch (error) {
      console.error('Error cargando menús:', error)
    } finally {
      setLoading(false)
    }
  }

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
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('product')
        .select('*')
        .gt('stock', 0)
        .order('product_name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error cargando productos:', error)
    }
  }

  const loadPorciones = async () => {
    try {
      const { data, error } = await supabase
        .from('receta_porcion')
        .select('*')

      if (error) throw error
      setPorciones(data || [])
    } catch (error) {
      console.error('Error cargando porciones:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    if (name === 'id_asistencia') {
      const asistencia = asistencias.find(a => a.id_asistencia === parseInt(value))
      setSelectedAsistencia(asistencia)
      // Recalcular porciones si ya hay productos agregados
      if (asistencia && detalles.length > 0) {
        recalcularPorciones(asistencia.total_alumnos)
      }
    }
  }

  const recalcularPorciones = (totalAlumnos) => {
    const newDetalles = detalles.map(detalle => {
      const porcion = porciones.find(p => p.id_product === parseInt(detalle.id_product))
      if (porcion && porcion.porciones_por_unidad > 0) {
        const cantidadNecesaria = totalAlumnos / porcion.porciones_por_unidad
        return {
          ...detalle,
          cantidad_planificada: cantidadNecesaria.toFixed(2)
        }
      }
      return detalle
    })
    setDetalles(newDetalles)
  }

  const addDetalle = () => {
    setDetalles([...detalles, {
      id_product: '',
      cantidad_planificada: '',
      cantidad_real_usada: ''
    }])
  }

  const removeDetalle = (index) => {
    setDetalles(detalles.filter((_, i) => i !== index))
  }

  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles]
    newDetalles[index][field] = value

    // Si seleccionaron un producto y hay asistencia, calcular automáticamente
    if (field === 'id_product' && value && selectedAsistencia) {
      const porcion = porciones.find(p => p.id_product === parseInt(value))
      if (porcion && porcion.porciones_por_unidad > 0) {
        const cantidadNecesaria = selectedAsistencia.total_alumnos / porcion.porciones_por_unidad
        newDetalles[index].cantidad_planificada = cantidadNecesaria.toFixed(2)
      }
    }

    setDetalles(newDetalles)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.id_asistencia) {
      notifyWarning('Campo requerido', 'Debe seleccionar una asistencia')
      return
    }

    if (detalles.length === 0) {
      notifyWarning('Campo requerido', 'Debe agregar al menos un rubro')
      return
    }

    const confirmed = await confirmAction('¿Confirmar menú?', 'Esto descontará los rubros del inventario', 'Confirmar menú')
    if (!confirmed) return

    setLoading(true)

    try {
      const user = await getCurrentUser()

      // Verificar stock suficiente antes de crear el menú
      const stockInsuficiente = []
      for (const det of detalles) {
        const product = products.find(p => p.id_product === parseInt(det.id_product))
        const cantidadNecesaria = parseFloat(det.cantidad_real_usada) || parseFloat(det.cantidad_planificada)
        if (product && cantidadNecesaria > product.stock) {
          stockInsuficiente.push(
            `${product.product_name}: necesita ${cantidadNecesaria} ${product.unit_measure}, stock disponible: ${product.stock}`
          )
        }
      }

      if (stockInsuficiente.length > 0) {
        notifyError('Stock insuficiente', stockInsuficiente.join(', '))
        setLoading(false)
        return
      }

      // Crear menú
      const { data: menuData, error: menuError } = await supabase
        .from('menu_diario')
        .insert({
          fecha: formData.fecha,
          id_asistencia: parseInt(formData.id_asistencia),
          notas: formData.notas,
          confirmado: true,
          created_by: user.id
        })
        .select()
        .single()

      if (menuError) throw menuError

      // Crear detalles del menú
      const detalleData = detalles.map(det => ({
        id_menu: menuData.id_menu,
        id_product: parseInt(det.id_product),
        cantidad_planificada: parseFloat(det.cantidad_planificada),
        cantidad_real_usada: parseFloat(det.cantidad_real_usada) || parseFloat(det.cantidad_planificada)
      }))

      const { error: detalleError } = await supabase
        .from('menu_detalle')
        .insert(detalleData)

      if (detalleError) throw detalleError

      // Crear salidas (outputs) para descontar del inventario
      const outputData = detalles.map(det => ({
        id_product: parseInt(det.id_product),
        amount: parseFloat(det.cantidad_real_usada) || parseFloat(det.cantidad_planificada),
        fecha: formData.fecha,
        motivo: 'Menú del día',
        id_menu: menuData.id_menu,
        created_by: user.id
      }))

      const { error: outputError } = await supabase
        .from('output')
        .insert(outputData)

      if (outputError) throw outputError

      notifySuccess('Menú registrado', 'El inventario se ha actualizado correctamente')
      resetForm()
      loadMenus()
      loadProducts() // Recargar para ver stock actualizado
    } catch (error) {
      console.error('Error guardando menú:', error)
      notifyError('Error al guardar menú', error.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      fecha: getLocalDate(),
      id_asistencia: '',
      notas: ''
    })
    setDetalles([])
    setSelectedAsistencia(null)
    setShowForm(false)
  }

  if (loading && menus.length === 0) return <Loading />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Menú Diario</h2>
        {userRole !== 3 && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '❌ Cancelar' : '➕ Nuevo Menú'}
          </button>
        )}
      </div>

      {showForm && userRole !== 3 && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">Nuevo Menú del Día</h3>
          <form onSubmit={handleSubmit}>
            <div className="alert alert-warning mb-4">
              ⚠️ <strong>Importante:</strong> Al confirmar el menú, se descontará automáticamente del inventario
            </div>

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
                <label>Asistencia del día *</label>
                <select
                  name="id_asistencia"
                  value={formData.id_asistencia}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {asistencias.map(asistencia => (
                    <option key={asistencia.id_asistencia} value={asistencia.id_asistencia}>
                      {new Date(asistencia.fecha).toLocaleDateString('es-VE')} - {asistencia.total_alumnos} alumnos
                    </option>
                  ))}
                </select>
                {asistencias.length === 0 && (
                  <p className="text-sm text-danger mt-1">
                    No hay asistencias registradas. Registre primero la asistencia del día.
                  </p>
                )}
              </div>
            </div>

            {selectedAsistencia && (
              <div className="alert alert-success mb-4">
                📊 Calculando para <strong>{selectedAsistencia.total_alumnos} alumnos</strong>
              </div>
            )}

            <div className="form-group">
              <label>Notas</label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleInputChange}
                rows="2"
                placeholder="Descripción del menú..."
              />
            </div>

            <hr style={{ margin: '1.5rem 0' }} />

            <div className="flex-between mb-4">
              <h4 className="font-semibold">Rubros del menú</h4>
              <button 
                type="button" 
                className="btn btn-sm btn-success" 
                onClick={addDetalle}
                disabled={!formData.id_asistencia}
              >
                ➕ Agregar rubro
              </button>
            </div>

            {!formData.id_asistencia && (
              <p className="text-secondary mb-4">Seleccione primero la asistencia</p>
            )}

            {detalles.length > 0 && (
              <div className="mb-4">
                {detalles.map((detalle, index) => {
                  const product = products.find(p => p.id_product === parseInt(detalle.id_product))
                  const porcion = porciones.find(p => p.id_product === parseInt(detalle.id_product))
                  
                  return (
                    <div key={index} className="card mb-2" style={{ background: '#f8fafc' }}>
                      <div className="grid grid-3 gap-2">
                        <div className="form-group">
                          <label>Rubro *</label>
                          <select
                            value={detalle.id_product}
                            onChange={(e) => handleDetalleChange(index, 'id_product', e.target.value)}
                            required
                          >
                            <option value="">Seleccionar...</option>
                            {products.map(product => (
                              <option key={product.id_product} value={product.id_product}>
                                {product.product_name} (Stock: {product.stock} {product.unit_measure})
                              </option>
                            ))}
                          </select>
                          {porcion && (
                            <p className="text-sm text-success mt-1">
                              ✓ 1 {porcion.unit_measure} = {porcion.porciones_por_unidad} porciones
                            </p>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Cantidad planificada *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detalle.cantidad_planificada}
                            onChange={(e) => handleDetalleChange(index, 'cantidad_planificada', e.target.value)}
                            required
                          />
                          {product && (
                            <p className="text-sm text-secondary mt-1">
                              Unidad: {product.unit_measure}
                            </p>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Cantidad real usada</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detalle.cantidad_real_usada}
                            onChange={(e) => handleDetalleChange(index, 'cantidad_real_usada', e.target.value)}
                            placeholder="Igual a planificada"
                          />
                        </div>
                      </div>

                      <button 
                        type="button" 
                        className="btn btn-danger btn-sm mt-2"
                        onClick={() => removeDetalle(index)}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Guardando...' : '✅ Confirmar menú y descontar inventario'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Historial de menús */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Historial de menús</h3>
        {menus.length === 0 ? (
          <div className="empty-state">
            <p>No hay menús registrados</p>
          </div>
        ) : (
          <div>
            {menus.map((menu) => (
              <div key={menu.id_menu} className="card mb-3" style={{ background: '#f8fafc' }}>
                <div className="flex-between mb-2">
                  <div>
                    <h4 className="font-semibold">
                      {new Date(menu.fecha).toLocaleDateString('es-VE', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h4>
                    <p className="text-sm text-secondary">
                      {menu.asistencia_diaria?.total_alumnos} alumnos
                    </p>
                  </div>
                  <span className="badge badge-success">Confirmado</span>
                </div>

                {menu.notas && (
                  <p className="text-sm mb-2"><strong>Notas:</strong> {menu.notas}</p>
                )}

                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Rubro</th>
                        <th>Planificado</th>
                        <th>Real usado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menu.menu_detalle?.map((detalle) => (
                        <tr key={detalle.id_detalle}>
                          <td>{detalle.product?.product_name}</td>
                          <td>{detalle.cantidad_planificada} {detalle.product?.unit_measure}</td>
                          <td className="font-semibold">
                            {detalle.cantidad_real_usada} {detalle.product?.unit_measure}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MenuDiario
