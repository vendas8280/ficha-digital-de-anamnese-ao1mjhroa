// pocketbase/hooks/forms.pb.js

// 1. Hook triggered after form submission record is updated
onRecordAfterUpdateSuccess((e) => {
  e.next()

  const record = e.record
  const status = record.getString('status')
  const patientEmail = record.getString('patient_email')
  const signedAt = record.getString('signed_at')
  const currentDeliveryStatus = record.getString('email_delivery_status')

  // Only act when status is preenchida, signed, and not already delivered
  if (status === 'preenchida' && patientEmail && signedAt && currentDeliveryStatus !== 'enviado') {
    let emailSuccess = false
    let deliveryError = ''

    try {
      // Inline helper: sanitize strings for standard PDF
      const sanitizePdf = (str) => {
        if (!str) return ''
        return String(str)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[\\()]/g, '')
          .replace(/[\r\n\t]+/g, ' ')
          .replace(/[^\x20-\x7E]/g, ' ')
          .trim()
      }

      // Inline helper: string to byte array
      const strToBytes = (str) => {
        const bytes = []
        for (let i = 0; i < str.length; i++) {
          bytes.push(str.charCodeAt(i) & 0xff)
        }
        return bytes
      }

      // Inline helper: byte array to string
      const bytesToStr = (bytes) => {
        let result = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize)
          result += String.fromCharCode.apply(null, chunk)
        }
        return result
      }

      // Inline helper: bytes to base64
      const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
      const bytesToB64 = (bytes) => {
        let result = ''
        const len = bytes.length
        let i = 0
        while (i < len) {
          const b0 = bytes[i++]
          const b1 = i < len ? bytes[i++] : NaN
          const b2 = i < len ? bytes[i++] : NaN

          const c0 = b0 >> 2
          const c1 = ((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4)
          const c2 = isNaN(b1) ? 64 : ((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6)
          const c3 = isNaN(b2) ? 64 : b2 & 63

          result +=
            B64_CHARS.charAt(c0) +
            B64_CHARS.charAt(c1) +
            (c2 === 64 ? '=' : B64_CHARS.charAt(c2)) +
            (c3 === 64 ? '=' : B64_CHARS.charAt(c3))
        }
        return result
      }

      // Inline helper: format Brasília date/time (UTC-3)
      const formatBrDateTime = (isoDateStr) => {
        try {
          const d = isoDateStr ? new Date(isoDateStr) : new Date()
          const brMs = d.getTime() - 3 * 3600 * 1000
          const brDate = new Date(brMs)
          const pad = (n) => String(n).padStart(2, '0')
          return `${pad(brDate.getUTCDate())}/${pad(brDate.getUTCMonth() + 1)}/${brDate.getUTCFullYear()} as ${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())} (horario de Brasilia)`
        } catch (_) {
          return 'Data e hora registradas'
        }
      }

      // Inline helper: format date for filename (DD-MM-AAAA)
      const formatBrDateForFilename = (isoDateStr) => {
        try {
          const d = isoDateStr ? new Date(isoDateStr) : new Date()
          const brMs = d.getTime() - 3 * 3600 * 1000
          const brDate = new Date(brMs)
          const pad = (n) => String(n).padStart(2, '0')
          return `${pad(brDate.getUTCDate())}-${pad(brDate.getUTCMonth() + 1)}-${brDate.getUTCFullYear()}`
        } catch (_) {
          return '2026-10-31'
        }
      }

      // Inline helper: get active clinic settings without example data or CNPJ
      const defaults = {
        clinic_name: 'Andresa Souza Clinic',
        notification_email: 'gihobaicn@hotmail.com',
        phone: '',
        sender_email: 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
        technical_responsible: 'Dra. Andresa Souza',
        professional_register: '',
        clinic_address: '',
      }
      let settings = defaults
      try {
        const list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
        if (list.length > 0) {
          const s = list[0]
          const p = s.getString('phone')
          const reg = s.getString('professional_register')
          const addr = s.getString('clinic_address')
          settings = {
            clinic_name: s.getString('clinic_name') || defaults.clinic_name,
            notification_email: s.getString('notification_email') || defaults.notification_email,
            phone: p && !p.includes('99999-8888') ? p : '',
            sender_email: s.getString('sender_email') || defaults.sender_email,
            technical_responsible:
              s.getString('technical_responsible') || defaults.technical_responsible,
            professional_register: reg && !reg.includes('12345') ? reg : '',
            clinic_address: addr && !addr.includes('Paulista') ? addr : '',
          }
        }
      } catch (_) {}

      const clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

      // Inline helper: generate complete PDF binary
      const generatePdf = (rec, isPatientCopy) => {
        const pName = rec.getString('patient_name') || 'Paciente'
        const pCpf = rec.getString('patient_cpf') || 'Nao informado'
        const pEmail = rec.getString('patient_email') || 'Nao informado'
        const pPhone = rec.getString('patient_phone') || 'Nao informado'
        const pBirth = rec.getString('patient_birth_date') || 'Nao informado'
        const pRg = rec.getString('patient_rg') || 'Nao informado'
        const pAddress = rec.getString('patient_address') || 'Nao informado'
        const pProf = rec.getString('patient_profession') || 'Nao informado'
        const pEmerg = rec.getString('patient_emergency_contact') || 'Nao informado'
        const fType = rec.getString('form_type')
        const sAt = rec.getString('signed_at') || rec.getString('created')
        const dHash = rec.getString('document_hash') || 'N/A'
        const ip = rec.getString('ip_address') || 'Nao disponivel'
        const ua = rec.getString('user_agent') || 'Nao disponivel'
        const tTitle =
          rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
        const tText = rec.getString('accepted_term_text') || ''

        const typeLabels = {
          geral: 'Anamnese Estetica Geral',
          labios: 'Labios & Micropigmentacao Labial',
          botox: 'Toxina Botulinica (Botox)',
        }
        const pLabel = typeLabels[fType] || fType || 'Anamnese'
        const brTime = formatBrDateTime(sAt)

        const answersList = []
        try {
          const rawAnswers = rec.getString('answers')
          if (rawAnswers) {
            const parsed = JSON.parse(rawAnswers)
            if (parsed && typeof parsed === 'object') {
              for (const k of Object.keys(parsed)) {
                let val = parsed[k]
                if (typeof val === 'boolean') val = val ? 'Sim' : 'Nao'
                if (Array.isArray(val)) val = val.join(', ')
                answersList.push(`${k.replace(/_/g, ' ')}: ${val}`)
              }
            }
          }
        } catch (_) {}

        const pages = []
        let currentLines = []
        const flush = () => {
          if (currentLines.length > 0) {
            pages.push(currentLines)
            currentLines = []
          }
        }
        const pushLine = (txt, isBold = false, size = 9, color = [0.1, 0.1, 0.1]) => {
          if (currentLines.length >= 48) flush()
          currentLines.push({ text: sanitizePdf(txt), isBold, size, color })
        }
        const pushDiv = () => {
          pushLine(
            '------------------------------------------------------------------------------------------------',
            false,
            8,
            [0.7, 0.7, 0.7],
          )
        }

        // Header
        pushLine(
          'ANDRESA SOUZA CLINIC - FICHA OFICIAL DE ANAMNESE E TERMO ASSINADO',
          true,
          11,
          [0.51, 0.09, 0.26],
        )
        pushLine(
          `Procedimento: ${pLabel} | Via: ${isPatientCopy ? 'Via do Paciente' : 'Via da Clinica (Prontuario)'}`,
          false,
          9,
          [0.3, 0.3, 0.3],
        )
        pushDiv()

        // 1. Dados Cadastrais
        pushLine('1. DADOS CADASTRAIS DO PACIENTE', true, 10, [0.51, 0.09, 0.26])
        pushLine(`Nome Completo: ${pName}    |    CPF: ${pCpf}`, false, 9)
        pushLine(`E-mail: ${pEmail}    |    Telefone: ${pPhone}`, false, 9)
        pushLine(`Nascimento: ${pBirth}    |    RG: ${pRg}`, false, 9)
        pushLine(`Profissao: ${pProf}    |    Emergencia: ${pEmerg}`, false, 9)
        pushLine(`Endereco Residencial: ${pAddress}`, false, 9)
        pushDiv()

        // 2. Questionário de Saúde e Anamnese (Todas as respostas)
        pushLine(
          '2. QUESTIONARIO DE SAUDE E ANAMNESE CLINICA (RESPOSTAS COMPLETAS)',
          true,
          10,
          [0.51, 0.09, 0.26],
        )
        if (answersList.length === 0) {
          pushLine('Nenhuma resposta registrada (ficha pendente).', false, 9, [0.4, 0.4, 0.4])
        } else {
          for (let i = 0; i < answersList.length; i++) {
            const ans = answersList[i]
            if (ans.length <= 88) {
              pushLine(` * ${ans}`, false, 9)
            } else {
              pushLine(` * ${ans.substring(0, 85)}`, false, 9)
              let pos = 85
              while (pos < ans.length) {
                pushLine(`   ${ans.substring(pos, pos + 85)}`, false, 9)
                pos += 85
              }
            }
          }
        }
        pushDiv()

        // 3. Termo de Consentimento Aceito (Texto Integral)
        pushLine('3. TERMO DE CONSENTIMENTO ACEITO INTEGRALMENTE', true, 10, [0.51, 0.09, 0.26])
        pushLine(tTitle, true, 9)
        const cleanT = sanitizePdf(tText)
        const paras = cleanT.split(/(?:\r?\n)+/)
        for (let pIdx = 0; pIdx < paras.length; pIdx++) {
          const pr = paras[pIdx].trim()
          if (!pr) continue
          let pos = 0
          while (pos < pr.length) {
            pushLine(pr.substring(pos, pos + 90), false, 8.5)
            pos += 90
          }
        }
        pushDiv()

        // 4. Auditoria Digital e Certificado de Assinatura Eletrônica
        pushLine(
          '4. REGISTRO DE AUDITORIA DIGITAL & CERTIFICADO DE ASSINATURA ELETRONICA',
          true,
          10,
          [0.51, 0.09, 0.26],
        )
        pushLine(`Data e Hora do Aceite: ${brTime}`, false, 9)
        pushLine(`IP de Origem Real: ${ip}`, false, 9)
        pushLine(`Dispositivo / User-Agent: ${ua.substring(0, 80)}`, false, 8)
        pushLine(`Hash SHA-256 de Integridade: ${dHash}`, true, 8, [0.1, 0.1, 0.1])
        pushLine(
          'Codigo de verificacao de integridade - garante que este documento nao foi alterado.',
          false,
          7.5,
          [0.4, 0.4, 0.4],
        )
        pushLine(
          `[Assinatura Eletronica Autenticada - Paciente: ${pName}]`,
          true,
          8.5,
          [0.51, 0.09, 0.26],
        )

        let clinicFoot = `Clinica: ${settings.clinic_name}`
        if (settings.technical_responsible)
          clinicFoot += ` | Resp. Tecnica: ${settings.technical_responsible}`
        if (settings.professional_register) clinicFoot += ` (${settings.professional_register})`
        if (settings.phone) clinicFoot += ` | Tel: ${settings.phone}`
        clinicFoot += ` | Fuso: Horario de Brasilia (UTC-3)`
        pushLine(clinicFoot, false, 7.5, [0.3, 0.3, 0.3])
        if (settings.clinic_address) {
          pushLine(`Endereco: ${settings.clinic_address}`, false, 7.5, [0.3, 0.3, 0.3])
        }

        // Rodapé da via do paciente
        if (isPatientCopy) {
          pushDiv()
          pushLine(
            'Esta e a sua via do documento assinado. Guarde para seus registros.',
            true,
            8.5,
            [0.03, 0.4, 0.25],
          )
        }

        flush()
        if (pages.length === 0) pages.push([])

        const totalPages = pages.length
        let nextObjId = 1
        const catalogId = nextObjId++
        const pagesId = nextObjId++
        const fontNormId = nextObjId++
        const fontBoldId = nextObjId++

        const pObjIds = []
        const cObjIds = []
        for (let i = 0; i < totalPages; i++) {
          pObjIds.push(nextObjId++)
          cObjIds.push(nextObjId++)
        }

        const objects = []
        objects.push({ id: catalogId, content: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` })
        const kids = pObjIds.map((id) => `${id} 0 R`).join(' ')
        objects.push({
          id: pagesId,
          content: `<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>`,
        })
        objects.push({
          id: fontNormId,
          content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
        })
        objects.push({
          id: fontBoldId,
          content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
        })

        for (let p = 0; p < totalPages; p++) {
          const pLines = pages[p]
          const curPId = pObjIds[p]
          const curCId = cObjIds[p]

          objects.push({
            id: curPId,
            content: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${curCId} 0 R /Resources << /Font << /F1 ${fontNormId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
          })

          let streamText = 'BT\n40 805 Td\n'
          for (let l = 0; l < pLines.length; l++) {
            const item = pLines[l]
            const fRef = item.isBold ? '/F2' : '/F1'
            const col = item.color || [0.1, 0.1, 0.1]
            const r = col[0].toFixed(2)
            const g = col[1].toFixed(2)
            const b = col[2].toFixed(2)
            const fSize = item.size || 9
            const leading = fSize + 4

            streamText += `${r} ${g} ${b} rg\n${fRef} ${fSize} Tf\n${leading} TL\n(${item.text}) Tj T*\n`
          }
          streamText += `0.5 0.5 0.5 rg\n/F1 7.5 Tf\n(Pagina ${p + 1} de ${totalPages}) Tj\nET\n`

          const streamBytes = strToBytes(streamText)
          objects.push({
            id: curCId,
            rawBytes: strToBytes(`<< /Length ${streamBytes.length} >>\nstream\n`)
              .concat(streamBytes)
              .concat(strToBytes('\nendstream')),
          })
        }

        let pdf = strToBytes('%PDF-1.4\n')
        const offsets = {}
        objects.sort((a, b) => a.id - b.id)

        for (let i = 0; i < objects.length; i++) {
          const obj = objects[i]
          offsets[obj.id] = pdf.length
          pdf = pdf.concat(strToBytes(`${obj.id} 0 obj\n`))
          if (obj.rawBytes) {
            pdf = pdf.concat(obj.rawBytes)
          } else {
            pdf = pdf.concat(strToBytes(obj.content))
          }
          pdf = pdf.concat(strToBytes('\nendobj\n'))
        }

        const xrefOff = pdf.length
        const pad10 = (n) => String(n).padStart(10, '0')
        let xrefStr = `xref\n0 ${nextObjId}\n0000000000 65535 f \n`
        for (let id = 1; id < nextObjId; id++) {
          xrefStr += `${pad10(offsets[id] || 0)} 00000 n \n`
        }
        xrefStr += `trailer\n<< /Size ${nextObjId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`
        pdf = pdf.concat(strToBytes(xrefStr))

        const cleanPatient = sanitizePdf(pName).replace(/[^a-zA-Z0-9]/g, '-')
        const fDate = formatBrDateForFilename(sAt)
        const filename = `Ficha-Anamnese-${cleanPatient}-${fDate}.pdf`

        return {
          bytes: pdf,
          pdfBytes: bytesToStr(pdf),
          base64: bytesToB64(pdf),
          filename,
        }
      }

      // Inline helper: build email body HTML & Text
      const buildEmail = (rec, isPatientCopy) => {
        const pName = rec.getString('patient_name') || 'Paciente'
        const pCpf = rec.getString('patient_cpf') || '-'
        const pEmail = rec.getString('patient_email') || ''
        const fType = rec.getString('form_type')
        const sAt = rec.getString('signed_at') || rec.getString('created')
        const dHash = rec.getString('document_hash') || 'N/A'
        const tTitle =
          rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
        const ip = rec.getString('ip_address') || 'Nao disponivel'
        const ua = rec.getString('user_agent') || 'Nao disponivel'
        const sig = rec.getString('signature_data') || ''

        const typeLabels = {
          geral: 'Anamnese Geral',
          labios: 'Labios & Micropigmentacao Labial',
          botox: 'Toxina Botulinica (Botox)',
        }
        const pLabel = typeLabels[fType] || fType || 'Anamnese'
        const brTime = formatBrDateTime(sAt)

        const sigHtml = sig
          ? `<div style="margin: 16px 0; text-align: center;">
               <img src="${sig}" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />
               <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
             </div>`
          : `<p style="font-style: italic; color: #64748b;">[Assinatura eletronica autenticada]</p>`

        let clinicFooterHtml = `<strong>${settings.clinic_name}</strong>`
        if (settings.technical_responsible) {
          clinicFooterHtml += ` &bull; Responsavel Tecnica: ${settings.technical_responsible}`
          if (settings.professional_register)
            clinicFooterHtml += ` (${settings.professional_register})`
        }
        if (settings.clinic_address) {
          clinicFooterHtml += `<br/>Endereco: ${settings.clinic_address}`
        }
        if (settings.phone) {
          clinicFooterHtml += ` &bull; Telefone: ${settings.phone}`
        }
        clinicFooterHtml += `<br/>Fuso horario: Horario de Brasilia (UTC-3)`

        const html = `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head><meta charset="UTF-8"><title>Comprovante: Ficha de Anamnese Assinada</title></head>
          <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
            <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Andresa Souza Clinic</h1>
                <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Comprovante de Ficha de Anamnese e Termo Assinado</p>
              </div>
              <div style="padding: 24px;">
                <p style="font-size: 15px; margin-top: 0;">Ola, <strong>${pName}</strong>!</p>
                <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                  Confirmamos a conclusao e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.
                  ${isPatientCopy ? 'Esta e a sua via oficial do documento assinado.' : 'Esta e a notificacao oficial registrada para o prontuario da clinica.'}
                </p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
                  <strong>O documento completo em PDF esta anexado a esta mensagem.</strong>
                  ${isPatientCopy ? '<br/><span style="display:inline-block; margin-top:4px; font-weight:600;">Esta e a sua via do documento assinado. Guarde para seus registros.</span>' : ''}
                </div>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                  <tr style="background-color: #fdf2f8; border-bottom: 1px solid #fbcfe8;">
                    <td style="padding: 10px 12px; font-weight: bold; width: 38%; color: #831843;">Tipo de Procedimento:</td>
                    <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">${pLabel}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Nome Completo:</td>
                    <td style="padding: 10px 12px;">${pName}</td>
                  </tr>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">CPF:</td>
                    <td style="padding: 10px 12px;">${pCpf}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>
                    <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${brTime}</td>
                  </tr>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versao Aceita:</td>
                    <td style="padding: 10px 12px;">${tTitle}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Enviado para:</td>
                    <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">${pEmail}</td>
                  </tr>
                  <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem REAL:</td>
                    <td style="padding: 10px 12px; font-family: monospace;">${ip}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
                    <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">${ua}</td>
                  </tr>
                </table>
                <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">
                  ${sigHtml}
                </div>
                <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>
                  <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">${dHash}</p>
                  <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                    Codigo de verificacao de integridade - garante que este documento nao foi alterado apos a assinatura.
                  </p>
                </div>
              </div>
              <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
                ${clinicFooterHtml}
              </div>
            </div>
          </body></html>
        `

        let clinicFooterText = `${settings.clinic_name}`
        if (settings.technical_responsible) {
          clinicFooterText += ` - Responsavel Tecnica: ${settings.technical_responsible}`
          if (settings.professional_register)
            clinicFooterText += ` (${settings.professional_register})`
        }
        if (settings.clinic_address) clinicFooterText += `\nEndereco: ${settings.clinic_address}`
        if (settings.phone) clinicFooterText += ` - Telefone: ${settings.phone}`
        clinicFooterText += `\nFuso horario: Horario de Brasilia (UTC-3)`

        const text = `
Andresa Souza Clinic - Comprovante: Ficha de Anamnese Assinada - ${pName} - ${pLabel}
==============================================================

Ola, ${pName}!

Confirmamos o preenchimento e a assinatura da sua Ficha de Anamnese.
O documento completo em PDF esta anexado a esta mensagem.
${isPatientCopy ? 'Esta e a sua via do documento assinado. Guarde para seus registros.' : ''}

DADOS DO PROCEDIMENTO E DO PACIENTE:
- Procedimento: ${pLabel}
- Paciente: ${pName}
- CPF: ${pCpf}
- Data e Hora do Aceite: ${brTime}
- Termo e Versao Aceita: ${tTitle}
- Enviado para: ${pEmail}
- IP de Origem REAL: ${ip}
- Dispositivo/Navegador: ${ua}

Codigo de verificacao de integridade - garante que este documento nao foi alterado apos a assinatura.
Hash SHA-256: ${dHash}

${clinicFooterText}
        `.trim()

        return { html, text, procLabel: pLabel, patientName: pName }
      }

      // Inline helper: send email with attached PDF (direct Resend API + connector fallback)
      const sendEmailWithPdf = (toAddr, subject, htmlBody, textBody, pdfData) => {
        const defaultSender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
        const fallbackSender = 'Andresa Souza Clinic <onboarding@resend.dev>'
        const configuredSender = settings.sender_email || defaultSender
        let sent = false
        let errorMsg = ''
        let resendResponse = null

        const resendApiKey = $os.getenv('RESEND_API_KEY') || 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'

        // 1. Primary: Direct Resend API via $http (supports base64 attachments natively)
        if (resendApiKey) {
          const sendDirect = (sender) => {
            return $http.send({
              url: 'https://api.resend.com/emails',
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + resendApiKey,
                'Content-Type': 'application/json',
              },
              data: {
                from: sender,
                to: [toAddr],
                subject: subject,
                html: htmlBody,
                text: textBody,
                attachments: [
                  {
                    filename: pdfData.filename,
                    content: pdfData.base64,
                  },
                ],
              },
            })
          }

          try {
            let directRes = sendDirect(configuredSender)
            let isOk = directRes.statusCode >= 200 && directRes.statusCode < 300

            // Fallback to onboarding@resend.dev if custom domain is not verified (403)
            if (!isOk) {
              const rawStr = directRes.raw || ''
              if (
                directRes.statusCode === 403 ||
                rawStr.includes('domain is not verified') ||
                rawStr.includes('Forbidden')
              ) {
                console.log(
                  'Direct Resend custom domain not verified (403), falling back to onboarding@resend.dev...',
                )
                directRes = sendDirect(fallbackSender)
                isOk = directRes.statusCode >= 200 && directRes.statusCode < 300
              }
            }

            if (isOk) {
              sent = true
              resendResponse = directRes.json || directRes.raw
              console.log('Direct Resend email with attachment sent successfully:', directRes.raw)
            } else {
              errorMsg = `Resend API HTTP ${directRes.statusCode}: ${directRes.raw}`
              console.log('Direct Resend error:', errorMsg)
            }
          } catch (errHttp) {
            console.log('Error calling direct Resend API:', errHttp)
            errorMsg = String(errHttp)
          }
        }

        // 2. Secondary: Resend connector via executeAsOwner
        if (!sent && typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
          try {
            const payload = {
              from: configuredSender,
              to: [toAddr],
              subject: subject,
              html: htmlBody,
              text: textBody,
              attachments: [
                {
                  filename: pdfData.filename,
                  content: pdfData.base64,
                },
              ],
            }

            let res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', payload)
            if (!res || !res.successful) {
              const errDetail = res ? JSON.stringify(res.error || res.data || '') : ''
              if (
                errDetail.includes('403') ||
                errDetail.includes('domain is not verified') ||
                errDetail.includes('Forbidden')
              ) {
                payload.from = fallbackSender
                res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', payload)
              }
            }

            if (res && res.successful) {
              sent = true
              resendResponse = res.data || res
            } else {
              if (!errorMsg) {
                errorMsg = res
                  ? JSON.stringify(res.error || res.data || 'Erro no conector Resend')
                  : 'Sem resposta do conector'
              }
            }
          } catch (errResend) {
            console.log('Error calling RESEND_SEND_EMAIL connector:', errResend)
            if (!errorMsg) errorMsg = String(errResend)
          }
        }

        // 3. Tertiary: Internal MailClient fallback
        if (!sent) {
          try {
            const fromName = configuredSender.includes('<')
              ? configuredSender.split('<')[0].trim()
              : 'Andresa Souza Clinic'
            const fromEmail = configuredSender.includes('<')
              ? configuredSender.split('<')[1].replace('>', '').trim()
              : configuredSender

            const msg = new MailerMessage({
              from: {
                address: fromEmail,
                name: fromName,
              },
              to: [{ address: toAddr }],
              subject: subject,
              html: htmlBody,
              text: textBody,
              attachments: [
                {
                  name: pdfData.filename,
                  data: pdfData.base64,
                  type: 'application/pdf',
                },
              ],
            })
            $app.newMailClient().send(msg)
            sent = true
          } catch (errMailer) {
            console.log('Mailer client error with attachment:', errMailer)
            if (!errorMsg) errorMsg = String(errMailer)
          }
        }

        return { sent, error: errorMsg, resendResponse }
      }

      // Generate PDFs for both copies
      const patientPdf = generatePdf(record, true)
      const clinicPdf = generatePdf(record, false)

      const patientContent = buildEmail(record, true)
      const clinicContent = buildEmail(record, false)
      const subject = `Comprovante: Ficha de Anamnese Assinada - ${patientContent.patientName} - ${patientContent.procLabel}`

      // (a) Send to Patient with patient PDF copy
      const patientResult = sendEmailWithPdf(
        patientEmail,
        subject,
        patientContent.html,
        patientContent.text,
        patientPdf,
      )

      if (patientResult.sent) {
        emailSuccess = true
      } else {
        deliveryError = `Falha ao enviar ao paciente: ${patientResult.error}`
      }

      // (b) Send to Clinic with clinic PDF copy
      if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
        sendEmailWithPdf(clinicEmail, subject, clinicContent.html, clinicContent.text, clinicPdf)
      }
    } catch (errGlobal) {
      console.log('Global error in email delivery hook:', errGlobal)
      deliveryError = String(errGlobal)
    }

    // Persist delivery status and pdf_attached_to_email
    try {
      const nowIso = new Date().toISOString()
      const statusToSet = emailSuccess ? 'enviado' : 'falha'
      const pdfAttached = emailSuccess ? 1 : 0
      $app
        .db()
        .newQuery(
          `UPDATE form_submissions 
           SET email_delivery_status = {:status}, 
               email_sent_at = {:sentAt}, 
               email_delivery_error = {:error},
               pdf_attached_to_email = {:pdfAttached}
           WHERE id = {:id}`,
        )
        .bind({
          status: statusToSet,
          sentAt: emailSuccess ? nowIso : '',
          error: deliveryError ? deliveryError.slice(0, 500) : '',
          pdfAttached: pdfAttached,
          id: record.id,
        })
        .execute()
    } catch (errDb) {
      console.log('Error updating delivery status in DB:', errDb)
    }
  }
}, 'form_submissions')

// 2. Custom endpoint: Get Real IP address from backend request
// Endpoint de teste da usuária: executa envio real de teste simulando a finalização da ficha,
// enviando as duas vias (clínica e paciente) com anexo PDF e retornando os dados completos da API Resend
routerAdd('POST', '/backend/v1/test-e2e-delivery', (e) => {
  let createdRecordId = null
  try {
    const formsCol = $app.findCollectionByNameOrId('form_submissions')
    const testRecord = new Record(formsCol)
    const testToken = 'test-' + String(Date.now()).slice(-8)
    const testPatientName = 'Paciente Teste'
    const testPatientEmail = 'gihobaicn@hotmail.com'

    testRecord.set('token', testToken)
    testRecord.set('form_type', 'geral')
    testRecord.set('patient_name', testPatientName)
    testRecord.set('patient_cpf', '111.222.333-44')
    testRecord.set('patient_email', testPatientEmail)
    testRecord.set('status', 'preenchida')
    testRecord.set('signed_at', new Date().toISOString())
    testRecord.set('ip_address', '187.64.120.45')
    testRecord.set('user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Teste/1.0')
    testRecord.set(
      'document_hash',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    testRecord.set('accepted_term_title', 'Termo de Consentimento Livre e Esclarecido - Versao 2.1')
    testRecord.set(
      'accepted_term_text',
      'Texto integral do termo de consentimento aceito e esclarecido para fins de teste clinico.',
    )
    testRecord.set(
      'answers',
      JSON.stringify({
        alergias: 'Nenhuma alergia conhecida',
        medicamentos: 'Nenhum medicamento de uso continuo',
        queixa_principal: 'Procedimento estetico geral',
      }),
    )
    testRecord.set(
      'signature_data',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    )

    $app.save(testRecord)
    createdRecordId = testRecord.id

    // Carregar registro atualizado
    const updated = $app.findRecordById('form_submissions', createdRecordId)

    return e.json(200, {
      testId: createdRecordId,
      email_delivery_status: updated.getString('email_delivery_status'),
      pdf_attached_to_email: updated.getBool('pdf_attached_to_email'),
      email_sent_at: updated.getString('email_sent_at'),
      email_delivery_error: updated.getString('email_delivery_error'),
    })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
})

routerAdd('DELETE', '/backend/v1/test-e2e-delivery/{id}', (e) => {
  const id = e.request.pathValue('id')
  try {
    const rec = $app.findRecordById('form_submissions', id)
    $app.delete(rec)
    return e.json(200, { deleted: true, id })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
})

routerAdd('GET', '/backend/v1/trigger-test-submission', (e) => {
  let createdRecordId = null
  try {
    const formsCol = $app.findCollectionByNameOrId('form_submissions')
    const testRecord = new Record(formsCol)
    const testToken = 'test-' + String(Date.now()).slice(-8)
    const testPatientName = 'Paciente Teste'
    const testPatientEmail = 'gihobaicn@hotmail.com'

    testRecord.set('token', testToken)
    testRecord.set('form_type', 'geral')
    testRecord.set('patient_name', testPatientName)
    testRecord.set('patient_cpf', '111.222.333-44')
    testRecord.set('patient_email', testPatientEmail)
    testRecord.set('status', 'preenchida')
    testRecord.set('signed_at', new Date().toISOString())
    testRecord.set('ip_address', '187.64.120.45')
    testRecord.set('user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Teste/1.0')
    testRecord.set(
      'document_hash',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    testRecord.set('accepted_term_title', 'Termo de Consentimento Livre e Esclarecido - Versao 2.1')
    testRecord.set(
      'accepted_term_text',
      'Texto integral do termo de consentimento aceito e esclarecido para fins de teste clinico.',
    )
    testRecord.set(
      'answers',
      JSON.stringify({
        alergias: 'Nenhuma alergia conhecida',
        medicamentos: 'Nenhum medicamento de uso continuo',
        queixa_principal: 'Procedimento estetico geral',
      }),
    )
    testRecord.set(
      'signature_data',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    )

    $app.save(testRecord)
    createdRecordId = testRecord.id

    // Carregar registro atualizado
    const updated = $app.findRecordById('form_submissions', createdRecordId)

    return e.json(200, {
      testId: createdRecordId,
      email_delivery_status: updated.getString('email_delivery_status'),
      pdf_attached_to_email: updated.getBool('pdf_attached_to_email'),
      email_sent_at: updated.getString('email_sent_at'),
      email_delivery_error: updated.getString('email_delivery_error'),
    })
  } catch (err) {
    return e.json(500, { error: String(err) })
  }
})

routerAdd('GET', '/backend/v1/client-ip', (e) => {
  let ip = 'Nao disponivel'
  try {
    const xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
    if (xForwardedFor) {
      const parts = xForwardedFor.split(',')
      if (parts.length > 0 && parts[0].trim()) {
        const candidate = parts[0].trim()
        if (candidate && candidate !== '127.0.0.1' && candidate !== '::1') ip = candidate
      }
    }
    if (ip === 'Nao disponivel') {
      const realIp = e.request.header.get('X-Real-IP') || ''
      if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') ip = realIp.trim()
    }
    if (ip === 'Nao disponivel') {
      const cfIp = e.request.header.get('CF-Connecting-IP') || ''
      if (cfIp) ip = cfIp.trim()
    }
  } catch (_) {}
  return e.json(200, { ip })
})

// 3. Custom endpoint: Send verification code to patient email
routerAdd('POST', '/backend/v1/forms/send-verification-code', (e) => {
  const info = e.requestInfo()
  const token = info.body.token
  const email = (info.body.email || '').trim().toLowerCase()
  const patientName = (info.body.patient_name || 'Paciente').trim()

  if (!token || !email) {
    return e.json(400, { error: 'Token da ficha e e-mail sao obrigatorios' })
  }

  try {
    const records = $app.findRecordsByFilter('form_submissions', `token = "${token}"`, '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha nao encontrada' })
    }
    const formRecord = records[0]

    // Generate 6-digit numeric verification code
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins

    // Save verification in DB
    const verifCol = $app.findCollectionByNameOrId('email_verifications')
    const verifRec = new Record(verifCol)
    verifRec.set('form_submission', formRecord.id)
    verifRec.set('email', email)
    verifRec.set('code', code)
    verifRec.set('verified', false)
    verifRec.set('expires_at', expiresAt)
    $app.save(verifRec)

    // Build email
    let sender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
    try {
      const list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (list.length > 0 && list[0].getString('sender_email')) {
        sender = list[0].getString('sender_email')
      }
    } catch (_) {}

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #831843; color: white; padding: 16px; text-align: center; border-radius: 6px 6px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">Andresa Souza Clinic</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px;">Codigo de Verificacao de E-mail</p>
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="font-size: 14px; text-align: left;">Ola, <strong>${patientName}</strong>!</p>
          <p style="font-size: 13px; color: #475569; text-align: left;">
            Para validar seu e-mail e receber com seguranca o comprovante oficial da sua ficha de anamnese, digite o codigo abaixo:
          </p>
          <div style="background-color: #fdf2f8; border: 2px dashed #db2777; border-radius: 8px; padding: 16px; margin: 20px 0; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #831843; font-family: monospace;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Este codigo e valido por 15 minutos. Se voce nao solicitou, por favor desconsidere.
          </p>
        </div>
      </div>
    `
    const text = `Seu codigo de validacao da Ficha de Anamnese da Andresa Souza Clinic e: ${code}\nValido por 15 minutos.`

    let sent = false
    if (typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
      try {
        let res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
          from: sender,
          to: [email],
          subject: `Seu Codigo de Validacao: ${code} - Andresa Souza Clinic`,
          html: html,
          text: text,
        })
        if (!res || !res.successful) {
          res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
            from: 'Andresa Souza Clinic <onboarding@resend.dev>',
            to: [email],
            subject: `Seu Codigo de Validacao: ${code} - Andresa Souza Clinic`,
            html: html,
            text: text,
          })
        }
        if (res && res.successful) sent = true
      } catch (_) {}
    }

    if (!sent) {
      try {
        const msg = new MailerMessage({
          from: {
            address: sender.includes('<') ? sender.split('<')[1].replace('>', '').trim() : sender,
            name: sender.includes('<') ? sender.split('<')[0].trim() : 'Andresa Souza Clinic',
          },
          to: [{ address: email }],
          subject: `Seu Codigo de Validacao: ${code} - Andresa Souza Clinic`,
          html: html,
          text: text,
        })
        $app.newMailClient().send(msg)
      } catch (errM) {
        console.log('Mailer client error sending code:', errM)
      }
    }

    return e.json(200, {
      success: true,
      message: 'Codigo de verificacao enviado para o e-mail informado',
    })
  } catch (err) {
    console.log('Error in send-verification-code:', err)
    return e.json(500, { error: 'Erro ao gerar e enviar codigo: ' + String(err) })
  }
})

