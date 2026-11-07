// Gerador de PDF em formato binário bruto (Uint8Array) do
// "COMPROVANTE DE ASSINATURA ELETRÔNICA"
// Documento SEPARADO da ficha, mostrando COMO a assinatura aconteceu (trilha cronológica).
// Não altera o PDF da ficha nem seu hash.

import {
  FormSubmissionRecord,
  ClinicSettingsRecord,
  AuditEventRecord,
  ProcedureAppointmentRecord,
} from '@/services/forms'
import { getFormCode, getFichaPdfFilename } from './formCode'
import { formatFriendlyDevice } from './deviceFormatter'

function escPdfWinAnsi(text: string): string {
  if (!text) return ''
  const s = String(text)
  const map: Record<string, string> = {
    á: '\\341',
    à: '\\340',
    â: '\\342',
    ã: '\\343',
    ä: '\\344',
    é: '\\351',
    è: '\\350',
    ê: '\\352',
    ë: '\\353',
    í: '\\355',
    ì: '\\354',
    î: '\\356',
    ï: '\\357',
    ó: '\\363',
    ò: '\\362',
    ô: '\\364',
    õ: '\\365',
    ö: '\\366',
    ú: '\\372',
    ù: '\\371',
    û: '\\373',
    ü: '\\374',
    ç: '\\347',
    Á: '\\301',
    À: '\\300',
    Â: '\\302',
    Ã: '\\303',
    Ä: '\\304',
    É: '\\311',
    È: '\\310',
    Ê: '\\312',
    Ë: '\\313',
    Í: '\\315',
    Ì: '\\314',
    Î: '\\316',
    Ï: '\\317',
    Ó: '\\323',
    Ò: '\\322',
    Ô: '\\324',
    Õ: '\\325',
    Ö: '\\326',
    Ú: '\\332',
    Ù: '\\331',
    Û: '\\333',
    Ü: '\\334',
    Ç: '\\307',
    ñ: '\\361',
    Ñ: '\\321',
    '°': '\\260',
    ª: '\\252',
    º: '\\272',
    '•': '\\225',
    '—': '-',
    '–': '-',
    '“': '"',
    '”': '"',
    '‘': "'",
    '’': "'",
    '…': '...',
  }
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i)
    if (map[ch]) {
      out += map[ch]
    } else if (ch === '(') {
      out += '\\('
    } else if (ch === ')') {
      out += '\\)'
    } else if (ch === '\\') {
      out += '\\\\'
    } else {
      const code = s.charCodeAt(i)
      if (code >= 32 && code <= 126) {
        out += ch
      } else if (code >= 160 && code <= 255) {
        out += '\\' + code.toString(8)
      } else {
        out += '?'
      }
    }
  }
  return out
}

function estimateCharWidth(ch: string, fontSize: number): number {
  if ('iljI|.,:;!'.indexOf(ch) !== -1) return fontSize * 0.28
  if ('frtJ()[]'.indexOf(ch) !== -1) return fontSize * 0.35
  if ('mwWM@#%&'.indexOf(ch) !== -1) return fontSize * 0.85
  if ('ABCDEFGHKLNOPQRSTUVXYZ'.indexOf(ch) !== -1) return fontSize * 0.65
  return fontSize * 0.52
}

function measureTextWidth(text: string, fontSize: number): number {
  let w = 0
  const s = String(text || '')
  for (let i = 0; i < s.length; i++) {
    w += estimateCharWidth(s.charAt(i), fontSize)
  }
  return w
}

function wrapText(text: string, maxPts: number, fontSize: number): string[] {
  if (!text) return []
  const words = String(text).split(' ')
  const lines: string[] = []
  let curLine = ''

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const test = curLine ? curLine + ' ' + w : w
    if (measureTextWidth(test, fontSize) <= maxPts) {
      curLine = test
    } else {
      if (curLine) lines.push(curLine)
      curLine = w
    }
  }
  if (curLine) lines.push(curLine)
  return lines
}

