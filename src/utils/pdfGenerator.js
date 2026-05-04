// ====================================================================
// PDF Report Generator — PAE Inventory System
// ====================================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabaseClient'

// ─── Constantes de diseño ────────────────────────────────────────────
const COLORS = {
  headerBg:      [255, 237, 213],  // #ffedd5 — Peach claro (tabla)
  headerText:    [154, 52, 18],    // #9a3412 — Peach oscuro (tabla)
  altRowBg:      [255, 247, 237],  // #fff7ed — Peach muy claro (filas alternas)
  textDark:      [51, 51, 51],     // #333333 — Texto oscuro moderno
  schoolName:    [34, 34, 34],     // #222222 — Nombre institución
  schoolDetail:  [85, 85, 85],     // #555555 — RIF / DEA
  schoolAddress: [119, 119, 119],  // #777777 — Dirección
  titleText:     [17, 17, 17],     // #111111 — Título del reporte
  titleBg:       [255, 237, 213],  // #ffedd5 — Fondo badge = mismo que headerBg (Peach claro)
  footerText:    [102, 102, 102],  // #666666 — Pie de página
  textMuted:     [120, 113, 108],  // #78716c — Textos secundarios varios
  lineSeparator: [200, 200, 200],  // #c8c8c8 — Separadores
}

const FONT_SIZES = {
  republic:     9,
  ministry:     8,
  schoolName:   14,
  schoolDetail: 10,
  schoolAddr:   9,
  reportTitle:  12,
  tableBody:    8,
  tableHeader:  8.5,
  footer:       8,
}

const MARGINS = { top: 15, right: 15, bottom: 20, left: 15 }

// ─── loadCustomFonts ─────────────────────────────────────────────────
// Placeholder para fuentes personalizadas.
// ─────────────────────────────────────────────────────────────────────
function loadCustomFonts(doc) {
  // Reserved for future custom font injection
}

// ─── fetchInstitutionalData ──────────────────────────────────────────
async function fetchInstitutionalData() {
  try {
    const { data, error } = await supabase
      .from('institucion')
      .select('nombre, rif, codigo_dea, direccion, director_actual, logo_url, cintillo_url')
      .eq('id', 1)
      .maybeSingle()

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
async function imgToBase64(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') return null

  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) {
      console.warn('[pdfGenerator] No se pudo descargar imagen. Status:', response.status)
      return null
    }

    const blob = await response.blob()

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => {
        console.warn('[pdfGenerator] Error leyendo blob de imagen.')
        resolve(null)
      }
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('[pdfGenerator] Excepción al convertir imagen a Base64:', err.message)
    return null
  }
}

// ─── drawCintillo (interno) ──────────────────────────────────────────
// Dibuja el cintillo panorámico en la parte superior.
// Retorna la coordenada Y donde termina.
// ─────────────────────────────────────────────────────────────────────
function drawCintillo(doc, cintilloBase64) {
  if (!cintilloBase64) return MARGINS.top

  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - MARGINS.left - MARGINS.right
  const cintilloHeight = usableWidth * 0.18

  try {
    doc.addImage(cintilloBase64, 'PNG', MARGINS.left, MARGINS.top - 4, usableWidth, cintilloHeight)
    return MARGINS.top + cintilloHeight + 3
  } catch (err) {
    console.warn('[pdfGenerator] Error al insertar cintillo en PDF:', err.message)
    return MARGINS.top
  }
}

// ─── drawWatermark (interno) ─────────────────────────────────────────
// Dibuja el logo como marca de agua SOBRE la tabla (capa superior).
// Llamar DESPUÉS de que autoTable haya renderizado la página actual.
// ─────────────────────────────────────────────────────────────────────
function drawWatermark(doc, logoBase64) {
  if (!logoBase64) return

  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const wmSize = 90
  const wmX = (pageWidth  - wmSize) / 2
  const wmY = (pageHeight - wmSize) / 2

  try {
    const gState = new doc.GState({ opacity: 0.12 })
    doc.saveGraphicsState()
    doc.setGState(gState)
    doc.addImage(logoBase64, 'PNG', wmX, wmY, wmSize, wmSize)
    doc.restoreGraphicsState()
  } catch (err) {
    console.warn('[pdfGenerator] Error al insertar marca de agua:', err.message)
  }
}

