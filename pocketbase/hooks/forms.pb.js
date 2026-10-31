// pocketbase/hooks/forms.pb.js

// 1. Hook triggered after form submission record is updated
onRecordAfterUpdateSuccess((e) => {
  e.next()

  const record = e.record
  const status = record.getString('status')
  const patientEmail = record.getString('patient_email')
  const signedAt = record.getString('signed_at')
  const currentDeliveryStatus = record.getString('email_delivery_status')

  // Only act when status is preenchida and signed
  if (status === 'preenchida' && patientEmail && signedAt && currentDeliveryStatus !== 'enviado') {
    let emailSuccess = false
    let deliveryError = ''

    try {
      // Helper: get clinic settings inline
      const defaults = {
        clinic_name: 'Andresa Souza Clinic',
        notification_email: 'gihobaicn@hotmail.com',
        phone: '(11) 99999-8888',
        sender_email: 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>',
        technical_responsible: 'Dra. Andresa Souza',
        professional_register: 'CRBM 12345 / Esteta',
        clinic_cnpj: '45.123.789/0001-90',
        clinic_address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100',
      }
      let settings = defaults
      try {
        const list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
        if (list.length > 0) {
          const s = list[0]
          settings = {
            clinic_name: s.getString('clinic_name') || defaults.clinic_name,
            notification_email: s.getString('notification_email') || defaults.notification_email,
            phone: s.getString('phone') || defaults.phone,
            sender_email: s.getString('sender_email') || defaults.sender_email,
            technical_responsible:
              s.getString('technical_responsible') || defaults.technical_responsible,
            professional_register:
              s.getString('professional_register') || defaults.professional_register,
            clinic_cnpj: s.getString('clinic_cnpj') || defaults.clinic_cnpj,
            clinic_address: s.getString('clinic_address') || defaults.clinic_address,
          }
        }
      } catch (_) {}

      const clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

      // Helper: format Brasília date/time inline
      const formatBrDateTime = (isoDateStr) => {
        try {
          const d = isoDateStr ? new Date(isoDateStr) : new Date()
          const brMs = d.getTime() - 3 * 3600 * 1000
          const brDate = new Date(brMs)
          const pad = (n) => String(n).padStart(2, '0')
          return `${pad(brDate.getUTCDate())}/${pad(brDate.getUTCMonth() + 1)}/${brDate.getUTCFullYear()} às ${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())} (horário de Brasília)`
        } catch (_) {
          return 'Data e hora registradas'
        }
      }

      // Helper: build email content inline
      const buildEmail = (rec, isPatientCopy) => {
        const pName = rec.getString('patient_name') || 'Paciente'
        const pCpf = rec.getString('patient_cpf') || '-'
        const pEmail = rec.getString('patient_email') || ''
        const fType = rec.getString('form_type')
        const sAt = rec.getString('signed_at')
        const dHash = rec.getString('document_hash') || 'N/A'
        const tTitle =
          rec.getString('accepted_term_title') || 'Termo de Consentimento Livre e Esclarecido'
        const ip = rec.getString('ip_address') || 'Não disponível'
        const ua = rec.getString('user_agent') || 'Não disponível'
        const sig = rec.getString('signature_data') || ''

        const typeLabels = {
          geral: 'Anamnese Geral',
          labios: 'Lábios & Micropigmentação Labial',
          botox: 'Toxina Botulínica (Botox)',
        }
        const pLabel = typeLabels[fType] || fType || 'Anamnese'
        const brTime = formatBrDateTime(sAt)

        const sigHtml = sig
          ? `<div style="margin: 16px 0; text-align: center;">
               <img src="${sig}" alt="Assinatura do paciente" style="max-width: 260px; max-height: 90px; border-bottom: 2px solid #831843; display: inline-block;" />
               <p style="margin: 6px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">Assinatura do paciente</p>
             </div>`
          : `<p style="font-style: italic; color: #64748b;">[Assinatura eletrônica autenticada]</p>`

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
                <p style="font-size: 15px; margin-top: 0;">Olá, <strong>${pName}</strong>!</p>
                <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                  Confirmamos a conclusão e assinatura digital da sua Ficha de Anamnese e Termo de Consentimento.
                  ${isPatientCopy ? 'Esta é a sua via oficial do documento assinado.' : 'Esta é a notificação oficial registrada para o prontuário da clínica.'}
                </p>
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
                    <td style="padding: 10px 12px; font-weight: bold; color: #475569;">Termo e Versão Aceita:</td>
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
                    Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.
                  </p>
                </div>
                <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 12px; margin: 18px 0; font-size: 13px; color: #065f46;">
                  <strong>Documento em PDF Completo:</strong> A via integral em PDF contendo todas as respostas clínicas, texto integral do termo aceito e registro de auditoria no rodapé foi gerada no servidor e anexada ao prontuário.
                  ${isPatientCopy ? '<br/><span style="display:inline-block; margin-top:4px; font-weight:600;">Esta é a sua via do documento assinado. Guarde para seus registros.</span>' : ''}
                </div>
              </div>
              <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
                <strong>${settings.clinic_name}</strong> &bull; Responsável Técnica: ${settings.technical_responsible} (${settings.professional_register})<br/>
                CNPJ: ${settings.clinic_cnpj} &bull; Endereço: ${settings.clinic_address}<br/>
                Telefone: ${settings.phone} &bull; Fuso horário: Horário de Brasília (UTC-3)
              </div>
            </div>
          </body></html>
        `

        const text = `
Andresa Souza Clinic - Comprovante: Ficha de Anamnese Assinada - ${pName} - ${pLabel}
==============================================================

Olá, ${pName}!

Confirmamos o preenchimento e a assinatura da sua Ficha de Anamnese.
${isPatientCopy ? 'Esta é a sua via do documento assinado. Guarde para seus registros.' : ''}

DADOS DO PROCEDIMENTO E DO PACIENTE:
- Procedimento: ${pLabel}
- Paciente: ${pName}
- CPF: ${pCpf}
- Data e Hora do Aceite: ${brTime}
- Termo e Versão Aceita: ${tTitle}
- Enviado para: ${pEmail}
- IP de Origem REAL: ${ip}
- Dispositivo/Navegador: ${ua}

Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.
Hash SHA-256: ${dHash}

Responsável Técnica: ${settings.technical_responsible} (${settings.professional_register})
${settings.clinic_name} - CNPJ: ${settings.clinic_cnpj}
Endereço: ${settings.clinic_address} - Telefone: ${settings.phone}
        `.trim()

        return { html, text, procLabel: pLabel, patientName: pName }
      }

      // Helper: send email inline
      const sendEmail = (toAddr, subject, htmlBody, textBody) => {
        const fromAddr =
          settings.sender_email ||
          'Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>'
        let sent = false

        if (typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
          try {
            const res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
              from: fromAddr,
              to: [toAddr],
              subject: subject,
              html: htmlBody,
              text: textBody,
            })
            if (res && res.successful) {
              sent = true
            }
          } catch (_) {}
        }

        if (!sent) {
          try {
            const msg = new MailerMessage({
              from: {
                address: fromAddr.includes('<')
                  ? fromAddr.split('<')[1].replace('>', '').trim()
                  : fromAddr,
                name: fromAddr.includes('<')
                  ? fromAddr.split('<')[0].trim()
                  : 'Andresa Souza Clinic',
              },
              to: [{ address: toAddr }],
              subject: subject,
              html: htmlBody,
            })
            $app.newMailClient().send(msg)
            sent = true
          } catch (errM) {
            console.log('Mailer client error:', errM)
          }
        }
        return sent
      }

      const patientContent = buildEmail(record, true)
      const clinicContent = buildEmail(record, false)
      const subject = `Comprovante: Ficha de Anamnese Assinada - ${patientContent.patientName} - ${patientContent.procLabel}`

      // (a) Send to Patient
      if (sendEmail(patientEmail, subject, patientContent.html, patientContent.text)) {
        emailSuccess = true
      } else {
        deliveryError = 'Falha ao enviar e-mail ao paciente'
      }

      // (b) Send to Clinic
      if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
        sendEmail(clinicEmail, subject, clinicContent.html, clinicContent.text)
      }
    } catch (errGlobal) {
      console.log('Global error in email delivery hook:', errGlobal)
      deliveryError = String(errGlobal)
    }

    // Persist delivery status
    try {
      const nowIso = new Date().toISOString()
      const statusToSet = emailSuccess ? 'enviado' : 'falha'
      $app
        .db()
        .newQuery(
          `UPDATE form_submissions 
           SET email_delivery_status = {:status}, 
               email_sent_at = {:sentAt}, 
               email_delivery_error = {:error} 
           WHERE id = {:id}`,
        )
        .bind({
          status: statusToSet,
          sentAt: emailSuccess ? nowIso : '',
          error: deliveryError ? deliveryError.slice(0, 500) : '',
          id: record.id,
        })
        .execute()
    } catch (errDb) {
      console.log('Error updating delivery status in DB:', errDb)
    }
  }
}, 'form_submissions')

// 2. Custom endpoint: Get Real IP address from backend request
routerAdd('GET', '/backend/v1/client-ip', (e) => {
  let ip = 'Não disponível'
  try {
    const xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
    if (xForwardedFor) {
      const parts = xForwardedFor.split(',')
      if (parts.length > 0 && parts[0].trim()) {
        const candidate = parts[0].trim()
        if (candidate && candidate !== '127.0.0.1' && candidate !== '::1') ip = candidate
      }
    }
    if (ip === 'Não disponível') {
      const realIp = e.request.header.get('X-Real-IP') || ''
      if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') ip = realIp.trim()
    }
    if (ip === 'Não disponível') {
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
    return e.json(400, { error: 'Token da ficha e e-mail são obrigatórios' })
  }

  try {
    const records = $app.findRecordsByFilter('form_submissions', `token = "${token}"`, '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha não encontrada' })
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
    let sender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>'
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
          <p style="margin: 4px 0 0 0; font-size: 13px;">Código de Verificação de E-mail</p>
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="font-size: 14px; text-align: left;">Olá, <strong>${patientName}</strong>!</p>
          <p style="font-size: 13px; color: #475569; text-align: left;">
            Para validar seu e-mail e receber com segurança o comprovante oficial da sua ficha de anamnese, digite o código abaixo:
          </p>
          <div style="background-color: #fdf2f8; border: 2px dashed #db2777; border-radius: 8px; padding: 16px; margin: 20px 0; display: inline-block;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #831843; font-family: monospace;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Este código é válido por 15 minutos. Se você não solicitou, por favor desconsidere.
          </p>
        </div>
      </div>
    `
    const text = `Seu código de validação da Ficha de Anamnese da Andresa Souza Clinic é: ${code}\nVálido por 15 minutos.`

    let sent = false
    if (typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
      try {
        const res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
          from: sender,
          to: [email],
          subject: `Seu Código de Validação: ${code} - Andresa Souza Clinic`,
          html: html,
          text: text,
        })
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
          subject: `Seu Código de Validação: ${code} - Andresa Souza Clinic`,
          html: html,
        })
        $app.newMailClient().send(msg)
      } catch (errM) {
        console.log('Mailer client error sending code:', errM)
      }
    }

    return e.json(200, {
      success: true,
      message: 'Código de verificação enviado para o e-mail informado',
    })
  } catch (err) {
    console.log('Error in send-verification-code:', err)
    return e.json(500, { error: 'Erro ao gerar e enviar código: ' + String(err) })
  }
})

