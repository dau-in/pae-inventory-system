import { useState, useEffect } from 'react'
import { supabase, getUserData } from '../supabaseClient'
import GlobalLoader from '../components/GlobalLoader'
import { notifySuccess, notifyError } from '../utils/notifications'
import { Building2, Pencil, Save, X, Upload, MapPin, User, Hash, Mail, Image, ShieldAlert, Globe } from 'lucide-react'

// ── Estados de Venezuela para el select ──
const ESTADOS_VENEZUELA = [
  'Amazonas','Anzoátegui','Apure','Aragua','Barinas','Bolívar','Carabobo',
  'Cojedes','Delta Amacuro','Distrito Capital','Falcón','Guárico','Lara',
  'Mérida','Miranda','Monagas','Nueva Esparta','Portuguesa','Sucre',
  'Táchira','Trujillo','Vargas','Yaracuy','Zulia'
]

// ── Helpers de validación ──
const RIF_REGEX = /^[JG]-\d{8}-\d$/
const DEA_REGEX = /^[OPS][DN]\d{8}$/

function formatRifInput(raw) {
  // Strip non-alphanumeric
  let v = raw.toUpperCase().replace(/[^JG0-9-]/g, '')
  // Auto-format: L-XXXXXXXX-X
  const digits = v.replace(/[^0-9]/g, '')
  const letter = v.match(/^[JG]/) ? v[0] : ''
  if (!letter) return v.slice(0, 1)
  if (digits.length <= 8) return `${letter}-${digits}`
  return `${letter}-${digits.slice(0, 8)}-${digits.slice(8, 9)}`
}

function formatDeaInput(raw) {
  let v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // First char: O, P, S
  if (v.length >= 1 && !'OPS'.includes(v[0])) v = v.slice(1)
  // Second char: D, N
  if (v.length >= 2 && !'DN'.includes(v[1])) v = v.slice(0, 1) + v.slice(2)
  return v.slice(0, 10)
}