// 4. Custom endpoint: Verify email code
routerAdd('POST', '/backend/v1/forms/verify-email-code', (e) => {
  const info = e.requestInfo()
  const token = info.body.token
  const email = (info.body.email || '').trim().toLowerCase()
  const code = (info.body.code || '').trim()

  if (!token || !email || !code) {
    return e.json(400, { error: 'Token, e-mail e codigo sao obrigatorios' })
  }

  try {
    const records = $app.findRecordsByFilter('form_submissions', `token = "${token}"`, '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha nao encontrada' })
    }
    const formRecord = records[0]

    const verifs = $app.findRecordsByFilter(
      'email_verifications',
      `form_submission = "${formRecord.id}" && email = "${email}" && code = "${code}" && verified = false`,
      '-created',
      1,
      0,
    )

    if (verifs.length === 0) {
      return e.json(400, { error: 'Codigo de verificacao invalido ou expirado' })
    }

    const verif = verifs[0]
    const expiresAt = new Date(verif.getString('expires_at'))
    if (expiresAt < new Date()) {
      return e.json(400, { error: 'O codigo informado expirou. Solicite um novo codigo.' })
    }

    const nowIso = new Date().toISOString()
    verif.set('verified', true)
    verif.set('verified_at', nowIso)
    $app.save(verif)

    if (formRecord.getString('status') === 'pendente') {
      formRecord.set('status', 'codigo_validado')
    }
    formRecord.set('email_code_verified_at', nowIso)
    formRecord.set('patient_email', email)
    $app.save(formRecord)

    // Register audit event inline
    try {
      let clientIp = 'Nao disponivel'
      const xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
      if (xForwardedFor) {
        const parts = xForwardedFor.split(',')
        if (parts.length > 0 && parts[0].trim() && parts[0].trim() !== '127.0.0.1')
          clientIp = parts[0].trim()
      }
      const auditCol = $app.findCollectionByNameOrId('audit_events')
      const auditRec = new Record(auditCol)
      auditRec.set('form_submission', formRecord.id)
      auditRec.set('event_type', 'codigo_validado')
      auditRec.set('description', `Codigo de e-mail (${code}) validado com sucesso para ${email}`)
      auditRec.set('ip_address', clientIp)
      auditRec.set('user_agent', e.request.header.get('User-Agent') || '')
      auditRec.set('timestamp', nowIso)
      $app.save(auditRec)
    } catch (_) {}

    return e.json(200, { success: true, message: 'Codigo validado com sucesso!' })
  } catch (err) {
    console.log('Error verifying email code:', err)
    return e.json(500, { error: 'Erro ao validar codigo: ' + String(err) })
  }
})

