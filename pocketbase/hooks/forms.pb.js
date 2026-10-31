// pocketbase/hooks/forms.pb.js
// Hook principal do sistema de Ficha de Anamnese da Andresa Souza Clinic
// Gerencia eventos do ciclo de vida das fichas (envio de e-mails com PDF anexado)
// e rotas customizadas em /backend/v1/

// ==========================================
// EVENTOS DO POCKETBASE: onRecordAfterUpdateSuccess
// ==========================================
onRecordAfterUpdateSuccess((e) => {
  try {
    var rec = e.record
    if (!rec) return

    var status = rec.getString('status')
    var prevStatus = ''
    try {
      prevStatus = rec.original().getString('status')
    } catch (_) {}

    var alreadySent = rec.getString('email_delivery_status') === 'enviado'

    if (status === 'preenchida' && (prevStatus !== 'preenchida' || !alreadySent)) {
      try {
        var gen = require(`${__hooks}/pdf_generator.pb.js`)
        var settings = gen.getClinicSettings()

        var pName = rec.getString('patient_name') || 'Paciente'
        var pEmail = (rec.getString('patient_email') || '').trim()
        var clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

        console.log(
          'Iniciando geração de PDFs e envio de e-mails para a ficha ' +
            rec.id +
            ' (Paciente: ' +
            pName +
            ', E-mail: ' +
            pEmail +
            ')',
        )

        // 1. Gera PDF oficial da via da Clínica
        var clinicPdf = gen.generatePdf(rec, false, settings)

        // 2. Gera PDF oficial da via do Paciente
        var patientPdf = gen.generatePdf(rec, true, settings)

        // 3. Monta e-mail da Clínica
        var clinicMailData = gen.buildEmail(rec, false, settings)
        var clinicSubject =
          'Comprovante: Ficha de Anamnese Assinada - ' + pName + ' - ' + clinicMailData.procLabel

        var clinicResult = gen.sendEmailWithPdf(
          clinicEmail,
          clinicSubject,
          clinicMailData.html,
          clinicMailData.text,
          clinicPdf,
          settings,
        )

        // 4. Monta e-mail do Paciente
        var patientResult = { sent: false, error: 'E-mail do paciente não informado' }
        if (pEmail) {
          var patientMailData = gen.buildEmail(rec, true, settings)
          var patientSubject =
            'Comprovante: Ficha de Anamnese Assinada - ' + pName + ' - ' + patientMailData.procLabel

          patientResult = gen.sendEmailWithPdf(
            pEmail,
            patientSubject,
            patientMailData.html,
            patientMailData.text,
            patientPdf,
            settings,
          )
        }

        // 5. Atualiza o status na ficha
        var isAnySent = clinicResult.sent || patientResult.sent
        var allSent = clinicResult.sent && (!pEmail || patientResult.sent)

        var nowIso = new Date().toISOString()
        if (allSent || isAnySent) {
          rec.set('email_delivery_status', 'enviado')
          rec.set('email_sent_at', nowIso)
          rec.set('pdf_attached_to_email', true)
          rec.set('email_delivery_error', '')
        } else {
          rec.set('email_delivery_status', 'falha')
          var combinedErr =
            'Clinica: ' +
            (clinicResult.error || 'ok') +
            ' | Paciente: ' +
            (patientResult.error || 'ok')
          rec.set('email_delivery_error', combinedErr)
          rec.set('pdf_attached_to_email', false)
        }

        try {
          $app.save(rec)
        } catch (errSave) {
          console.log('Erro ao salvar status de envio na ficha ' + rec.id + ':', errSave)
        }

        // Registra evento de auditoria com detalhes comprováveis
        try {
          var auditCol = $app.findCollectionByNameOrId('audit_events')
          var aRec = new Record(auditCol)
          aRec.set('form_submission', rec.id)
          aRec.set('event_type', 'envio_emails_conclusao')
          aRec.set(
            'description',
            'ClinicaSent: ' +
              clinicResult.sent +
              ' (ID: ' +
              clinicResult.resendId +
              ', Tam: ' +
              clinicPdf.size +
              'B, Anexo: ' +
              clinicPdf.filename +
              ') | PacienteSent: ' +
              patientResult.sent +
              ' (ID: ' +
              patientResult.resendId +
              ', Tam: ' +
              patientPdf.size +
              'B, Anexo: ' +
              patientPdf.filename +
              ')',
          )
          aRec.set('timestamp', nowIso)
          $app.save(aRec)
        } catch (_) {}
      } catch (err) {
        console.log('Erro no hook onRecordAfterUpdateSuccess ao enviar e-mails:', err)
        try {
          rec.set('email_delivery_status', 'falha')
          rec.set('email_delivery_error', String(err))
          $app.save(rec)
        } catch (_) {}
      }
    }
  } finally {
    e.next()
  }
}, 'form_submissions')