// ─── drawLetterhead (interno) ────────────────────────────────────────
// Modo A — CON cintillo:
//   Dibuja el cintillo panorámico y luego solo:
//     Nombre (14pt bold #222) → RIF/DEA (10pt normal #555) → Dirección (9pt italic #777)
//   (Omite República y Ministerio pues el cintillo ya los contiene visualmente)
//
// Modo B — SIN cintillo:
//   Logo esquina izquierda (si existe) + bloque formal completo:
//     República → Ministerio → Nombre → RIF/DEA → Dirección
//
// Línea separadora gris clara al final.
// Retorna la coordenada Y donde comienza el contenido.
// ─────────────────────────────────────────────────────────────────────
function drawLetterhead(doc, institucional, logoBase64, cintilloBase64) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let currentY

  if (cintilloBase64) {
    // ── MODO A: con cintillo ──────────────────────────────────────────
    currentY = drawCintillo(doc, cintilloBase64)

    // Nombre institución — protagonista
    if (institucional?.nombre) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(FONT_SIZES.schoolName)
      doc.setTextColor(...COLORS.schoolName)
      doc.text(institucional.nombre.toUpperCase(), pageWidth / 2, currentY, { align: 'center' })
      currentY += 6
    }

    // RIF y Código DEA
    const legalParts = []
    if (institucional?.rif && institucional.rif !== 'J-00000000-0') {
      legalParts.push(`RIF: ${institucional.rif}`)
    }
    if (institucional?.codigo_dea && institucional.codigo_dea !== 'CÓDIGO-DEA') {
      legalParts.push(`Código DEA: ${institucional.codigo_dea}`)
    }

    if (legalParts.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(FONT_SIZES.schoolDetail)
      doc.setTextColor(...COLORS.schoolDetail)
      doc.text(legalParts.join('  \u2022  '), pageWidth / 2, currentY, { align: 'center' })
      currentY += 5
    }

    // Dirección
    if (institucional?.direccion && institucional.direccion.trim() !== '') {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(FONT_SIZES.schoolAddr)
      doc.setTextColor(...COLORS.schoolAddress)
      const maxW = pageWidth - MARGINS.left - MARGINS.right
      const lines = doc.splitTextToSize(institucional.direccion, maxW)
      lines.forEach((line) => {
        doc.text(line, pageWidth / 2, currentY, { align: 'center' })
        currentY += 3.5
      })
    }

  } else {
    // ── MODO B: sin cintillo — bloque formal completo ─────────────────
    currentY = MARGINS.top

    // Logo en esquina izquierda
    const logoWidth  = 22
    const logoHeight = 22
    let textStartX  = MARGINS.left
    let textCenterX = pageWidth / 2

    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', MARGINS.left, currentY - 2, logoWidth, logoHeight)
        textStartX  = MARGINS.left + logoWidth + 6
        textCenterX = textStartX + (pageWidth - textStartX - MARGINS.right) / 2
      } catch (err) {
        console.warn('[pdfGenerator] Error al insertar logo en PDF:', err.message)
      }
    }

    // República
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_SIZES.republic)
    doc.setTextColor(...COLORS.textDark)
    doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', textCenterX, currentY, { align: 'center' })
    currentY += 5

    // Ministerio
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT_SIZES.ministry)
    doc.text('MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN', textCenterX, currentY, { align: 'center' })
    currentY += 6

    // Nombre institución
    if (institucional?.nombre) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(FONT_SIZES.schoolName)
      doc.setTextColor(...COLORS.schoolName)
      doc.text(institucional.nombre.toUpperCase(), textCenterX, currentY, { align: 'center' })
      currentY += 6
    }

    // RIF y Código DEA
    const legalParts = []
    if (institucional?.rif && institucional.rif !== 'J-00000000-0') {
      legalParts.push(`RIF: ${institucional.rif}`)
    }
    if (institucional?.codigo_dea && institucional.codigo_dea !== 'CÓDIGO-DEA') {
      legalParts.push(`Código DEA: ${institucional.codigo_dea}`)
    }

    if (legalParts.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(FONT_SIZES.schoolDetail)
      doc.setTextColor(...COLORS.schoolDetail)
      doc.text(legalParts.join('  \u2022  '), textCenterX, currentY, { align: 'center' })
      currentY += 5
    }

    // Dirección
    if (institucional?.direccion && institucional.direccion.trim() !== '') {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(FONT_SIZES.schoolAddr)
      doc.setTextColor(...COLORS.schoolAddress)
      const maxW = pageWidth - textStartX - MARGINS.right
      const lines = doc.splitTextToSize(institucional.direccion, maxW)
      lines.forEach((line) => {
        doc.text(line, textCenterX, currentY, { align: 'center' })
        currentY += 3.5
      })
    }
  }

  // ── Línea separadora gris clara (ambos modos) ─────────────────────
  currentY += 3
  doc.setDrawColor(...COLORS.lineSeparator)
  doc.setLineWidth(0.4)
  doc.line(MARGINS.left, currentY, pageWidth - MARGINS.right, currentY)
  currentY += 5

  return currentY
}

// ─── drawTitleBadge (interno) ────────────────────────────────────────
// Dibuja el título del reporte dentro de un rectángulo "badge"
// con fondo gris muy tenue (#f5f5f5) y texto centrado 12pt bold.
// Retorna la coordenada Y donde termina el badge.
// ─────────────────────────────────────────────────────────────────────
function drawTitleBadge(doc, title, startY) {
  const pageWidth   = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - MARGINS.left - MARGINS.right
  const badgeH      = 10  // altura del rectángulo
  const badgeY      = startY + 2

  // Fondo del badge
  doc.setFillColor(...COLORS.titleBg)
  doc.roundedRect(MARGINS.left, badgeY, usableWidth, badgeH, 2, 2, 'F')

  // Texto del título centrado dentro del badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT_SIZES.reportTitle)
  doc.setTextColor(...COLORS.titleText)
  doc.text(title.toUpperCase(), pageWidth / 2, badgeY + 6.5, { align: 'center' })

  return badgeY + badgeH + 5
}

