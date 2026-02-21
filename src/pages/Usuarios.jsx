import { useState, useEffect } from 'react'
import { supabase, getUserData, getCurrentUser, createUserAccount } from '../supabaseClient'
import Loading from '../components/Loading'

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

  useEffect(() => {
    checkPermissions()
    loadUsuarios()
    loadRoles()
  }, [])

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
      alert('Error al cargar usuarios')
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

      alert('Usuario creado exitosamente.\n\nCredenciales:\nCorreo: ' + formData.email + '\nContraseña: ' + formData.password + '\n\nComparta estas credenciales con el usuario.')
      resetForm()
      loadUsuarios()
    } catch (error) {
      console.error('Error creando usuario:', error)
      if (error.message.includes('already registered')) {
        alert('Error: Ya existe un usuario con ese correo electrónico.')
      } else if (error.message.includes('username')) {
        alert('Error: Ya existe un usuario con ese nombre de usuario.')
      } else {
        alert('Error al crear usuario: ' + error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (user) => {
    if (user.id_user === currentUserId) {
      alert('No puede editar su propia cuenta desde aquí.')
      return
    }
    // Nadie puede editar a un Desarrollador
    if (user.id_rol === 4) {
      alert('No puede modificar la cuenta de un Desarrollador.')
      return
    }
    // Director no puede editar a otro Director
    if (userRole === 1 && user.id_rol === 1) {
      alert('No puede modificar a otro Director.')
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
      alert('Usuario actualizado exitosamente')
      resetForm()
      loadUsuarios()
    } catch (error) {
      console.error('Error actualizando usuario:', error)
      alert('Error al actualizar usuario: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user) => {
    if (user.id_user === currentUserId) {
      alert('No puede desactivar su propia cuenta.')
      return
    }
    // Nadie puede desactivar a un Desarrollador
    if (user.id_rol === 4) {
      alert('No puede desactivar la cuenta de un Desarrollador.')
      return
    }
    // Director no puede desactivar a otro Director
    if (userRole === 1 && user.id_rol === 1) {
      alert('No puede desactivar a otro Director.')
      return
    }

    const newStatus = !user.is_active
    const action = newStatus ? 'activar' : 'desactivar'

    if (!confirm(`¿Está seguro de ${action} al usuario "${user.full_name}"?`)) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: newStatus })
        .eq('id_user', user.id_user)

      if (error) throw error
      alert(`Usuario ${newStatus ? 'activado' : 'desactivado'} exitosamente`)
      loadUsuarios()
    } catch (error) {
      console.error('Error cambiando estado:', error)
      alert('Error: ' + error.message)
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

  if (loading) return <Loading />

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
          <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>🔒</p>
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
            className="btn btn-primary"
            onClick={() => { setEditingUser(null); setShowForm(true) }}
          >
            ➕ Nuevo Usuario
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
                      {new Date(user.created_at).toLocaleDateString('es-VE')}
                    </td>
                    <td>
                      {user.id_user === currentUserId ? (
                        <span className="text-sm text-secondary">(Tu cuenta)</span>
                      ) : user.id_rol === 4 ? (
                        <span className="text-sm text-secondary">(Desarrollador)</span>
                      ) : user.id_rol === 1 && userRole === 1 ? (
                        <span className="text-sm text-secondary">(Director protegido)</span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEdit(user)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className={`btn btn-sm ${user.is_active === false ? 'btn-success' : 'btn-danger'}`}
                            onClick={() => toggleActive(user)}
                          >
                            {user.is_active === false ? '✅ Activar' : '🚫 Desactivar'}
                          </button>
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
    </div>
  )
}

export default Usuarios