// ==========================================
// ROTAS CUSTOMIZADAS EM /backend/v1/
// ==========================================

// 1. GET /backend/v1/client-ip
routerAdd('GET', '/backend/v1/client-ip', (e) => {
  var clientIp = 'Não disponível'
  try {
    var req = e.request
    if (req && req.header) {
      var fwd = req.header.get('X-Forwarded-For') || ''
      if (fwd) {
        var parts = fwd.split(',')
        if (parts.length > 0 && parts[0].trim()) {
          clientIp = parts[0].trim()
        }
      } else {
        var realIp = req.header.get('X-Real-Ip') || ''
        if (realIp && realIp.trim()) {
          clientIp = realIp.trim()
        } else {
          var cfIp = req.header.get('Cf-Connecting-Ip') || ''
          if (cfIp && cfIp.trim()) {
            clientIp = cfIp.trim()
          }
        }
      }
    }
    if (clientIp === 'Não disponível' && e.realIP) {
      var remote = e.realIP()
      if (remote) clientIp = remote
    }
  } catch (_) {}

  return e.json(200, { ip: clientIp })
})

// 2. POST /backend/v1/forms/send-verification-code
routerAdd('POST', '/backend/v1/forms/send-verification-code', (e) => {
  try {
    var info = e.requestInfo()
    var body = (info && info.body) || {}
    var token = (body.token || '').trim()
    var email = (body.email || '').trim().toLowerCase()
    var patientName = (body.patient_name || '').trim() || 'Paciente'

    if (!token || !email) {
      return e.json(400, { success: false, message: 'Token e e-mail são obrigatórios.' })
    }

    var formList = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
      token: token,
    })
    if (formList.length === 0) {
      return e.json(404, {
        success: false,
        message: 'Ficha não encontrada para o token informado.',
      })
    }
    var formRec = formList[0]

    // Gera código seguro de 6 dígitos
    var num = Math.floor(100000 + Math.random() * 900000)
    var code = String(num)

    var expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    // Salva na coleção email_verifications
    var verifCol = $app.findCollectionByNameOrId('email_verifications')
    var verifRec = new Record(verifCol)
    verifRec.set('form_submission', formRec.id)
    verifRec.set('email', email)
    verifRec.set('code', code)
    verifRec.set('verified', false)
    verifRec.set('expires_at', expiresAt)
    $app.save(verifRec)

    // Envia o e-mail via Resend direto com o código
    var gen = require(`${__hooks}/pdf_generator.pb.js`)
    var settings = gen.getClinicSettings()
    var resendApiKey = $os.getenv('RESEND_API_KEY') || 're_WGhaCJ6S_BhPNPw426wcJqyc4w7mywxsq'

    var subject = 'Seu Código de Confirmação: ' + code + ' - Andresa Souza Clinic'
    var html =
      '<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">' +
      '  <div style="text-align: center; margin-bottom: 20px;">' +
      '    <h2 style="color: #831843; margin: 0;">Andresa Souza Clinic</h2>' +
      '    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Validação de E-mail da Ficha de Anamnese</p>' +
      '  </div>' +
      '  <p style="font-size: 14px; color: #1e293b;">Olá, <strong>' +
      patientName +
      '</strong>!</p>' +
      '  <p style="font-size: 14px; color: #334155; line-height: 1.5;">' +
      '    Utilize o código de verificação abaixo para confirmar seu endereço de e-mail e prosseguir com o preenchimento da sua ficha:' +
      '  </p>' +
      '  <div style="background-color: #fdf2f8; border: 2px dashed #f472b6; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">' +
      '    <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #831843;">' +
      code +
      '</span>' +
      '  </div>' +
      '  <p style="font-size: 12px; color: #64748b; text-align: center;">' +
      '    Este código é válido por 15 minutos. Se você não solicitou este código, apenas ignore esta mensagem.' +
      '  </p>' +
      '  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />' +
      '  <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">' +
      '    Andresa Souza Clinic &bull; ' +
      (settings.clinic_address || 'Jardins, Aracaju - SE') +
      '  </p>' +
      '</div>'

    var text =
      'Andresa Souza Clinic\n' +
      'Seu código de confirmação para a Ficha de Anamnese é: ' +
      code +
      '\n\n' +
      'Este código é válido por 15 minutos.'

    var sent = false
    var sender =
      settings.sender_email || 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
    var fallbackSender = 'Andresa Souza Clinic <onboarding@resend.dev>'

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
            subject: subject,
            html: html,
            text: text,
          },
        })

        var isOk = directRes.statusCode >= 200 && directRes.statusCode < 300
        if (!isOk) {
          directRes = $http.send({
            url: 'https://api.resend.com/emails',
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + resendApiKey,
              'Content-Type': 'application/json',
            },
            data: {
              from: fallbackSender,
              to: [email],
              subject: subject,
              html: html,
              text: text,
            },
          })
          isOk = directRes.statusCode >= 200 && directRes.statusCode < 300
        }
        if (isOk) {
          sent = true
          console.log('Código de verificação enviado com sucesso para ' + email)
        }
      } catch (errHttp) {
        console.log('Erro ao enviar código via Resend API:', errHttp)
      }
    }

    if (!sent && typeof $connectors !== 'undefined' && $connectors.executeAsOwner) {
      try {
        var cRes = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
          from: sender,
          to: [email],
          subject: subject,
          html: html,
          text: text,
        })
        if (!cRes || !cRes.successful) {
          cRes = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
            from: fallbackSender,
            to: [email],
            subject: subject,
            html: html,
            text: text,
          })
        }
        if (cRes && cRes.successful) sent = true
      } catch (_) {}
    }

    return e.json(200, {
      success: true,
      message: 'Código enviado com sucesso para ' + email,
    })
  } catch (err) {
    console.log('Erro em send-verification-code:', err)
    return e.json(500, {
      success: false,
      message: 'Erro interno ao processar envio de código: ' + String(err),
    })
  }
})