// 5. Custom endpoint: Record audit event from patient flow
routerAdd('POST', '/backend/v1/forms/audit-event', (e) => {
  const info = e.requestInfo()
  const token = info.body.token
  const eventType = info.body.event_type
  const description = info.body.description || ''
  const stepNumber = info.body.step_number || 0
  const metadata = info.body.metadata || {}

  if (!token || !eventType) {
    return e.json(400, { error: 'Token e event_type sao obrigatorios' })
  }

  try {
    const records = $app.findRecordsByFilter('form_submissions', `token = "${token}"`, '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha nao encontrada' })
    }
    const formRecord = records[0]

    let clientIp = 'Nao disponivel'
    try {
      const xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
      if (xForwardedFor) {
        const parts = xForwardedFor.split(',')
        if (parts.length > 0 && parts[0].trim() && parts[0].trim() !== '127.0.0.1')
          clientIp = parts[0].trim()
      }
    } catch (_) {}

    const auditCol = $app.findCollectionByNameOrId('audit_events')
    const auditRec = new Record(auditCol)
    auditRec.set('form_submission', formRecord.id)
    auditRec.set('event_type', eventType)
    auditRec.set('description', description)
    auditRec.set('step_number', stepNumber)
    auditRec.set('ip_address', clientIp)
    auditRec.set('user_agent', e.request.header.get('User-Agent') || '')
    auditRec.set('metadata', JSON.stringify(metadata))
    auditRec.set('timestamp', new Date().toISOString())
    $app.save(auditRec)

    return e.json(200, { success: true })
  } catch (err) {
    console.log('Error recording audit event:', err)
    return e.json(500, { error: 'Erro ao registrar evento de auditoria: ' + String(err) })
  }
})