// ─── drawFooter (interno) ────────────────────────────────────────────
// Pie de página en cada hoja:
//   - Izquierda: "Reporte emitido por: [userName]  |  [Fecha y Hora]"
//   - Derecha:   "https://github.com/dau-in/pae-inventory-system  |  Página X de Y"
// ─────────────────────────────────────────────────────────────────────
function drawFooter(doc, userName) {
  const pageCount  = doc.internal.getNumberOfPages()
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const now     = new Date()
  const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    const footerLineY = pageHeight - MARGINS.bottom + 2
    doc.setDrawColor(...COLORS.lineSeparator)
    doc.setLineWidth(0.3)
    doc.line(MARGINS.left, footerLineY, pageWidth - MARGINS.right, footerLineY)

    const footerY = pageHeight - MARGINS.bottom + 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(FONT_SIZES.footer)
    doc.setTextColor(...COLORS.footerText)

    const userLabel = userName ? `Reporte emitido por: ${userName}` : 'Reporte emitido por el sistema'
    doc.text(`${userLabel}  \u2022  ${dateStr} ${timeStr}`, MARGINS.left, footerY)

    doc.text(
      `https://github.com/dau-in/pae-inventory-system  \u2022  Página ${i} de ${pageCount}`,
      pageWidth - MARGINS.right,
      footerY,
      { align: 'right' }
    )
  }
}

// ─── exportPDF ───────────────────────────────────────────────────────
// Función principal exportada.
// ─────────────────────────────────────────────────────────────────────
export async function exportPDF({ title, columns, data, filename, userName }) {
  // 1. Cargar datos institucionales
  const institucional = await fetchInstitutionalData()
  if (!institucional) {
    throw new Error('DATOS_INSTITUCION_FALTANTES')
  }

  // 2. Convertir imágenes a Base64 en paralelo (manejo CORS)
  const [logoBase64, cintilloBase64] = await Promise.all([
    imgToBase64(institucional?.logo_url    || ''),
    imgToBase64(institucional?.cintillo_url || ''),
  ])

  // 3. Crear documento PDF (A4 vertical)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // 4. Cargar fuentes personalizadas (placeholder para Roboto)
  loadCustomFonts(doc)

  // 5. Membrete (lógica condicional con/sin cintillo)
  let startY = drawLetterhead(doc, institucional, logoBase64, cintilloBase64)

  // 6. Título del reporte con efecto badge
  startY = drawTitleBadge(doc, title, startY)

  // 7. Tabla de datos con autoTable
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
    didDrawPage: (hookData) => {
      if (hookData.pageNumber > 1) {
        drawLetterhead(doc, institucional, logoBase64, cintilloBase64)
      }
    },
  })

  // 8. Disclaimer legal (debajo de la tabla)
  const disclaimerBody = 'El presente reporte es de carácter exclusivamente informativo y ha sido generado por el sistema de apoyo administrativo PAE Inventory System. Este documento carece de validez legal y no sustituye, en ningún caso, las obligaciones de declaración ante las plataformas oficiales de SUNAGRO, SISECAL o el ecosistema digital del CNAE. La integridad y el uso de estos datos son responsabilidad única del receptor.'
  const finalY = doc.lastAutoTable.finalY || 200
  const pageWidth2 = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const disclaimerMaxW = pageWidth2 - MARGINS.left - MARGINS.right
  let disclaimerY = finalY + 15

  // Si no cabe en la página actual, saltar a una nueva
  if (disclaimerY + 25 > pageHeight - MARGINS.bottom) {
    doc.addPage()
    disclaimerY = MARGINS.top
  }

  // Parte A: Título en bold #444444
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(68, 68, 68)  // #444444
  doc.text('DESCARGO DE RESPONSABILIDAD', pageWidth2 / 2, disclaimerY, { align: 'center' })
  disclaimerY += 5

  // Parte B: Cuerpo en italic #777777
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLORS.schoolAddress)  // #777777
  const disclaimerLines = doc.splitTextToSize(disclaimerBody, disclaimerMaxW)
  disclaimerLines.forEach((line) => {
    doc.text(line, pageWidth2 / 2, disclaimerY, { align: 'center' })
    disclaimerY += 3.5
  })

  // 9. Marca de agua — dibujada DESPUÉS de la tabla para flotar sobre ella
  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawWatermark(doc, logoBase64)
  }

  // 9. Pie de página (todas las páginas)
  drawFooter(doc, userName)

  // 10. Previsualizar en nueva pestaña
  const pdfUrl = doc.output('bloburl')
  window.open(pdfUrl, '_blank')
}