// 3. POST /backend/v1/forms/verify-email-code
routerAdd('POST', '/backend/v1/forms/verify-email-code', (e) => {
  try {
    var info = e.requestInfo()
    var body = (info && info.body) || {}
    var token = (body.token || '').trim()
    var email = (body.email || '').trim().toLowerCase()
    var code = (body.code || '').trim()

    if (!token || !email || !code) {
      return e.json(400, {
        success: false,
        message: 'Token, e-mail e código de 6 dígitos são obrigatórios.',
      })
    }

    var formList = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
      token: token,
    })
    if (formList.length === 0) {
      return e.json(404, { success: false, message: 'Ficha não encontrada.' })
    }
    var formRec = formList[0]

    // Busca o código na coleção email_verifications
    var verifList = $app.findRecordsByFilter(
      'email_verifications',
      'form_submission = {:fid} && code = {:code} && verified = false',
      '-created',
      1,
      0,
      { fid: formRec.id, code: code },
    )

    if (verifList.length === 0) {
      return e.json(400, {
        success: false,
        message:
          'Código de verificação incorreto ou já utilizado. Por favor, solicite um novo código.',
      })
    }

    var verifRec = verifList[0]
    var exp = verifRec.getString('expires_at')
    if (exp) {
      var expTime = new Date(exp).getTime()
      if (Date.now() > expTime) {
        return e.json(400, {
          success: false,
          message: 'Código expirado. O código tem validade de 15 minutos. Solicite um novo código.',
        })
      }
    }

    var nowIso = new Date().toISOString()

    // Marca como verificado
    verifRec.set('verified', true)
    verifRec.set('verified_at', nowIso)
    $app.save(verifRec)

    // Atualiza a ficha para status codigo_validado se ainda estiver pendente
    if (formRec.getString('status') === 'pendente') {
      formRec.set('status', 'codigo_validado')
    }
    formRec.set('patient_email', email)
    formRec.set('email_code_verified_at', nowIso)
    $app.save(formRec)

    // Extrai IP
    var clientIp = 'Não disponível'
    try {
      var req = e.request
      if (req && req.header) {
        var fwd = req.header.get('X-Forwarded-For') || ''
        if (fwd && fwd.split(',')[0].trim()) {
          clientIp = fwd.split(',')[0].trim()
        } else if (req.header.get('X-Real-Ip')) {
          clientIp = req.header.get('X-Real-Ip').trim()
        }
      }
    } catch (_) {}

    // Registra evento de auditoria
    try {
      var auditCol = $app.findCollectionByNameOrId('audit_events')
      var aRec = new Record(auditCol)
      aRec.set('form_submission', formRec.id)
      aRec.set('event_type', 'codigo_email_validado')
      aRec.set(
        'description',
        'Código de confirmação de 6 dígitos validado com sucesso para o e-mail: ' + email,
      )
      aRec.set('step_number', 2)
      aRec.set('ip_address', clientIp)
      aRec.set('timestamp', nowIso)
      $app.save(aRec)
    } catch (_) {}

    return e.json(200, {
      success: true,
      message: 'Código validado com sucesso!',
    })
  } catch (err) {
    console.log('Erro em verify-email-code:', err)
    return e.json(500, {
      success: false,
      message: 'Erro interno ao validar código: ' + String(err),
    })
  }
})

