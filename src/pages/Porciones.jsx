import { useState, useEffect, useRef } from 'react'
import { supabase, getUserData } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError, confirmDanger } from '../utils/notifications'
import { exportPDF } from '../utils/pdfGenerator'
import { X, Plus, Lightbulb, Pencil, Trash2, Save, FileText, ChevronLeft, ChevronRight } from 'lucide-react'

function Porciones() {
  const [loading, setLoading] = useState(true)
  const [porciones, setPorciones] = useState([])
  const [products, setProducts] = useState([])
  const [ultimaAsistencia, setUltimaAsistencia] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPorcion, setEditingPorcion] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const isInitialMount = useRef(true)
  const tableRef = useRef(null)

  const [formData, setFormData] = useState({
    id_product: '',
    rendimiento_por_unidad: '',
    unit_measure: 'kg',
    notas: ''
  })

  useEffect(() => {
    loadPorciones()
    loadProducts()
    loadUltimaAsistencia()
    getUserData().then(data => {
      setUserRole(data?.id_rol)
      setUserName(data?.username || '')
    })
  }, [])

  // Scroll to table header on page change (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (!loading && tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentPage, loading])

  const loadUltimaAsistencia = async () => {
    try {
      const { data } = await supabase
        .from('registro_diario')
        .select('asistencia_total')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle()
      setUltimaAsistencia(data?.asistencia_total || null)
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
        rendimiento_por_unidad: parseFloat(formData.rendimiento_por_unidad),
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
      rendimiento_por_unidad: porcion.rendimiento_por_unidad,
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
      rendimiento_por_unidad: '',
      unit_measure: 'kg',
      notas: ''
    })
    setEditingPorcion(null)
    setShowForm(false)
  }

  if (loading && porciones.length === 0) return <GlobalLoader text="Consultando la base de datos..." />

  // Productos que ya tienen porción configurada
  const productsWithPortion = porciones.map(p => p.id_product)
  const availableProducts = products.filter(p => !productsWithPortion.includes(p.id_product))

  const handleExportPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const columns = [
        { header: 'Rubro', dataKey: 'rubro' },
        { header: 'Rendimiento', dataKey: 'rendimiento' },
        { header: 'Unidad', dataKey: 'unidad' },
        { header: 'Notas', dataKey: 'notas' },
      ]
      const rows = porciones.map(p => ({
        rubro: p.product?.product_name || '-',
        rendimiento: `${p.rendimiento_por_unidad} porciones`,
        unidad: p.unit_measure || '-',
        notas: p.notas || '-',
      }))
      await exportPDF({
        title: 'REPORTE DE PORCIONES',
        columns,
        data: rows,
        userName,
      })
    } catch (err) {
      console.error('Error exportando PDF:', err)
      notifyError('Error', 'No se pudo generar el reporte PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="flex-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Configuración de Porciones</h2>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Define cuántas porciones da cada unidad de rubro</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exporting || porciones.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            style={{ background: '#FFF7ED', color: '#9a3412', border: '1px solid #fed7aa' }}
          >
            <FileText className="w-4 h-4" />
            {exporting ? 'Generando...' : 'Generar Reporte'}
          </button>
          {userRole !== 3 && (
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
              style={{ background: '#FFD9A8', color: '#0f172a' }}
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4" /> Nueva Porción
            </button>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="alert alert-warning mb-4">
        <span className="inline-flex items-center gap-1"><Lightbulb className="w-4 h-4" /> <strong>¿Cómo configurar las porciones?</strong></span><br/>
        Aquí le enseñas al sistema para cuántos niños alcanza 1 kilo, 1 litro o 1 unidad de cada rubro.
        Al registrar el menú diario, el sistema usará este número para descontar automáticamente
        la cantidad exacta del inventario.
      </div>

      {showForm && userRole !== 3 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
            {/* — Encabezado del modal — */}
            <div
              className="flex items-center justify-between"
              style={{
                padding: '1rem 1.5rem',
                background: '#FFF7ED',
                borderBottom: '1px solid #fed7aa'
              }}
            >
              <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#9a3412', margin: 0 }}>
                {editingPorcion ? 'Editar Porción' : 'Nueva Porción'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#9a3412' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ffedd5'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* — Cuerpo scrollable — */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label>Rubro <span className="text-red-500 ml-1">●</span></label>
                    <select
                      className="w-full"
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
                    <label>Rendimiento (porciones) <span className="text-red-500 ml-1">●</span></label>
                    <input
                      className="w-full"
                      type="number"
                      step="0.01"
                      name="rendimiento_por_unidad"
                      value={formData.rendimiento_por_unidad}
                      onChange={handleInputChange}
                      placeholder="Ej: 12"
                      required
                    />
                    <p className="text-sm text-secondary mt-1">
                      Ej: Si escribes 5, significa que 1 {formData.unit_measure} alcanza para 5 niños.
                    </p>
                  </div>

                  <div className="form-group">
                    <label>Unidad de medida <span className="text-red-500 ml-1">●</span></label>
                    <select
                      className="w-full"
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
                      className="w-full"
                      type="text"
                      name="notas"
                      value={formData.notas}
                      onChange={handleInputChange}
                      placeholder="Observaciones..."
                    />
                  </div>
                </div>

                {/* — Pie del modal — */}
                <div
                  className="flex gap-3 justify-end"
                  style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '1rem' }}
                >
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                    style={{ background: '#f3f4f6', color: '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
                  >
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 justify-center px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                    style={{
                      background: loading ? '#cbd5e1' : '#FFD9A8',
                      color: loading ? '#94a3b8' : '#431407',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#ffc885' }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#FFD9A8' }}
                  >
                    {loading ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div ref={tableRef} className="flex justify-between items-center mb-4 scroll-mt-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">Porciones configuradas <span className="ml-3 bg-[#FFD9A8] text-[#9a3412] text-xs font-bold px-2.5 py-1 rounded-full">{porciones.length}</span></h3>
          {porciones.length > 0 && (() => {
            const tp = Math.ceil(porciones.length / itemsPerPage)
            const sp = Math.min(currentPage, tp)
            const iLast = sp * itemsPerPage
            const iFirst = iLast - itemsPerPage
            return <span className="text-sm font-medium text-slate-500">Mostrando {iFirst + 1} - {Math.min(iLast, porciones.length)}</span>
          })()}
        </div>
        {porciones.length === 0 ? (
          <div className="empty-state">
            <p>No hay porciones configuradas</p>
            <button className="btn btn-primary mt-4" onClick={() => setShowForm(true)}>
              Configurar primera porción
            </button>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(porciones.length / itemsPerPage)
          const safePage = Math.min(currentPage, totalPages)
          const indexOfLastItem = safePage * itemsPerPage
          const indexOfFirstItem = indexOfLastItem - itemsPerPage
          const currentItems = porciones.slice(indexOfFirstItem, indexOfLastItem)
          return (
          <>
          <div className="relative min-h-[400px]">
            {loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-lg">
                <div className="flex gap-2 mb-2">
                  <div className="w-3 h-3 bg-orange-200 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-orange-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm text-slate-500 font-medium">Consultando la base de datos...</span>
              </div>
            )}
            <div className={`transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th>Rendimiento (porciones)</th>
                  <th>Ejemplo de cálculo</th>
                  <th>Notas</th>
                  {(userRole === 1 || userRole === 4) && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {currentItems.map((porcion) => {
                  const alumnosEjemplo = ultimaAsistencia || 0
                  const cantidadNecesaria = alumnosEjemplo > 0
                    ? (alumnosEjemplo / porcion.rendimiento_por_unidad).toFixed(2)
                    : '-'

                  return (
                    <tr key={porcion.id_porcion}>
                      <td className="font-semibold">{porcion.product?.product_name}</td>
                      <td>
                        <span className="text-lg font-bold text-slate-800">
                          {porcion.rendimiento_por_unidad}
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
                      {(userRole === 1 || userRole === 4) && (
                        <td>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleEdit(porcion)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(porcion.id_porcion)}
                            >
                              <Trash2 className="w-4 h-4" />
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
            </div>
          </div>

          {totalPages >= 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 mt-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safePage <= 1}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#FFF7ED', color: '#9a3412' }}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-sm font-medium text-gray-600">Página {safePage} de {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safePage >= totalPages}
                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#FFF7ED', color: '#9a3412' }}
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          </>
          )
        })()}
      </div>
    </div>
  )
}

export default Porciones
