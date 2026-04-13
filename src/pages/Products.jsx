import { useState, useEffect } from 'react'
import { supabase, getUserData, getLocalDate } from '../supabaseClient'
import { notifySuccess, notifyError, confirmDanger, confirmAction } from '../utils/notifications'
import { exportPDF } from '../utils/pdfGenerator'
import GlobalLoader from '../components/GlobalLoader'
import { X, Plus, Pencil, Archive, RotateCcw, Trash2, FileText, AlertTriangle, Package, Save } from 'lucide-react'

function Products() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [categoryError, setCategoryError] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [activeTab, setActiveTab] = useState('activos')
  const [inventoryView, setInventoryView] = useState('general')
  const [expiringProducts, setExpiringProducts] = useState([])
  const [exporting, setExporting] = useState(false)
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
    loadExpiringProducts()
  }, [])

  const loadUserRole = async () => {
    const data = await getUserData()
    setUserRole(data?.id_rol)
    setUserName(data?.username || '')
  }

  const loadProducts = async () => {
    try {
      const [productRes, stockRes] = await Promise.all([
        supabase.from('product').select('*, category(category_name)').order('product_name'),
        supabase.from('v_stock_real').select('id_product, stock_real, stock_vencido, ultimo_ingreso')
      ])

      if (productRes.error) throw productRes.error

      // Merge stock_real into product data
      const stockMap = {}
      for (const s of (stockRes.data || [])) {
        stockMap[s.id_product] = s
      }
      const merged = (productRes.data || []).map(p => ({
        ...p,
        stock_real: stockMap[p.id_product]?.stock_real ?? p.stock,
        stock_vencido: stockMap[p.id_product]?.stock_vencido ?? 0,
        ultimo_ingreso: stockMap[p.id_product]?.ultimo_ingreso ?? null
      }))

      setProducts(merged)
    } catch (error) {
      console.error('Error cargando productos:', error)
      notifyError('Error', 'No se pudieron cargar los rubros')
    } finally {
      setLoading(false)
    }
  }

  const loadExpiringProducts = async () => {
    try {
      const { data: inputData, error: inputError } = await supabase
        .from('input')
        .select('id_product, lotes_detalle, guia_entrada!inner(estado), product(product_name, unit_measure, stock)')
        .eq('guia_entrada.estado', 'Aprobada')

      if (inputError) throw inputError

      const today = getLocalDate()
      const in7Days = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })()

      // Group expiring/expired lotes by product
      const productMap = {}
      for (const inp of (inputData || [])) {
        if (!inp.lotes_detalle || !Array.isArray(inp.lotes_detalle)) continue
        for (const lote of inp.lotes_detalle) {
          const fv = lote.fecha_vencimiento || ''
          const cant = parseFloat(lote.cantidad) || 0
          if (cant <= 0) continue
          const isExpired = fv < today
          const isExpiringSoon = fv >= today && fv <= in7Days
          if (isExpired || isExpiringSoon) {
            if (!productMap[inp.id_product]) {
              productMap[inp.id_product] = {
                id_product: inp.id_product,
                product_name: inp.product?.product_name || '-',
                unit_measure: inp.product?.unit_measure || '-',
                stock: inp.product?.stock ?? 0,
                ultimo_ingreso: null,
                lotes: []
              }
            }
            productMap[inp.id_product].lotes.push({
              cantidad: cant,
              fecha_vencimiento: fv,
              estado: isExpired ? 'Vencido' : 'Por vencer'
            })
          }
        }
      }

      // Merge ultimo_ingreso from products state
      const result = Object.values(productMap)
      // We'll enrich with ultimo_ingreso after products are loaded
      setExpiringProducts(result)
    } catch (error) {
      console.error('Error cargando lotes vencidos:', error)
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
    // Guardia de rol: solo Desarrollador puede borrar físicamente
    if (userRole !== 4) {
      notifyError('Sin permisos', 'Solo el Desarrollador puede eliminar rubros permanentemente.')
      return
    }

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

  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      if (inventoryView === 'vencimientos') {
        // Exportar reporte de vencimientos
        const columns = [
          { header: 'Rubro', dataKey: 'product_name' },
          { header: 'Cantidad', dataKey: 'cantidad' },
          { header: 'Unidad', dataKey: 'unit_measure' },
          { header: 'Vencimiento', dataKey: 'fecha_vencimiento' },
          { header: 'Estado', dataKey: 'estado' },
        ]
        const rows = expiringProducts.flatMap(p =>
          p.lotes.map(lote => ({
            product_name: p.product_name,
            cantidad: lote.cantidad,
            unit_measure: p.unit_measure,
            fecha_vencimiento: lote.fecha_vencimiento,
            estado: lote.estado,
          }))
        )
        await exportPDF({
          title: 'REPORTE DE VENCIMIENTOS',
          columns,
          data: rows,
          userName,
        })
      } else {
        // Exportar inventario general
        const columns = [
          { header: 'Rubro', dataKey: 'product_name' },
          { header: 'Categoría', dataKey: 'category_name' },
          { header: 'Stock', dataKey: 'stock' },
          { header: 'Unidad', dataKey: 'unit_measure' },
        ]
        const rows = sortedProducts.map(p => ({
          product_name: p.product_name,
          category_name: p.category?.category_name || '-',
          stock: p.stock_real,
          unit_measure: p.unit_measure,
        }))
        await exportPDF({
          title: 'REPORTE DE INVENTARIO ACTUAL',
          columns,
          data: rows,
          userName,
        })
      }
    } catch (err) {
      console.error('Error exportando PDF:', err)
      notifyError('Error', 'No se pudo generar el reporte PDF')
    } finally {
      setExporting(false)
    }
  }

  const getStockBadge = (stock) => {
    const base = 'px-2 py-0.5 text-xs font-medium rounded-full'
    if (stock === 0) return <span className={`${base} bg-red-100 text-red-800`}>AGOTADO</span>
    if (stock <= 10) return <span className={`${base} bg-red-50 text-red-600`}>BAJO</span>
    if (stock < 50) return <span className={`${base} bg-yellow-50 text-yellow-700`}>MEDIO</span>
    return <span className={`${base} bg-green-50 text-green-700`}>SUFICIENTE</span>
  }

  const getRelativeDate = (dateString) => {
    if (!dateString) return ''
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(dateString + 'T00:00:00')
    const diffMs = target - today
    const diffDays = Math.round(diffMs / 86400000)
    if (diffDays < 0) return `Venció hace ${Math.abs(diffDays)} día${Math.abs(diffDays) !== 1 ? 's' : ''}`
    if (diffDays === 0) return 'Vence hoy'
    return `Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`
  }

  // Filtrar por tab activo
  const filteredProducts = products.filter(p =>
    activeTab === 'activos' ? !p.is_archived : p.is_archived === true
  )
  const sortedProducts = [...filteredProducts].sort((a, b) => (b.stock_real ?? 0) - (a.stock_real ?? 0))
  const totalExpiringLotes = expiringProducts.reduce((sum, p) => sum + p.lotes.length, 0)

  if (loading && products.length === 0) return <GlobalLoader text="Consultando la base de datos..." />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Inventario de Rubros</h2>
        <div className="flex items-center gap-2">
          <button
            id="btn-export-inventory-pdf"
            className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm font-semibold"
            onClick={handleExportPDF}
            disabled={exporting || (inventoryView === 'general' ? sortedProducts.length === 0 : expiringProducts.length === 0)}
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Generando...' : 'Generar Reporte'}
          </button>
          {userRole !== 3 && (
            <button
              className={`btn btn-primary flex items-center gap-2 transition-opacity duration-300 ${(inventoryView === 'vencimientos' || activeTab === 'archivados') ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
              onClick={() => { if (activeTab === 'activos' && inventoryView === 'general') setShowForm(!showForm) }}
              disabled={inventoryView === 'vencimientos' || activeTab === 'archivados'}
            >
              {showForm && activeTab === 'activos' && inventoryView === 'general' ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nuevo Rubro</>}
            </button>
          )}
        </div>
      </div>

      {/* View Tabs: General / Próximos a Vencer */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#FFF7ED' }}>
        <button
          onClick={() => setInventoryView('general')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-in-out"
          style={inventoryView === 'general'
            ? { background: '#fff', color: '#9a3412', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { background: 'transparent', color: '#78716c' }
          }
        >
          <Package className="w-4 h-4" />
          Inventario General
        </button>
        <button
          onClick={() => setInventoryView('vencimientos')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-in-out"
          style={inventoryView === 'vencimientos'
            ? { background: '#fff', color: '#9a3412', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { background: 'transparent', color: '#78716c' }
          }
        >
          <AlertTriangle className="w-4 h-4" />
          Próximos a Vencer
          {totalExpiringLotes > 0 && (
            <span className="ml-2 relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffc885] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFD9A8]"></span>
            </span>
          )}
        </button>
      </div>

      {/* Sub-tabs: Always rendered for CLS prevention */}
      <div className={`flex gap-1 mb-4 p-1 rounded-xl transition-all duration-300 ease-in-out ${
        inventoryView === 'vencimientos' ? 'opacity-50 pointer-events-none' : ''
      }`} style={{ background: '#FFF7ED' }}>
        <button
          onClick={() => { setActiveTab('activos'); resetForm() }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-in-out ${
            inventoryView === 'vencimientos' ? 'cursor-not-allowed' : ''
          }`}
          style={activeTab === 'activos'
            ? { background: '#fff', color: '#9a3412', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { background: 'transparent', color: '#78716c' }
          }
          disabled={inventoryView === 'vencimientos'}
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
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-in-out ${
            inventoryView === 'vencimientos' ? 'cursor-not-allowed' : ''
          }`}
          style={activeTab === 'archivados'
            ? { background: '#fff', color: '#9a3412', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
            : { background: 'transparent', color: '#78716c' }
          }
          disabled={inventoryView === 'vencimientos'}
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

      {inventoryView === 'general' && (<>

      {/* Modal: Crear/Editar Rubro */}
      {showForm && userRole !== 3 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-orange-100" style={{ background: '#FFF7ED' }}>
              <h3 className="text-lg font-semibold" style={{ color: '#9a3412' }}>
                {editingProduct ? 'Editar Rubro' : 'Nuevo Rubro'}
              </h3>
              <button onClick={resetForm} className="p-1 rounded-lg hover:bg-orange-100 transition-colors">
                <X className="w-5 h-5 text-orange-700" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Nombre del rubro <span className="text-red-500 ml-1">●</span></label>
                  <input
                    type="text"
                    name="product_name"
                    value={formData.product_name}
                    onChange={handleInputChange}
                    className="w-full"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Unidad de medida <span className="text-red-500 ml-1">●</span></label>
                  <select
                    name="unit_measure"
                    value={formData.unit_measure}
                    onChange={handleInputChange}
                    className="w-full"
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
                    className={`w-full ${categoryError ? 'border-red-500 ring-2 ring-red-200' : ''}`}
                    required
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

                <div className="form-group md:col-span-2">
                  <label>Descripción</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  style={{ background: '#f3f4f6', color: '#374151' }}
                  onClick={resetForm}
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  style={{
                    background: loading ? '#cbd5e1' : '#FFD9A8',
                    color: loading ? '#94a3b8' : '#431407',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                  disabled={loading}
                >
                  <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar'}
                </button>

                {editingProduct && userRole === 4 && (
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
                        {product.stock_real} {getStockBadge(product.stock_real)}
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
                              {(userRole === 1 || userRole === 4) && (
                                <button
                                  className="btn btn-sm flex items-center gap-2"
                                  style={{ background: '#FFF7ED', color: '#9a3412', border: '1px solid #FDBA74' }}
                                  onClick={() => handleArchive(product)}
                                >
                                  <Archive className="w-4 h-4" /> Archivar
                                </button>
                              )}
                            </>
                          ) : (
                            (userRole === 1 || userRole === 4) && (
                              <button
                                className="btn btn-sm flex items-center gap-2"
                                style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #86efac' }}
                                onClick={() => handleRestore(product)}
                              >
                                <RotateCcw className="w-4 h-4" /> Restaurar
                              </button>
                            )
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
      </>)}

      {inventoryView === 'vencimientos' && (
        <div className="card min-w-0">
          <h3 className="text-lg font-semibold mb-4">Lotes Vencidos o Próximos a Vencer</h3>
          {expiringProducts.length === 0 ? (
            <div className="empty-state">
              <p className="text-slate-500">No hay lotes vencidos ni próximos a vencer. ¡Todo en orden!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Rubro</th>
                    <th>Lote</th>
                    <th>Cantidad</th>
                    <th>Vencimiento</th>
                    <th>Último Ingreso</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringProducts.flatMap(product => {
                    const matchedProduct = products.find(p => p.id_product === product.id_product)
                    const ultimoIngreso = matchedProduct?.ultimo_ingreso
                    return product.lotes.map((lote, idx) => (
                      <tr key={`${product.id_product}-${idx}`}>
                        <td className="font-semibold">{product.product_name}</td>
                        <td className="text-sm">#{idx + 1}</td>
                        <td>{lote.cantidad} {product.unit_measure}</td>
                        <td className="text-sm">
                          <div>{lote.fecha_vencimiento}</div>
                          <div className={`text-xs mt-0.5 ${lote.estado === 'Vencido' ? 'text-red-500' : 'text-yellow-600'}`}>
                            {getRelativeDate(lote.fecha_vencimiento)}
                          </div>
                        </td>
                        <td className="text-sm text-slate-600">
                          {ultimoIngreso ? new Date(ultimoIngreso + 'T00:00:00').toLocaleDateString('es-VE') : 'N/A'}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            lote.estado === 'Vencido'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-50 text-yellow-700'
                          }`}>
                            {lote.estado === 'Vencido' ? 'Vencido' : 'Por vencer'}
                          </span>
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Products
