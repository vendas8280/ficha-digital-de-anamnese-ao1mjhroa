// pocketbase/hooks/forms.pb.js
// Automações de fichas de anamnese da Andresa Souza Clinic (v0.0.9).

// -------------------------------------------------------------
// 1. Hook disparado após atualização do registro para 'preenchida'
// -------------------------------------------------------------
onRecordAfterUpdateSuccess((e) => {
  e.next()

  var pdfGen = require(`${__hooks}/pdf_generator.js`)
  var record = e.record
  var status = record.getString('status')
  var patientEmail = record.getString('patient_email')
  var signedAt = record.getString('signed_at')
  var currentDeliveryStatus = record.getString('email_delivery_status')

  if (status === 'preenchida' && patientEmail && signedAt && currentDeliveryStatus !== 'enviado') {
    var emailSuccess = false
    var deliveryError = ''

    try {
      var settings = pdfGen.getClinicSettings()
      var clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

      var patientPdf = pdfGen.generatePdf(record, true, settings)
      var clinicPdf = pdfGen.generatePdf(record, false, settings)

      var patientContent = pdfGen.buildEmail(record, true, settings)
      var clinicContent = pdfGen.buildEmail(record, false, settings)
      var subject =
        'Comprovante: Ficha de Anamnese Assinada - ' +
        patientContent.patientName +
        ' - ' +
        patientContent.procLabel

      // (a) Envio para o paciente com a via do paciente
      var patientResult = pdfGen.sendEmailWithPdf(
        patientEmail,
        subject,
        patientContent.html,
        patientContent.text,
        patientPdf,
        settings,
      )

      if (patientResult.sent) {
        emailSuccess = true
      } else {
        deliveryError = 'Falha ao enviar ao paciente: ' + patientResult.error
      }

      // (b) Envio para a clínica com a via da clínica
      if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
        pdfGen.sendEmailWithPdf(
          clinicEmail,
          subject,
          clinicContent.html,
          clinicContent.text,
          clinicPdf,
          settings,
        )
      }
    } catch (errGlobal) {
      console.log('Global error in email delivery hook:', errGlobal)
      deliveryError = String(errGlobal)
    }

    try {
      var nowIso = new Date().toISOString()
      var statusToSet = emailSuccess ? 'enviado' : 'falha'
      var pdfAttached = emailSuccess ? 1 : 0
      $app
        .db()
        .newQuery(
          'UPDATE form_submissions ' +
            'SET email_delivery_status = {:status}, ' +
            '    email_sent_at = {:sentAt}, ' +
            '    email_delivery_error = {:error}, ' +
            '    pdf_attached_to_email = {:pdfAttached} ' +
            'WHERE id = {:id}',
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

// -------------------------------------------------------------
// 2. Custom endpoint: Get Real IP address from backend request
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/client-ip', (e) => {
  var ip = 'Não disponível'
  try {
    var xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
    if (xForwardedFor) {
      var parts = xForwardedFor.split(',')
      if (parts.length > 0 && parts[0].trim()) {
        var candidate = parts[0].trim()
        if (candidate && candidate !== '127.0.0.1' && candidate !== '::1') ip = candidate
      }
    }
    if (ip === 'Não disponível') {
      var realIp = e.request.header.get('X-Real-IP') || ''
      if (realIp && realIp !== '127.0.0.1' && realIp !== '::1') ip = realIp.trim()
    }
    if (ip === 'Não disponível') {
      var cfIp = e.request.header.get('CF-Connecting-IP') || ''
      if (cfIp) ip = cfIp.trim()
    }
  } catch (_) {}
  return e.json(200, { ip: ip })
})

// -------------------------------------------------------------
// 3. Custom endpoint: Send verification code to patient email
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/forms/send-verification-code', (e) => {
  var info = e.requestInfo()
  var token = info.body.token
  var email = (info.body.email || '').trim().toLowerCase()
  var patientName = (info.body.patient_name || 'Paciente').trim()

  if (!token || !email) {
    return e.json(400, { error: 'Token da ficha e e-mail são obrigatórios' })
  }

  try {
    var records = $app.findRecordsByFilter('form_submissions', 'token = "' + token + '"', '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha não encontrada' })
    }
    var formRecord = records[0]

    var code = String(Math.floor(100000 + Math.random() * 900000))
    var expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    var verifCol = $app.findCollectionByNameOrId('email_verifications')
    var verifRec = new Record(verifCol)
    verifRec.set('form_submission', formRecord.id)
    verifRec.set('email', email)
    verifRec.set('code', code)
    verifRec.set('verified', false)
    verifRec.set('expires_at', expiresAt)
    $app.save(verifRec)

    var sender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
    try {
      var slist = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (slist.length > 0 && slist[0].getString('sender_email')) {
        sender = slist[0].getString('sender_email')
      }
    } catch (_) {}

    var html =
      '<div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
      '  <div style="background-color: #831843; color: white; padding: 16px; text-align: center; border-radius: 6px 6px 0 0;">' +
      '    <h2 style="margin: 0; font-size: 18px;">Andresa Souza Clinic</h2>' +
      '    <p style="margin: 4px 0 0 0; font-size: 13px;">Código de Verificação de E-mail</p>' +
      '  </div>' +
      '  <div style="padding: 20px; text-align: center;">' +
      '    <p style="font-size: 14px; text-align: left;">Olá, <strong>' +
      patientName +
      '</strong>!</p>' +
      '    <p style="font-size: 13px; color: #475569; text-align: left;">' +
      '      Para validar seu e-mail e receber com segurança o comprovante oficial da sua ficha de anamnese, digite o código abaixo:' +
      '    </p>' +
      '    <div style="background-color: #fdf2f8; border: 2px dashed #db2777; border-radius: 8px; padding: 16px; margin: 20px 0; display: inline-block;">' +
      '      <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #831843; font-family: monospace;">' +
      code +
      '</span>' +
      '    </div>' +
      '    <p style="font-size: 12px; color: #64748b;">' +
      '      Este código é válido por 15 minutos. Se você não solicitou, por favor desconsidere.' +
      '    </p>' +
      '  </div>' +
      '</div>'
    var text =
      'Seu código de validação da Ficha de Anamnese da Andresa Souza Clinic é: ' +
      code +
      '\nVálido por 15 minutos.'

    var sent = false
    var resendApiKey = $os.getenv('RESEND_API_KEY') || 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'

    if (resendApiKey) {
      try {
        var directRes = $http.send({
          url: 'https://api.resend.com/emails',
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + resendApiKey,
            'Content-Type': 'application/json',
          },
          data: {
            from: sender,
            to: [email],
            subject: 'Seu Código de Validação: ' + code + ' - Andresa Souza Clinic',
            html: html,
            text: text,
          },
        })
        if (directRes.statusCode >= 200 && directRes.statusCode < 300) {
          sent = true
        } else if (directRes.statusCode === 403) {
          directRes = $http.send({
            url: 'https://api.resend.com/emails',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + resendApiKey,
              'Content-Type': 'application/json',
            },
            data: {
              from: 'Andresa Souza Clinic <onboarding@resend.dev>',
              to: [email],
              subject: 'Seu Código de Validação: ' + code + ' - Andresa Souza Clinic',
              html: html,
              text: text,
            },
          })
          if (directRes.statusCode >= 200 && directRes.statusCode < 300) sent = true
        }
      } catch (_) {}
    }

    if (!sent && typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
      try {
        var res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
          from: sender,
          to: [email],
          subject: 'Seu Código de Validação: ' + code + ' - Andresa Souza Clinic',
          html: html,
          text: text,
        })
        if (!res || !res.successful) {
          res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
            from: 'Andresa Souza Clinic <onboarding@resend.dev>',
            to: [email],
            subject: 'Seu Código de Validação: ' + code + ' - Andresa Souza Clinic',
            html: html,
            text: text,
          })
        }
        if (res && res.successful) sent = true
      } catch (_) {}
    }

    if (!sent) {
      try {
        var msg = new MailerMessage({
          from: {
            address: sender.includes('<') ? sender.split('<')[1].replace('>', '').trim() : sender,
            name: sender.includes('<') ? sender.split('<')[0].trim() : 'Andresa Souza Clinic',
          },
          to: [{ address: email }],
          subject: 'Seu Código de Validação: ' + code + ' - Andresa Souza Clinic',
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
      message: 'Código de verificação enviado para o e-mail informado',
    })
  } catch (err) {
    console.log('Error in send-verification-code:', err)
    return e.json(500, { error: 'Erro ao gerar e enviar código: ' + String(err) })
  }
})