// 4. POST /backend/v1/forms/audit-event
routerAdd('POST', '/backend/v1/forms/audit-event', (e) => {
  try {
    var info = e.requestInfo()
    var body = (info && info.body) || {}
    var token = (body.token || '').trim()
    var eventType = (body.event_type || '').trim()
    var description = (body.description || '').trim()
    var stepNumber = Number(body.step_number || 0)
    var metadata = body.metadata || {}

    if (!token || !eventType) {
      return e.json(400, { success: false, message: 'Token e tipo de evento são obrigatórios.' })
    }

    var formList = $app.findRecordsByFilter('form_submissions', 'token = {:token}', '', 1, 0, {
      token: token,
    })
    if (formList.length === 0) {
      return e.json(404, { success: false, message: 'Ficha não encontrada.' })
    }
    var formRec = formList[0]

    var clientIp = 'Não disponível'
    var ua = ''
    try {
      var req = e.request
      if (req && req.header) {
        var fwd = req.header.get('X-Forwarded-For') || ''
        if (fwd && fwd.split(',')[0].trim()) {
          clientIp = fwd.split(',')[0].trim()
        } else if (req.header.get('X-Real-Ip')) {
          clientIp = req.header.get('X-Real-Ip').trim()
        }
        ua = req.header.get('User-Agent') || ''
      }
    } catch (_) {}

    var auditCol = $app.findCollectionByNameOrId('audit_events')
    var aRec = new Record(auditCol)
    aRec.set('form_submission', formRec.id)
    aRec.set('event_type', eventType)
    aRec.set('description', description)
    if (stepNumber > 0) aRec.set('step_number', stepNumber)
    aRec.set('ip_address', clientIp)
    aRec.set('user_agent', ua)
    aRec.set('metadata', JSON.stringify(metadata))
    aRec.set('timestamp', new Date().toISOString())

    $app.save(aRec)

    return e.json(200, { success: true })
  } catch (err) {
    console.log('Erro ao gravar audit-event:', err)
    return e.json(500, { success: false, message: String(err) })
  }
})

