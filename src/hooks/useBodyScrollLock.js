import { useEffect } from 'react'

/**
 * useBodyScrollLock
 * Bloquea el scroll del body cuando un modal está abierto.
 * Restaura el valor previo al desmontar o cerrar.
 *
 * @param {boolean} isLocked — true cuando el modal está visible
 */
export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow || 'unset'
    }
  }, [isLocked])
}
