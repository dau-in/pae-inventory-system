// ====================================================================
// PDF Report Generator — PAE Inventory System
// ====================================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'

// ─── Constantes de diseño ────────────────────────────────────────────
const COLORS = {
  headerBg: [255, 237, 213],    // #ffedd5 — Peach claro
  headerText: [154, 52, 18],    // #9a3412 — Peach oscuro
  altRowBg: [255, 247, 237],    // #fff7ed — Peach muy claro (filas alternas)
  textDark: [41, 37, 36],       // #292524 — Casi negro
  textMuted: [120, 113, 108],   // #78716c — Gris cálido
  lineAccent: [251, 146, 60],   // #fb923c — Naranja peach para líneas
}

const FONT_SIZES = {
  republic: 9,
  ministry: 8,
  schoolName: 10,
  schoolDetails: 7.5,
  reportTitle: 13,
  tableBody: 8,
  tableHeader: 8.5,
  footer: 7,
}

const MARGINS = { top: 15, right: 15, bottom: 20, left: 15 }

// ─── fetchInstitutionalData ──────────────────────────────────────────
// Obtiene la fila única (id=1) de la tabla `institucion`.
// Retorna el objeto con { nombre, rif, codigo_dea, direccion, logo_url }
// o null si no existe / hay error de red.
// ─────────────────────────────────────────────────────────────────────
async function fetchInstitutionalData() {
  try {
    const { data, error } = await supabase
      .from('institucion')
      .select('nombre, rif, codigo_dea, direccion, director_actual, logo_url')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('[pdfGenerator] Error al obtener datos institucionales:', error.message)
      return null
    }

    return data
  } catch (err) {
    console.error('[pdfGenerator] Excepción al consultar institucion:', err)
    return null
  }
}

// ─── imgToBase64 ─────────────────────────────────────────────────────
// Convierte una URL de imagen (logo_url de Supabase Storage) a una
// cadena Base64 apta para jsPDF.addImage().
// Si la URL es nula o la carga falla, retorna null silenciosamente
// para que el PDF se genere solo con texto sin colapsar.
// ─────────────────────────────────────────────────────────────────────
async function imgToBase64(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null
  }

  try {
    const response = await fetch(url, { mode: 'cors' })

    if (!response.ok) {
      console.warn('[pdfGenerator] No se pudo descargar el logo. Status:', response.status)
      return null
    }

    const blob = await response.blob()

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => {
        console.warn('[pdfGenerator] Error leyendo blob del logo.')
        resolve(null)
      }
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('[pdfGenerator] Excepción al convertir logo a Base64:', err.message)
    return null
  }
}

// ─── drawLetterhead (interno) ────────────────────────────────────────
// Renderiza el membrete oficial en la parte superior del PDF:
//   - Logo institucional (si existe) a la izquierda
//   - Jerarquía textual: República → Ministerio → Plantel → RIF/DEA → Dirección
// Retorna la coordenada Y donde termina el membrete para continuar
// dibujando el contenido del reporte debajo.
// ─────────────────────────────────────────────────────────────────────
function drawLetterhead(doc, institucional, logoBase64) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let currentY = MARGINS.top

  // — Logo institucional (columna izquierda) —
  const logoWidth = 22
  const logoHeight = 22
  let textStartX = MARGINS.left
  let textCenterX = pageWidth / 2

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', MARGINS.left, currentY - 2, logoWidth, logoHeight)
      // Desplazar texto para que no se superponga al logo
      textStartX = MARGINS.left + logoWidth + 6
      textCenterX = textStartX + (pageWidth - textStartX - MARGINS.right) / 2
    } catch (err) {
      console.warn('[pdfGenerator] Error al insertar logo en PDF:', err.message)
      // Continuar sin logo
    }
  }

  // — Línea 1: REPÚBLICA BOLIVARIANA DE VENEZUELA —
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT_SIZES.republic)
  doc.setTextColor(...COLORS.textDark)
  doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', textCenterX, currentY, { align: 'center' })
  currentY += 5

  // — Línea 2: MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN —
  doc.setFontSize(FONT_SIZES.ministry)
  doc.text('MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN', textCenterX, currentY, { align: 'center' })
  currentY += 6

  // — Línea 3: Nombre del plantel (dato dinámico) —
  if (institucional?.nombre) {
    doc.setFontSize(FONT_SIZES.schoolName)
    doc.setFont('helvetica', 'bold')
    doc.text(institucional.nombre.toUpperCase(), textCenterX, currentY, { align: 'center' })
    currentY += 5
  }

  // — Línea 4: RIF y Código DEA (solo si existen en la BD, sin placeholders) —
  const legalParts = []
  if (institucional?.rif && institucional.rif !== 'J-00000000-0') {
    legalParts.push(`RIF: ${institucional.rif}`)
  }
  if (institucional?.codigo_dea && institucional.codigo_dea !== 'CÓDIGO-DEA') {
    legalParts.push(`Código DEA: ${institucional.codigo_dea}`)
  }

  if (legalParts.length > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT_SIZES.schoolDetails)
    doc.setTextColor(...COLORS.textMuted)
    doc.text(legalParts.join('   |   '), textCenterX, currentY, { align: 'center' })
    currentY += 4
  }

  // — Línea 5: Dirección (solo si existe) —
  if (institucional?.direccion && institucional.direccion.trim() !== '') {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(FONT_SIZES.schoolDetails)
    doc.setTextColor(...COLORS.textMuted)

    // Dividir dirección larga en líneas para evitar desbordamiento
    const maxLineWidth = pageWidth - textStartX - MARGINS.right
    const addressLines = doc.splitTextToSize(institucional.direccion, maxLineWidth)
    addressLines.forEach((line) => {
      doc.text(line, textCenterX, currentY, { align: 'center' })
      currentY += 3.5
    })
  }

  // — Línea separadora decorativa (acento Peach) —
  currentY += 2
  doc.setDrawColor(...COLORS.lineAccent)
  doc.setLineWidth(0.6)
  doc.line(MARGINS.left, currentY, pageWidth - MARGINS.right, currentY)
  currentY += 4

  return currentY
}