// -------------------------------------------------------------
// 4. Custom endpoint: Verify email code
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/forms/verify-email-code', (e) => {
  var info = e.requestInfo()
  var token = info.body.token
  var email = (info.body.email || '').trim().toLowerCase()
  var code = (info.body.code || '').trim()

  if (!token || !email || !code) {
    return e.json(400, { error: 'Token, e-mail e código são obrigatórios' })
  }

  try {
    var records = $app.findRecordsByFilter('form_submissions', 'token = "' + token + '"', '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha não encontrada' })
    }
    var formRecord = records[0]

    var verifs = $app.findRecordsByFilter(
      'email_verifications',
      'form_submission = "' +
        formRecord.id +
        '" && email = "' +
        email +
        '" && code = "' +
        code +
        '" && verified = false',
      '-created',
      1,
      0,
    )

    if (verifs.length === 0) {
      return e.json(400, { error: 'Código de verificação inválido ou expirado' })
    }

    var verif = verifs[0]
    var expiresAt = new Date(verif.getString('expires_at'))
    if (expiresAt < new Date()) {
      return e.json(400, { error: 'O código informado expirou. Solicite um novo código.' })
    }

    var nowIso = new Date().toISOString()
    verif.set('verified', true)
    verif.set('verified_at', nowIso)
    $app.save(verif)

    if (formRecord.getString('status') === 'pendente') {
      formRecord.set('status', 'codigo_validado')
    }
    formRecord.set('email_code_verified_at', nowIso)
    formRecord.set('patient_email', email)
    $app.save(formRecord)

    // Register audit event
    try {
      var clientIp = 'Não disponível'
      var xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
      if (xForwardedFor) {
        var parts = xForwardedFor.split(',')
        if (parts.length > 0 && parts[0].trim() && parts[0].trim() !== '127.0.0.1')
          clientIp = parts[0].trim()
      }
      var auditCol = $app.findCollectionByNameOrId('audit_events')
      var auditRec = new Record(auditCol)
      auditRec.set('form_submission', formRecord.id)
      auditRec.set('event_type', 'codigo_validado')
      auditRec.set(
        'description',
        'Código de e-mail (' + code + ') validado com sucesso para ' + email,
      )
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

// -------------------------------------------------------------
// 5. Custom endpoint: Record audit event from patient flow
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/forms/audit-event', (e) => {
  var info = e.requestInfo()
  var token = info.body.token
  var eventType = info.body.event_type
  var description = info.body.description || ''
  var stepNumber = info.body.step_number || 0
  var metadata = info.body.metadata || {}

  if (!token || !eventType) {
    return e.json(400, { error: 'Token e event_type são obrigatórios' })
  }

  try {
    var records = $app.findRecordsByFilter('form_submissions', 'token = "' + token + '"', '', 1, 0)
    if (records.length === 0) {
      return e.json(404, { error: 'Ficha não encontrada' })
    }
    var formRecord = records[0]

    var clientIp = 'Não disponível'
    try {
      var xForwardedFor = e.request.header.get('X-Forwarded-For') || ''
      if (xForwardedFor) {
        var parts = xForwardedFor.split(',')
        if (parts.length > 0 && parts[0].trim() && parts[0].trim() !== '127.0.0.1')
          clientIp = parts[0].trim()
      }
    } catch (_) {}

    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var auditRec = new Record(auditCol)
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

// -------------------------------------------------------------
// 6. Custom endpoint to download / view complete PDF generated by server
// -------------------------------------------------------------
routerAdd('GET', '/backend/v1/forms/{id}/pdf', (e) => {
  var pdfGen = require(`${__hooks}/pdf_generator.js`)
  var id = e.request.pathValue('id')
  var via = e.request.url.query().get('via') || 'clinica'

  try {
    var record = $app.findRecordById('form_submissions', id)
    var isPatientCopy = via === 'paciente'

    var settings = pdfGen.getClinicSettings()
    var pdfData = pdfGen.generatePdf(record, isPatientCopy, settings)

    e.response.header().set('Content-Type', 'application/pdf')
    e.response.header().set('Content-Disposition', 'inline; filename="' + pdfData.filename + '"')
    return e.string(200, pdfData.pdfBytes)
  } catch (err) {
    console.log('Error generating PDF:', err)
    return e.json(404, { error: 'Ficha não encontrada para emissão de PDF' })
  }
})

// -------------------------------------------------------------
// 7. Custom endpoint to resend receipt email manually from panel
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/forms/resend-email', (e) => {
  var pdfGen = require(`${__hooks}/pdf_generator.js`)
  var info = e.requestInfo()
  var id = info.body.id
  if (!id) {
    return e.json(400, { error: 'ID da ficha é obrigatório' })
  }

  try {
    var record = $app.findRecordById('form_submissions', id)
    var patientEmail = record.getString('patient_email')
    if (!patientEmail) {
      return e.json(400, { error: 'Ficha não possui e-mail de paciente preenchido' })
    }

    var settings = pdfGen.getClinicSettings()
    var clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

    var patientPdf = pdfGen.generatePdf(record, true, settings)
    var clinicPdf = pdfGen.generatePdf(record, false, settings)

    var patientContent = pdfGen.buildEmail(record, true, settings)
    var clinicContent = pdfGen.buildEmail(record, false, settings)
    var subject =
      'Comprovante: Ficha de Anamnese Assinada - ' +
      patientContent.patientName +
      ' - ' +
      patientContent.procLabel

    var emailSent = false
    var sendErr = ''
    var resendIdPatient = null
    var resendIdClinic = null

    // (a) Re-send to patient
    var patientResult = pdfGen.sendEmailWithPdf(
      patientEmail,
      subject,
      patientContent.html,
      patientContent.text,
      patientPdf,
      settings,
    )

    if (patientResult.sent) {
      emailSent = true
      resendIdPatient = patientResult.resendId
    } else {
      sendErr = patientResult.error
    }

    // (b) Re-send to clinic
    if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
      var clinicResult = pdfGen.sendEmailWithPdf(
        clinicEmail,
        subject,
        clinicContent.html,
        clinicContent.text,
        clinicPdf,
        settings,
      )
      if (clinicResult.sent) {
        resendIdClinic = clinicResult.resendId
      }
    }

    var nowIso = new Date().toISOString()
    var pdfAttached = emailSent ? 1 : 0
    $app
      .db()
      .newQuery(
        'UPDATE form_submissions ' +
          'SET email_delivery_status = {:status}, ' +
          '    email_sent_at = {:sentAt}, ' +
          '    email_delivery_error = {:error}, ' +
          '    pdf_attached_to_email = {:pdfAttached} ' +
          'WHERE id = {:id}',
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
        resendIdPatient: resendIdPatient,
        resendIdClinic: resendIdClinic,
        attachmentFilename: patientPdf.filename,
        attachmentSize: patientPdf.size,
        totalPages: patientPdf.totalPages,
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
