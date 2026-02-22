import { useState, useEffect } from 'react'
import { supabase, getUserData } from '../supabaseClient'
import { notifySuccess, notifyError, confirmDanger } from '../utils/notifications'
import Loading from '../components/Loading'

function Products() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({
    product_name: '',
    unit_measure: 'kg',
    description: '',
    id_category: ''
  })

  useEffect(() => {
    loadProducts()
    loadCategories()
    loadUserRole()
  }, [])

  const loadUserRole = async () => {
    const data = await getUserData()
    setUserRole(data?.id_rol)
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('product')
        .select('*, category(category_name)')
        .order('product_name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error cargando productos:', error)
      notifyError('Error', 'No se pudieron cargar los rubros')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('category')
        .select('*')
        .order('category_name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error cargando categorías:', error)
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
      const dataToSubmit = {
        product_name: formData.product_name,
        unit_measure: formData.unit_measure,
        description: formData.description || null,
        id_category: formData.id_category ? parseInt(formData.id_category) : null
      }

      if (editingProduct) {
        const { error } = await supabase
          .from('product')
          .update(dataToSubmit)
          .eq('id_product', editingProduct.id_product)

        if (error) throw error
        notifySuccess('Rubro actualizado', 'Los cambios se guardaron correctamente')
      } else {
        const { error } = await supabase
          .from('product')
          .insert(dataToSubmit)

        if (error) throw error
        notifySuccess('Rubro creado', 'El rubro se registró correctamente')
      }

      resetForm()
      loadProducts()
    } catch (error) {
      console.error('Error guardando rubro:', error)
      notifyError('Error al guardar', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      product_name: product.product_name || '',
      unit_measure: product.unit_measure || 'kg',
      description: product.description || '',
      id_category: product.id_category || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    const confirmed = await confirmDanger('¿Eliminar rubro?', 'Esta acción no se puede deshacer')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('product')
        .delete()
        .eq('id_product', id)

      if (error) throw error
      notifySuccess('Eliminado', 'El rubro fue eliminado')
      loadProducts()
    } catch (error) {
      console.error('Error eliminando rubro:', error)
      notifyError('Error al eliminar', error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      product_name: '',
      unit_measure: 'kg',
      description: '',
      id_category: ''
    })
    setEditingProduct(null)
    setShowForm(false)
  }

  const getStockBadge = (stock) => {
    if (stock < 10) return <span className="badge badge-danger">BAJO</span>
    if (stock < 50) return <span className="badge badge-warning">MEDIO</span>
    return <span className="badge badge-success">OK</span>
  }

  if (loading && products.length === 0) return <Loading />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Inventario de Rubros</h2>
        {userRole !== 3 && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '❌ Cancelar' : '➕ Nuevo Rubro'}
          </button>
        )}
      </div>

      {/* Formulario (oculto para Supervisor) */}
      {showForm && userRole !== 3 && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Rubro' : 'Nuevo Rubro'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label>Nombre del rubro *</label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  required
                />
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
                <label>Categoría</label>
                <select
                  name="id_category"
                  value={formData.id_category}
                  onChange={handleInputChange}
                >
                  <option value="">Seleccionar...</option>
                  {categories.map(cat => (
                    <option key={cat.id_category} value={cat.id_category}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
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

      {/* Tabla de rubros */}
      <div className="card">
        <div className="overflow-x-auto">
          {products.length === 0 ? (
            <div className="empty-state">
              <p>No hay rubros registrados</p>
              <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
                Crear primer rubro
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>It.</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Unidad</th>
                  {userRole !== 3 && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id_product}>
                    <td>It. {product.id_product}</td>
                    <td className="font-semibold">{product.product_name}</td>
                    <td>{product.category?.category_name || '-'}</td>
                    <td>
                      {product.stock} {getStockBadge(product.stock)}
                    </td>
                    <td>{product.unit_measure}</td>
                    {userRole !== 3 && (
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEdit(product)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(product.id_product)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default Products
