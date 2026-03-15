import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Github } from 'lucide-react'

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
      let errorMessage = 'Ocurri\u00F3 un error al intentar iniciar sesi\u00F3n.'
      if (error.message === 'Invalid login credentials') {
        errorMessage = 'Credenciales inv\u00E1lidas. Por favor, verifique su correo y contrase\u00F1a.'
      } else if (error.message === 'Email not confirmed') {
        errorMessage = 'Por favor, confirme su correo electr\u00F3nico antes de ingresar.'
      } else if (error.message) {
        errorMessage = error.message
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden bg-gradient-to-br from-orange-50 via-orange-50 to-orange-100">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="login-bg-orb absolute -top-40 -left-40 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="login-bg-orb absolute -bottom-40 -right-40 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" style={{ animationDelay: '3s' }} />
        <div className="login-bg-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-3xl" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Overlapping Cards Container */}
      <div className="flex flex-col lg:flex-row items-center w-full max-w-5xl relative lg:gap-0 gap-8 mt-20 lg:mt-0">

        {/* Tarjeta Izquierda — Formulario */}
        <div className="login-panel w-full lg:w-5/12 bg-white/95 backdrop-blur-2xl p-10 md:p-12 lg:p-14 rounded-3xl shadow-2xl z-20 relative border border-white/40">
          <div className="flex justify-center mb-8">
            <img
              src="/logo.png"
              alt="PAE Logo"
              className="w-28 h-28 rounded-3xl shadow-sm drop-shadow-md"
            />
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-slate-600 mb-1">
                Correo electr&oacute;nico
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
                className="w-full p-3 bg-white/70 border border-slate-200/80 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all duration-200"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-slate-600 mb-1">
                Contrase&ntilde;a
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
                className="w-full p-3 bg-white/70 border border-slate-200/80 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-pae-peach hover:bg-pae-peach-dark text-slate-900 font-bold py-3 rounded-xl shadow-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesi\u00F3n...' : 'Iniciar Sesi\u00F3n'}
            </button>
          </form>

          <div className="text-center mt-6">
            <a
              href="https://github.com/dau-in/pae-inventory-system"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Github className="w-3.5 h-3.5" /> C&oacute;digo Fuente
            </a>
          </div>
        </div>

        {/* Tarjeta Derecha — Definición Institucional */}
        <div className="login-footer w-full lg:w-7/12 bg-gradient-to-br from-orange-100 via-orange-50 to-orange-50 p-10 md:p-12 lg:py-16 lg:pr-12 lg:pl-24 rounded-3xl shadow-xl z-10 lg:-ml-16 border border-orange-200/50">
          <p className="font-serif italic text-slate-700 text-lg md:text-xl leading-relaxed">
            &ldquo;Pol&iacute;tica p&uacute;blica de asistencia socioeducativa orientada a la
            provisi&oacute;n nutricional estudiantil, con el fin de optimizar el aprendizaje y
            mitigar la deserci&oacute;n escolar mediante la gesti&oacute;n comunitaria.&rdquo;
          </p>
          <hr className="border-orange-200/60 my-6" />
          <p className="text-right text-sm text-slate-600 font-medium tracking-wide">
            — Sistema de Inventario para el{' '}
            <span className="text-orange-600 font-extrabold opacity-100">P</span>rograma de{' '}
            <span className="text-orange-600 font-extrabold opacity-100">A</span>limentaci&oacute;n{' '}
            <span className="text-orange-600 font-extrabold opacity-100">E</span>scolar (PAE).
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
