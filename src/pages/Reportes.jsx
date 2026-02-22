import { useState, useEffect } from 'react'
import { supabase, getLocalDate, getFirstDayOfMonth } from '../supabaseClient'
import Loading from '../components/Loading'
import { notifyError } from '../utils/notifications'

function Reportes() {
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState('stock')
  const [reportData, setReportData] = useState([])
  const [dateRange, setDateRange] = useState({
    desde: getFirstDayOfMonth(),
    hasta: getLocalDate()
  })

  useEffect(() => {
    loadReport()
  }, [reportType, dateRange])

  const loadReport = async () => {
    setLoading(true)
    try {
      switch (reportType) {
        case 'stock':
          await loadStockReport()
          break
        case 'entradas':
          await loadEntradasReport()
          break
        case 'salidas':
          await loadSalidasReport()
          break
        case 'vencimientos':
          await loadVencimientosReport()
          break
        case 'consumo':
          await loadConsumoReport()
          break
        default:
          break
      }
    } catch (error) {
      console.error('Error cargando reporte:', error)
      notifyError('Error al cargar reporte', error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStockReport = async () => {
    const { data, error } = await supabase
      .from('product')
      .select('*, category(category_name)')
      .order('stock', { ascending: false })

    if (error) throw error
    setReportData(data || [])
  }

  const loadEntradasReport = async () => {
    const { data, error } = await supabase
      .from('input')
      .select(`
        *,
        product(product_name, unit_measure),
        guia_entrada(numero_guia_sunagro, fecha)
      `)
      .gte('fecha', dateRange.desde)
      .lte('fecha', dateRange.hasta)
      .order('fecha', { ascending: false })

    if (error) throw error
    setReportData(data || [])
  }

  const loadSalidasReport = async () => {
    const { data, error } = await supabase
      .from('output')
      .select(`
        *,
        product(product_name, unit_measure)
      `)
      .gte('fecha', dateRange.desde)
      .lte('fecha', dateRange.hasta)
      .order('fecha', { ascending: false })

    if (error) throw error
    setReportData(data || [])
  }

  const loadVencimientosReport = async () => {
    const { data, error } = await supabase.rpc('get_lotes_por_vencer', { p_dias: 365 })

    if (error) throw error
    setReportData(data || [])
  }

  const loadConsumoReport = async () => {
    // Consultar menus en el rango de fechas y traer sus detalles
    const { data, error } = await supabase
      .from('menu_diario')
      .select(`
        fecha,
        menu_detalle(
          id_product,
          cantidad_real_usada,
          product(product_name, unit_measure)
        )
      `)
      .gte('fecha', dateRange.desde)
      .lte('fecha', dateRange.hasta)

    if (error) throw error

    // Agrupar por producto
    const grouped = {}
    data?.forEach(menu => {
      menu.menu_detalle?.forEach(item => {
        if (!item.product) return
        const productId = item.id_product
        if (!grouped[productId]) {
          grouped[productId] = {
            product_name: item.product.product_name,
            unit_measure: item.product.unit_measure,
            total: 0,
            veces: 0
          }
        }
        grouped[productId].total += parseFloat(item.cantidad_real_usada || 0)
        grouped[productId].veces += 1
      })
    })

    setReportData(Object.values(grouped))
  }

  const handleDateChange = (e) => {
    const { name, value } = e.target
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const exportToCSV = () => {
    let csv = ''
    let filename = `reporte_${reportType}_${getLocalDate()}.csv`

    switch (reportType) {
      case 'stock':
        csv = 'Producto,Categoría,Stock,Unidad\n'
        reportData.forEach(item => {
          csv += `"${item.product_name}","${item.category?.category_name || '-'}",${item.stock},${item.unit_measure}\n`
        })
        break
      case 'entradas':
        csv = 'Fecha,Guía,Producto,Cantidad,Unidad\n'
        reportData.forEach(item => {
          csv += `${item.fecha},"${item.guia_entrada?.numero_guia_sunagro || '-'}","${item.product?.product_name}",${item.amount},${item.product?.unit_measure}\n`
        })
        break
      case 'salidas':
        csv = 'Fecha,Producto,Cantidad,Unidad,Motivo\n'
        reportData.forEach(item => {
          csv += `${item.fecha},"${item.product?.product_name}",${item.amount},${item.product?.unit_measure},"${item.motivo || '-'}"\n`
        })
        break
      case 'vencimientos':
        csv = 'Producto,Cantidad Lote,Stock Total,Vencimiento,Días restantes\n'
        reportData.forEach(item => {
          csv += `"${item.product_name}",${item.cantidad_lote},${item.stock},${item.fecha_vencimiento},${item.dias_restantes}\n`
        })
        break
      case 'consumo':
        csv = 'Producto,Total consumido,Unidad,Veces usado\n'
        reportData.forEach(item => {
          csv += `"${item.product_name}",${item.total.toFixed(2)},${item.unit_measure},${item.veces}\n`
        })
        break
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Reportes</h2>

      <div className="card mb-4">
        <div className="grid grid-2 gap-4">
          <div className="form-group">
            <label>Tipo de reporte</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="stock">Stock actual</option>
              <option value="entradas">Entradas (guías)</option>
              <option value="salidas">Salidas (menús)</option>
              <option value="vencimientos">Lotes por vencer</option>
              <option value="consumo">Consumo por producto</option>
            </select>
          </div>

          {(reportType === 'entradas' || reportType === 'salidas' || reportType === 'consumo') && (
            <>
              <div className="form-group">
                <label>Desde</label>
                <input
                  type="date"
                  name="desde"
                  value={dateRange.desde}
                  onChange={handleDateChange}
                />
              </div>
              <div className="form-group">
                <label>Hasta</label>
                <input
                  type="date"
                  name="hasta"
                  value={dateRange.hasta}
                  onChange={handleDateChange}
                />
              </div>
            </>
          )}
        </div>

        <button className="btn btn-success mt-2" onClick={exportToCSV}>
          📥 Exportar a CSV
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loading />
        ) : reportData.length === 0 ? (
          <div className="empty-state">
            <p>No hay datos para este reporte</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {reportType === 'stock' && (
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item) => (
                    <tr key={item.id_product}>
                      <td className="font-semibold">{item.product_name}</td>
                      <td>{item.category?.category_name || '-'}</td>
                      <td>{item.stock} {item.unit_measure}</td>
                      <td>
                        {item.stock < 10 ? (
                          <span className="badge badge-danger">BAJO</span>
                        ) : item.stock < 50 ? (
                          <span className="badge badge-warning">MEDIO</span>
                        ) : (
                          <span className="badge badge-success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'entradas' && (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Guía</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item) => (
                    <tr key={item.id_input}>
                      <td>{new Date(item.fecha).toLocaleDateString('es-VE')}</td>
                      <td>{item.guia_entrada?.numero_guia_sunagro || '-'}</td>
                      <td>{item.product?.product_name}</td>
                      <td className="font-semibold">{item.amount} {item.product?.unit_measure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'salidas' && (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item) => (
                    <tr key={item.id_output}>
                      <td>{new Date(item.fecha).toLocaleDateString('es-VE')}</td>
                      <td>{item.product?.product_name}</td>
                      <td className="font-semibold">{item.amount} {item.product?.unit_measure}</td>
                      <td className="text-sm">{item.motivo || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'vencimientos' && (
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad Lote</th>
                    <th>Stock Total</th>
                    <th>Vencimiento</th>
                    <th>Días restantes</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, index) => (
                    <tr key={index}>
                      <td className="font-semibold">{item.product_name}</td>
                      <td>{item.cantidad_lote} {item.unit_measure}</td>
                      <td>{item.stock} {item.unit_measure}</td>
                      <td>{new Date(item.fecha_vencimiento).toLocaleDateString('es-VE')}</td>
                      <td>
                        {item.dias_restantes < 0 ? (
                          <span className="badge badge-danger">VENCIDO</span>
                        ) : item.dias_restantes <= 7 ? (
                          <span className="badge badge-danger">{item.dias_restantes} días</span>
                        ) : item.dias_restantes <= 30 ? (
                          <span className="badge badge-warning">{item.dias_restantes} días</span>
                        ) : (
                          <span>{item.dias_restantes} días</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {reportType === 'consumo' && (
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Total consumido</th>
                    <th>Veces usado</th>
                    <th>Promedio por uso</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, index) => (
                    <tr key={index}>
                      <td className="font-semibold">{item.product_name}</td>
                      <td>{item.total.toFixed(2)} {item.unit_measure}</td>
                      <td>{item.veces}</td>
                      <td>{(item.total / item.veces).toFixed(2)} {item.unit_measure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Reportes
