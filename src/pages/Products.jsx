import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Loading from '../components/Loading'

function Products() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    stock: '',
    unit_measure: 'kg',
    expiration_date: '',
    description: '',
    id_category: ''
  })

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

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
      alert('Error al cargar productos')
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
        ...formData,
        stock: parseFloat(formData.stock) || 0,
        id_category: formData.id_category ? parseInt(formData.id_category) : null,
        expiration_date: formData.expiration_date || null
      }

      if (editingProduct) {
        // Al actualizar, no enviar stock (se controla via entradas/salidas)
        const { stock, ...dataWithoutStock } = dataToSubmit
        const { error } = await supabase
          .from('product')
          .update(dataWithoutStock)
          .eq('id_product', editingProduct.id_product)

        if (error) throw error
        alert('Producto actualizado exitosamente')
      } else {
        // Crear
        const { error } = await supabase
          .from('product')
          .insert(dataToSubmit)

        if (error) throw error
        alert('Producto creado exitosamente')
      }

      resetForm()
      loadProducts()
    } catch (error) {
      console.error('Error guardando producto:', error)
      alert('Error al guardar producto: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      product_name: product.product_name || '',
      product_code: product.product_code || '',
      stock: product.stock || '',
      unit_measure: product.unit_measure || 'kg',
      expiration_date: product.expiration_date || '',
      description: product.description || '',
      id_category: product.id_category || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return

    try {
      const { error } = await supabase
        .from('product')
        .delete()
        .eq('id_product', id)

      if (error) throw error
      alert('Producto eliminado')
      loadProducts()
    } catch (error) {
      console.error('Error eliminando producto:', error)
      alert('Error al eliminar producto: ' + error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      product_name: '',
      product_code: '',
      stock: '',
      unit_measure: 'kg',
      expiration_date: '',
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

  const getExpirationWarning = (date) => {
    if (!date) return null
    const today = new Date()
    const expirationDate = new Date(date)
    const daysUntilExpiration = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiration < 0) {
      return <span className="badge badge-danger">VENCIDO</span>
    } else if (daysUntilExpiration <= 7) {
      return <span className="badge badge-danger">{daysUntilExpiration} días</span>
    } else if (daysUntilExpiration <= 30) {
      return <span className="badge badge-warning">{daysUntilExpiration} días</span>
    }
    return null
  }

  if (loading && products.length === 0) return <Loading />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Productos</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '❌ Cancelar' : '➕ Nuevo Producto'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label>Nombre del producto *</label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Código</label>
                <input
                  type="text"
                  name="product_code"
                  value={formData.product_code}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>{editingProduct ? 'Stock actual (solo lectura)' : 'Stock inicial'}</label>
                <input
                  type="number"
                  step="0.01"
                  name="stock"
                  value={formData.stock}
                  onChange={handleInputChange}
                  required={!editingProduct}
                  disabled={!!editingProduct}
                />
                {editingProduct && (
                  <p className="text-sm text-secondary mt-1">
                    El stock se modifica mediante guías de entrada y menús diarios
                  </p>
                )}
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
                <label>Fecha de vencimiento</label>
                <input
                  type="date"
                  name="expiration_date"
                  value={formData.expiration_date}
                  onChange={handleInputChange}
                />
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

      {/* Tabla de productos */}
      <div className="card">
        <div className="overflow-x-auto">
          {products.length === 0 ? (
            <div className="empty-state">
              <p>No hay productos registrados</p>
              <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
                Crear primer producto
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Unidad</th>
                  <th>Vencimiento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id_product}>
                    <td>{product.product_code || '-'}</td>
                    <td className="font-semibold">{product.product_name}</td>
                    <td>{product.category?.category_name || '-'}</td>
                    <td>
                      {product.stock} {getStockBadge(product.stock)}
                    </td>
                    <td>{product.unit_measure}</td>
                    <td>
                      {product.expiration_date ? (
                        <>
                          {new Date(product.expiration_date).toLocaleDateString('es-VE')}
                          {' '}
                          {getExpirationWarning(product.expiration_date)}
                        </>
                      ) : '-'}
                    </td>
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
