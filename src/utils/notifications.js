import Swal from 'sweetalert2'

export const notifySuccess = (title, text) => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonColor: '#10b981'
  })
}

export const notifyError = (title, text) => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
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
    confirmButtonColor: '#3b82f6'
  })
}

export const confirmAction = async (title, text, confirmText = 'Confirmar') => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonColor: '#10b981',
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