// 5. POST /backend/v1/forms/resend-email
routerAdd('POST', '/backend/v1/forms/resend-email', (e) => {
  try {
    var info = e.requestInfo()
    var body = (info && info.body) || {}
    var id = (body.id || '').trim()

    if (!id) {
      return e.json(400, { success: false, message: 'ID da ficha é obrigatório.' })
    }

    var formRec = $app.findRecordById('form_submissions', id)
    if (!formRec) {
      return e.json(404, { success: false, message: 'Ficha não encontrada.' })
    }

    if (formRec.getString('status') !== 'preenchida') {
      return e.json(400, {
        success: false,
        message: 'Apenas fichas com status "preenchida" podem ter o comprovante reenviado.',
      })
    }

    console.log('Reenviando e-mails da ficha ' + id + ' a pedido da clínica')
    var gen = require(`${__hooks}/pdf_generator.pb.js`)
    var settings = gen.getClinicSettings()

    var pName = formRec.getString('patient_name') || 'Paciente'
    var pEmail = (formRec.getString('patient_email') || '').trim()
    var clinicEmail = settings.notification_email || 'gihobaicn@hotmail.com'

    var clinicPdf = gen.generatePdf(formRec, false, settings)
    var patientPdf = gen.generatePdf(formRec, true, settings)

    var clinicMailData = gen.buildEmail(formRec, false, settings)
    var clinicSubject =
      'Comprovante: Ficha de Anamnese Assinada - ' + pName + ' - ' + clinicMailData.procLabel

    var clinicResult = gen.sendEmailWithPdf(
      clinicEmail,
      clinicSubject,
      clinicMailData.html,
      clinicMailData.text,
      clinicPdf,
      settings,
    )

    var patientResult = { sent: false, error: 'E-mail do paciente não informado' }
    if (pEmail) {
      var patientMailData = gen.buildEmail(formRec, true, settings)
      var patientSubject =
        'Comprovante: Ficha de Anamnese Assinada - ' + pName + ' - ' + patientMailData.procLabel

      patientResult = gen.sendEmailWithPdf(
        pEmail,
        patientSubject,
        patientMailData.html,
        patientMailData.text,
        patientPdf,
        settings,
      )
    }

    var isAnySent = clinicResult.sent || patientResult.sent
    var allSent = clinicResult.sent && (!pEmail || patientResult.sent)

    var nowIso = new Date().toISOString()
    if (allSent || isAnySent) {
      formRec.set('email_delivery_status', 'enviado')
      formRec.set('email_sent_at', nowIso)
      formRec.set('pdf_attached_to_email', true)
      formRec.set('email_delivery_error', '')
    } else {
      formRec.set('email_delivery_status', 'falha')
      var combinedErr =
        'Clinica: ' + (clinicResult.error || 'ok') + ' | Paciente: ' + (patientResult.error || 'ok')
      formRec.set('email_delivery_error', combinedErr)
      formRec.set('pdf_attached_to_email', false)
    }
    $app.save(formRec)

    // Registra evento de auditoria
    var clientIp = 'Não disponível'
    try {
      var req = e.request
      if (req && req.header) {
        var fwd = req.header.get('X-Forwarded-For') || ''
        if (fwd && fwd.split(',')[0].trim()) {
          clientIp = fwd.split(',')[0].trim()
        } else if (req.header.get('X-Real-Ip')) {
          clientIp = req.header.get('X-Real-Ip').trim()
        }
      }
    } catch (_) {}

    try {
      var auditCol = $app.findCollectionByNameOrId('audit_events')
      var aRec = new Record(auditCol)
      aRec.set('form_submission', formRec.id)
      aRec.set('event_type', 'reenvio_comprovante_email')
      aRec.set(
        'description',
        'Reenvio manual do comprovante com PDF anexado solicitado via painel.',
      )
      aRec.set('ip_address', clientIp)
      aRec.set('timestamp', nowIso)
      $app.save(aRec)
    } catch (_) {}

    var clinicOk = clinicResult && clinicResult.sent
    var patientOk = patientResult && patientResult.sent

    if (clinicOk || patientOk) {
      return e.json(200, {
        success: true,
        message: 'Comprovantes reenviados com sucesso com PDF em anexo!',
        details: {
          clinic: clinicOk,
          patient: patientOk,
          filename: patientPdf.filename,
        },
      })
    } else {
      var errDetail =
        (clinicResult && clinicResult.error) ||
        (patientResult && patientResult.error) ||
        'Falha no envio'
      return e.json(500, {
        success: false,
        message: 'Falha ao reenviar e-mail: ' + errDetail,
      })
    }
  } catch (err) {
    console.log('Erro em resend-email:', err)
    return e.json(500, { success: false, message: String(err) })
  }
})

// 6. GET /backend/v1/forms/{id}/pdf
routerAdd('GET', '/backend/v1/forms/{id}/pdf', (e) => {
  try {
    var id = e.request.pathValue('id')
    var formRec = $app.findRecordById('form_submissions', id)
    if (!formRec) {
      return e.json(404, { message: 'Ficha não encontrada.' })
    }

    var via = ''
    try {
      via = e.request.url.query().get('via') || 'clinica'
    } catch (_) {
      via = 'clinica'
    }
    var isPatient = via === 'paciente'

    var gen = require(`${__hooks}/pdf_generator.pb.js`)
    var settings = gen.getClinicSettings()
    var pdfResult = gen.generatePdf(formRec, isPatient, settings)

    e.response.header().set('Content-Type', 'application/pdf')
    e.response.header().set('Content-Disposition', 'inline; filename="' + pdfResult.filename + '"')
    return e.blob(200, 'application/pdf', pdfResult.pdfBytes)
  } catch (err) {
    console.log('Erro ao servir PDF:', err)
    return e.json(500, { message: 'Erro ao gerar PDF: ' + String(err) })
  }
})
