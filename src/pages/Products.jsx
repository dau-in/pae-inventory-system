import { useState, useEffect } from 'react'
import { supabase, getUserData } from '../supabaseClient'
import { notifySuccess, notifyError, confirmDanger, confirmAction } from '../utils/notifications'
import GlobalLoader from '../components/GlobalLoader'
import { X, Plus, Pencil, Archive, RotateCcw, Trash2, AlertTriangle } from 'lucide-react'

function Products() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [categoryError, setCategoryError] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [activeTab, setActiveTab] = useState('activos')
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
    if (name === 'id_category') setCategoryError(false)
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.id_category) {
      setCategoryError(true)
      notifyError('Campo requerido', 'Debe seleccionar una categoría')
      return
    }

    // Validar duplicidad de nombre de rubro
    if (!editingProduct) {
      const nombreNormalizado = formData.product_name.trim().toLowerCase()
      const duplicado = products.find(
        p => p.product_name.trim().toLowerCase() === nombreNormalizado
      )
      if (duplicado) {
        notifyError('Rubro duplicado', 'Ya existe un rubro con este nombre. Por favor, especifique la marca o detalle (ej. Arroz Mary)')
        return
      }
    }

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

  const handleArchive = async (product) => {
    const confirmed = await confirmAction(
      '¿Archivar este rubro?',
      `"${product.product_name}" dejará de aparecer en la lista activa. Podrás restaurarlo en cualquier momento desde el Catálogo Archivado.`,
      'Archivar'
    )
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('product')
        .update({ is_archived: true })
        .eq('id_product', product.id_product)

      if (error) throw error
      notifySuccess('Archivado', `"${product.product_name}" fue archivado correctamente`)
      loadProducts()
    } catch (error) {
      console.error('Error archivando rubro:', error)
      notifyError('Error al archivar', error.message)
    }
  }

  const handleRestore = async (product) => {
    try {
      const { error } = await supabase
        .from('product')
        .update({ is_archived: false })
        .eq('id_product', product.id_product)

      if (error) throw error
      notifySuccess('Restaurado', `"${product.product_name}" fue restaurado al inventario activo`)
      loadProducts()
    } catch (error) {
      console.error('Error restaurando rubro:', error)
      notifyError('Error al restaurar', error.message)
    }
  }

  const handlePermanentDelete = async (id) => {
    const confirmed = await confirmDanger(
      '¿Eliminar definitivamente?',
      'Esta acción es irreversible. El rubro será eliminado permanentemente del sistema.'
    )
    if (!confirmed) return

    try {
      // Consultar si tiene movimientos asociados
      const [inputCheck, outputCheck, porcionCheck] = await Promise.all([
        supabase.from('input').select('id_input', { count: 'exact', head: true }).eq('id_product', id),
        supabase.from('output').select('id_output', { count: 'exact', head: true }).eq('id_product', id),
        supabase.from('receta_porcion').select('id_porcion', { count: 'exact', head: true }).eq('id_product', id)
      ])

      const totalRecords = (inputCheck.count || 0) + (outputCheck.count || 0) + (porcionCheck.count || 0)

      if (totalRecords > 0) {
        notifyError(
          'No se puede eliminar',
          'Este rubro ya posee registros en el sistema (entradas, salidas o porciones). Por favor, utilice la opción de Archivar.'
        )
        return
      }

      const { error } = await supabase
        .from('product')
        .delete()
        .eq('id_product', id)

      if (error) throw error
      notifySuccess('Eliminado', 'El rubro fue eliminado permanentemente')
      resetForm()
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
    setCategoryError(false)
    setShowForm(false)
  }

  const getStockBadge = (stock) => {
    const base = 'px-2 py-0.5 text-xs font-medium rounded-full'
    if (stock === 0) return <span className={`${base} bg-red-100 text-red-800`}>AGOTADO</span>
    if (stock <= 10) return <span className={`${base} bg-red-50 text-red-600`}>BAJO</span>
    if (stock < 50) return <span className={`${base} bg-yellow-50 text-yellow-700`}>MEDIO</span>
    return <span className={`${base} bg-green-50 text-green-700`}>SUFICIENTE</span>
  }

  // Filtrar por tab activo
  const filteredProducts = products.filter(p =>
    activeTab === 'activos' ? !p.is_archived : p.is_archived === true
  )
  const sortedProducts = [...filteredProducts].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))

  if (loading && products.length === 0) return <GlobalLoader text="Consultando la base de datos..." />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Inventario de Rubros</h2>
        {userRole !== 3 && (
          <button
            className={`btn btn-primary flex items-center gap-2 transition-opacity duration-300 ${activeTab === 'archivados' ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => { if (activeTab === 'activos') setShowForm(!showForm) }}
            disabled={activeTab === 'archivados'}
          >
            {showForm && activeTab === 'activos' ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nuevo Rubro</>}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#FFF7ED' }}>
        <button
          onClick={() => { setActiveTab('activos'); resetForm() }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-in-out"
          style={activeTab === 'activos'
            ? { background: '#fff', color: '#9a3412', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { background: 'transparent', color: '#78716c' }
          }
        >
          <Plus className="w-4 h-4" />
          Rubros Activos
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full transition-all duration-300 ease-in-out" style={activeTab === 'activos'
            ? { background: '#FFEDD5', color: '#9a3412' }
            : { background: '#e7e5e4', color: '#78716c' }
          }>
            {products.filter(p => !p.is_archived).length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('archivados'); resetForm() }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-in-out"
          style={activeTab === 'archivados'
            ? { background: '#fff', color: '#9a3412', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { background: 'transparent', color: '#78716c' }
          }
        >
          <Archive className="w-4 h-4" />
          Catálogo Archivado
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full transition-all duration-300 ease-in-out" style={activeTab === 'archivados'
            ? { background: '#FFEDD5', color: '#9a3412' }
            : { background: '#e7e5e4', color: '#78716c' }
          }>
            {products.filter(p => p.is_archived === true).length}
          </span>
        </button>
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
                <label>Nombre del rubro <span className="text-red-500 ml-1">●</span></label>
                <input
                  type="text"
                  name="product_name"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Unidad de medida <span className="text-red-500 ml-1">●</span></label>
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
                <label>Categoría <span className="text-red-500 ml-1">●</span></label>
                <select
                  name="id_category"
                  value={formData.id_category}
                  onChange={handleInputChange}
                  required
                  className={categoryError ? 'border-red-500 ring-2 ring-red-200' : ''}
                >
                  <option value="">Seleccionar...</option>
                  {categories.map(cat => (
                    <option key={cat.id_category} value={cat.id_category}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
                {categoryError && (
                  <p className="text-red-500 text-xs mt-1">Debe seleccionar una categoría</p>
                )}
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

            <div className="flex items-center gap-2">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>

              {/* Borrado Físico Condicional — Solo en modo edición */}
              {editingProduct && userRole !== 3 && (
                <button
                  type="button"
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                  onClick={() => handlePermanentDelete(editingProduct.id_product)}
                >
                  <Trash2 className="w-4 h-4" /> Eliminar Definitivamente
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Tabla de rubros */}
      <div key={activeTab} className="card min-w-0" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
        <div className="overflow-x-auto">
          {sortedProducts.length === 0 ? (
            <div className="empty-state">
              {activeTab === 'activos' ? (
                <>
                  <p>No hay rubros activos registrados</p>
                  <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
                    Crear primer rubro
                  </button>
                </>
              ) : (
                <p className="text-slate-500">No hay rubros archivados</p>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nº Ítem</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Unidad</th>
                  {userRole !== 3 && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((product) => (
                  <tr key={product.id_product}>
                    <td>{product.id_product}</td>
                    <td className="font-semibold">{product.product_name}</td>
                    <td>{product.category?.category_name || '-'}</td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {product.stock} {getStockBadge(product.stock)}
                      </div>
                    </td>
                    <td>{product.unit_measure}</td>
                    {userRole !== 3 && (
                      <td>
                        <div className="flex gap-2">
                          {activeTab === 'activos' ? (
                            <>
                              <button
                                className="btn btn-sm btn-primary flex items-center gap-2"
                                onClick={() => handleEdit(product)}
                              >
                                <Pencil className="w-4 h-4" /> Editar
                              </button>
                              <button
                                className="btn btn-sm flex items-center gap-2"
                                style={{ background: '#FFF7ED', color: '#9a3412', border: '1px solid #FDBA74' }}
                                onClick={() => handleArchive(product)}
                              >
                                <Archive className="w-4 h-4" /> Archivar
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm flex items-center gap-2"
                              style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #86efac' }}
                              onClick={() => handleRestore(product)}
                            >
                              <RotateCcw className="w-4 h-4" /> Restaurar
                            </button>
                          )}
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