// ─── drawFooter (interno) ────────────────────────────────────────────
// Dibuja el pie de página en cada hoja del documento:
//   - Izquierda: "Generado por: [userName] | [Fecha y Hora]"
//   - Derecha:   "Página X de Y"
// ─────────────────────────────────────────────────────────────────────
function drawFooter(doc, userName) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // Línea separadora del pie
    const footerLineY = pageHeight - MARGINS.bottom + 2
    doc.setDrawColor(...COLORS.lineAccent)
    doc.setLineWidth(0.3)
    doc.line(MARGINS.left, footerLineY, pageWidth - MARGINS.right, footerLineY)

    // Texto del pie
    const footerY = pageHeight - MARGINS.bottom + 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT_SIZES.footer)
    doc.setTextColor(...COLORS.textMuted)

    // Lado izquierdo: usuario y fecha
    const userLabel = userName ? `Generado por: ${userName}` : 'Generado por el sistema'
    doc.text(`${userLabel}  |  ${dateStr} ${timeStr}`, MARGINS.left, footerY)

    // Lado derecho: paginación
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - MARGINS.right, footerY, { align: 'right' })
  }
}

// ─── exportPDF ───────────────────────────────────────────────────────
// Función principal exportada. Genera y descarga un PDF con:
//   - Membrete oficial del PAE Venezuela
//   - Tabla de datos con estilo Peach
//   - Pie de página con auditoría
//
// Parámetros:
//   @param {string}   title    — Título del reporte (ej. "Inventario General")
//   @param {Array}    columns  — Definición de columnas para autoTable
//                                 [{header: 'Nombre', dataKey: 'name'}, ...]
//   @param {Array}    data     — Array de objetos con los datos a tabular
//   @param {string}   filename — Nombre del archivo descargado (sin extensión)
//   @param {string}   userName — Nombre del usuario que genera el reporte
// ─────────────────────────────────────────────────────────────────────
export async function exportPDF({ title, columns, data, filename, userName }) {
  // 1. Cargar datos institucionales y logo
  const institucional = await fetchInstitutionalData()

  // Solo intentar convertir el logo si existe una URL válida (no vacía ni placeholder)
  const rawLogoUrl = institucional?.logo_url || ''
  const hasValidLogo = typeof rawLogoUrl === 'string' && rawLogoUrl.trim() !== ''
  const logoBase64 = hasValidLogo ? await imgToBase64(rawLogoUrl) : null

  // 2. Crear documento PDF (A4 vertical)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // 3. Membrete oficial (retorna Y de inicio para contenido)
  let startY = drawLetterhead(doc, institucional, logoBase64)

  // 4. Título del reporte
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT_SIZES.reportTitle)
  doc.setTextColor(...COLORS.headerText)
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.text(title.toUpperCase(), pageWidth / 2, startY, { align: 'center' })
  startY += 8

  // 5. Tabla de datos con autoTable
  autoTable(doc, {
    startY,
    head: [columns.map((col) => col.header)],
    body: data.map((row) => columns.map((col) => row[col.dataKey] ?? '')),
    margin: { top: 45, left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: FONT_SIZES.tableBody,
      textColor: COLORS.textDark,
      cellPadding: 2.5,
      lineColor: [230, 225, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.headerText,
      fontStyle: 'bold',
      fontSize: FONT_SIZES.tableHeader,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: COLORS.altRowBg,
    },
    // Repetir membrete en páginas adicionales
    didDrawPage: (hookData) => {
      // Solo redibujar membrete en páginas después de la primera
      if (hookData.pageNumber > 1) {
        drawLetterhead(doc, institucional, logoBase64)
      }
    },
  })

  // 6. Pie de página (se aplica a todas las páginas)
  drawFooter(doc, userName)

  // 7. Previsualizar en nueva pestaña
  const pdfUrl = doc.output('bloburl')
  window.open(pdfUrl, '_blank')
}
