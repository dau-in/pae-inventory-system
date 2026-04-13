import { useState, useEffect } from 'react'
import { supabase, getUserData } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError } from '../utils/notifications'
import { Building2, Pencil, Save, X, Upload, MapPin, User, Hash } from 'lucide-react'

function DatosPlantel() {
  const [institucion, setInstitucion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({})
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  useEffect(() => {
    loadInstitucion()
    getUserData().then(data => setUserRole(data?.id_rol))
  }, [])

  const loadInstitucion = async () => {
    try {
      const { data, error } = await supabase
        .from('institucion')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) throw error
      setInstitucion(data)
    } catch (error) {
      console.error('Error cargando datos del plantel:', error)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = () => {
    setFormData({
      nombre: institucion?.nombre || '',
      rif: institucion?.rif || '',
      codigo_dea: institucion?.codigo_dea || '',
      direccion: institucion?.direccion || '',
      director_actual: institucion?.director_actual || ''
    })
    setLogoFile(null)
    setLogoPreview(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setEditing(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notifyError('Archivo inválido', 'Solo se permiten imágenes (PNG, JPG, etc.)')
      return
    }

    // Validar peso (máx 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      notifyError('Archivo muy pesado', 'El logo no debe superar los 2 MB.')
      e.target.value = ''
      return
    }

    // Validar resolución (máx 1024x1024)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      if (img.width > 1024 || img.height > 1024) {
        notifyError('Resolución excedida', `La imagen es de ${img.width}×${img.height} px. Máximo permitido: 1024×1024 px.`)
        e.target.value = ''
        return
      }
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      notifyError('Imagen corrupta', 'No se pudo leer la imagen seleccionada.')
      e.target.value = ''
    }
    img.src = URL.createObjectURL(file)
  }

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      notifyError('Campo requerido', 'El nombre de la institución es obligatorio')
      return
    }

    setSaving(true)
    try {
      let logo_url = institucion?.logo_url || ''

      if (logoFile) {
        // Reciclar logo viejo del bucket si existe
        if (institucion?.logo_url) {
          try {
            const oldPath = institucion.logo_url.split('/logos/').pop()
            if (oldPath) {
              await supabase.storage.from('logos').remove([oldPath])
            }
          } catch {
            // No bloquear si falla el borrado del logo viejo
          }
        }

        const fileExt = logoFile.name.split('.').pop() || 'png'
        const filePath = `logo-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, { cacheControl: '3600' })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(filePath)

        logo_url = urlData.publicUrl
      }

      const { error } = await supabase
        .from('institucion')
        .update({
          ...formData,
          logo_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1)

      if (error) throw error

      notifySuccess('Datos actualizados', 'Los datos del plantel se guardaron correctamente')
      setEditing(false)
      setLogoFile(null)
      setLogoPreview(null)
      loadInstitucion()
    } catch (error) {
      console.error('Error guardando datos:', error)
      notifyError('Error al guardar', error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <GlobalLoader text="Consultando la base de datos..." />

  return (
  <>
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <div className="bg-pae-peach-light px-6 py-8 text-center border-b border-orange-100">
          {/* Logo (siempre lectura, edición en modal) */}
          <div className="mb-4">
            {institucion?.logo_url ? (
              <img
                src={institucion.logo_url}
                alt="Logo institucional"
                className="w-32 h-32 rounded-2xl object-cover mx-auto shadow-sm"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto shadow-sm">
                <Building2 className="w-12 h-12 text-slate-300" />
              </div>
            )}
          </div>

          <h1 className="text-2xl font-heading font-bold text-slate-800">
            {institucion?.nombre || 'Sin nombre'}
          </h1>
        </div>

        {/* Body: Datos */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* RIF */}
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">RIF</p>
                <p className="text-slate-800 font-medium">{institucion?.rif || '—'}</p>
              </div>
            </div>

            {/* Código DEA */}
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Código DEA</p>
                <p className="text-slate-800 font-medium">{institucion?.codigo_dea || '—'}</p>
              </div>
            </div>

            {/* Dirección */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <MapPin className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Dirección</p>
                <p className="text-slate-800 font-medium">{institucion?.direccion || '—'}</p>
              </div>
            </div>

            {/* Director */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <User className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Director(a) Actual</p>
                <p className="text-slate-800 font-medium">{institucion?.director_actual || '—'}</p>
              </div>
            </div>
          </div>

          {/* Botón Editar (solo Dev, solo en lectura) */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {!editing && userRole === 4 && (
              <div className="flex justify-end">
                <button
                  onClick={startEdit}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" /> Editar Datos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer: última actualización */}
        {institucion?.updated_at && (
          <div className="px-6 py-3 bg-slate-50 border-t border-gray-100 text-center">
            <p className="text-xs text-slate-400">
              Última actualización: {new Date(institucion.updated_at).toLocaleDateString('es-VE', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        )}
      </div>
    </div>

    {/* ═══ MODAL: Editar Datos del Plantel ═══ */}
    {editing && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) cancelEdit() }}
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
              <Building2 className="w-5 h-5" /> Editar Datos del Plantel
            </h3>
            <button
              type="button"
              onClick={cancelEdit}
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
            {/* Logo upload */}
            <div className="mb-4 text-center">
              <label className="cursor-pointer group block mx-auto w-32 h-32 relative">
                {logoPreview || institucion?.logo_url ? (
                  <img
                    src={logoPreview || institucion?.logo_url}
                    alt="Logo"
                    className="w-32 h-32 rounded-2xl object-cover mx-auto border-2 border-dashed border-orange-300 group-hover:opacity-75 transition-opacity"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-white border-2 border-dashed border-orange-300 flex items-center justify-center mx-auto group-hover:border-orange-400 transition-colors">
                    <Building2 className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">Click para cambiar el logo</p>
              <p className="text-xs text-slate-400 mt-1">Formato PNG o JPG. Máximo 2 MB. Resolación máxima: 1024 × 1024 px.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group md:col-span-2">
                <label>Nombre de la Institución <span className="text-red-500 ml-1">●</span></label>
                <input
                  className="w-full"
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Nombre de la Institución"
                />
              </div>
              <div className="form-group">
                <label>RIF</label>
                <input
                  className="w-full"
                  type="text"
                  name="rif"
                  value={formData.rif}
                  onChange={handleChange}
                  placeholder="J-XXXXXXXX-X"
                />
              </div>
              <div className="form-group">
                <label>Código DEA</label>
                <input
                  className="w-full"
                  type="text"
                  name="codigo_dea"
                  value={formData.codigo_dea}
                  onChange={handleChange}
                  placeholder="Código DEA"
                />
              </div>
              <div className="form-group md:col-span-2">
                <label>Dirección</label>
                <textarea
                  className="w-full"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  placeholder="Dirección completa del plantel"
                  rows={2}
                />
              </div>
              <div className="form-group md:col-span-2">
                <label>Director(a) Actual</label>
                <input
                  className="w-full"
                  type="text"
                  name="director_actual"
                  value={formData.director_actual}
                  onChange={handleChange}
                  placeholder="Nombre del Director(a)"
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
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                style={{ background: '#f3f4f6', color: '#374151' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border"
                style={{
                  background: saving ? '#cbd5e1' : '#FFF7ED',
                  color: saving ? '#94a3b8' : '#9a3412',
                  borderColor: saving ? '#cbd5e1' : '#fed7aa',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#FFD9A8' } }}
                onMouseLeave={e => { if (!saving) { e.currentTarget.style.background = '#FFF7ED' } }}
              >
                <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

export default DatosPlantel
