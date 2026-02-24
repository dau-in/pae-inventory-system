import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id_user', data.user.id)
        .single()

      if (userError || !userData) {
        throw new Error('Usuario no autorizado. Contacte al administrador.')
      }

      if (userData.is_active === false) {
        await supabase.auth.signOut()
        throw new Error('Su cuenta ha sido desactivada. Contacte al Director.')
      }

      navigate('/')
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pae-peach-light p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-orange-100">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="PAE Logo" className="w-28 h-28 mx-auto mb-4 rounded-3xl shadow-sm drop-shadow-md" />
          <h1 className="text-2xl font-bold text-center text-pae-pot-dark mb-2">
            PAE Inventory System
          </h1>
          <p className="text-sm text-gray-500">
            ¡Bienvenido/a de nuevo!
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
              disabled={loading}
              autoComplete="email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent mt-1"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="current-password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pae-peach focus:border-transparent mt-1"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-pae-peach hover:bg-pae-peach-dark text-slate-900 font-bold py-3 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">
            Sistema de Inventario del Programa de Alimentación Escolar
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
