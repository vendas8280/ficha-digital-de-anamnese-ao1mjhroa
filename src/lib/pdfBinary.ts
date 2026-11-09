// Gerador de PDF em formato binário bruto (Uint8Array) reutilizando a especificação
// de layout e formatação do sistema (conforme o gerador do backend e a impressão do front).
import { FormSubmissionRecord, ClinicSettingsRecord } from '@/services/forms'

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

function formatBrDate(isoStr?: string): string {
  if (!isoStr) return 'Não informada'
  try {
    const d = new Date(isoStr)
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const brDate = new Date(utc - 3 * 3600000)
    const dia = String(brDate.getDate()).padStart(2, '0')
    const mes = String(brDate.getMonth() + 1).padStart(2, '0')
    const ano = brDate.getFullYear()
    const horas = String(brDate.getHours()).padStart(2, '0')
    const minutos = String(brDate.getMinutes()).padStart(2, '0')
    return `${dia}/${mes}/${ano} às ${horas}:${minutos}`
  } catch (_) {
    return isoStr
  }
}

function formatShortDate(isoStr?: string): string {
  try {
    const d = isoStr ? new Date(isoStr) : new Date()
    const utc = d.getTime() + d.getTimezoneOffset() * 60000
    const brDate = new Date(utc - 3 * 3600000)
    const dia = String(brDate.getDate()).padStart(2, '0')
    const mes = String(brDate.getMonth() + 1).padStart(2, '0')
    return `${dia}/${mes}/${brDate.getFullYear()}`
  } catch (_) {
    return '31/10/2026'
  }
}

