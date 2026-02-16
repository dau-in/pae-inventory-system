import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import Loading from '../components/Loading'

function Reportes() {
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState('stock')
  const [reportData, setReportData] = useState([])
  const [dateRange, setDateRange] = useState({
    desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0]
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
      alert('Error al cargar reporte: ' + error.message)
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
        guia_entrada(numero_guia, fecha)
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
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const { data, error } = await supabase
      .from('product')
      .select('*, category(category_name)')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .order('expiration_date', { ascending: true })

    if (error) throw error
    setReportData(data || [])
  }

  const loadConsumoReport = async () => {
    const { data, error } = await supabase
      .from('menu_detalle')
      .select(`
        *,
        product(product_name, unit_measure),
        menu_diario(fecha)
      `)
      .gte('menu_diario.fecha', dateRange.desde)
      .lte('menu_diario.fecha', dateRange.hasta)

    if (error) throw error

    // Agrupar por producto
    const grouped = {}
    data?.forEach(item => {
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
    let filename = `reporte_${reportType}_${new Date().toISOString().split('T')[0]}.csv`

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
          csv += `${item.fecha},"${item.guia_entrada?.numero_guia || '-'}","${item.product?.product_name}",${item.amount},${item.product?.unit_measure}\n`
        })
        break
      case 'salidas':
        csv = 'Fecha,Producto,Cantidad,Unidad,Motivo\n'
        reportData.forEach(item => {
          csv += `${item.fecha},"${item.product?.product_name}",${item.amount},${item.product?.unit_measure},"${item.motivo || '-'}"\n`
        })
        break
      case 'vencimientos':
        csv = 'Producto,Stock,Vencimiento,Días restantes\n'
        reportData.forEach(item => {
          const days = Math.ceil((new Date(item.expiration_date) - new Date()) / (1000 * 60 * 60 * 24))
          csv += `"${item.product_name}",${item.stock},${item.expiration_date},${days}\n`
        })
        break
      case 'consumo':
        csv = 'Producto,Total consumido,Unidad,Veces usado\n'
        reportData.forEach(item => {
          csv += `"${item.product_name}",${item.total.toFixed(2)},${item.unit_measure},${item.veces}\n`
        })
        break
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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
              <option value="vencimientos">Productos por vencer</option>
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
                      <td>{item.guia_entrada?.numero_guia || '-'}</td>
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
                    <th>Stock</th>
                    <th>Vencimiento</th>
                    <th>Días restantes</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item) => {
                    const days = Math.ceil((new Date(item.expiration_date) - new Date()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={item.id_product}>
                        <td className="font-semibold">{item.product_name}</td>
                        <td>{item.stock} {item.unit_measure}</td>
                        <td>{new Date(item.expiration_date).toLocaleDateString('es-VE')}</td>
                        <td>
                          {days < 0 ? (
                            <span className="badge badge-danger">VENCIDO</span>
                          ) : days <= 7 ? (
                            <span className="badge badge-danger">{days} días</span>
                          ) : days <= 30 ? (
                            <span className="badge badge-warning">{days} días</span>
                          ) : (
                            <span>{days} días</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
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
