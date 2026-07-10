import { WifiOff, ServerCrash, Wifi } from 'lucide-react'
import { connectionMeta } from '../hooks/useConnectionStatus'

/**
 * ConnectionToast
 * Tarjeta flotante inferior que informa el estado de la conexión dentro
 * del sistema. Permanece visible mientras dure la falla — indicando desde
 * cuándo y el tiempo para el próximo reintento — y muestra una confirmación
 * breve al restablecerse. No bloquea la interfaz: los datos ya cargados
 * siguen siendo consultables.
 */

const TOAST_CONFIG = {
  offline: {
    Icon: WifiOff,
    chip: 'bg-slate-100 text-slate-600',
    title: 'Sin conexión a internet',
  },
  'server-down': {
    Icon: ServerCrash,
    chip: 'bg-amber-100 text-amber-600',
    title: 'Sin conexión con el servidor',
  },
  restored: {
    Icon: Wifi,
    chip: 'bg-emerald-100 text-emerald-600',
    title: 'Conexión restablecida',
  },
}

export default function ConnectionToast({ status, downSince, lastOkAt, retrySeconds }) {
  const config = TOAST_CONFIG[status]
  if (!config) return null

  const { Icon, chip, title } = config
  const isDown = status === 'offline' || status === 'server-down'
  const { since, retry } = connectionMeta({ status, downSince, lastOkAt, retrySeconds })

  return (
    <div
      role="status"
      aria-live="polite"
      className="connection-toast fixed bottom-6 left-1/2 z-[9999] flex items-center gap-3 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl px-4 py-3 max-w-[calc(100vw-2rem)]"
    >
      <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${chip}`}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="text-left">
        <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">{title}</p>
        {isDown && (
          <p className="text-xs text-slate-400">
            <span className="whitespace-nowrap">{since}</span>
            {retry && <span className="whitespace-nowrap"> · {retry}</span>}
          </p>
        )}
      </div>
    </div>
  )
}
