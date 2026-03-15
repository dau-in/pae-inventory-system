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

  if (loading) return <GlobalLoader text="Cargando datos del plantel..." />

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-pae-peach-light px-6 py-8 text-center border-b border-orange-100">
          {editing ? (
            /* --- Modo Edición: Logo upload --- */
            <div className="mb-4">
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
              <p className="text-xs text-slate-400 mt-1">Formato PNG o JPG. Máximo 2 MB. Resolución máxima: 1024 × 1024 px.</p>
            </div>
          ) : (
            /* --- Modo Lectura: Logo --- */
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
          )}

          {editing ? (
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Nombre de la Institución"
              className="text-2xl font-heading font-bold text-center w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent"
            />
          ) : (
            <h1 className="text-2xl font-heading font-bold text-slate-800">
              {institucion?.nombre || 'Sin nombre'}
            </h1>
          )}
        </div>

        {/* Body: Datos */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* RIF */}
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">RIF</p>
                {editing ? (
                  <input
                    type="text"
                    name="rif"
                    value={formData.rif}
                    onChange={handleChange}
                    placeholder="J-XXXXXXXX-X"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{institucion?.rif || '—'}</p>
                )}
              </div>
            </div>

            {/* Código DEA */}
            <div className="flex items-start gap-3">
              <Hash className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Código DEA</p>
                {editing ? (
                  <input
                    type="text"
                    name="codigo_dea"
                    value={formData.codigo_dea}
                    onChange={handleChange}
                    placeholder="Código DEA"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{institucion?.codigo_dea || '—'}</p>
                )}
              </div>
            </div>

            {/* Dirección */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <MapPin className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Dirección</p>
                {editing ? (
                  <textarea
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    placeholder="Dirección completa del plantel"
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{institucion?.direccion || '—'}</p>
                )}
              </div>
            </div>

            {/* Director */}
            <div className="flex items-start gap-3 sm:col-span-2">
              <User className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Director(a) Actual</p>
                {editing ? (
                  <input
                    type="text"
                    name="director_actual"
                    value={formData.director_actual}
                    onChange={handleChange}
                    placeholder="Nombre del Director(a)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{institucion?.director_actual || '—'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {editing ? (
              <div className="flex gap-3 justify-end">
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            ) : (
              userRole === 4 && (
                <div className="flex justify-end">
                  <button
                    onClick={startEdit}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" /> Editar Datos
                  </button>
                </div>
              )
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
  )
}

export default DatosPlantel
