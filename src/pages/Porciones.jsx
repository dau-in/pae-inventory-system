import { useState, useEffect } from 'react'
import { supabase, getUserData } from '../supabaseClient'
import Loading from '../components/Loading'
import { notifySuccess, notifyError, confirmDanger } from '../utils/notifications'

function Porciones() {
  const [loading, setLoading] = useState(true)
  const [porciones, setPorciones] = useState([])
  const [products, setProducts] = useState([])
  const [ultimaAsistencia, setUltimaAsistencia] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPorcion, setEditingPorcion] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({
    id_product: '',
    porciones_por_unidad: '',
    unit_measure: 'kg',
    notas: ''
  })

  useEffect(() => {
    loadPorciones()
    loadProducts()
    loadUltimaAsistencia()
    getUserData().then(data => setUserRole(data?.id_rol))
  }, [])

  const loadUltimaAsistencia = async () => {
    try {
      const { data } = await supabase
        .from('asistencia_diaria')
        .select('total_alumnos')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      setUltimaAsistencia(data?.total_alumnos || null)
    } catch (error) {
      console.error('Error cargando asistencia:', error)
    }
  }
  const loadPorciones = async () => {
    try {
      const { data, error } = await supabase
        .from('receta_porcion')
        .select('*, product(product_name, unit_measure)')
        .order('id_porcion', { ascending: false })

      if (error) throw error
      setPorciones(data || [])
    } catch (error) {
      console.error('Error cargando porciones:', error)
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

    // Si cambia el producto, autocompletar unit_measure en un solo setState
    if (name === 'id_product') {
      const product = products.find(p => p.id_product === parseInt(value))
      setFormData(prev => ({
        ...prev,
        id_product: value,
        unit_measure: product ? product.unit_measure : prev.unit_measure
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToSubmit = {
        id_product: parseInt(formData.id_product),
        porciones_por_unidad: parseFloat(formData.porciones_por_unidad),
        unit_measure: formData.unit_measure,
        notas: formData.notas
      }

      if (editingPorcion) {
        const { error } = await supabase
          .from('receta_porcion')
          .update(dataToSubmit)
          .eq('id_porcion', editingPorcion.id_porcion)

        if (error) throw error
        notifySuccess('Actualizado', 'Porción actualizada correctamente')
      } else {
        const { error } = await supabase
          .from('receta_porcion')
          .insert(dataToSubmit)

        if (error) throw error
        notifySuccess('Configurado', 'Porción configurada correctamente')
      }

      resetForm()
      loadPorciones()
    } catch (error) {
      console.error('Error guardando porción:', error)
      notifyError('Error al guardar', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (porcion) => {
    setEditingPorcion(porcion)
    setFormData({
      id_product: porcion.id_product,
      porciones_por_unidad: porcion.porciones_por_unidad,
      unit_measure: porcion.unit_measure,
      notas: porcion.notas || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmDanger('¿Eliminar porción?', 'Se eliminará esta configuración de porción')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('receta_porcion')
        .delete()
        .eq('id_porcion', id)

      if (error) throw error
      notifySuccess('Eliminado', 'Configuración de porción eliminada')
      loadPorciones()
    } catch (error) {
      console.error('Error eliminando porción:', error)
      notifyError('Error', error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      id_product: '',
      porciones_por_unidad: '',
      unit_measure: 'kg',
      notas: ''
    })
    setEditingPorcion(null)
    setShowForm(false)
  }

  if (loading && porciones.length === 0) return <Loading />

  // Productos que ya tienen porción configurada
  const productsWithPortion = porciones.map(p => p.id_product)
  const availableProducts = products.filter(p => !productsWithPortion.includes(p.id_product))

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Configuración de Porciones</h2>
          <p className="text-secondary">Define cuántas porciones da cada unidad de producto</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
          style={{ display: userRole === 3 ? 'none' : undefined }}
        >
          {showForm ? '❌ Cancelar' : '➕ Nueva Porción'}
        </button>
      </div>

      {/* Info box */}
      <div className="alert alert-warning mb-4">
        💡 <strong>¿Cómo funciona?</strong> Cuando crees un menú diario, el sistema calculará automáticamente
        cuánto necesitas de cada producto basándose en estas configuraciones y la cantidad de alumnos.
        <br/><strong>Ejemplo:</strong> Si 1 kg de arroz = 12 porciones y tienes {ultimaAsistencia || '---'} alumnos,
        el sistema calculará que necesitas 64.5 kg de arroz.
      </div>

      {showForm && userRole !== 3 && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingPorcion ? 'Editar Porción' : 'Nueva Porción'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label>Producto *</label>
                <select
                  name="id_product"
                  value={formData.id_product}
                  onChange={handleInputChange}
                  required
                  disabled={editingPorcion}
                >
                  <option value="">Seleccionar...</option>
                  {(editingPorcion ? products : availableProducts).map(product => (
                    <option key={product.id_product} value={product.id_product}>
                      {product.product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Porciones por unidad *</label>
                <input
                  type="number"
                  step="0.01"
                  name="porciones_por_unidad"
                  value={formData.porciones_por_unidad}
                  onChange={handleInputChange}
                  placeholder="Ej: 12"
                  required
                />
                <p className="text-sm text-secondary mt-1">
                  Cuántas porciones se obtienen de 1 unidad
                </p>
              </div>

              <div className="form-group">
                <label>Unidad de medida *</label>
                <select
                  name="unit_measure"
                  value={formData.unit_measure}
                  onChange={handleInputChange}
                  required
                >
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="lt">Litros (lt)</option>
                  <option value="unidades">Unidades</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notas</label>
                <input
                  type="text"
                  name="notas"
                  value={formData.notas}
                  onChange={handleInputChange}
                  placeholder="Observaciones..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
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
        <h3 className="text-lg font-semibold mb-4">Porciones configuradas</h3>
        {porciones.length === 0 ? (
          <div className="empty-state">
            <p>No hay porciones configuradas</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
              Configurar primera porción
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Porciones por unidad</th>
                  <th>Ejemplo de cálculo</th>
                  <th>Notas</th>
                  {userRole !== 3 && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {porciones.map((porcion) => {
                  const alumnosEjemplo = ultimaAsistencia || 0
                  const cantidadNecesaria = alumnosEjemplo > 0
                    ? (alumnosEjemplo / porcion.porciones_por_unidad).toFixed(2)
                    : '-'

                  return (
                    <tr key={porcion.id_porcion}>
                      <td className="font-semibold">{porcion.product?.product_name}</td>
                      <td>
                        <span className="text-lg font-bold text-primary">
                          {porcion.porciones_por_unidad}
                        </span>
                        <span className="text-sm text-secondary ml-1">
                          porciones / {porcion.unit_measure}
                        </span>
                      </td>
                      <td className="text-sm">
                        {alumnosEjemplo > 0 ? (
                          <>
                            Para {alumnosEjemplo} alumnos:<br/>
                            <strong>{cantidadNecesaria} {porcion.unit_measure}</strong>
                          </>
                        ) : (
                          <span className="text-secondary">Sin asistencia registrada</span>
                        )}
                      </td>
                      <td className="text-sm">{porcion.notas || '-'}</td>
                      {userRole !== 3 && (
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleEdit(porcion)}
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(porcion.id_porcion)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Porciones