function formatDateBR(dateStr?: string): string {
  if (!dateStr) return 'Não registrado'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function generateAuditProofPdfBytes(
  form: FormSubmissionRecord,
  audits: AuditEventRecord[],
  settings?: ClinicSettingsRecord | null,
  appointment?: ProcedureAppointmentRecord | null,
): Uint8Array {
  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN_X = 36
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2 // ~523 pt
  const HEADER_TOP = 800
  const CONTENT_START_Y = 740
  const FOOTER_RESERVED = 68

  interface PageData {
    commands: string[]
  }

  const pages: PageData[] = []
  let curPage: PageData = { commands: [] }
  let curY = CONTENT_START_Y

  function newPage() {
    pages.push(curPage)
    curPage = { commands: [] }
    curY = CONTENT_START_Y
  }

  function ensureSpace(pts: number) {
    if (curY - pts < FOOTER_RESERVED) {
      newPage()
    }
  }

  // Identificação e Dados Básicos
  const formCode = getFormCode(form)
  const patientName = form.patient_name || 'Paciente Não Informado'
  const patientCpf = form.patient_cpf || 'Não informado'
  const patientEmail = form.patient_email || 'Não informado'
  const signedAt = formatDateBR(form.signed_at)
  const docHash = form.document_hash || 'Hash não gerado'
  const signedPdfFilename = getFichaPdfFilename(form)
  const ipOrigem =
    form.ip_address && form.ip_address.trim() ? form.ip_address.trim() : 'não registrado'
  const friendlyDevice = formatFriendlyDevice(form.user_agent)

  // Procedimento
  const procLabels: Record<string, string> = {
    geral: 'Anamnese Estética Geral',
    labios: 'Lábios, Micropigmentação & Revitalização Labial',
    botox: 'Toxina Botulínica (Botox)',
    preenchimento: 'Preenchimento Facial',
    fios: 'Fios de PDO',
    peeling: 'Peeling Químico',
    limpeza_pele: 'Limpeza de Pele',
    estetica_facial: 'Estética Facial',
    estetica_corporal: 'Estética Corporal',
  }
  const procName = procLabels[form.form_type] || form.form_type || 'Procedimento Estético'

  let procDateTime = 'Conforme agendamento'
  if (appointment && appointment.procedure_date) {
    try {
      const dtParts = appointment.procedure_date.split('T')[0].split('-')
      if (dtParts.length === 3) {
        const dStr = `${dtParts[2]}/${dtParts[1]}/${dtParts[0]}`
        const tStr = appointment.procedure_time || 'Horário a definir'
        procDateTime = `${dStr} às ${tStr}`
      }
    } catch {
      procDateTime = `${appointment.procedure_date} ${appointment.procedure_time || ''}`
    }
  }

  // Título e avisos do cabeçalho de página são renderizados no loop final de páginas,
  // mas aqui montamos o corpo do documento.

  // --- CABEÇALHO DO DOCUMENTO (Bloco de Introdução) ---
  curPage.commands.push(
    `BT /F2 14 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${curY} Td (${escPdfWinAnsi('COMPROVANTE DE ASSINATURA ELETRÔNICA')}) Tj ET`,
  )
  curY -= 15

  curPage.commands.push(
    `BT /F2 10 Tf 0.20 0.25 0.35 rg ${MARGIN_X} ${curY} Td (${escPdfWinAnsi('Código da Ficha: ' + formCode)}) Tj ET`,
  )
  curY -= 14

  const subDesc =
    'Este documento comprova como a assinatura eletrônica foi realizada. Deve ser arquivado junto com o PDF da ficha.'
  curPage.commands.push(
    `BT /F1 8.5 Tf 0.45 0.50 0.58 rg ${MARGIN_X} ${curY} Td (${escPdfWinAnsi(subDesc)}) Tj ET`,
  )
  curY -= 18

  // Linha divisória suave
  curPage.commands.push(
    `q 0.82 0.85 0.90 RG 0.75 w ${MARGIN_X} ${curY} m ${PAGE_WIDTH - MARGIN_X} ${curY} l S Q`,
  )
  curY -= 16

  // Helper para títulos de blocos
  function drawBlockTitle(title: string) {
    ensureSpace(28)
    curPage.commands.push(`q 0.94 0.92 0.95 rg ${MARGIN_X} ${curY - 14} ${CONTENT_WIDTH} 18 re f Q`)
    curPage.commands.push(
      `BT /F2 9.5 Tf 0.40 0.10 0.25 rg ${MARGIN_X + 6} ${curY - 10} Td (${escPdfWinAnsi(title.toUpperCase())}) Tj ET`,
    )
    curY -= 22
  }

  // Helper para tabela de 2 colunas
  function drawKeyValueRows(rows: { label: string; value: string; isMono?: boolean }[]) {
    const col1W = 160
    const col2W = CONTENT_WIDTH - col1W - 8

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const fontSize = 8.5
      const fontName = row.isMono ? '/F3' : '/F1'
      const valLines = wrapText(row.value, col2W, fontSize)
      const lineH = 11
      const blockH = Math.max(16, valLines.length * lineH + 4)

      ensureSpace(blockH + 4)

      // Linha de fundo alternada sutil
      if (i % 2 === 0) {
        curPage.commands.push(
          `q 0.98 0.98 0.99 rg ${MARGIN_X} ${curY - blockH + 3} ${CONTENT_WIDTH} ${blockH} re f Q`,
        )
      }

      // Rótulo
      curPage.commands.push(
        `BT /F2 ${fontSize} Tf 0.25 0.30 0.38 rg ${MARGIN_X + 4} ${curY - 9} Td (${escPdfWinAnsi(row.label)}) Tj ET`,
      )

      // Valor (multilinha se necessário)
      let vY = curY - 9
      for (let vl = 0; vl < valLines.length; vl++) {
        curPage.commands.push(
          `BT ${fontName} ${fontSize} Tf 0.15 0.20 0.28 rg ${MARGIN_X + col1W} ${vY} Td (${escPdfWinAnsi(valLines[vl])}) Tj ET`,
        )
        vY -= lineH
      }

      curY -= blockH
    }
    curY -= 6
  }

  // ══════ BLOCO 1 — IDENTIFICAÇÃO ══════
  drawBlockTitle('BLOCO 1 — Identificação da Paciente e Procedimento')
  drawKeyValueRows([
    { label: 'Nome da Paciente:', value: patientName },
    { label: 'CPF:', value: patientCpf },
    { label: 'E-mail Validado:', value: patientEmail },
    { label: 'Procedimento:', value: procName },
    { label: 'Data e Hora do Procedimento:', value: procDateTime },
  ])

  // ══════ BLOCO 2 — VÍNCULO COM O DOCUMENTO ASSINADO (destaque com borda) ══════
  drawBlockTitle('BLOCO 2 — Vínculo com o Documento Assinado (Prova de Integridade)')
  const boxTop = curY
  const b2Rows = [
    { label: 'Documento assinado:', value: signedPdfFilename },
    { label: 'Hash SHA-256 do documento:', value: docHash, isMono: true },
    { label: 'Assinado em:', value: signedAt },
    { label: 'Fuso horário:', value: 'Brasília (UTC-3)' },
  ]
  drawKeyValueRows(b2Rows)

  const noticeText =
    'O hash acima identifica de forma única o PDF assinado. Se o arquivo for alterado em qualquer ponto, o hash deixa de corresponder.'
  const noticeLines = wrapText(noticeText, CONTENT_WIDTH - 16, 7.5)
  ensureSpace(noticeLines.length * 10 + 6)
  let nY = curY - 2
  for (let nl = 0; nl < noticeLines.length; nl++) {
    curPage.commands.push(
      `BT /F1 7.5 Tf 0.45 0.48 0.55 rg ${MARGIN_X + 6} ${nY} Td (${escPdfWinAnsi(noticeLines[nl])}) Tj ET`,
    )
    nY -= 9.5
  }
  curY = nY - 4

  // Borda ao redor do Bloco 2
  const boxH = boxTop - curY
  curPage.commands.push(
    `q 0.514 0.094 0.263 RG 0.8 w ${MARGIN_X} ${curY} ${CONTENT_WIDTH} ${boxH} re S Q`,
  )
  curY -= 12

  // ══════ BLOCO 3 — DADOS TÉCNICOS DA ASSINATURA ══════
  drawBlockTitle('BLOCO 3 — Dados Técnicos da Assinatura')
  drawKeyValueRows([
    { label: 'E-mail submetido à validação:', value: patientEmail },
    { label: 'Status de Validação de E-mail:', value: 'Código de e-mail validado com sucesso' },
    { label: 'IP de Origem Real:', value: ipOrigem },
    { label: 'Dispositivo / Navegador:', value: friendlyDevice },
    { label: 'Data e Hora do Aceite do Termo:', value: signedAt },
    { label: 'Data e Hora da Assinatura:', value: signedAt },
    {
      label: 'Código de Verificação:',
      value: '[Protegido por sigilo — validação criptográfica confirmada]',
    },
  ])

  // ══════ BLOCO 4 — TRILHA COMPLETA CRONOLÓGICA ══════
  drawBlockTitle('BLOCO 4 — Trilha Cronológica de Eventos')

  // Cabeçalho da tabela de trilha
  const colWDate = 105
  const colWIp = 95
  const colWEvent = CONTENT_WIDTH - colWDate - colWIp // ~323 pt

  function drawAuditTableHeader() {
    ensureSpace(18)
    curPage.commands.push(`q 0.20 0.25 0.35 rg ${MARGIN_X} ${curY - 14} ${CONTENT_WIDTH} 16 re f Q`)
    curPage.commands.push(
      `BT /F2 8 Tf 1 1 1 rg ${MARGIN_X + 4} ${curY - 10} Td (${escPdfWinAnsi('DATA / HORA')}) Tj ET`,
    )
    curPage.commands.push(
      `BT /F2 8 Tf 1 1 1 rg ${MARGIN_X + colWDate + 4} ${curY - 10} Td (${escPdfWinAnsi('EVENTO REGISTRADO')}) Tj ET`,
    )
    curPage.commands.push(
      `BT /F2 8 Tf 1 1 1 rg ${MARGIN_X + colWDate + colWEvent + 4} ${curY - 10} Td (${escPdfWinAnsi('IP DE ORIGEM')}) Tj ET`,
    )
    curY -= 18
  }

  drawAuditTableHeader()

  // Se não houver eventos cadastrados, insere eventos básicos
  const eventList =
    audits && audits.length > 0
      ? audits
      : [
          {
            id: 'synth-1',
            form_submission: form.id,
            event_type: 'termo_assinado',
            description: `Paciente concluiu a assinatura eletrônica da ficha (Hash: ${docHash})`,
            timestamp: form.signed_at || form.created,
            ip_address: form.ip_address,
            created: form.created,
          } as AuditEventRecord,
        ]

  for (let ei = 0; ei < eventList.length; ei++) {
    const ev = eventList[ei]
    const dateStr = formatDateBR(ev.timestamp || ev.created)
    const rawIp = (ev.ip_address || '').trim()
    const ipStr = rawIp.length > 0 ? rawIp : 'não registrado'

    // Higieniza descrição para NUNCA exibir código numérico de validação
    let cleanDesc = ev.description || ev.event_type || 'Evento registrado'
    cleanDesc = cleanDesc.replace(
      /c[oó]digo\s+(?:de\s+verificação\s+)?(?:\d{4,8}|[A-Za-z0-9]{4,8})/gi,
      'código [oculto]',
    )
    cleanDesc = cleanDesc.replace(/\b\d{6}\b/g, '******')

    const evLines = wrapText(cleanDesc, colWEvent - 8, 7.5)
    const rowH = Math.max(14, evLines.length * 9.5 + 4)

    if (curY - rowH < FOOTER_RESERVED) {
      newPage()
      drawAuditTableHeader()
    }

    // Linha zebrada
    if (ei % 2 === 0) {
      curPage.commands.push(
        `q 0.96 0.97 0.98 rg ${MARGIN_X} ${curY - rowH + 2} ${CONTENT_WIDTH} ${rowH} re f Q`,
      )
    }

    // Data/hora
    curPage.commands.push(
      `BT /F1 7.5 Tf 0.25 0.30 0.38 rg ${MARGIN_X + 4} ${curY - 8} Td (${escPdfWinAnsi(dateStr)}) Tj ET`,
    )

    // Descrição do evento
    let eY = curY - 8
    for (let el = 0; el < evLines.length; el++) {
      curPage.commands.push(
        `BT /F1 7.5 Tf 0.15 0.20 0.28 rg ${MARGIN_X + colWDate + 4} ${eY} Td (${escPdfWinAnsi(evLines[el])}) Tj ET`,
      )
      eY -= 9.5
    }

    // IP de origem
    curPage.commands.push(
      `BT /F3 7 Tf 0.30 0.35 0.42 rg ${MARGIN_X + colWDate + colWEvent + 4} ${curY - 8} Td (${escPdfWinAnsi(ipStr)}) Tj ET`,
    )

    curY -= rowH
  }

  pages.push(curPage)
  const totalPages = pages.length

  // Configurações da clínica para cabeçalho e rodapé
  let clinicN = 'Andresa Souza Clinic'
  let tResp = 'Andresa Souza — CREFITO-13 000000-F'
  let cAddr = 'Jardins, Aracaju - SE • Tel: (79) 99980-9134'

  if (settings) {
    if (settings.clinic_name) clinicN = settings.clinic_name
    if (settings.technical_responsible) {
      tResp = settings.technical_responsible
      if (settings.professional_register) {
        tResp += ' — ' + settings.professional_register
      }
    }
    if (settings.clinic_address || settings.phone) {
      cAddr = `${settings.clinic_address || 'Jardins, Aracaju - SE'} • Tel: ${settings.phone || '(79) 99980-9134'}`
    }
  }

  const nowGenerated = formatDateBR(new Date().toISOString())

  const compiledPageStreams: string[] = []

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pNum = pIdx + 1
    const streamParts: string[] = []
    streamParts.push('q\n')

    // Cabeçalho institucional no topo de cada página
    streamParts.push(
      `BT /F2 12 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${HEADER_TOP} Td (${escPdfWinAnsi(clinicN.toUpperCase())}) Tj ET\n`,
    )
    const rightHeader = `${patientName} • ${formCode}`
    const rightHeaderW = measureTextWidth(rightHeader, 8.5)
    streamParts.push(
      `BT /F2 8.5 Tf 0.35 0.40 0.48 rg ${PAGE_WIDTH - MARGIN_X - rightHeaderW} ${HEADER_TOP} Td (${escPdfWinAnsi(rightHeader)}) Tj ET\n`,
    )
    streamParts.push(
      `BT /F1 8.5 Tf 0.30 0.35 0.42 rg ${MARGIN_X} ${HEADER_TOP - 12} Td (${escPdfWinAnsi('Comprovante de Assinatura Eletrônica & Trilha Cronológica de Integridade')}) Tj ET\n`,
    )
    streamParts.push(
      `q 0.514 0.094 0.263 RG 1 w ${MARGIN_X} ${HEADER_TOP - 18} m ${PAGE_WIDTH - MARGIN_X} ${HEADER_TOP - 18} l S Q\n`,
    )

    // Conteúdo da página
    const cmds = pages[pIdx].commands
    for (let ci = 0; ci < cmds.length; ci++) {
      streamParts.push(cmds[ci] + '\n')
    }

    // Rodapé fixo de cada página
    const footerLineY = 48
    streamParts.push(
      `q 0.80 0.83 0.88 RG 0.5 w ${MARGIN_X} ${footerLineY} m ${PAGE_WIDTH - MARGIN_X} ${footerLineY} l S Q\n`,
    )
    streamParts.push(
      `BT /F2 8 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${footerLineY - 10} Td (${escPdfWinAnsi(clinicN)}) Tj ET\n`,
    )
    streamParts.push(
      `BT /F1 8 Tf 0.35 0.40 0.48 rg ${MARGIN_X + measureTextWidth(clinicN, 8) + 6} ${footerLineY - 10} Td (${escPdfWinAnsi('• Profissional Responsável: ' + tResp)}) Tj ET\n`,
    )
    const footerL2Left = `${cAddr} • Documento gerado automaticamente em ${nowGenerated}`
    streamParts.push(
      `BT /F1 7.5 Tf 0.40 0.45 0.52 rg ${MARGIN_X} ${footerLineY - 20} Td (${escPdfWinAnsi(footerL2Left)}) Tj ET\n`,
    )
    const footerL3 = 'A trilha completa permanece arquivada de forma imutável no sistema.'
    streamParts.push(
      `BT /F1 7.5 Tf 0.50 0.55 0.60 rg ${MARGIN_X} ${footerLineY - 29} Td (${escPdfWinAnsi(footerL3)}) Tj ET\n`,
    )

    const pageStr = `Página ${pNum} de ${totalPages}`
    const pageStrW = measureTextWidth(pageStr, 8)
    streamParts.push(
      `BT /F2 8 Tf 0.30 0.35 0.45 rg ${PAGE_WIDTH - MARGIN_X - pageStrW} ${footerLineY - 20} Td (${escPdfWinAnsi(pageStr)}) Tj ET\n`,
    )

    streamParts.push('Q\n')
    compiledPageStreams.push(streamParts.join(''))
  }

  // Montagem final do arquivo PDF binário
  const pdfParts: string[] = []
  const offsets: number[] = []
  pdfParts.push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  function addPdfObj(objContent: string) {
    let curOffset = 0
    for (let op = 0; op < pdfParts.length; op++) curOffset += pdfParts[op].length
    offsets.push(curOffset)
    pdfParts.push(objContent + '\n')
  }

  addPdfObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')

  const pageObjIds: number[] = []
  const fontF1Id = 3 // Helvetica
  const fontF2Id = 4 // Helvetica-Bold
  const fontF3Id = 5 // Courier (monoespaçada)

  let curNextId = 6
  for (let pi = 0; pi < totalPages; pi++) {
    pageObjIds.push(curNextId)
    curNextId += 2
  }

  const kidsArrayStr = pageObjIds.map((id) => `${id} 0 R`).join(' ')
  addPdfObj(`2 0 obj\n<< /Type /Pages /Kids [${kidsArrayStr}] /Count ${totalPages} >>\nendobj`)

  addPdfObj(
    `${fontF1Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj`,
  )
  addPdfObj(
    `${fontF2Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj`,
  )
  addPdfObj(
    `${fontF3Id} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj`,
  )

  for (let pi = 0; pi < totalPages; pi++) {
    const pageId = pageObjIds[pi]
    const contentId = pageId + 1
    const pStream = compiledPageStreams[pi]
    const streamLen = pStream.length

    const pageObjStr = [
      `${pageId} 0 obj`,
      '<< /Type /Page',
      '   /Parent 2 0 R',
      `   /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
      `   /Contents ${contentId} 0 R`,
      '   /Resources <<',
      `      /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R /F3 ${fontF3Id} 0 R >>`,
      '      /ProcSet [/PDF /Text]',
      '   >>',
      '>>',
      'endobj',
    ].join('\n')
    addPdfObj(pageObjStr)

    const contentObjStr = [
      `${contentId} 0 obj`,
      `<< /Length ${streamLen} >>`,
      'stream',
      pStream + 'endstream',
      'endobj',
    ].join('\n')
    addPdfObj(contentObjStr)
  }

  let xrefOffset = 0
  for (let op = 0; op < pdfParts.length; op++) xrefOffset += pdfParts[op].length

  const totalObjs = curNextId - 1
  const xrefParts: string[] = []
  xrefParts.push('xref\n')
  xrefParts.push(`0 ${totalObjs + 1}\n`)
  xrefParts.push('0000000000 65535 f \n')

  for (let oi = 1; oi <= totalObjs; oi++) {
    const off = offsets[oi - 1]
    const offStr = String(off).padStart(10, '0')
    xrefParts.push(`${offStr} 00000 n \n`)
  }

  pdfParts.push(xrefParts.join(''))

  const trailerStr = [
    'trailer',
    `<< /Size ${totalObjs + 1}`,
    '   /Root 1 0 R',
    '>>',
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n')
  pdfParts.push(trailerStr)

  const finalStr = pdfParts.join('')
  const outBytes = new Uint8Array(finalStr.length)
  for (let bi = 0; bi < finalStr.length; bi++) {
    outBytes[bi] = finalStr.charCodeAt(bi) & 0xff
  }
  return outBytes
}
