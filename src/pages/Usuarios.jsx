import { useState, useEffect } from 'react'
import { supabase, getUserData, getCurrentUser, createUserAccount, changeUserPassword } from '../supabaseClient'
import { notifySuccess, notifyError, notifyWarning, notifyInfo, confirmDanger, confirmAction } from '../utils/notifications'
import GlobalLoader from '../components/GlobalLoader'
import { Lock, Plus, KeyRound, Pencil, Check, Ban } from 'lucide-react'

function Usuarios() {
  const [loading, setLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    username: '',
    id_rol: 2
  })
  const [saving, setSaving] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' })
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    checkPermissions()
    loadUsuarios()
    loadRoles()
  }, [])

  // Auto-refresh cada 60 segundos para mantener estados de conexión actualizados
  useEffect(() => {
    const interval = setInterval(() => {
      loadUsuarios()
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const isUserOnline = (lastSeen) => {
    if (!lastSeen) return false
    return (new Date() - new Date(lastSeen)) < 3 * 60 * 1000
  }

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Nunca'
    const diffMs = new Date() - new Date(timestamp)
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMinutes < 1) return 'hace un momento'
    if (diffMinutes === 1) return 'hace 1 minuto'
    if (diffMinutes < 60) return `hace ${diffMinutes} minutos`
    if (diffHours === 1) return 'hace 1 hora'
    if (diffHours < 24) return `hace ${diffHours} horas`
    if (diffDays === 1) return 'hace 1 día'
    return `hace ${diffDays} días`
  }

  const canChangePassword = (user) => {
    // Desarrollador (4): puede cambiar a todos
    if (userRole === 4) return true
    // Director (1): puede cambiar la suya, la de roles 2 y 3. NO la de otro Director ni Desarrollador
    if (userRole === 1) {
      if (user.id_user === currentUserId) return true
      if ([2, 3].includes(user.id_rol)) return true
    }
    return false
  }

  const checkPermissions = async () => {
    const data = await getUserData()
    setUserRole(data?.id_rol)
    setCurrentUserId(data?.id_user)
  }

  const loadUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, rol(rol_name)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error cargando usuarios:', error)
      notifyError('Error', 'No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('rol')
        .select('*')
        .order('id_rol')

      if (error) throw error
      setRoles(data || [])
    } catch (error) {
      console.error('Error cargando roles:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (formData.password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres')
      }

      await createUserAccount(
        formData.email,
        formData.password,
        formData.full_name,
        formData.username,
        parseInt(formData.id_rol)
      )

      notifyInfo('Usuario creado', '<b>Credenciales:</b><br>Correo: ' + formData.email + '<br>Contraseña: ' + formData.password + '<br><br>Comparta estas credenciales con el usuario.')
      resetForm()
      loadUsuarios()
    } catch (error) {
      console.error('Error creando usuario:', error)
      if (error.message.includes('already registered')) {
        notifyError('Error', 'Ya existe un usuario con ese correo electrónico')
      } else if (error.message.includes('username')) {
        notifyError('Error', 'Ya existe un usuario con ese nombre de usuario')
      } else {
        notifyError('Error al crear usuario', error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (user) => {
    if (user.id_user === currentUserId) {
      notifyWarning('Acción no permitida', 'No puede editar su propia cuenta desde aquí')
      return
    }
    // Nadie puede editar a un Desarrollador
    if (user.id_rol === 4) {
      notifyWarning('Acción no permitida', 'No puede modificar la cuenta de un Desarrollador')
      return
    }
    // Director no puede editar a otro Director
    if (userRole === 1 && user.id_rol === 1) {
      notifyWarning('Acción no permitida', 'No puede modificar a otro Director')
      return
    }
    setEditingUser(user)
    setFormData({
      email: '',
      password: '',
      full_name: user.full_name,
      username: user.username,
      id_rol: user.id_rol
    })
    setShowForm(true)
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          username: formData.username,
          id_rol: parseInt(formData.id_rol)
        })
        .eq('id_user', editingUser.id_user)

      if (error) throw error
      notifySuccess('Actualizado', 'Usuario actualizado exitosamente')
      resetForm()
      loadUsuarios()
    } catch (error) {
      console.error('Error actualizando usuario:', error)
      notifyError('Error al actualizar', error.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user) => {
    if (user.id_user === currentUserId) {
      notifyWarning('Acción no permitida', 'No puede desactivar su propia cuenta')
      return
    }
    // Nadie puede desactivar a un Desarrollador
    if (user.id_rol === 4) {
      notifyWarning('Acción no permitida', 'No puede desactivar la cuenta de un Desarrollador')
      return
    }
    // Director no puede desactivar a otro Director
    if (userRole === 1 && user.id_rol === 1) {
      notifyWarning('Acción no permitida', 'No puede desactivar a otro Director')
      return
    }

    const newStatus = !user.is_active
    const action = newStatus ? 'activar' : 'desactivar'

    const confirmed = await confirmDanger(`¿${action} usuario?`, `¿Está seguro de ${action} al usuario "${user.full_name}"?`, action === 'activar' ? 'Activar' : 'Desactivar')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id_user', user.id_user)

      if (error) throw error
      notifySuccess(newStatus ? 'Activado' : 'Desactivado', 'Usuario ' + (newStatus ? 'activado' : 'desactivado') + ' exitosamente')
      loadUsuarios()
    } catch (error) {
      console.error('Error cambiando estado:', error)
      notifyError('Error', error.message)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      username: '',
      id_rol: 2
    })
    setEditingUser(null)
    setShowForm(false)
  }

  const openPasswordModal = (user) => {
    setPasswordTarget(user)
    setPasswordData({ newPassword: '', confirmPassword: '' })
    setShowPasswordModal(true)
  }

  const closePasswordModal = () => {
    setPasswordTarget(null)
    setPasswordData({ newPassword: '', confirmPassword: '' })
    setShowPasswordModal(false)
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()

    if (passwordData.newPassword.length < 6) {
      notifyWarning('Contraseña muy corta', 'La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      notifyWarning('No coinciden', 'La nueva contraseña y la confirmación deben ser iguales')
      return
    }

    const confirmed = await confirmAction(
      '¿Cambiar contraseña?',
      `¿Está seguro de cambiar la contraseña de "${passwordTarget.full_name}"?`,
      'Cambiar'
    )
    if (!confirmed) return

    setChangingPassword(true)
    try {
      await changeUserPassword(passwordTarget.id_user, passwordData.newPassword)
      notifyInfo(
        'Contraseña cambiada',
        `<b>Nueva contraseña para ${passwordTarget.full_name}:</b><br><br>` +
        `<code style="font-size: 1.2rem; padding: 0.5rem; background: #f1f5f9; border-radius: 4px;">${passwordData.newPassword}</code><br><br>` +
        `Comparta esta contraseña con el usuario.`
      )
      closePasswordModal()
    } catch (error) {
      console.error('Error cambiando contraseña:', error)
      if (error.message?.includes('different from the old password')) {
        notifyError('Contraseña sin cambios', 'La nueva contraseña debe ser diferente a la actual.')
      } else {
        notifyError('Error al cambiar contraseña', error.message)
      }
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) return <GlobalLoader text="Cargando usuarios..." />

  // Solo Director (id_rol=1) o Desarrollador (id_rol=4) puede acceder
  if (userRole !== null && userRole !== 1 && userRole !== 4) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: '#fee2e2',
          borderRadius: '12px',
          border: '2px solid #ef4444'
        }}>
          <div style={{ margin: '0 0 1rem 0' }}><Lock className="w-12 h-12 text-red-400 mx-auto" /></div>
          <h3>Acceso Denegado</h3>
          <p>Solo el Director puede gestionar usuarios.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex-between mb-4">
        <h2 className="text-2xl font-bold">Gestión de Usuarios</h2>
        {!showForm && (
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={() => { setEditingUser(null); setShowForm(true) }}
          >
            <Plus className="w-4 h-4" /> Nuevo Usuario
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card mb-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingUser ? `Editar: ${editingUser.full_name}` : 'Crear Nuevo Usuario'}
          </h3>
          <form onSubmit={editingUser ? handleUpdate : handleCreate}>
            <div className="grid grid-2 gap-4">
              {!editingUser && (
                <>
                  <div className="form-group">
                    <label>Correo electrónico *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="usuario@correo.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="form-group">
                    <label>Contraseña * (mínimo 6 caracteres)</label>
                    <input
                      type="text"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Contraseña temporal"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <p className="text-sm text-secondary mt-1">
                      Se muestra en texto plano para que pueda compartirla con el usuario
                    </p>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Nombre completo *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Nombre y Apellido"
                  required
                />
              </div>

              <div className="form-group">
                <label>Nombre de usuario *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="nombre.usuario"
                  required
                  disabled={!!editingUser}
                />
                {editingUser && (
                  <p className="text-sm text-secondary mt-1">
                    El nombre de usuario no se puede cambiar
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Rol *</label>
                <select
                  name="id_rol"
                  value={formData.id_rol}
                  onChange={handleInputChange}
                  required
                >
                  {roles.filter(rol => {
                    // Nunca mostrar Desarrollador
                    if (rol.id_rol === 4) return false
                    // Director solo ve roles 2 y 3
                    if (userRole === 1 && rol.id_rol === 1) return false
                    return true
                  }).map(rol => (
                    <option key={rol.id_rol} value={rol.id_rol}>
                      {rol.rol_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editingUser ? 'Actualizar' : 'Crear Usuario'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de usuarios */}
      <div className="card">
        <div className="overflow-x-auto">
          {usuarios.length === 0 ? (
            <div className="empty-state">
              <p>No hay usuarios registrados</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Conexión</th>
                  <th>Última IP</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(user => (
                  <tr key={user.id_user} style={{ opacity: user.is_active === false ? 0.5 : 1 }}>
                    <td className="font-semibold">{user.full_name}</td>
                    <td>{user.username}</td>
                    <td>
                      <span className={`badge ${
                        user.id_rol === 4 ? 'badge-danger' :
                        user.id_rol === 1 ? 'badge-danger' :
                        user.id_rol === 2 ? 'badge-success' :
                        'badge-warning'
                      }`}>
                        {user.rol?.rol_name || 'Sin rol'}
                      </span>
                    </td>
                    <td>
                      {user.is_active === false ? (
                        <span className="badge badge-danger">Inactivo</span>
                      ) : (
                        <span className="badge badge-success">Activo</span>
                      )}
                    </td>
                    <td>
                      {isUserOnline(user.last_seen) ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            backgroundColor: '#10b981', display: 'inline-block'
                          }}></span>
                          <span className="text-sm" style={{ color: '#10b981', fontWeight: 600 }}>En línea</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            backgroundColor: '#94a3b8', display: 'inline-block'
                          }}></span>
                          <span className="text-sm text-secondary">{getRelativeTime(user.last_seen)}</span>
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-secondary">
                      {user.last_ip || '—'}
                    </td>
                    <td>
                      {new Date(user.created_at).toLocaleDateString('es-VE')}
                    </td>
                    <td>
                      {user.id_user === currentUserId ? (
                        <div className="flex gap-2">
                          <span className="text-sm text-secondary" style={{ alignSelf: 'center' }}>(Tu cuenta)</span>
                          {canChangePassword(user) && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => openPasswordModal(user)}
                              title="Cambiar contraseña"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {!(user.id_rol === 4) && !(user.id_rol === 1 && userRole === 1) && (
                            <button
                              className="btn btn-sm btn-primary flex items-center gap-2"
                              onClick={() => handleEdit(user)}
                            >
                              <Pencil className="w-4 h-4" /> Editar
                            </button>
                          )}
                          {canChangePassword(user) && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => openPasswordModal(user)}
                              title="Cambiar contraseña"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}
                          {!(user.id_rol === 4) && !(user.id_rol === 1 && userRole === 1) && (
                            <button
                              className={`btn btn-sm flex items-center gap-2 ${user.is_active === false ? 'btn-success' : 'btn-danger'}`}
                              onClick={() => toggleActive(user)}
                            >
                              {user.is_active === false ? <><Check className="w-4 h-4" /> Activar</> : <><Ban className="w-4 h-4" /> Desactivar</>}
                            </button>
                          )}
                          {!canChangePassword(user) && (user.id_rol === 4 || (user.id_rol === 1 && userRole === 1)) && (
                            <span className="text-sm text-secondary">
                              {user.id_rol === 4 ? '(Desarrollador)' : '(Director protegido)'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de cambio de contraseña */}
      {showPasswordModal && passwordTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', margin: '1rem' }}>
            <h3 className="text-lg font-semibold mb-4">
              <span className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> Cambiar Contraseña</span>
            </h3>
            <p className="text-sm text-secondary mb-4">
              Usuario: <strong>{passwordTarget.full_name}</strong> ({passwordTarget.username})
            </p>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Nueva contraseña * (mínimo 6 caracteres)</label>
                <input
                  type="text"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Nueva contraseña"
                  required
                  minLength={6}
                  autoFocus
                  autoComplete="new-password"
                />
                <p className="text-sm text-secondary mt-1">
                  Se muestra en texto plano para que pueda compartirla con el usuario
                </p>
              </div>
              <div className="form-group">
                <label>Confirmar contraseña *</label>
                <input
                  type="text"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Repetir contraseña"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                  {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closePasswordModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Usuarios
