import { useState, useEffect } from 'react'
import { supabase, getCurrentUser } from '../supabaseClient'
import Loading from '../components/Loading'

function GuiasEntrada() {
  const [loading, setLoading] = useState(true)
  const [guias, setGuias] = useState([])
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    numero_guia: '',
    codigo_sunagro: '',
    fecha: new Date().toISOString().split('T')[0],
    inspector: '',
    vocera: '',
    telefono_vocera: '',
    notas: ''
  })
  const [detalles, setDetalles] = useState([])

  useEffect(() => {
    loadGuias()
    loadProducts()
  }, [])

  const loadGuias = async () => {
    try {
      const { data, error } = await supabase
        .from('guia_entrada')
        .select(`
          *,
          input(
            id_input,
            amount,
            unit_amount,
            product(product_name)
          )
        `)
        .order('fecha', { ascending: false })

      if (error) throw error
      setGuias(data || [])
    } catch (error) {
      console.error('Error cargando guías:', error)
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
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const addDetalle = () => {
    setDetalles([...detalles, {
      id_product: '',
      amount: '',
      unit_amount: ''
    }])
  }

  const removeDetalle = (index) => {
    setDetalles(detalles.filter((_, i) => i !== index))
  }

  const handleDetalleChange = (index, field, value) => {
    const newDetalles = [...detalles]
    newDetalles[index][field] = value
    setDetalles(newDetalles)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (detalles.length === 0) {
      alert('Debe agregar al menos un producto')
      return
    }

    setLoading(true)

    try {
      const user = await getCurrentUser()

      // Insertar guía
      const { data: guiaData, error: guiaError } = await supabase
        .from('guia_entrada')
        .insert({
          ...formData,
          created_by: user.id
        })
        .select()
        .single()

      if (guiaError) throw guiaError

      // Insertar detalles
      const inputData = detalles.map(detalle => ({
        id_guia: guiaData.id_guia,
        id_product: parseInt(detalle.id_product),
        amount: parseFloat(detalle.amount),
        unit_amount: detalle.unit_amount ? parseInt(detalle.unit_amount) : null,
        fecha: formData.fecha
      }))

      const { error: inputError } = await supabase
        .from('input')
        .insert(inputData)

      if (inputError) throw inputError

      alert('Guía registrada exitosamente. El stock se ha actualizado automáticamente.')
      resetForm()
      loadGuias()
    } catch (error) {
      console.error('Error guardando guía:', error)
      alert('Error al guardar guía: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      numero_guia: '',
      codigo_sunagro: '',
      fecha: new Date().toISOString().split('T')[0],
      inspector: '',
      vocera: '',
      telefono_vocera: '',
      notas: ''
    })
    setDetalles([])
    setShowForm(false)
  }

  if (loading && guias.length === 0) return <Loading />

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Guías de Entrada</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '❌ Cancelar' : '➕ Nueva Guía'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">Nueva Guía de Entrada</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2 gap-4">
              <div className="form-group">
                <label>Número de guía *</label>
                <input
                  type="text"
                  name="numero_guia"
                  value={formData.numero_guia}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Código SUNAGRO</label>
                <input
                  type="text"
                  name="codigo_sunagro"
                  value={formData.codigo_sunagro}
                  onChange={handleInputChange}
                />
              </div>

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
                <label>Inspector</label>
                <input
                  type="text"
                  name="inspector"
                  value={formData.inspector}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Vocera</label>
                <input
                  type="text"
                  name="vocera"
                  value={formData.vocera}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Teléfono vocera</label>
                <input
                  type="tel"
                  name="telefono_vocera"
                  value={formData.telefono_vocera}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notas</label>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleInputChange}
                rows="2"
              />
            </div>

            <hr style={{ margin: '1.5rem 0' }} />

            <div className="flex-between mb-4">
              <h4 className="font-semibold">Productos recibidos</h4>
              <button type="button" className="btn btn-sm btn-success" onClick={addDetalle}>
                ➕ Agregar producto
              </button>
            </div>

            {detalles.length === 0 ? (
              <p className="text-secondary mb-4">No hay productos agregados. Click en "Agregar producto"</p>
            ) : (
              <div className="mb-4">
                {detalles.map((detalle, index) => (
                  <div key={index} className="card mb-2" style={{ background: '#f8fafc' }}>
                    <div className="grid grid-2 gap-2">
                      <div className="form-group">
                        <label>Producto *</label>
                        <select
                          value={detalle.id_product}
                          onChange={(e) => handleDetalleChange(index, 'id_product', e.target.value)}
                          required
                        >
                          <option value="">Seleccionar...</option>
                          {products.map(product => (
                            <option key={product.id_product} value={product.id_product}>
                              {product.product_name} ({product.unit_measure})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Cantidad *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={detalle.amount}
                          onChange={(e) => handleDetalleChange(index, 'amount', e.target.value)}
                          placeholder="Ej: 25.5"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Unidades (opcional)</label>
                        <input
                          type="number"
                          value={detalle.unit_amount}
                          onChange={(e) => handleDetalleChange(index, 'unit_amount', e.target.value)}
                          placeholder="Ej: 10 sacos"
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button 
                          type="button" 
                          className="btn btn-danger btn-sm"
                          onClick={() => removeDetalle(index)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar guía'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de guías */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Historial de guías</h3>
        {guias.length === 0 ? (
          <div className="empty-state">
            <p>No hay guías registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nº Guía</th>
                  <th>Código SUNAGRO</th>
                  <th>Fecha</th>
                  <th>Inspector</th>
                  <th>Vocera</th>
                  <th>Productos</th>
                </tr>
              </thead>
              <tbody>
                {guias.map((guia) => (
                  <tr key={guia.id_guia}>
                    <td className="font-semibold">{guia.numero_guia}</td>
                    <td>{guia.codigo_sunagro || '-'}</td>
                    <td>{new Date(guia.fecha).toLocaleDateString('es-VE')}</td>
                    <td>{guia.inspector || '-'}</td>
                    <td>{guia.vocera || '-'}</td>
                    <td>
                      {guia.input?.length || 0} producto(s)
                      {guia.input && guia.input.length > 0 && (
                        <ul className="text-sm text-secondary mt-1">
                          {guia.input.map((item) => (
                            <li key={item.id_input}>
                              {item.product?.product_name}: {item.amount}
                              {item.unit_amount ? ` (${item.unit_amount} unidades)` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default GuiasEntrada