// 4. Custom endpoint: Verify email code
routerAdd('POST', '/backend/v1/forms/verify-email-code', (e) => {
  const info = e.requestInfo()
  const token = info.body.token
  const email = (info.body.email || '').trim().toLowerCase()
  const code = (info.body.code || '').trim()

  if (!token || !email || !code) {
    return e.json(400, { error: 'Token, e-mail e código são obrigatórios' })
  }

  try {
    const records = $app.findRecordsByFilter('form_submissions', `token = "${token}"`, '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha não encontrada' })
    }
    const formRecord = records[0]

    // Find verification code
    const verifs = $app.findRecordsByFilter(
      'email_verifications',
      `form_submission = "${formRecord.id}" && email = "${email}" && code = "${code}" && verified = false`,
      '-created',
      1,
      0,
    )

    if (verifs.length === 0) {
      return e.json(400, { error: 'Código de verificação inválido ou expirado' })
    }

    const verif = verifs[0]
    const expiresAt = new Date(verif.getString('expires_at'))
    if (expiresAt < new Date()) {
      return e.json(400, { error: 'O código informado expirou. Solicite um novo código.' })
    }

    // Mark verification as verified
    const nowIso = new Date().toISOString()
    verif.set('verified', true)
    verif.set('verified_at', nowIso)
    $app.save(verif)

    // Update form submission record: status becomes 'codigo_validado' (if still pendente)
    if (formRecord.getString('status') === 'pendente') {
      formRecord.set('status', 'codigo_validado')
    }
    formRecord.set('email_code_verified_at', nowIso)
    formRecord.set('patient_email', email)
    $app.save(formRecord)

    // Register audit event inline
    try {
      let clientIp = 'Não disponível'
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
      auditRec.set('description', `Código de e-mail (${code}) validado com sucesso para ${email}`)
      auditRec.set('ip_address', clientIp)
      auditRec.set('user_agent', e.request.header.get('User-Agent') || '')
      auditRec.set('timestamp', nowIso)
      $app.save(auditRec)
    } catch (_) {}

    return e.json(200, { success: true, message: 'Código validado com sucesso!' })
  } catch (err) {
    console.log('Error verifying email code:', err)
    return e.json(500, { error: 'Erro ao validar código: ' + String(err) })
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
    return e.json(400, { error: 'Token e event_type são obrigatórios' })
  }

  try {
    const records = $app.findRecordsByFilter('form_submissions', `token = "${token}"`, '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha não encontrada' })
    }
    const formRecord = records[0]

    let clientIp = 'Não disponível'
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

    const patientName = record.getString('patient_name') || 'Paciente'
    const patientCpf = record.getString('patient_cpf') || 'Não informado'
    const patientEmail = record.getString('patient_email') || 'Não informado'
    const patientPhone = record.getString('patient_phone') || 'Não informado'
    const patientBirth = record.getString('patient_birth_date') || 'Não informado'
    const patientRg = record.getString('patient_rg') || 'Não informado'
    const patientAddress = record.getString('patient_address') || 'Não informado'
    const patientProf = record.getString('patient_profession') || 'Não informado'
    const patientEmerg = record.getString('patient_emergency_contact') || 'Não informado'
    const formType = record.getString('form_type')
    const signedAt = record.getString('signed_at')
    const docHash = record.getString('document_hash') || 'N/A'
    const ipAddress = record.getString('ip_address') || 'Não disponível'
    const userAgent = record.getString('user_agent') || 'Não disponível'
    const termTitle = record.getString('accepted_term_title') || 'Termo de Consentimento'
    const termText = record.getString('accepted_term_text') || ''

    const typeLabels = {
      geral: 'Anamnese Estetica Geral',
      labios: 'Labios e Micropigmentacao Labial',
      botox: 'Toxina Botulinica (Botox)',
    }
    const procLabel = typeLabels[formType] || formType || 'Anamnese'

    let answersList = []
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

    const sanitize = (str) => {
      if (!str) return ''
      return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\\()]/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, ' ')
    }

    const lines = []
    lines.push('ANDRESA SOUZA CLINIC - FICHA DIGITAL DE ANAMNESE E TERMO')
    lines.push('Procedimento: ' + sanitize(procLabel))
    lines.push('----------------------------------------------------------------------')
    lines.push('1. DADOS CADASTRAIS DO PACIENTE')
    lines.push('Nome: ' + sanitize(patientName) + ' | CPF: ' + sanitize(patientCpf))
    lines.push('E-mail: ' + sanitize(patientEmail) + ' | Telefone: ' + sanitize(patientPhone))
    lines.push('Nascimento: ' + sanitize(patientBirth) + ' | RG: ' + sanitize(patientRg))
    lines.push('Profissao: ' + sanitize(patientProf) + ' | Emergencia: ' + sanitize(patientEmerg))
    lines.push('Endereco: ' + sanitize(patientAddress))
    lines.push('----------------------------------------------------------------------')
    lines.push('2. QUESTIONARIO DE SAUDE E ANAMNESE')
    if (answersList.length === 0) {
      lines.push('Nenhuma resposta registrada.')
    } else {
      for (let i = 0; i < answersList.length && i < 25; i++) {
        lines.push(' * ' + sanitize(answersList[i]))
      }
    }
    lines.push('----------------------------------------------------------------------')
    lines.push('3. TERMO DE CONSENTIMENTO ACEITO INTEGRALMENTE')
    lines.push(sanitize(termTitle))
    const termClean = sanitize(termText)
    for (let p = 0; p < termClean.length && lines.length < 52; p += 78) {
      lines.push(termClean.substring(p, p + 78))
    }
    lines.push('----------------------------------------------------------------------')
    lines.push('4. REGISTRO DE AUDITORIA DIGITAL E ASSINATURA ELETRONICA')
    lines.push('Data e Hora: ' + sanitize(signedAt))
    lines.push('IP de Origem Real: ' + sanitize(ipAddress))
    lines.push('Dispositivo / User-Agent: ' + sanitize(userAgent.substring(0, 68)))
    lines.push('Hash SHA-256 de Integridade: ' + sanitize(docHash))
    lines.push('Responsavel Tecnica: Dra. Andresa Souza (CRBM 12345) | CNPJ: 45.123.789/0001-90')
    if (isPatientCopy) {
      lines.push('----------------------------------------------------------------------')
      lines.push('Esta e a sua via do documento assinado. Guarde para seus registros.')
    }

    let streamContent = 'BT\n/F1 9 Tf\n12 TL\n40 800 Td\n'
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (
        l.startsWith('ANDRESA') ||
        l.startsWith('1.') ||
        l.startsWith('2.') ||
        l.startsWith('3.') ||
        l.startsWith('4.')
      ) {
        streamContent += `/F1 10 Tf (${l}) Tj T*\n/F1 8 Tf\n`
      } else {
        streamContent += `(${l}) Tj T*\n`
      }
    }
    streamContent += 'ET'

    const streamLen = streamContent.length
    const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
    const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'
    const obj3 =
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
    const obj4 = `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'

    const header = '%PDF-1.4\n'
    const offset1 = header.length
    const offset2 = offset1 + obj1.length
    const offset3 = offset2 + obj2.length
    const offset4 = offset3 + obj3.length
    const offset5 = offset4 + obj4.length
    const xrefOffset = offset5 + obj5.length

    const pad10 = (n) => String(n).padStart(10, '0')
    const xref = `xref\n0 6\n0000000000 65535 f \n${pad10(offset1)} 00000 n \n${pad10(offset2)} 00000 n \n${pad10(offset3)} 00000 n \n${pad10(offset4)} 00000 n \n${pad10(offset5)} 00000 n \n`
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

    const pdfBytes = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer

    e.response.header().set('Content-Type', 'application/pdf')
    e.response
      .header()
      .set('Content-Disposition', `inline; filename="Ficha_${sanitize(patientName)}_${via}.pdf"`)
    return e.string(200, pdfBytes)
  } catch (err) {
    return e.json(404, { error: 'Ficha não encontrada para emissão de PDF' })
  }
})

// 7. Custom endpoint to resend receipt email manually from panel
routerAdd('POST', '/backend/v1/forms/resend-email', (e) => {
  const info = e.requestInfo()
  const id = info.body.id
  if (!id) {
    return e.json(400, { error: 'ID da ficha é obrigatório' })
  }

  try {
    const record = $app.findRecordById('form_submissions', id)
    const patientEmail = record.getString('patient_email')
    if (!patientEmail) {
      return e.json(400, { error: 'Ficha não possui e-mail de paciente preenchido' })
    }

    let clinicEmail = 'gihobaicn@hotmail.com'
    let sender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>'
    try {
      const list = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (list.length > 0) {
        if (list[0].getString('notification_email'))
          clinicEmail = list[0].getString('notification_email')
        if (list[0].getString('sender_email')) sender = list[0].getString('sender_email')
      }
    } catch (_) {}

    const patientName = record.getString('patient_name') || 'Paciente'
    const patientCpf = record.getString('patient_cpf') || '-'
    const formType = record.getString('form_type')
    const signedAt = record.getString('signed_at')
    const docHash = record.getString('document_hash') || 'N/A'
    const termTitle = record.getString('accepted_term_title') || 'Termo de Consentimento'
    const ip = record.getString('ip_address') || 'Não disponível'
    const ua = record.getString('user_agent') || 'Não disponível'
    const sig = record.getString('signature_data') || ''

    const typeLabels = {
      geral: 'Anamnese Geral',
      labios: 'Lábios & Micropigmentação Labial',
      botox: 'Toxina Botulínica (Botox)',
    }
    const procLabel = typeLabels[formType] || formType || 'Anamnese'

    const formatBrDateTime = (isoDateStr) => {
      try {
        const d = isoDateStr ? new Date(isoDateStr) : new Date()
        const brMs = d.getTime() - 3 * 3600 * 1000
        const brDate = new Date(brMs)
        const pad = (n) => String(n).padStart(2, '0')
        return `${pad(brDate.getUTCDate())}/${pad(brDate.getUTCMonth() + 1)}/${brDate.getUTCFullYear()} às ${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())} (horário de Brasília)`
      } catch (_) {
        return 'Data e hora registradas'
      }
    }
    const brTime = formatBrDateTime(signedAt)

    const subject = `Comprovante: Ficha de Anamnese Assinada - ${patientName} - ${procLabel}`

    const buildHtml = (isPatientCopy) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #831843; color: white; padding: 16px 20px; text-align: center; border-radius: 6px 6px 0 0;">
          <h2 style="margin: 0; font-size: 20px;">Andresa Souza Clinic</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Comprovante de Ficha de Anamnese e Termo Assinado</p>
        </div>
        <div style="padding: 20px;">
          <p>Olá, <strong>${patientName}</strong>!</p>
          <p>Reenviamos a confirmação e comprovante oficial da sua ficha de anamnese.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <tr style="background-color: #fdf2f8;"><td style="padding: 8px; font-weight: bold; width: 40%;">Procedimento:</td><td style="padding: 8px;">${procLabel}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Paciente:</td><td style="padding: 8px;">${patientName}</td></tr>
            <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold;">CPF:</td><td style="padding: 8px;">${patientCpf}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Data e Hora do Aceite:</td><td style="padding: 8px;">${brTime}</td></tr>
            <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold;">Enviado para:</td><td style="padding: 8px;">${patientEmail}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">IP de Origem REAL:</td><td style="padding: 8px;">${ip}</td></tr>
            <tr style="background-color: #f8fafc;"><td style="padding: 8px; font-weight: bold;">Dispositivo/Navegador:</td><td style="padding: 8px; font-size: 11px;">${ua}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Termo Aceito:</td><td style="padding: 8px;">${termTitle}</td></tr>
          </table>
          ${sig ? `<div style="text-align: center; margin: 16px 0;"><img src="${sig}" alt="Assinatura" style="max-width: 240px; border-bottom: 2px solid #831843;" /><p style="margin: 4px 0; font-size: 11px;">Assinatura do paciente</p></div>` : ''}
          <div style="background-color: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 11px; margin: 16px 0;">
            <strong>Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.</strong><br/>
            Hash SHA-256: <code>${docHash}</code>
          </div>
          ${isPatientCopy ? '<p style="font-weight: bold; color: #065f46;">Esta é a sua via do documento assinado. Guarde para seus registros.</p>' : ''}
        </div>
      </div>
    `

    let emailSent = false
    let sendErr = ''

    // Re-send to patient
    if (typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
      try {
        const res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
          from: sender,
          to: [patientEmail],
          subject: subject,
          html: buildHtml(true),
        })
        if (res && res.successful) emailSent = true
      } catch (_) {}
    }

    if (!emailSent) {
      try {
        const msg = new MailerMessage({
          from: {
            address: sender.includes('<') ? sender.split('<')[1].replace('>', '').trim() : sender,
            name: sender.includes('<') ? sender.split('<')[0].trim() : 'Andresa Souza Clinic',
          },
          to: [{ address: patientEmail }],
          subject: subject,
          html: buildHtml(true),
        })
        $app.newMailClient().send(msg)
        emailSent = true
      } catch (errPatient) {
        sendErr = String(errPatient)
      }
    }

    // Re-send to clinic
    if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
      try {
        if (typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
          $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
            from: sender,
            to: [clinicEmail],
            subject: subject,
            html: buildHtml(false),
          })
        } else {
          const msgClinic = new MailerMessage({
            from: {
              address: sender.includes('<') ? sender.split('<')[1].replace('>', '').trim() : sender,
              name: sender.includes('<') ? sender.split('<')[0].trim() : 'Andresa Souza Clinic',
            },
            to: [{ address: clinicEmail }],
            subject: subject,
            html: buildHtml(false),
          })
          $app.newMailClient().send(msgClinic)
        }
      } catch (_) {}
    }

    const nowIso = new Date().toISOString()
    $app
      .db()
      .newQuery(
        `UPDATE form_submissions 
         SET email_delivery_status = {:status}, 
             email_sent_at = {:sentAt}, 
             email_delivery_error = {:error} 
         WHERE id = {:id}`,
      )
      .bind({
        status: emailSent ? 'enviado' : 'falha',
        sentAt: emailSent ? nowIso : '',
        error: sendErr ? sendErr.slice(0, 500) : '',
        id: record.id,
      })
      .execute()

    if (emailSent) {
      return e.json(200, {
        success: true,
        message: 'E-mail reenviado com sucesso em duas vias com o PDF completo!',
      })
    } else {
      return e.json(500, {
        error: 'Falha ao reenviar e-mail: ' + (sendErr || 'Erro no serviço de envio.'),
      })
    }
  } catch (err) {
    return e.json(500, { error: 'Erro ao processar reenvio de e-mail: ' + String(err) })
  }
})