function DatosPlantel() {
  const [institucion, setInstitucion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [formData, setFormData] = useState({})
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [cintilloFile, setCintilloFile] = useState(null)
  const [cintilloPreview, setCintilloPreview] = useState(null)

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
      director_actual: institucion?.director_actual || '',
      estado: institucion?.estado || '',
      ciudad: institucion?.ciudad || '',
      municipio: institucion?.municipio || '',
      parroquia: institucion?.parroquia || '',
      direccion_detallada: institucion?.direccion_detallada || '',
      codigo_postal: institucion?.codigo_postal || '',
      correo_electronico: institucion?.correo_electronico || '',
    })
    setLogoFile(null)
    setLogoPreview(null)
    setCintilloFile(null)
    setCintilloPreview(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setCintilloFile(null)
    setCintilloPreview(null)
    setEditing(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'rif') return setFormData(prev => ({ ...prev, rif: formatRifInput(value) }))
    if (name === 'codigo_dea') return setFormData(prev => ({ ...prev, codigo_dea: formatDeaInput(value) }))
    if (name === 'codigo_postal') return setFormData(prev => ({ ...prev, codigo_postal: value.replace(/[^0-9]/g, '').slice(0, 5) }))
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // ── Reusable image picker handler ──
  const handleImagePick = (e, { maxW, maxH, onAccept, label }) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notifyError('Archivo inválido', 'Solo se permiten imágenes (PNG, JPG, etc.)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      notifyError('Archivo muy pesado', `${label} no debe superar los 2 MB.`)
      e.target.value = ''
      return
    }
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      if (img.width > maxW || img.height > maxH) {
        notifyError('Resolución excedida', `La imagen es de ${img.width}×${img.height} px. Máximo permitido: ${maxW}×${maxH} px.`)
        e.target.value = ''
        return
      }
      onAccept(file)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      notifyError('Imagen corrupta', 'No se pudo leer la imagen seleccionada.')
      e.target.value = ''
    }
    img.src = URL.createObjectURL(file)
  }

  const handleLogoChange = (e) => handleImagePick(e, {
    maxW: 1024, maxH: 1024, label: 'El logo',
    onAccept: (file) => { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)) }
  })

  const handleCintilloChange = (e) => handleImagePick(e, {
    maxW: 2000, maxH: 500, label: 'El cintillo',
    onAccept: (file) => { setCintilloFile(file); setCintilloPreview(URL.createObjectURL(file)) }
  })

  // ── Upload helper ──
  const uploadImage = async (file, currentUrl, prefix) => {
    if (currentUrl) {
      try {
        const oldPath = currentUrl.split('/logos/').pop()
        if (oldPath) await supabase.storage.from('logos').remove([oldPath])
      } catch { /* ignore */ }
    }
    const ext = file.name.split('.').pop() || 'png'
    const path = `${prefix}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { cacheControl: '3600' })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    return urlData.publicUrl
  }

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      notifyError('Campo requerido', 'El nombre de la institución es obligatorio')
      return
    }
    if (formData.rif && !RIF_REGEX.test(formData.rif)) {
      notifyError('Formato de RIF inválido', 'Use el formato: J-12345678-9 o G-12345678-9')
      return
    }
    if (formData.codigo_dea && !DEA_REGEX.test(formData.codigo_dea) && formData.codigo_dea.length > 0) {
      notifyError('Formato de Código DEA inválido', 'Use el formato: OD06591801 (2 letras + 8 números)')
      return
    }
    if (formData.correo_electronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo_electronico)) {
      notifyError('Correo inválido', 'Ingrese un correo electrónico válido.')
      return
    }

    setSaving(true)
    try {
      let logo_url = institucion?.logo_url || ''
      let cintillo_url = institucion?.cintillo_url || ''

      if (logoFile) logo_url = await uploadImage(logoFile, institucion?.logo_url, 'logo')
      if (cintilloFile) cintillo_url = await uploadImage(cintilloFile, institucion?.cintillo_url, 'cintillo')

      const { error } = await supabase
        .from('institucion')
        .update({ ...formData, logo_url, cintillo_url, updated_at: new Date().toISOString() })
        .eq('id', 1)

      if (error) throw error
      notifySuccess('Datos actualizados', 'Los datos del plantel se guardaron correctamente')
      setEditing(false)
      setLogoFile(null); setLogoPreview(null)
      setCintilloFile(null); setCintilloPreview(null)
      loadInstitucion()
    } catch (error) {
      console.error('Error guardando datos:', error)
      notifyError('Error al guardar', error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <GlobalLoader text="Consultando la base de datos..." />

  // ── Helper para filas de lectura ──
  const InfoRow = ({ icon: Icon, label, value, span2 }) => (
    <div className={`flex items-start gap-3${span2 ? ' md:col-span-2' : ''}`}>
      <Icon className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-slate-800 font-medium">{value || '—'}</p>
      </div>
    </div>
  )

  // ── Build full address string for display ──
  const fullAddress = [
    institucion?.direccion_detallada,
    institucion?.parroquia && `Parroquia ${institucion.parroquia}`,
    institucion?.municipio && `Municipio ${institucion.municipio}`,
    institucion?.ciudad,
    institucion?.estado,
    institucion?.codigo_postal && `CP ${institucion.codigo_postal}`
  ].filter(Boolean).join(', ')

  return (
  <>
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        {/* Header con logo */}
        <div className="bg-pae-peach-light px-6 py-8 text-center border-b border-orange-100">
          <div className="mb-4">
            {institucion?.logo_url ? (
              <img src={institucion.logo_url} alt="Logo institucional" className="w-32 h-32 rounded-2xl object-cover mx-auto shadow-sm" />
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

        {/* ── Banner de seguridad para no-Desarrolladores ── */}
        {userRole !== 4 && (
          <div className="mx-6 mt-6 p-4 rounded-xl border" style={{ background: '#FFF7ED', borderColor: '#fed7aa' }}>
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#9a3412' }} />
              <p className="text-sm leading-relaxed" style={{ color: '#9a3412' }}>
                Por motivos de seguridad y procesos de auditoría, la modificación de datos institucionales está restringida al desarrollador responsable. En caso de requerir una actualización, le agradeceremos ponerse en contacto con el administrador del sistema.
              </p>
            </div>
          </div>
        )}

        {/* Body: Datos en lectura */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Identidad */}
            <InfoRow icon={Hash} label="RIF" value={institucion?.rif} />
            <InfoRow icon={Hash} label="Código DEA" value={institucion?.codigo_dea} />
            {/* Contacto */}
            <InfoRow icon={User} label="Director(a) Actual" value={institucion?.director_actual} />
            <InfoRow icon={Mail} label="Correo Electrónico" value={institucion?.correo_electronico} />
            {/* Dirección consolidada (full width) */}
            <div className="flex items-start gap-3 md:col-span-2">
              <MapPin className="w-5 h-5 text-pae-peach-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Dirección Física</p>
                <p className="text-slate-800 font-medium">
                  {institucion?.direccion_detallada || institucion?.direccion || '—'}
                </p>
                {fullAddress && (
                  <p className="text-sm text-gray-500 mt-1">{fullAddress}</p>
                )}
              </div>
            </div>
          </div>

          {/* Cintillo / Membrete preview */}
          {institucion?.cintillo_url && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Membrete para Reportes</p>
              <img src={institucion.cintillo_url} alt="Membrete institucional" className="w-full h-16 object-contain rounded-lg border border-gray-100" />
            </div>
          )}

          {/* Botón Editar (solo Dev) */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {!editing && userRole === 4 && (
              <div className="flex justify-end">
                <button onClick={startEdit} className="btn btn-primary flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> Editar Datos
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
          {/* Header */}
          <div className="flex items-center justify-between" style={{ padding: '1rem 1.5rem', background: '#FFF7ED', borderBottom: '1px solid #fed7aa' }}>
            <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#9a3412', margin: 0 }}>
              <Building2 className="w-5 h-5" /> Editar Datos del Plantel
            </h3>
            <button type="button" onClick={cancelEdit} className="p-1.5 rounded-lg transition-colors" style={{ color: '#9a3412' }}
              onMouseEnter={e => e.currentTarget.style.background = '#ffedd5'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
            {/* ── Logo upload ── */}
            <div className="mb-4 text-center">
              <label className="cursor-pointer group block mx-auto w-32 h-32 relative">
                {logoPreview || institucion?.logo_url ? (
                  <img src={logoPreview || institucion?.logo_url} alt="Logo" className="w-32 h-32 rounded-2xl object-cover mx-auto border-2 border-dashed border-orange-300 group-hover:opacity-75 transition-opacity" />
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-white border-2 border-dashed border-orange-300 flex items-center justify-center mx-auto group-hover:border-orange-400 transition-colors">
                    <Building2 className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              </label>
              <p className="text-xs text-slate-500 mt-2">Click para cambiar el logo</p>
              <p className="text-xs text-slate-400 mt-1">Máx. 2 MB · 1024 × 1024 px</p>
            </div>

            {/* ── Sección: Identificación ── */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2">Identificación</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group md:col-span-2">
                <label>Nombre de la Institución <span className="text-red-500 ml-1">●</span></label>
                <input className="w-full" type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre de la Institución" />
              </div>
              <div className="form-group">
                <label>RIF</label>
                <input className="w-full" type="text" name="rif" value={formData.rif} onChange={handleChange} placeholder="J-00000000-0" maxLength={12} />
                <p className="text-xs text-slate-400 mt-1">Formato: J-12345678-9 o G-12345678-9</p>
              </div>
              <div className="form-group">
                <label>Código DEA</label>
                <input className="w-full" type="text" name="codigo_dea" value={formData.codigo_dea} onChange={handleChange} placeholder="OD06591801" maxLength={10} style={{ textTransform: 'uppercase' }} />
                <p className="text-xs text-slate-400 mt-1">Formato: 2 letras + 8 números (ej. OD06591801)</p>
              </div>
              <div className="form-group md:col-span-2">
                <label>Director(a) Actual</label>
                <input className="w-full" type="text" name="director_actual" value={formData.director_actual} onChange={handleChange} placeholder="Nombre del Director(a)" />
              </div>
              <div className="form-group md:col-span-2">
                <label>Correo Electrónico</label>
                <input className="w-full" type="email" name="correo_electronico" value={formData.correo_electronico} onChange={handleChange} placeholder="correo@institucion.edu.ve" />
              </div>
            </div>

            {/* ── Sección: Ubicación Geográfica ── */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Ubicación Geográfica</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label>Estado</label>
                <select className="w-full" name="estado" value={formData.estado} onChange={handleChange}>
                  <option value="">Seleccionar estado...</option>
                  {ESTADOS_VENEZUELA.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Ciudad</label>
                <input className="w-full" type="text" name="ciudad" value={formData.ciudad} onChange={handleChange} placeholder="Ciudad" />
              </div>
              <div className="form-group">
                <label>Municipio</label>
                <input className="w-full" type="text" name="municipio" value={formData.municipio} onChange={handleChange} placeholder="Municipio" />
              </div>
              <div className="form-group">
                <label>Parroquia</label>
                <input className="w-full" type="text" name="parroquia" value={formData.parroquia} onChange={handleChange} placeholder="Parroquia" />
              </div>
              <div className="form-group">
                <label>Código Postal</label>
                <input className="w-full" type="text" name="codigo_postal" value={formData.codigo_postal} onChange={handleChange} placeholder="2301" maxLength={5} inputMode="numeric" />
              </div>
              <div className="form-group md:col-span-2">
                <label>Dirección General</label>
                <textarea className="w-full" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Dirección general del plantel" rows={2} />
              </div>
              <div className="form-group md:col-span-2">
                <label>Dirección Detallada</label>
                <textarea className="w-full" name="direccion_detallada" value={formData.direccion_detallada} onChange={handleChange} placeholder="Urbanización, sector, avenida, calle, edificio, etc." rows={2} />
              </div>
            </div>

            {/* ── Sección: Cintillo / Membrete ── */}
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Cintillo / Membrete</p>
            <div className="mb-2">
              <label className="cursor-pointer group block w-full relative">
                {cintilloPreview || institucion?.cintillo_url ? (
                  <img src={cintilloPreview || institucion?.cintillo_url} alt="Cintillo" className="w-full max-h-28 object-contain rounded-lg border-2 border-dashed border-orange-300 group-hover:opacity-75 transition-opacity bg-white p-2" />
                ) : (
                  <div className="w-full h-24 rounded-lg bg-white border-2 border-dashed border-orange-300 flex items-center justify-center group-hover:border-orange-400 transition-colors">
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <Image className="w-8 h-8" />
                      <span className="text-xs">Click para subir cintillo</span>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <input type="file" accept="image/*" onChange={handleCintilloChange} className="hidden" />
              </label>
              <p className="text-xs text-slate-400 mt-1">Imagen rectangular para encabezado de PDFs. Máx. 2 MB · 2000 × 500 px.</p>
            </div>

            {/* ── Footer del modal ── */}
            <div className="flex gap-3 justify-end" style={{ paddingTop: '1rem', borderTop: '1px solid #e5e7eb', marginTop: '1rem' }}>
              <button type="button" onClick={cancelEdit} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                style={{ background: '#f3f4f6', color: '#374151' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}>
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors border"
                style={{
                  background: saving ? '#cbd5e1' : '#FFF7ED',
                  color: saving ? '#94a3b8' : '#9a3412',
                  borderColor: saving ? '#cbd5e1' : '#fed7aa',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#FFD9A8' }}
                onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#FFF7ED' }}>
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