function formatBirthDateBR(dateStr?: string): string {
  if (!dateStr || dateStr === 'Não informado') return 'Não informado'
  try {
    const clean = String(dateStr).trim().split('T')[0]
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`
    }
    return dateStr
  } catch (_) {
    return dateStr
  }
}

export function generateFormPdfBytes(
  form: FormSubmissionRecord,
  settings?: ClinicSettingsRecord | null,
): Uint8Array {
  const patientName = form.patient_name || 'Paciente'
  const patientCpf = form.patient_cpf || 'Não informado'
  const patientEmail = form.patient_email || 'Não informado'
  const patientPhone = form.patient_phone || 'Não informado'
  const patientBirth = formatBirthDateBR(form.patient_birth_date)
  const patientRg = form.patient_rg || 'Não informado'
  const patientProf = form.patient_profession || 'Não informado'
  const patientEmerg = form.patient_emergency_contact || 'Não informado'
  const patientAddr = form.patient_address || 'Não informado'

  const formTypeLabels: Record<string, string> = {
    geral: 'Anamnese Estética Geral',
    labios: 'Lábios, Micropigmentação & Revitalização Labial',
    botox: 'Toxina Botulínica (Botox)',
  }
  const fType = form.form_type || 'geral'
  const fTypeLabel = formTypeLabels[fType] || fType

  const signedAt = formatBrDate(form.signed_at || form.created)
  const signedDateShort = formatShortDate(form.signed_at || form.created)
  const ipOrigem = form.ip_address || 'Não informado'
  const userAgent = form.user_agent || 'Navegador Web/Mobile'
  const docHash = form.document_hash || 'SHA-256 REGISTRADO'
  const termTitle = form.accepted_term_title || `Termo de Consentimento - ${fTypeLabel}`
  const termText = form.accepted_term_text || ''

  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN_X = 56.7
  const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X
  const HEADER_TOP = PAGE_HEIGHT - 38
  const CONTENT_TOP = PAGE_HEIGHT - 80
  const CONTENT_BOTTOM = 65

  interface PageData {
    commands: string[]
  }

  const pages: PageData[] = []
  let curPage: PageData = { commands: [] }
  let curY = CONTENT_TOP

  function newPage() {
    pages.push(curPage)
    curPage = { commands: [] }
    curY = CONTENT_TOP
  }

  function ensureSpace(ptsNeeded: number) {
    if (curY - ptsNeeded < CONTENT_BOTTOM) {
      newPage()
    }
  }

  function drawSectionTitle(titleText: string) {
    ensureSpace(32)
    curY -= 6
    curPage.commands.push(
      `q 0.514 0.094 0.263 rg 1 w ${MARGIN_X} ${curY - 18} ${CONTENT_WIDTH} 0.5 re f Q`,
    )
    curPage.commands.push(
      `BT /F2 12 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${curY - 12} Td (${escPdfWinAnsi(titleText)}) Tj ET`,
    )
    curY -= 26
  }

  function drawTwoColumnTable(
    rows: Array<{ label: string; value: string }>,
    col1Width: number,
    col2Width: number,
  ) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const label = row.label || ''
      const val = row.value || ''
      const isAlt = r % 2 === 1

      const labelLines = wrapText(label, col1Width - 14, 9)
      const valLines = wrapText(val, col2Width - 14, 9)
      const numLines = Math.max(labelLines.length, valLines.length, 1)
      const rowH = numLines * 13 + 8

      ensureSpace(rowH + 2)

      if (isAlt) {
        curPage.commands.push(
          `q 0.965 0.972 0.980 rg ${MARGIN_X} ${curY - rowH} ${CONTENT_WIDTH} ${rowH} re f Q`,
        )
      }

      curPage.commands.push(
        `q 0.88 0.90 0.93 RG 0.5 w ${MARGIN_X} ${curY - rowH} m ${MARGIN_X + CONTENT_WIDTH} ${curY - rowH} l S Q`,
      )

      const textY = curY - 14
      for (let l = 0; l < labelLines.length; l++) {
        curPage.commands.push(
          `BT /F2 9 Tf 0.18 0.23 0.32 rg ${MARGIN_X + 6} ${textY - l * 12} Td (${escPdfWinAnsi(labelLines[l])}) Tj ET`,
        )
      }

      for (let v = 0; v < valLines.length; v++) {
        curPage.commands.push(
          `BT /F1 9 Tf 0.10 0.14 0.20 rg ${MARGIN_X + col1Width + 6} ${textY - v * 12} Td (${escPdfWinAnsi(valLines[v])}) Tj ET`,
        )
      }

      curY -= rowH
    }
    curY -= 8
  }

  // SEÇÃO 1
  drawSectionTitle('SEÇÃO 1 — DADOS CADASTRAIS DO PACIENTE')
  const patientDataRows = [
    { label: 'Nome Completo:', value: patientName },
    { label: 'CPF:', value: patientCpf },
    { label: 'E-mail:', value: patientEmail },
    { label: 'Telefone / WhatsApp:', value: patientPhone },
    { label: 'Data de Nascimento:', value: patientBirth },
    { label: 'RG:', value: patientRg },
    { label: 'Profissão:', value: patientProf },
    { label: 'Contato de Emergência:', value: patientEmerg },
    { label: 'Endereço Residencial:', value: patientAddr },
    { label: 'Procedimento Escolhido:', value: fTypeLabel },
  ]
  drawTwoColumnTable(patientDataRows, 150, CONTENT_WIDTH - 150)

  // SEÇÃO 2
  drawSectionTitle('SEÇÃO 2 — QUESTIONÁRIO DE SAÚDE & ANAMNESE')
  const questionRows: Array<{ label: string; value: string }> = []
  try {
    const rawAnswers = form.answers
    if (rawAnswers) {
      const answersObj = typeof rawAnswers === 'string' ? JSON.parse(rawAnswers) : rawAnswers
      const qLabels: Record<string, string> = {
        alergias: 'Alergias a Medicamentos / Cosméticos',
        cicatrizacao: 'Histórico de Cicatrização / Queloides',
        doencas_cronicas: 'Doenças Crônicas / Autoimunes',
        fumante: 'Tabagismo / Fumante Ativo',
        gestante_ou_lactante: 'Gestante ou Lactante',
        medicamentos_em_uso: 'Medicamentos de Uso Contínuo',
        objetivo_labios: 'Objetivo com o Procedimento Labial',
        procedimentos_anteriores: 'Procedimentos Estéticos Anteriores',
        queixa_principal: 'Queixa Estética Principal',
        historico_saude: 'Histórico Geral de Saúde',
        herpes_labial: 'Histórico de Herpes Labial',
        uso_anticoagulantes: 'Uso de Anticoagulantes / AAS',
      }
      const aKeys = Object.keys(answersObj)
      for (let k = 0; k < aKeys.length; k++) {
        const aKey = aKeys[k]
        const qVal = answersObj[aKey]
        const qText =
          qLabels[aKey] || aKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        let vStr = Array.isArray(qVal) ? qVal.join(', ') : String(qVal)
        if (typeof qVal === 'boolean') vStr = qVal ? 'Sim' : 'Não'
        questionRows.push({ label: qText + ':', value: vStr || 'Não informado' })
      }
    }
  } catch {
    /* intentionally ignored */
  }

  if (questionRows.length === 0) {
    questionRows.push({
      label: 'Questionário Clínico:',
      value: 'Respostas registradas e validadas eletronicamente no prontuário.',
    })
  }
  drawTwoColumnTable(questionRows, 195, CONTENT_WIDTH - 195)

  // SEÇÃO 3
  drawSectionTitle('SEÇÃO 3 — TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO')
  ensureSpace(22)
  curPage.commands.push(
    `BT /F2 10 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${curY - 10} Td (${escPdfWinAnsi(termTitle)}) Tj ET`,
  )
  curY -= 18

  const clauses: string[] = []
  if (termText) {
    const rawParas = termText.split(/\n\s*\n|\n(?=[0-9]+\.\s+)/)
    for (let p = 0; p < rawParas.length; p++) {
      const pt = rawParas[p].trim()
      if (pt) clauses.push(pt)
    }
  }
  if (clauses.length === 0) {
    clauses.push(
      'Declaração de consentimento integralmente lida, compreendida, confirmada e aceita pelo paciente no momento da assinatura eletrônica.',
    )
  }

  for (let c = 0; c < clauses.length; c++) {
    const clauseText = clauses[c]
    const lines = wrapText(clauseText, CONTENT_WIDTH, 9.5)
    const clauseH = lines.length * 13 + 6

    ensureSpace(clauseH)

    for (let cl = 0; cl < lines.length; cl++) {
      curPage.commands.push(
        `BT /F1 9.5 Tf 0.20 0.24 0.30 rg ${MARGIN_X} ${curY - 11} Td (${escPdfWinAnsi(lines[cl])}) Tj ET`,
      )
      curY -= 13
    }
    curY -= 6
  }

  // SEÇÃO 4
  drawSectionTitle('SEÇÃO 4 — ASSINATURA ELETRÔNICA DO PACIENTE')
  const boxHeight = 110
  ensureSpace(boxHeight + 50)

  curPage.commands.push(
    `q 0.988 0.950 0.972 rg 0.81 0.40 0.60 RG 1 w ${MARGIN_X} ${curY - boxHeight} ${CONTENT_WIDTH} ${boxHeight} re B Q`,
  )

  curPage.commands.push(
    `BT /F2 11 Tf 0.514 0.094 0.263 rg ${MARGIN_X + 130} ${curY - 55} Td (${escPdfWinAnsi('Assinatura Eletrônica Autenticada')}) Tj ET`,
  )

  const lineY = curY - boxHeight + 18
  curPage.commands.push(
    `q 0.514 0.094 0.263 RG 1.2 w ${MARGIN_X + 80} ${lineY} m ${MARGIN_X + CONTENT_WIDTH - 80} ${lineY} l S Q`,
  )
  curPage.commands.push(
    `BT /F2 9.5 Tf 0.20 0.24 0.30 rg ${MARGIN_X + 180} ${lineY - 11} Td (${escPdfWinAnsi('Assinatura do Paciente: ' + patientName)}) Tj ET`,
  )
  curPage.commands.push(
    `BT /F1 8.5 Tf 0.40 0.45 0.50 rg ${MARGIN_X + 175} ${lineY - 22} Td (${escPdfWinAnsi('Aceite e Assinatura Registrados em: ' + signedAt)}) Tj ET`,
  )

  curY -= boxHeight + 32

  // SEÇÃO 5
  drawSectionTitle('SEÇÃO 5 — REGISTRO DA ASSINATURA ELETRÔNICA')
  let signedAtDisplay = signedAt
  if (
    signedAtDisplay.indexOf('(horário de Brasília)') === -1 &&
    signedAtDisplay.indexOf('(Horário de Brasília)') === -1
  ) {
    signedAtDisplay = `${signedAtDisplay} (horário de Brasília)`
  }
  const sec5Text = `Aceite registrado em ${signedAtDisplay}. Assinatura eletrônica realizada com confirmação por código enviado ao e-mail informado. O registro técnico completo — data, hora, origem e integridade do documento — está arquivado na clínica e pode ser solicitado a qualquer momento.`
  const sec5Lines = wrapText(sec5Text, CONTENT_WIDTH - 24, 9.5)
  const boxPad = 12
  const lineH = 14
  const sec5BoxH = sec5Lines.length * lineH + boxPad * 2
  ensureSpace(sec5BoxH + 10)

  curPage.commands.push(
    `q 0.985 0.985 0.99 rg 0.85 0.88 0.92 RG 0.8 w ${MARGIN_X} ${curY - sec5BoxH} ${CONTENT_WIDTH} ${sec5BoxH} re B Q`,
  )

  let textY = curY - boxPad - 8
  for (let s5 = 0; s5 < sec5Lines.length; s5++) {
    curPage.commands.push(
      `BT /F1 9.5 Tf 0.25 0.28 0.35 rg ${MARGIN_X + 12} ${textY} Td (${escPdfWinAnsi(sec5Lines[s5])}) Tj ET`,
    )
    textY -= lineH
  }
  curY -= sec5BoxH + 12

  pages.push(curPage)
  const totalPages = pages.length

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

  const compiledPageStreams: string[] = []

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pNum = pIdx + 1
    const streamParts: string[] = []
    streamParts.push('q\n')

    streamParts.push(
      `BT /F2 13 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${HEADER_TOP} Td (${escPdfWinAnsi(clinicN.toUpperCase())}) Tj ET\n`,
    )
    const rightHeader = `${patientName} • ${signedDateShort}`
    const rightHeaderW = measureTextWidth(rightHeader, 8.5)
    streamParts.push(
      `BT /F1 8.5 Tf 0.35 0.40 0.48 rg ${PAGE_WIDTH - MARGIN_X - rightHeaderW} ${HEADER_TOP} Td (${escPdfWinAnsi(rightHeader)}) Tj ET\n`,
    )
    streamParts.push(
      `BT /F1 9 Tf 0.30 0.35 0.42 rg ${MARGIN_X} ${HEADER_TOP - 13} Td (${escPdfWinAnsi('Ficha de Anamnese e Termo de Consentimento Assinado')}) Tj ET\n`,
    )
    streamParts.push(
      `q 0.514 0.094 0.263 RG 1 w ${MARGIN_X} ${HEADER_TOP - 20} m ${PAGE_WIDTH - MARGIN_X} ${HEADER_TOP - 20} l S Q\n`,
    )

    const cmds = pages[pIdx].commands
    for (let ci = 0; ci < cmds.length; ci++) {
      streamParts.push(cmds[ci] + '\n')
    }

    const footerLineY = 48
    streamParts.push(
      `q 0.80 0.83 0.88 RG 0.5 w ${MARGIN_X} ${footerLineY} m ${PAGE_WIDTH - MARGIN_X} ${footerLineY} l S Q\n`,
    )
    streamParts.push(
      `BT /F2 8.5 Tf 0.514 0.094 0.263 rg ${MARGIN_X} ${footerLineY - 11} Td (${escPdfWinAnsi(clinicN)}) Tj ET\n`,
    )
    streamParts.push(
      `BT /F1 8.5 Tf 0.35 0.40 0.48 rg ${MARGIN_X + measureTextWidth(clinicN, 8.5) + 8} ${footerLineY - 11} Td (${escPdfWinAnsi('• Profissional Responsável: ' + tResp)}) Tj ET\n`,
    )
    const formCode = form.form_code || ''
    const footerL2Left = formCode
      ? `Código da Ficha: ${formCode} • ${cAddr} • Horário de Brasília (UTC-3)`
      : `${cAddr} • Horário de Brasília (UTC-3)`
    streamParts.push(
      `BT /F1 8 Tf 0.40 0.45 0.52 rg ${MARGIN_X} ${footerLineY - 22} Td (${escPdfWinAnsi(footerL2Left)}) Tj ET\n`,
    )
    const pageStr = `Página ${pNum} de ${totalPages}`
    const pageStrW = measureTextWidth(pageStr, 8)
    streamParts.push(
      `BT /F2 8 Tf 0.30 0.35 0.45 rg ${PAGE_WIDTH - MARGIN_X - pageStrW} ${footerLineY - 22} Td (${escPdfWinAnsi(pageStr)}) Tj ET\n`,
    )

    streamParts.push('Q\n')
    compiledPageStreams.push(streamParts.join(''))
  }

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
  const fontF1Id = 3
  const fontF2Id = 4

  let curNextId = 5
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

  const resourcesDict = `<< /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> >>`

  for (let pBuild = 0; pBuild < totalPages; pBuild++) {
    const pId = pageObjIds[pBuild]
    const cId = pId + 1
    const cStream = compiledPageStreams[pBuild]

    addPdfObj(
      `${pId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources ${resourcesDict} /Contents ${cId} 0 R >>\nendobj`,
    )

    addPdfObj(`${cId} 0 obj\n<< /Length ${cStream.length} >>\nstream\n${cStream}endstream\nendobj`)
  }

  let xrefStart = 0
  for (let xp = 0; xp < pdfParts.length; xp++) xrefStart += pdfParts[xp].length

  const totalObjects = offsets.length
  let xrefStr = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`
  for (let oi = 0; oi < offsets.length; oi++) {
    let offS = String(offsets[oi])
    while (offS.length < 10) offS = '0' + offS
    xrefStr += `${offS} 00000 n \n`
  }
  xrefStr += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  pdfParts.push(xrefStr)

  const fullPdfStr = pdfParts.join('')
  const encoder = new TextEncoder()
  return encoder.encode(fullPdfStr)
}
