import { connectionMeta } from '../hooks/useConnectionStatus'

/**
 * ConnectionScreen
 * Pantalla completa que sustituye al Login cuando no hay conexión o el
 * servidor no responde: sin sesión iniciada no existe ninguna acción
 * posible, por lo que aquí sí corresponde bloquear en vez de dejar que
 * el formulario falle con errores crípticos. Hereda la atmósfera visual
 * del Login (degradado cálido, orbes, panel de vidrio) con el logo en
 * escala de grises "respirando" mientras espera. Desaparece sola al
 * restablecerse la conexión (el hook reintenta periódicamente).
 */

const SCREEN_CONFIG = {
  offline: {
    title: 'Sin conexión a internet',
    message: 'Verifique su red Wi-Fi o datos móviles. El sistema se reconectará automáticamente.',
  },
  'server-down': {
    title: 'No se puede conectar con el servidor',
    message: 'Su conexión a internet funciona, pero el servidor no responde en este momento. Reintentando automáticamente…',
  },
}

export default function ConnectionScreen({ status, downSince, lastOkAt, retrySeconds }) {
  const { title, message } = SCREEN_CONFIG[status] ?? SCREEN_CONFIG['server-down']
  const { since, retry } = connectionMeta({ status, downSince, lastOkAt, retrySeconds })

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden bg-gradient-to-br from-orange-50 via-orange-50 to-orange-100">
      {/* Orbes de fondo, misma atmósfera del Login */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="login-bg-orb absolute -top-40 -left-40 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="login-bg-orb absolute -bottom-40 -right-40 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" style={{ animationDelay: '3s' }} />
      </div>

      <div className="login-panel relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl p-10 md:p-12 rounded-3xl shadow-2xl border border-white/40 text-center">
        <div className="flex justify-center mb-8">
          <img
            src="/logo.png"
            alt="PAE Logo"
            className="connection-logo w-28 h-28 rounded-3xl shadow-sm"
          />
        </div>

        <h1 className="mb-3 text-xl font-semibold text-slate-700">{title}</h1>
        <p className="text-sm text-slate-500">{message}</p>

        <p className="mt-6 text-xs text-slate-400">
          <span className="whitespace-nowrap">{since}</span>
          {retry && <span className="whitespace-nowrap"> · {retry}</span>}
        </p>

        <div className="dot-loader mt-8">
          <div className="dot dot-1 bg-orange-200"></div>
          <div className="dot dot-2 bg-orange-200"></div>
          <div className="dot dot-3 bg-orange-200"></div>
        </div>
      </div>
    </div>
  )
}