// 6. Custom endpoint to download / view complete PDF generated by server
routerAdd('GET', '/backend/v1/forms/{id}/pdf', (e) => {
  const id = e.request.pathValue('id')
  const via = e.request.url.query().get('via') || 'clinica' // 'paciente' or 'clinica'

  try {
    const record = $app.findRecordById('form_submissions', id)
    const isPatientCopy = via === 'paciente'

    // Inline PDF generator
    const sanitizePdf = (str) => {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\\()]/g, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, ' ')
        .trim()
    }

    const strToBytes = (str) => {
      const bytes = []
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xff)
      }
      return bytes
    }

    const bytesToStr = (bytes) => {
      let result = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize)
        result += String.fromCharCode.apply(null, chunk)
      }
      return result
    }

    const formatBrDateTime = (isoDateStr) => {
      try {
        const d = isoDateStr ? new Date(isoDateStr) : new Date()
        const brMs = d.getTime() - 3 * 3600 * 1000
        const brDate = new Date(brMs)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(brDate.getUTCDate())}/${pad(brDate.getUTCMonth() + 1)}/${brDate.getUTCFullYear()} as ${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())} (horario de Brasilia)`
      } catch (_) {
        return 'Data e hora registradas'
      }
    }

    const formatBrDateForFilename = (isoDateStr) => {
      try {
        const d = isoDateStr ? new Date(isoDateStr) : new Date()
        const brMs = d.getTime() - 3 * 3600 * 1000
        const brDate = new Date(brMs)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(brDate.getUTCDate())}-${pad(brDate.getUTCMonth() + 1)}-${brDate.getUTCFullYear()}`
      } catch (_) {
        return '2026-10-31'
      }
    }

    let settings = {
      clinic_name: 'Andresa Souza Clinic',
      technical_responsible: 'Dra. Andresa Souza',
      professional_register: '',
      phone: '',
      clinic_address: '',
    }
    try {
      const list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (list.length > 0) {
        const s = list[0]
        const p = s.getString('phone')
        const reg = s.getString('professional_register')
        const addr = s.getString('clinic_address')
        settings = {
          clinic_name: s.getString('clinic_name') || settings.clinic_name,
          technical_responsible:
            s.getString('technical_responsible') || settings.technical_responsible,
          professional_register: reg && !reg.includes('12345') ? reg : '',
          phone: p && !p.includes('99999-8888') ? p : '',
          clinic_address: addr && !addr.includes('Paulista') ? addr : '',
        }
      }
    } catch (_) {}

    const pName = record.getString('patient_name') || 'Paciente'
    const pCpf = record.getString('patient_cpf') || 'Nao informado'
    const pEmail = record.getString('patient_email') || 'Nao informado'
    const pPhone = record.getString('patient_phone') || 'Nao informado'
    const pBirth = record.getString('patient_birth_date') || 'Nao informado'
    const pRg = record.getString('patient_rg') || 'Nao informado'
    const pAddress = record.getString('patient_address') || 'Nao informado'
    const pProf = record.getString('patient_profession') || 'Nao informado'
    const pEmerg = record.getString('patient_emergency_contact') || 'Nao informado'
    const fType = record.getString('form_type')
    const sAt = record.getString('signed_at') || record.getString('created')
    const dHash = record.getString('document_hash') || 'N/A'
    const ip = record.getString('ip_address') || 'Nao disponivel'
    const ua = record.getString('user_agent') || 'Nao disponivel'
    const tTitle =
      record.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
    const tText = record.getString('accepted_term_text') || ''

    const typeLabels = {
      geral: 'Anamnese Estetica Geral',
      labios: 'Labios & Micropigmentacao Labial',
      botox: 'Toxina Botulinica (Botox)',
    }
    const pLabel = typeLabels[fType] || fType || 'Anamnese'
    const brTime = formatBrDateTime(sAt)

    const answersList = []
    try {
      const rawAnswers = record.getString('answers')
      if (rawAnswers) {
        const parsed = JSON.parse(rawAnswers)
        if (parsed && typeof parsed === 'object') {
          for (const k of Object.keys(parsed)) {
            let val = parsed[k]
            if (typeof val === 'boolean') val = val ? 'Sim' : 'Nao'
            if (Array.isArray(val)) val = val.join(', ')
            answersList.push(`${k.replace(/_/g, ' ')}: ${val}`)
          }
        }
      }
    } catch (_) {}

    const pages = []
    let currentLines = []
    const flush = () => {
      if (currentLines.length > 0) {
        pages.push(currentLines)
        currentLines = []
      }
    }
    const pushLine = (txt, isBold = false, size = 9, color = [0.1, 0.1, 0.1]) => {
      if (currentLines.length >= 48) flush()
      currentLines.push({ text: sanitizePdf(txt), isBold, size, color })
    }
    const pushDiv = () => {
      pushLine(
        '------------------------------------------------------------------------------------------------',
        false,
        8,
        [0.7, 0.7, 0.7],
      )
    }

    pushLine(
      'ANDRESA SOUZA CLINIC - FICHA OFICIAL DE ANAMNESE E TERMO ASSINADO',
      true,
      11,
      [0.51, 0.09, 0.26],
    )
    pushLine(
      `Procedimento: ${pLabel} | Via: ${isPatientCopy ? 'Via do Paciente' : 'Via da Clinica (Prontuario)'}`,
      false,
      9,
      [0.3, 0.3, 0.3],
    )
    pushDiv()

    pushLine('1. DADOS CADASTRAIS DO PACIENTE', true, 10, [0.51, 0.09, 0.26])
    pushLine(`Nome Completo: ${pName}    |    CPF: ${pCpf}`, false, 9)
    pushLine(`E-mail: ${pEmail}    |    Telefone: ${pPhone}`, false, 9)
    pushLine(`Nascimento: ${pBirth}    |    RG: ${pRg}`, false, 9)
    pushLine(`Profissao: ${pProf}    |    Emergencia: ${pEmerg}`, false, 9)
    pushLine(`Endereco Residencial: ${pAddress}`, false, 9)
    pushDiv()

    pushLine(
      '2. QUESTIONARIO DE SAUDE E ANAMNESE CLINICA (RESPOSTAS COMPLETAS)',
      true,
      10,
      [0.51, 0.09, 0.26],
    )
    if (answersList.length === 0) {
      pushLine('Nenhuma resposta registrada (ficha pendente).', false, 9, [0.4, 0.4, 0.4])
    } else {
      for (let i = 0; i < answersList.length; i++) {
        const ans = answersList[i]
        if (ans.length <= 88) {
          pushLine(` * ${ans}`, false, 9)
        } else {
          pushLine(` * ${ans.substring(0, 85)}`, false, 9)
          let pos = 85
          while (pos < ans.length) {
            pushLine(`   ${ans.substring(pos, pos + 85)}`, false, 9)
            pos += 85
          }
        }
      }
    }
    pushDiv()

    pushLine('3. TERMO DE CONSENTIMENTO ACEITO INTEGRALMENTE', true, 10, [0.51, 0.09, 0.26])
    pushLine(tTitle, true, 9)
    const cleanT = sanitizePdf(tText)
    const paras = cleanT.split(/(?:\r?\n)+/)
    for (let pIdx = 0; pIdx < paras.length; pIdx++) {
      const pr = paras[pIdx].trim()
      if (!pr) continue
      let pos = 0
      while (pos < pr.length) {
        pushLine(pr.substring(pos, pos + 90), false, 8.5)
        pos += 90
      }
    }
    pushDiv()

    pushLine(
      '4. REGISTRO DE AUDITORIA DIGITAL & CERTIFICADO DE ASSINATURA ELETRONICA',
      true,
      10,
      [0.51, 0.09, 0.26],
    )
    pushLine(`Data e Hora do Aceite: ${brTime}`, false, 9)
    pushLine(`IP de Origem Real: ${ip}`, false, 9)
    pushLine(`Dispositivo / User-Agent: ${ua.substring(0, 80)}`, false, 8)
    pushLine(`Hash SHA-256 de Integridade: ${dHash}`, true, 8, [0.1, 0.1, 0.1])
    pushLine(
      'Codigo de verificacao de integridade - garante que este documento nao foi alterado.',
      false,
      7.5,
      [0.4, 0.4, 0.4],
    )
    pushLine(
      `[Assinatura Eletronica Autenticada - Paciente: ${pName}]`,
      true,
      8.5,
      [0.51, 0.09, 0.26],
    )

    let clinicFoot = `Clinica: ${settings.clinic_name}`
    if (settings.technical_responsible)
      clinicFoot += ` | Resp. Tecnica: ${settings.technical_responsible}`
    if (settings.professional_register) clinicFoot += ` (${settings.professional_register})`
    if (settings.phone) clinicFoot += ` | Tel: ${settings.phone}`
    clinicFoot += ` | Fuso: Horario de Brasilia (UTC-3)`
    pushLine(clinicFoot, false, 7.5, [0.3, 0.3, 0.3])
    if (settings.clinic_address) {
      pushLine(`Endereco: ${settings.clinic_address}`, false, 7.5, [0.3, 0.3, 0.3])
    }

    if (isPatientCopy) {
      pushDiv()
      pushLine(
        'Esta e a sua via do documento assinado. Guarde para seus registros.',
        true,
        8.5,
        [0.03, 0.4, 0.25],
      )
    }

    flush()
    if (pages.length === 0) pages.push([])

    const totalPages = pages.length
    let nextObjId = 1
    const catalogId = nextObjId++
    const pagesId = nextObjId++
    const fontNormId = nextObjId++
    const fontBoldId = nextObjId++

    const pObjIds = []
    const cObjIds = []
    for (let i = 0; i < totalPages; i++) {
      pObjIds.push(nextObjId++)
      cObjIds.push(nextObjId++)
    }

    const objects = []
    objects.push({ id: catalogId, content: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` })
    const kids = pObjIds.map((id) => `${id} 0 R`).join(' ')
    objects.push({
      id: pagesId,
      content: `<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>`,
    })
    objects.push({
      id: fontNormId,
      content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    })
    objects.push({
      id: fontBoldId,
      content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
    })

    for (let p = 0; p < totalPages; p++) {
      const pLines = pages[p]
      const curPId = pObjIds[p]
      const curCId = cObjIds[p]

      objects.push({
        id: curPId,
        content: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${curCId} 0 R /Resources << /Font << /F1 ${fontNormId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
      })

      let streamText = 'BT\n40 805 Td\n'
      for (let l = 0; l < pLines.length; l++) {
        const item = pLines[l]
        const fRef = item.isBold ? '/F2' : '/F1'
        const col = item.color || [0.1, 0.1, 0.1]
        const r = col[0].toFixed(2)
        const g = col[1].toFixed(2)
        const b = col[2].toFixed(2)
        const fSize = item.size || 9
        const leading = fSize + 4

        streamText += `${r} ${g} ${b} rg\n${fRef} ${fSize} Tf\n${leading} TL\n(${item.text}) Tj T*\n`
      }
      streamText += `0.5 0.5 0.5 rg\n/F1 7.5 Tf\n(Pagina ${p + 1} de ${totalPages}) Tj\nET\n`

      const streamBytes = strToBytes(streamText)
      objects.push({
        id: curCId,
        rawBytes: strToBytes(`<< /Length ${streamBytes.length} >>\nstream\n`)
          .concat(streamBytes)
          .concat(strToBytes('\nendstream')),
      })
    }

    let pdf = strToBytes('%PDF-1.4\n')
    const offsets = {}
    objects.sort((a, b) => a.id - b.id)

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i]
      offsets[obj.id] = pdf.length
      pdf = pdf.concat(strToBytes(`${obj.id} 0 obj\n`))
      if (obj.rawBytes) {
        pdf = pdf.concat(obj.rawBytes)
      } else {
        pdf = pdf.concat(strToBytes(obj.content))
      }
      pdf = pdf.concat(strToBytes('\nendobj\n'))
    }

    const xrefOff = pdf.length
    const pad10 = (n) => String(n).padStart(10, '0')
    let xrefStr = `xref\n0 ${nextObjId}\n0000000000 65535 f \n`
    for (let id = 1; id < nextObjId; id++) {
      xrefStr += `${pad10(offsets[id] || 0)} 00000 n \n`
    }
    xrefStr += `trailer\n<< /Size ${nextObjId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`
    pdf = pdf.concat(strToBytes(xrefStr))

    const cleanPatient = sanitizePdf(pName).replace(/[^a-zA-Z0-9]/g, '-')
    const fDate = formatBrDateForFilename(sAt)
    const filename = `Ficha-Anamnese-${cleanPatient}-${fDate}.pdf`

    e.response.header().set('Content-Type', 'application/pdf')
    e.response.header().set('Content-Disposition', `inline; filename="${filename}"`)
    return e.string(200, bytesToStr(pdf))
  } catch (err) {
    console.log('Error generating PDF:', err)
    return e.json(404, { error: 'Ficha nao encontrada para emissao de PDF' })
  }
})

// 7. Custom endpoint to resend receipt email manually from panel
routerAdd('POST', '/backend/v1/forms/resend-email', (e) => {
  const info = e.requestInfo()
  const id = info.body.id
  if (!id) {
    return e.json(400, { error: 'ID da ficha e obrigatorio' })
  }

  try {
    const record = $app.findRecordById('form_submissions', id)
    const patientEmail = record.getString('patient_email')
    if (!patientEmail) {
      return e.json(400, { error: 'Ficha nao possui e-mail de paciente preenchido' })
    }

    const sanitizePdf = (str) => {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\\()]/g, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, ' ')
        .trim()
    }

    const strToBytes = (str) => {
      const bytes = []
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xff)
      }
      return bytes
    }

    const bytesToStr = (bytes) => {
      let result = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize)
        result += String.fromCharCode.apply(null, chunk)
      }
      return result
    }

    const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const bytesToB64 = (bytes) => {
      let result = ''
      const len = bytes.length
      let i = 0
      while (i < len) {
        const b0 = bytes[i++]
        const b1 = i < len ? bytes[i++] : NaN
        const b2 = i < len ? bytes[i++] : NaN

        const c0 = b0 >> 2
        const c1 = ((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4)
        const c2 = isNaN(b1) ? 64 : ((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6)
        const c3 = isNaN(b2) ? 64 : b2 & 63

        result +=
          B64_CHARS.charAt(c0) +
          B64_CHARS.charAt(c1) +
          (c2 === 64 ? '=' : B64_CHARS.charAt(c2)) +
          (c3 === 64 ? '=' : B64_CHARS.charAt(c3))
      }
      return result
    }

    const formatBrDateTime = (isoDateStr) => {
      try {
        const d = isoDateStr ? new Date(isoDateStr) : new Date()
        const brMs = d.getTime() - 3 * 3600 * 1000
        const brDate = new Date(brMs)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(brDate.getUTCDate())}/${pad(brDate.getUTCMonth() + 1)}/${brDate.getUTCFullYear()} as ${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())} (horario de Brasilia)`
      } catch (_) {
        return 'Data e hora registradas'
      }
    }

    const formatBrDateForFilename = (isoDateStr) => {
      try {
        const d = isoDateStr ? new Date(isoDateStr) : new Date()
        const brMs = d.getTime() - 3 * 3600 * 1000
        const brDate = new Date(brMs)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(brDate.getUTCDate())}-${pad(brDate.getUTCMonth() + 1)}-${brDate.getUTCFullYear()}`
      } catch (_) {
        return '2026-10-31'
      }
    }

    let settings = {
      clinic_name: 'Andresa Souza Clinic',
      notification_email: 'gihobaicn@hotmail.com',
      phone: '',
      sender_email: 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
      technical_responsible: 'Dra. Andresa Souza',
      professional_register: '',
      clinic_address: '',
    }
    try {
      const list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (list.length > 0) {
        const s = list[0]
        const p = s.getString('phone')
        const reg = s.getString('professional_register')
        const addr = s.getString('clinic_address')
        settings = {
          clinic_name: s.getString('clinic_name') || settings.clinic_name,
          notification_email: s.getString('notification_email') || settings.notification_email,
          phone: p && !p.includes('99999-8888') ? p : '',
          sender_email: s.getString('sender_email') || settings.sender_email,
          technical_responsible:
            s.getString('technical_responsible') || settings.technical_responsible,
          professional_register: reg && !reg.includes('12345') ? reg : '',
          clinic_address: addr && !addr.includes('Paulista') ? addr : '',
        }
      }
    } catch (_) {}

    const clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

    // Inline generator
    const generatePdf = (rec, isPatientCopy) => {
      const pName = rec.getString('patient_name') || 'Paciente'
      const pCpf = rec.getString('patient_cpf') || 'Nao informado'
      const pEmail = rec.getString('patient_email') || 'Nao informado'
      const pPhone = rec.getString('patient_phone') || 'Nao informado'
      const pBirth = rec.getString('patient_birth_date') || 'Nao informado'
      const pRg = rec.getString('patient_rg') || 'Nao informado'
      const pAddress = rec.getString('patient_address') || 'Nao informado'
      const pProf = rec.getString('patient_profession') || 'Nao informado'
      const pEmerg = rec.getString('patient_emergency_contact') || 'Nao informado'
      const fType = rec.getString('form_type')
      const sAt = rec.getString('signed_at') || rec.getString('created')
      const dHash = rec.getString('document_hash') || 'N/A'
      const ip = rec.getString('ip_address') || 'Nao disponivel'
      const ua = rec.getString('user_agent') || 'Nao disponivel'
      const tTitle =
        rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
      const tText = rec.getString('accepted_term_text') || ''

      const typeLabels = {
        geral: 'Anamnese Estetica Geral',
        labios: 'Labios & Micropigmentacao Labial',
        botox: 'Toxina Botulinica (Botox)',
      }
      const pLabel = typeLabels[fType] || fType || 'Anamnese'
      const brTime = formatBrDateTime(sAt)

      const answersList = []
      try {
        const rawAnswers = rec.getString('answers')
        if (rawAnswers) {
          const parsed = JSON.parse(rawAnswers)
          if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
              let val = parsed[k]
              if (typeof val === 'boolean') val = val ? 'Sim' : 'Nao'
              if (Array.isArray(val)) val = val.join(', ')
              answersList.push(`${k.replace(/_/g, ' ')}: ${val}`)
            }
          }
        }
      } catch (_) {}

      const pages = []
      let currentLines = []
      const flush = () => {
        if (currentLines.length > 0) {
          pages.push(currentLines)
          currentLines = []
        }
      }
      const pushLine = (txt, isBold = false, size = 9, color = [0.1, 0.1, 0.1]) => {
        if (currentLines.length >= 48) flush()
        currentLines.push({ text: sanitizePdf(txt), isBold, size, color })
      }
      const pushDiv = () => {
        pushLine(
          '------------------------------------------------------------------------------------------------',
          false,
          8,
          [0.7, 0.7, 0.7],
        )
      }

      pushLine(
        'ANDRESA SOUZA CLINIC - FICHA OFICIAL DE ANAMNESE E TERMO ASSINADO',
        true,
        11,
        [0.51, 0.09, 0.26],
      )
      pushLine(
        `Procedimento: ${pLabel} | Via: ${isPatientCopy ? 'Via do Paciente' : 'Via da Clinica (Prontuario)'}`,
        false,
        9,
        [0.3, 0.3, 0.3],
      )
      pushDiv()

      pushLine('1. DADOS CADASTRAIS DO PACIENTE', true, 10, [0.51, 0.09, 0.26])
      pushLine(`Nome Completo: ${pName}    |    CPF: ${pCpf}`, false, 9)
      pushLine(`E-mail: ${pEmail}    |    Telefone: ${pPhone}`, false, 9)
      pushLine(`Nascimento: ${pBirth}    |    RG: ${pRg}`, false, 9)
      pushLine(`Profissao: ${pProf}    |    Emergencia: ${pEmerg}`, false, 9)
      pushLine(`Endereco Residencial: ${pAddress}`, false, 9)
      pushDiv()

      pushLine(
        '2. QUESTIONARIO DE SAUDE E ANAMNESE CLINICA (RESPOSTAS COMPLETAS)',
        true,
        10,
        [0.51, 0.09, 0.26],
      )
      if (answersList.length === 0) {
        pushLine('Nenhuma resposta registrada (ficha pendente).', false, 9, [0.4, 0.4, 0.4])
      } else {
        for (let i = 0; i < answersList.length; i++) {
          const ans = answersList[i]
          if (ans.length <= 88) {
            pushLine(` * ${ans}`, false, 9)
          } else {
            pushLine(` * ${ans.substring(0, 85)}`, false, 9)
            let pos = 85
            while (pos < ans.length) {
              pushLine(`   ${ans.substring(pos, pos + 85)}`, false, 9)
              pos += 85
            }
          }
        }
      }
      pushDiv()

      pushLine('3. TERMO DE CONSENTIMENTO ACEITO INTEGRALMENTE', true, 10, [0.51, 0.09, 0.26])
      pushLine(tTitle, true, 9)
      const cleanT = sanitizePdf(tText)
      const paras = cleanT.split(/(?:\r?\n)+/)
      for (let pIdx = 0; pIdx < paras.length; pIdx++) {
        const pr = paras[pIdx].trim()
        if (!pr) continue
        let pos = 0
        while (pos < pr.length) {
          pushLine(pr.substring(pos, pos + 90), false, 8.5)
          pos += 90
        }
      }
      pushDiv()

      pushLine(
        '4. REGISTRO DE AUDITORIA DIGITAL & CERTIFICADO DE ASSINATURA ELETRONICA',
        true,
        10,
        [0.51, 0.09, 0.26],
      )
      pushLine(`Data e Hora do Aceite: ${brTime}`, false, 9)
      pushLine(`IP de Origem Real: ${ip}`, false, 9)
      pushLine(`Dispositivo / User-Agent: ${ua.substring(0, 80)}`, false, 8)
      pushLine(`Hash SHA-256 de Integridade: ${dHash}`, true, 8, [0.1, 0.1, 0.1])
      pushLine(
        'Codigo de verificacao de integridade - garante que este documento nao foi alterado.',
        false,
        7.5,
        [0.4, 0.4, 0.4],
      )
      pushLine(
        `[Assinatura Eletronica Autenticada - Paciente: ${pName}]`,
        true,
        8.5,
        [0.51, 0.09, 0.26],
      )

      let clinicFoot = `Clinica: ${settings.clinic_name}`
      if (settings.technical_responsible)
        clinicFoot += ` | Resp. Tecnica: ${settings.technical_responsible}`
      if (settings.professional_register) clinicFoot += ` (${settings.professional_register})`
      if (settings.phone) clinicFoot += ` | Tel: ${settings.phone}`
      clinicFoot += ` | Fuso: Horario de Brasilia (UTC-3)`
      pushLine(clinicFoot, false, 7.5, [0.3, 0.3, 0.3])
      if (settings.clinic_address) {
        pushLine(`Endereco: ${settings.clinic_address}`, false, 7.5, [0.3, 0.3, 0.3])
      }

      if (isPatientCopy) {
        pushDiv()
        pushLine(
          'Esta e a sua via do documento assinado. Guarde para seus registros.',
          true,
          8.5,
          [0.03, 0.4, 0.25],
        )
      }

      flush()
      if (pages.length === 0) pages.push([])

      const totalPages = pages.length
      let nextObjId = 1
      const catalogId = nextObjId++
      const pagesId = nextObjId++
      const fontNormId = nextObjId++
      const fontBoldId = nextObjId++

      const pObjIds = []
      const cObjIds = []
      for (let i = 0; i < totalPages; i++) {
        pObjIds.push(nextObjId++)
        cObjIds.push(nextObjId++)
      }

      const objects = []
      objects.push({ id: catalogId, content: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` })
      const kids = pObjIds.map((id) => `${id} 0 R`).join(' ')
      objects.push({
        id: pagesId,
        content: `<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>`,
      })
      objects.push({
        id: fontNormId,
        content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
      })
      objects.push({
        id: fontBoldId,
        content: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`,
      })

      for (let p = 0; p < totalPages; p++) {
        const pLines = pages[p]
        const curPId = pObjIds[p]
        const curCId = cObjIds[p]

        objects.push({
          id: curPId,
          content: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${curCId} 0 R /Resources << /Font << /F1 ${fontNormId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
        })

        let streamText = 'BT\n40 805 Td\n'
        for (let l = 0; l < pLines.length; l++) {
          const item = pLines[l]
          const fRef = item.isBold ? '/F2' : '/F1'
          const col = item.color || [0.1, 0.1, 0.1]
          const r = col[0].toFixed(2)
          const g = col[1].toFixed(2)
          const b = col[2].toFixed(2)
          const fSize = item.size || 9
          const leading = fSize + 4

          streamText += `${r} ${g} ${b} rg\n${fRef} ${fSize} Tf\n${leading} TL\n(${item.text}) Tj T*\n`
        }
        streamText += `0.5 0.5 0.5 rg\n/F1 7.5 Tf\n(Pagina ${p + 1} de ${totalPages}) Tj\nET\n`

        const streamBytes = strToBytes(streamText)
        objects.push({
          id: curCId,
          rawBytes: strToBytes(`<< /Length ${streamBytes.length} >>\nstream\n`)
            .concat(streamBytes)
            .concat(strToBytes('\nendstream')),
        })
      }

      let pdf = strToBytes('%PDF-1.4\n')
      const offsets = {}
      objects.sort((a, b) => a.id - b.id)

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i]
        offsets[obj.id] = pdf.length
        pdf = pdf.concat(strToBytes(`${obj.id} 0 obj\n`))
        if (obj.rawBytes) {
          pdf = pdf.concat(obj.rawBytes)
        } else {
          pdf = pdf.concat(strToBytes(obj.content))
        }
        pdf = pdf.concat(strToBytes('\nendobj\n'))
      }

      const xrefOff = pdf.length
      const pad10 = (n) => String(n).padStart(10, '0')
      let xrefStr = `xref\n0 ${nextObjId}\n0000000000 65535 f \n`
      for (let id = 1; id < nextObjId; id++) {
        xrefStr += `${pad10(offsets[id] || 0)} 00000 n \n`
      }
      xrefStr += `trailer\n<< /Size ${nextObjId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`
      pdf = pdf.concat(strToBytes(xrefStr))

      const cleanPatient = sanitizePdf(pName).replace(/[^a-zA-Z0-9]/g, '-')
      const fDate = formatBrDateForFilename(sAt)
      const filename = `Ficha-Anamnese-${cleanPatient}-${fDate}.pdf`

      return {
        bytes: pdf,
        pdfBytes: bytesToStr(pdf),
        base64: bytesToB64(pdf),
        filename,
      }
    }

    // Build email
    const buildEmail = (rec, isPatientCopy) => {
      const pName = rec.getString('patient_name') || 'Paciente'
      const pCpf = rec.getString('patient_cpf') || '-'
      const pEmail = rec.getString('patient_email') || ''
      const fType = rec.getString('form_type')
      const sAt = rec.getString('signed_at') || rec.getString('created')
      const dHash = rec.getString('document_hash') || 'N/A'
      const tTitle =
        rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
      const ip = rec.getString('ip_address') || 'Nao disponivel'
      const ua = rec.getString('user_agent') || 'Nao disponivel'
      const sig = rec.getString('signature_data') || ''

      const typeLabels = {
        geral: 'Anamnese Geral',
        labios: 'Labios & Micropigmentacao Labial',
        botox: 'Toxina Botulinica (Botox)',
      }
      const pLabel = typeLabels[fType] || fType || 'Anamnese'
      const brTime = formatBrDateTime(sAt)

      const sigHtml = sig
        ? `<div style="margin: 16px 0; text-align: center;">
             <img src="${sig}" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />
             <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
           </div>`
        : `<p style="font-style: italic; color: #64748b;">[Assinatura eletronica autenticada]</p>`

      let clinicFooterHtml = `<strong>${settings.clinic_name}</strong>`
      if (settings.technical_responsible) {
        clinicFooterHtml += ` &bull; Responsavel Tecnica: ${settings.technical_responsible}`
        if (settings.professional_register)
          clinicFooterHtml += ` (${settings.professional_register})`
      }
      if (settings.clinic_address) {
        clinicFooterHtml += `<br/>Endereco: ${settings.clinic_address}`
      }
      if (settings.phone) {
        clinicFooterHtml += ` &bull; Telefone: ${settings.phone}`
      }
      clinicFooterHtml += `<br/>Fuso horario: Horario de Brasilia (UTC-3)`

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head><meta charset="UTF-8"><title>Comprovante: Ficha de Anamnese Assinada</title></head>
        <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
          <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #831843; color: #ffffff; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Andresa Souza Clinic</h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.95;">Comprovante de Ficha de Anamnese e Termo Assinado</p>
            </div>
            <div style="padding: 24px;">
              <p style="font-size: 15px; margin-top: 0;">Ola, <strong>${pName}</strong>!</p>
              <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                Reenviamos a confirmacao e comprovante oficial da sua Ficha de Anamnese e Termo de Consentimento.
                ${isPatientCopy ? 'Esta e a sua via oficial do documento assinado.' : 'Esta e a notificacao oficial registrada para o prontuario da clinica.'}
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; color: #166534;">
                <strong>O documento completo em PDF esta anexado a esta mensagem.</strong>
                ${isPatientCopy ? '<br/><span style="display:inline-block; margin-top:4px; font-weight:600;">Esta e a sua via do documento assinado. Guarde para seus registros.</span>' : ''}
              </div>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
                <tr style="background-color: #fdf2f8; border-bottom: 1px solid #fbcfe8;">
                  <td style="padding: 10px 12px; font-weight: bold; width: 38%; color: #831843;">Tipo de Procedimento:</td>
                  <td style="padding: 10px 12px; font-weight: bold; color: #1e293b;">${pLabel}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Nome Completo:</td>
                  <td style="padding: 10px 12px;">${pName}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">CPF:</td>
                  <td style="padding: 10px 12px;">${pCpf}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Data e Hora do Aceite:</td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #0f172a;">${brTime}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versao Aceita:</td>
                  <td style="padding: 10px 12px;">${tTitle}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Enviado para:</td>
                  <td style="padding: 10px 12px; color: #0369a1; font-weight: 600;">${pEmail}</td>
                </tr>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">IP de Origem REAL:</td>
                  <td style="padding: 10px 12px; font-family: monospace;">${ip}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Dispositivo / Navegador:</td>
                  <td style="padding: 10px 12px; font-size: 11px; color: #64748b; word-break: break-all;">${ua}</td>
                </tr>
              </table>
              <div style="background-color: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; margin: 18px 0;">
                ${sigHtml}
              </div>
              <div style="background-color: #f1f5f9; border-left: 4px solid #831843; padding: 12px; margin: 18px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #0f172a;">Hash SHA-256 do Documento:</p>
                <p style="margin: 4px 0 0 0; font-family: monospace; font-size: 11px; word-break: break-all; color: #334155;">${dHash}</p>
                <p style="margin: 6px 0 0 0; font-size: 11px; color: #64748b; font-style: italic;">
                  Codigo de verificacao de integridade - garante que este documento nao foi alterado apos a assinatura.
                </p>
              </div>
            </div>
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
              ${clinicFooterHtml}
            </div>
          </div>
        </body></html>
      `

      let clinicFooterText = `${settings.clinic_name}`
      if (settings.technical_responsible) {
        clinicFooterText += ` - Responsavel Tecnica: ${settings.technical_responsible}`
        if (settings.professional_register)
          clinicFooterText += ` (${settings.professional_register})`
      }
      if (settings.clinic_address) clinicFooterText += `\nEndereco: ${settings.clinic_address}`
      if (settings.phone) clinicFooterText += ` - Telefone: ${settings.phone}`
      clinicFooterText += `\nFuso horario: Horario de Brasilia (UTC-3)`

      const text = `
Andresa Souza Clinic - Comprovante: Ficha de Anamnese Assinada - ${pName} - ${pLabel}
==============================================================

Ola, ${pName}!

Reenviamos a confirmacao e comprovante oficial da sua Ficha de Anamnese.
O documento completo em PDF esta anexado a esta mensagem.
${isPatientCopy ? 'Esta e a sua via do documento assinado. Guarde para seus registros.' : ''}

DADOS DO PROCEDIMENTO E DO PACIENTE:
- Procedimento: ${pLabel}
- Paciente: ${pName}
- CPF: ${pCpf}
- Data e Hora do Aceite: ${brTime}
- Termo e Versao Aceita: ${tTitle}
- Enviado para: ${pEmail}
- IP de Origem REAL: ${ip}
- Dispositivo/Navegador: ${ua}

Codigo de verificacao de integridade - garante que este documento nao foi alterado apos a assinatura.
Hash SHA-256: ${dHash}

${clinicFooterText}
      `.trim()

      return { html, text, procLabel: pLabel, patientName: pName }
    }

    const sendEmailWithPdf = (toAddr, subject, htmlBody, textBody, pdfData) => {
      const defaultSender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
      const fallbackSender = 'Andresa Souza Clinic <onboarding@resend.dev>'
      const configuredSender = settings.sender_email || defaultSender
      let sent = false
      let errorMsg = ''
      let resendResponse = null

      const resendApiKey = $os.getenv('RESEND_API_KEY') || 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'

      // 1. Primary: Direct Resend API via $http (supports base64 attachments natively)
      if (resendApiKey) {
        const sendDirect = (sender) => {
          return $http.send({
            url: 'https://api.resend.com/emails',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + resendApiKey,
              'Content-Type': 'application/json',
            },
            data: {
              from: sender,
              to: [toAddr],
              subject: subject,
              html: htmlBody,
              text: textBody,
              attachments: [
                {
                  filename: pdfData.filename,
                  content: pdfData.base64,
                },
              ],
            },
          })
        }

        try {
          let directRes = sendDirect(configuredSender)
          let isOk = directRes.statusCode >= 200 && directRes.statusCode < 300

          // Fallback to onboarding@resend.dev if custom domain is not verified (403)
          if (!isOk) {
            const rawStr = directRes.raw || ''
            if (
              directRes.statusCode === 403 ||
              rawStr.includes('domain is not verified') ||
              rawStr.includes('Forbidden')
            ) {
              console.log(
                'Direct Resend custom domain not verified (403), falling back to onboarding@resend.dev...',
              )
              directRes = sendDirect(fallbackSender)
              isOk = directRes.statusCode >= 200 && directRes.statusCode < 300
            }
          }

          if (isOk) {
            sent = true
            resendResponse = directRes.json || directRes.raw
            console.log(
              'Direct Resend email with attachment sent successfully (resend endpoint):',
              directRes.raw,
            )
          } else {
            errorMsg = `Resend API HTTP ${directRes.statusCode}: ${directRes.raw}`
            console.log('Direct Resend error:', errorMsg)
          }
        } catch (errHttp) {
          console.log('Error calling direct Resend API:', errHttp)
          errorMsg = String(errHttp)
        }
      }

      // 2. Secondary: Resend connector via executeAsOwner
      if (!sent && typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
        try {
          const payload = {
            from: configuredSender,
            to: [toAddr],
            subject: subject,
            html: htmlBody,
            text: textBody,
            attachments: [
              {
                filename: pdfData.filename,
                content: pdfData.base64,
              },
            ],
          }

          let res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', payload)
          if (!res || !res.successful) {
            const errDetail = res ? JSON.stringify(res.error || res.data || '') : ''
            if (
              errDetail.includes('403') ||
              errDetail.includes('domain is not verified') ||
              errDetail.includes('Forbidden')
            ) {
              payload.from = fallbackSender
              res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', payload)
            }
          }

          if (res && res.successful) {
            sent = true
            resendResponse = res.data || res
          } else {
            if (!errorMsg) {
              errorMsg = res
                ? JSON.stringify(res.error || res.data || 'Erro no conector Resend')
                : 'Sem resposta do conector'
            }
          }
        } catch (errResend) {
          console.log('Error calling RESEND_SEND_EMAIL connector:', errResend)
          if (!errorMsg) errorMsg = String(errResend)
        }
      }

      // 3. Tertiary: Internal MailClient fallback
      if (!sent) {
        try {
          const fromName = configuredSender.includes('<')
            ? configuredSender.split('<')[0].trim()
            : 'Andresa Souza Clinic'
          const fromEmail = configuredSender.includes('<')
            ? configuredSender.split('<')[1].replace('>', '').trim()
            : configuredSender

          const msg = new MailerMessage({
            from: {
              address: fromEmail,
              name: fromName,
            },
            to: [{ address: toAddr }],
            subject: subject,
            html: htmlBody,
            text: textBody,
            attachments: [
              {
                name: pdfData.filename,
                data: pdfData.base64,
                type: 'application/pdf',
              },
            ],
          })
          $app.newMailClient().send(msg)
          sent = true
        } catch (errMailer) {
          console.log('Mailer client error with attachment:', errMailer)
          if (!errorMsg) errorMsg = String(errMailer)
        }
      }

      return { sent, error: errorMsg, resendResponse }
    }

    const patientPdf = generatePdf(record, true)
    const clinicPdf = generatePdf(record, false)

    const patientContent = buildEmail(record, true)
    const clinicContent = buildEmail(record, false)
    const subject = `Comprovante: Ficha de Anamnese Assinada - ${patientContent.patientName} - ${patientContent.procLabel}`

    let emailSent = false
    let sendErr = ''

    // (a) Re-send to patient
    const patientResult = sendEmailWithPdf(
      patientEmail,
      subject,
      patientContent.html,
      patientContent.text,
      patientPdf,
    )

    if (patientResult.sent) {
      emailSent = true
    } else {
      sendErr = patientResult.error
    }

    // (b) Re-send to clinic
    if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
      sendEmailWithPdf(clinicEmail, subject, clinicContent.html, clinicContent.text, clinicPdf)
    }

    const nowIso = new Date().toISOString()
    const pdfAttached = emailSent ? 1 : 0
    $app
      .db()
      .newQuery(
        `UPDATE form_submissions 
         SET email_delivery_status = {:status}, 
             email_sent_at = {:sentAt}, 
             email_delivery_error = {:error},
             pdf_attached_to_email = {:pdfAttached}
         WHERE id = {:id}`,
      )
      .bind({
        status: emailSent ? 'enviado' : 'falha',
        sentAt: emailSent ? nowIso : '',
        error: sendErr ? sendErr.slice(0, 500) : '',
        pdfAttached: pdfAttached,
        id: record.id,
      })
      .execute()

    if (emailSent) {
      return e.json(200, {
        success: true,
        message: 'E-mail reenviado com sucesso em duas vias com o PDF completo anexado!',
      })
    } else {
      return e.json(500, {
        error: 'Falha ao reenviar e-mail: ' + (sendErr || 'Erro no servico de envio.'),
      })
    }
  } catch (err) {
    return e.json(500, { error: 'Erro ao processar reenvio de e-mail: ' + String(err) })
  }
})
