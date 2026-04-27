import { useState, useEffect } from 'react'
import { supabase, getUserData, getLocalDate } from '../supabaseClient'
import { notifySuccess, notifyError, confirmDanger, confirmAction } from '../utils/notifications'
import { exportPDF } from '../utils/pdfGenerator'
import GlobalLoader from '../components/GlobalLoader'
import { X, Plus, Pencil, Archive, RotateCcw, Trash2, FileText, AlertTriangle, Package, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

function Products() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [categoryError, setCategoryError] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [lotes, setLotes] = useState([])
  const [lotesLoading, setLotesLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 20
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
    loadLotes()
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

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    const today = new Date(); today.setHours(0,0,0,0)
    return Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000)
  }

  const loadLotes = async () => {
    setLotesLoading(true)
    try {
      const { data, error } = await supabase
        .from('input')
        .select('id_input, id_product, fecha, lotes_detalle, guia_entrada!inner(estado), product(product_name, unit_measure)')
        .eq('guia_entrada.estado', 'Aprobada')
      if (error) throw error
      const flat = []
      for (const inp of (data || [])) {
        if (!Array.isArray(inp.lotes_detalle)) continue
        inp.lotes_detalle.forEach((lote, i) => {
          const cant = parseFloat(lote.cantidad) || 0
          if (cant <= 0) return
          flat.push({
            id_input: inp.id_input, lote_idx: i + 1,
            product_name: inp.product?.product_name || '-',
            unit_measure: inp.product?.unit_measure || '-',
            cantidad: cant,
            fecha_vencimiento: lote.fecha_vencimiento || '',
            fecha_input: inp.fecha || '',
            dias_restantes: getDaysUntil(lote.fecha_vencimiento)
          })
        })
      }
      flat.sort((a, b) => {
        if (!a.fecha_vencimiento) return 1
        if (!b.fecha_vencimiento) return -1
        return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento)
      })
      setLotes(flat)
    } catch (error) {
      console.error('Error cargando lotes:', error)
    } finally {
      setLotesLoading(false)
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
      if (activeTab === 'lotes') {
        const columns = [
          { header: 'Rubro', dataKey: 'product_name' },
          { header: 'Stock Lote', dataKey: 'cantidad' },
          { header: 'Unidad', dataKey: 'unit_measure' },
          { header: 'Vencimiento', dataKey: 'fecha_vencimiento' },
          { header: 'Estado', dataKey: 'estado' },
        ]
        const rows = lotes.map(l => ({
          product_name: l.product_name, cantidad: l.cantidad, unit_measure: l.unit_measure,
          fecha_vencimiento: l.fecha_vencimiento || 'Sin fecha',
          estado: l.dias_restantes === null ? 'Sin fecha' : l.dias_restantes <= 0 ? 'Vencido' : l.dias_restantes <= 7 ? 'Crítico' : l.dias_restantes <= 30 ? 'Por vencer' : 'Vigente',
        }))
        await exportPDF({ title: 'REPORTE DE LOTES (FIFO)', columns, data: rows, userName })
      } else {
        const columns = [
          { header: 'Rubro', dataKey: 'product_name' },
          { header: 'Categoría', dataKey: 'category_name' },
          { header: 'Stock', dataKey: 'stock' },
          { header: 'Unidad', dataKey: 'unit_measure' },
        ]
        const rows = sortedProducts.map(p => ({
          product_name: p.product_name, category_name: p.category?.category_name || '-',
          stock: p.stock_real, unit_measure: p.unit_measure,
        }))
        await exportPDF({ title: activeTab === 'archivo' ? 'REPORTE DE RUBROS ARCHIVADOS' : 'REPORTE DE INVENTARIO ACTUAL', columns, data: rows, userName })
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
    activeTab === 'archivo' ? p.is_archived === true : !p.is_archived
  )
  const sortedProducts = [...filteredProducts].sort((a, b) => (b.stock_real ?? 0) - (a.stock_real ?? 0))
  const getExpiryBadge = (days) => {
    const base = 'px-2 py-0.5 text-xs font-medium rounded-full'
    if (days === null) return <span className={`${base} bg-gray-100 text-gray-500`}>Sin fecha</span>
    if (days <= 0) return <span className={`${base} bg-red-100 text-red-800`}>VENCIDO</span>
    if (days <= 7) return <span className={`${base} bg-red-50 text-red-600`}>Crítico ({days}d)</span>
    if (days <= 30) return <span className={`${base} bg-yellow-50 text-yellow-700`}>Por vencer ({days}d)</span>
    return <span className={`${base} bg-green-50 text-green-700`}>Vigente ({days}d)</span>
  }

  // ── Lotes: separar vigentes y vencidos ──
  const lotesVigentes = lotes.filter(l => l.dias_restantes === null || l.dias_restantes > 0)
  const lotesVencidos = lotes.filter(l => l.dias_restantes !== null && l.dias_restantes <= 0)
    .sort((a, b) => b.fecha_vencimiento.localeCompare(a.fecha_vencimiento))
  const lotesOrdenados = [...lotesVigentes, ...lotesVencidos]

  // ── Paginación universal ──
  const getPageData = (data) => {
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE)
    const safePage = Math.min(currentPage, totalPages || 1)
    const paginated = data.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)
    return { paginated, totalPages, safePage }
  }
  const productPages = getPageData(sortedProducts)
  const lotesPages = getPageData(lotesOrdenados)
  const dividerIndex = lotesVigentes.length // para insertar fila divisoria

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
            disabled={exporting || (activeTab === 'lotes' ? lotes.length === 0 : sortedProducts.length === 0)}
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Generando...' : 'Generar Reporte'}
          </button>
          {userRole !== 3 && (
            <button
              className={`btn btn-primary flex items-center gap-2 transition-opacity duration-200 ${activeTab !== 'general' ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => { if (activeTab === 'general') setShowForm(!showForm) }}
              disabled={activeTab !== 'general'}
            >
              {showForm && activeTab === 'general' ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Nuevo Rubro</>}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="flex w-full bg-orange-50/60 p-1.5 rounded-xl mb-6">
        {[{ key: 'general', icon: Package, label: 'Catálogo de Rubros', count: products.filter(p => !p.is_archived).length },
          { key: 'lotes', icon: AlertTriangle, label: 'Control de Vencimientos', count: lotes.length },
          { key: 'archivo', icon: Archive, label: 'Catálogo Inactivo', count: products.filter(p => p.is_archived).length }
        ].map(tab => (
          <button key={tab.key}
            onClick={() => { setActiveTab(tab.key); resetForm(); setCurrentPage(1) }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === tab.key
                ? 'bg-white shadow-sm font-bold text-orange-800'
                : 'font-medium text-slate-500 hover:text-slate-700 hover:bg-orange-50/80'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === tab.key
                ? 'bg-orange-100 text-orange-800'
                : 'bg-slate-200/70 text-slate-500'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Modal: Crear/Editar Rubro */}
      {activeTab === 'general' && showForm && userRole !== 3 && (
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

      {/* ═══ TAB: Catálogo de Rubros ═══ */}
      {activeTab === 'general' && (
      <div key="general" className="card min-w-0" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Rubros Activos <span className="ml-2 bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full">{sortedProducts.length}</span></h3>
          {productPages.totalPages > 1 && <span className="text-sm text-slate-500">Pág. {productPages.safePage} de {productPages.totalPages}</span>}
        </div>
        <div className="overflow-x-auto">
          {sortedProducts.length === 0 ? (
            <div className="empty-state">
              <p>No hay rubros activos registrados</p>
              <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>Crear primer rubro</button>
            </div>
          ) : (
            <table>
              <thead><tr><th>Nº Ítem</th><th>Nombre</th><th>Categoría</th><th>Stock</th><th>Unidad</th>{userRole !== 3 && <th>Acciones</th>}</tr></thead>
              <tbody>
                {productPages.paginated.map(product => (
                  <tr key={product.id_product}>
                    <td>{product.id_product}</td>
                    <td className="font-semibold">{product.product_name}</td>
                    <td>{product.category?.category_name || '-'}</td>
                    <td><div className="flex items-center gap-2 whitespace-nowrap">{product.stock_real} {getStockBadge(product.stock_real)}</div></td>
                    <td>{product.unit_measure}</td>
                    {userRole !== 3 && (
                      <td><div className="flex gap-2">
                        <button className="btn btn-sm btn-primary flex items-center gap-2" onClick={() => handleEdit(product)}><Pencil className="w-4 h-4" /> Editar</button>
                        {(userRole === 1 || userRole === 4) && (
                          <button className="btn btn-sm flex items-center gap-2" style={{ background: '#FFF7ED', color: '#9a3412', border: '1px solid #FDBA74' }} onClick={() => handleArchive(product)}><Archive className="w-4 h-4" /> Archivar</button>
                        )}
                      </div></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {productPages.totalPages >= 1 && sortedProducts.length > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4 mt-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={productPages.safePage <= 1}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#FFF7ED', color: '#9a3412' }}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm font-medium text-gray-600">Página {productPages.safePage} de {productPages.totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, productPages.totalPages))}
              disabled={productPages.safePage >= productPages.totalPages}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#FFF7ED', color: '#9a3412' }}
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      )}

      {/* ═══ TAB: Catálogo Inactivo ═══ */}
      {activeTab === 'archivo' && (
      <div key="archivo" className="card min-w-0" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Rubros Archivados <span className="ml-2 bg-slate-200 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">{sortedProducts.length}</span></h3>
          {productPages.totalPages > 1 && <span className="text-sm text-slate-500">Pág. {productPages.safePage} de {productPages.totalPages}</span>}
        </div>
        <div className="overflow-x-auto">
          {sortedProducts.length === 0 ? (
            <div className="empty-state"><p className="text-slate-500">No hay rubros archivados</p></div>
          ) : (
            <table>
              <thead><tr><th>Nº Ítem</th><th>Nombre</th><th>Categoría</th><th>Stock</th><th>Unidad</th>{(userRole === 1 || userRole === 4) && <th>Acciones</th>}</tr></thead>
              <tbody>
                {productPages.paginated.map(product => (
                  <tr key={product.id_product}>
                    <td>{product.id_product}</td>
                    <td className="font-semibold">{product.product_name}</td>
                    <td>{product.category?.category_name || '-'}</td>
                    <td><div className="flex items-center gap-2 whitespace-nowrap">{product.stock_real} {getStockBadge(product.stock_real)}</div></td>
                    <td>{product.unit_measure}</td>
                    {(userRole === 1 || userRole === 4) && (
                      <td>
                        <button className="btn btn-sm flex items-center gap-2" style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #86efac' }} onClick={() => handleRestore(product)}><RotateCcw className="w-4 h-4" /> Restaurar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {productPages.totalPages >= 1 && sortedProducts.length > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4 mt-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={productPages.safePage <= 1}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#FFF7ED', color: '#9a3412' }}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-sm font-medium text-gray-600">Página {productPages.safePage} de {productPages.totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, productPages.totalPages))}
              disabled={productPages.safePage >= productPages.totalPages}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#FFF7ED', color: '#9a3412' }}
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      )}

      {/* ═══ TAB: Control de Vencimientos ═══ */}
      {activeTab === 'lotes' && (
        <div className="card min-w-0" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Lotes en Stock <span className="ml-2 bg-orange-100 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-full">{lotes.length}</span></h3>
            {lotesPages.totalPages > 1 && <span className="text-sm text-slate-500">Pág. {lotesPages.safePage} de {lotesPages.totalPages}</span>}
          </div>
          {lotesLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : lotesOrdenados.length === 0 ? (
            <div className="empty-state"><p className="text-slate-500">No hay lotes activos en el inventario</p></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table>
                  <thead><tr><th>Rubro</th><th>ID Lote</th><th>Stock del Lote</th><th>Vencimiento</th><th>Últ. Reabastecimiento</th><th>Estado</th></tr></thead>
                  <tbody>
                    {lotesPages.paginated.map((lote, idx) => {
                      const globalIdx = (lotesPages.safePage - 1) * ITEMS_PER_PAGE + idx
                      const showDivider = globalIdx === dividerIndex && lotesVencidos.length > 0
                      return (
                        <>
                          {showDivider && (
                            <tr key="divider" className="bg-slate-50">
                              <td colSpan="100%" className="text-center font-semibold text-slate-500 py-2">Lotes Caducados (Merma)</td>
                            </tr>
                          )}
                          <tr key={`${lote.id_input}-${lote.lote_idx}-${idx}`}>
                            <td className="font-semibold">{lote.product_name}</td>
                            <td className="text-sm font-mono text-slate-500">INP-{lote.id_input}/{lote.lote_idx}</td>
                            <td className="font-medium">{lote.cantidad} {lote.unit_measure}</td>
                            <td className="text-sm">
                              <div>{lote.fecha_vencimiento || '—'}</div>
                              {lote.fecha_vencimiento && lote.dias_restantes > 0 && (
                                <div className="text-xs mt-0.5 text-slate-400">{getRelativeDate(lote.fecha_vencimiento)}</div>
                              )}
                            </td>
                            <td className="text-sm text-slate-500">{lote.fecha_input ? new Date(lote.fecha_input + 'T00:00:00').toLocaleDateString('es-VE') : '—'}</td>
                            <td>{getExpiryBadge(lote.dias_restantes)}</td>
                          </tr>
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {lotesPages.totalPages >= 1 && lotesOrdenados.length > 0 && (
                <div className="flex items-center justify-center gap-4 pt-4 mt-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={lotesPages.safePage <= 1}
                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#FFF7ED', color: '#9a3412' }}
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <span className="text-sm font-medium text-gray-600">Página {lotesPages.safePage} de {lotesPages.totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, lotesPages.totalPages))}
                    disabled={lotesPages.safePage >= lotesPages.totalPages}
                    className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: '#FFF7ED', color: '#9a3412' }}
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Products
