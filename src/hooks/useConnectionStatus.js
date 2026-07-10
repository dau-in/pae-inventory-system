import { useState, useEffect, useRef } from 'react'

/**
 * useConnectionStatus
 * Monitorea la conectividad real del sistema en dos niveles:
 *   1. Red local (eventos online/offline del navegador)
 *   2. Alcance del servidor (endpoint de salud de Supabase), ya que el
 *      navegador puede reportar internet OK mientras el backend está caído.
 *
 * Estados posibles:
 *   'online'      — todo operativo (no se muestra nada al usuario)
 *   'offline'     — sin conexión a internet
 *   'server-down' — hay internet pero el servidor no responde
 *   'restored'    — la conexión volvió; estado transitorio de unos segundos
 *
 * Retorna { status, downSince, retrySeconds }:
 *   downSince    — Date del momento en que se detectó la caída (null si sano)
 *   retrySeconds — segundos restantes para el próximo reintento (0 = en curso)
 */

const HEALTH_URL = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const CHECK_INTERVAL_OK = 45000    // chequeo de rutina con conexión sana
const CHECK_INTERVAL_DOWN = 10000  // reintentos durante una caída
const RESTORED_BANNER_MS = 4000    // duración del aviso de reconexión
const HEALTH_TIMEOUT_MS = 5000     // tope de espera por respuesta de salud

const DOWN_STATES = ['offline', 'server-down']

/**
 * Formatea el tiempo transcurrido desde una fecha en formato compacto:
 * "hace un momento", "hace 5 min", "hace 2 h".
 */
export function formatDownSince(date) {
  if (!date) return ''
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'hace un momento'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `hace ${mins} min`
  return `hace ${Math.floor(mins / 60)} h`
}

/**
 * Construye las dos piezas de texto que acompañan al indicador:
 *   since — desde cuándo: sin internet usa el inicio de la caída; con el
 *           servidor caído usa la última conexión exitosa hacia él
 *   retry — cuenta regresiva compacta del próximo reintento
 */
export function connectionMeta({ status, downSince, lastOkAt, retrySeconds }) {
  const since = status === 'server-down'
    ? (lastOkAt
        ? `Última conexión ${formatDownSince(lastOkAt)}`
        : `Sin respuesta del servidor ${formatDownSince(downSince)}`)
    : `Sin internet ${formatDownSince(downSince)}`

  const retry = retrySeconds == null
    ? null
    : (retrySeconds > 0 ? `reintento en ${retrySeconds}s` : 'reintentando…')

  return { since, retry }
}

export function useConnectionStatus() {
  const [status, setStatus] = useState('online')
  const [downSince, setDownSince] = useState(null)
  const [lastOkAt, setLastOkAt] = useState(null)
  const [retrySeconds, setRetrySeconds] = useState(null)
  const statusRef = useRef('online')
  const downSinceRef = useRef(null)
  const retryAtRef = useRef(null)

  useEffect(() => {
    let checkTimer = null
    let restoreTimer = null
    let tickTimer = null
    let cancelled = false

    const set = (next) => {
      if (cancelled) return
      statusRef.current = next
      setStatus(next)
    }

    // Registra el inicio de la caída solo una vez (la más antigua)
    const markDown = () => {
      if (!downSinceRef.current) {
        downSinceRef.current = new Date()
        setDownSince(downSinceRef.current)
      }
    }

    const markUp = () => {
      downSinceRef.current = null
      retryAtRef.current = null
      setDownSince(null)
      setRetrySeconds(null)
    }

    const checkServer = async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
      try {
        const res = await fetch(HEALTH_URL, {
          headers: { apikey: ANON_KEY },
          signal: controller.signal,
          cache: 'no-store',
        })
        return res.ok
      } catch {
        return false
      } finally {
        clearTimeout(timeout)
      }
    }

    const scheduleNext = () => {
      if (cancelled) return
      const healthy = !DOWN_STATES.includes(statusRef.current)
      const delay = healthy ? CHECK_INTERVAL_OK : CHECK_INTERVAL_DOWN
      retryAtRef.current = Date.now() + delay
      checkTimer = setTimeout(evaluate, delay)
    }

    const evaluate = async () => {
      if (cancelled) return
      if (!navigator.onLine) {
        set('offline')
        markDown()
      } else {
        const wasDown = DOWN_STATES.includes(statusRef.current)
        const serverOk = await checkServer()
        if (cancelled) return

        if (serverOk && !cancelled) setLastOkAt(new Date())

        if (!serverOk) {
          set('server-down')
          markDown()
        } else if (wasDown) {
          set('restored')
          markUp()
          clearTimeout(restoreTimer)
          restoreTimer = setTimeout(() => {
            if (statusRef.current === 'restored') set('online')
          }, RESTORED_BANNER_MS)
        } else if (statusRef.current !== 'restored') {
          set('online')
        }
      }
      scheduleNext()
    }

    // Tick de 1 s durante las caídas: actualiza la cuenta regresiva del
    // reintento y de paso refresca el "desconectado hace X"
    tickTimer = setInterval(() => {
      if (cancelled || !DOWN_STATES.includes(statusRef.current)) return
      if (retryAtRef.current) {
        setRetrySeconds(Math.max(0, Math.ceil((retryAtRef.current - Date.now()) / 1000)))
      }
    }, 1000)

    const onOffline = () => {
      set('offline')
      markDown()
    }
    const onOnline = () => {
      // Al recuperar red, verificar de inmediato que el servidor responda
      clearTimeout(checkTimer)
      evaluate()
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    evaluate()

    return () => {
      cancelled = true
      clearTimeout(checkTimer)
      clearTimeout(restoreTimer)
      clearInterval(tickTimer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { status, downSince, lastOkAt, retrySeconds }
}
