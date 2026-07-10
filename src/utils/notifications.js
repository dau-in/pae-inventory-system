import Swal from 'sweetalert2'

// Traduce errores crudos de red ("Failed to fetch" y variantes según el
// navegador) a un mensaje claro, acorde al monitoreo de conexión del sistema.
// Cualquier otro texto pasa intacto.
const humanizeNetworkError = (text) => {
  if (typeof text === 'string' && /failed to fetch|networkerror|network request failed|load failed/i.test(text)) {
    return 'Sin conexión con el servidor. La operación no se guardó — verifique su conexión e intente de nuevo.'
  }
  return text
}

export const notifySuccess = (title, text) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonColor: '#FFD9A8'
  })
}

export const notifyError = (title, text) => {
  return Swal.fire({
    icon: 'error',
    title,
    text: humanizeNetworkError(text),
    confirmButtonColor: '#ef4444'
  })
}

export const notifyWarning = (title, text) => {
  return Swal.fire({
    icon: 'warning',
    title,
    text,
    confirmButtonColor: '#f59e0b'
  })
}

export const notifyInfo = (title, html) => {
  return Swal.fire({
    icon: 'info',
    title,
    html,
    confirmButtonColor: '#FFD9A8'
  })
}

export const confirmAction = async (title, text, confirmText = 'Confirmar') => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonColor: '#FFD9A8',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar'
  })
  return result.isConfirmed
}

export const confirmDanger = async (title, text, confirmText = 'Eliminar') => {
  const result = await Swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar'
  })
  return result.isConfirmed
}
