// Hook de lembretes automáticos de agendamento — Etapa 3 (envio real via Resend).
// Envia apenas para o paciente (ou e-mail de comprovantes da clínica no modo de teste).
//
// Regras de Envio da Etapa 3:
// 1. Cada lembrete sai uma única vez (índice único no banco + idempotência de status).
// 2. Horário previsto entre agora e 30 minutos atrás (passou disso, marcar "não enviado por atraso").
// 3. Falhou, tentar 3 vezes com 10 minutos de intervalo. Depois disso, marcar "falha no envio" com botão Reenviar no painel.
// 4. Nunca enviar se o agendamento estiver cancelado ou sem ficha assinada.
// 5. Todos os horários em America/Sao_Paulo (UTC-3).
// 6. Respeitar antecedência mínima configurada (6, 12 ou 24 horas) ao decidir quais lembretes programar/enviar.
// 7. Modo de teste ligado: tudo vai para o e-mail de comprovantes da clínica com "[TESTE]" no assunto, e a paciente não recebe.
// 8. Resend REST API direta com RESEND_API_KEY do cofre ($os.getenv), remetente de lembretes configurado.
//
// REGRA DO JSVM: NADA de declaração top-level. Todas as funções auxiliares
// devem estar declaradas DENTRO de cada callback (cronAdd / routerAdd).

// -------------------------------------------------------------
// Cron de Lembretes: roda a cada 5 minutos para precisão de envio,
// processa lembretes pendentes, aplica janela de atraso (30m),
// retentativas (3x com intervalo de 10m) e marca "não enviado por atraso".
// -------------------------------------------------------------
cronAdd('marcarSemFicha', '*/5 * * * *', () => {
  function enviarLembreteResend(rem, appt, forceNow) {
    var resendKey = $os.getenv('RESEND_API_KEY')
    if (!resendKey) {
      console.log('Lembrete ' + rem.id + ': RESEND_API_KEY ausente no cofre.')
      return { ok: false, error: 'Chave RESEND_API_KEY ausente no cofre do Skip Cloud.' }
    }

    var settingsRec = null
    try {
      var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (recs && recs.length > 0) settingsRec = recs[0]
    } catch (_) {}

    var clinicName = 'Andresa Souza Clinic'
    var clinicAddr = 'Jardins, Aracaju - SE'
    var clinicPhone = '(79) 99809-1314'
    var clinicEmail = 'gihobaicn@hotmail.com'
    var reminderSender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
    var testMode = true
    var enable24h = true
    var enable2h = true

    if (settingsRec) {
      if (settingsRec.getString('clinic_name')) clinicName = settingsRec.getString('clinic_name')
      if (settingsRec.getString('clinic_address'))
        clinicAddr = settingsRec.getString('clinic_address')
      if (settingsRec.getString('phone')) clinicPhone = settingsRec.getString('phone')
      if (settingsRec.getString('notification_email'))
        clinicEmail = settingsRec.getString('notification_email')
      if (settingsRec.getString('reminder_sender_email')) {
        reminderSender = settingsRec.getString('reminder_sender_email')
      } else if (settingsRec.getString('sender_email')) {
        reminderSender = settingsRec.getString('sender_email')
      }
      if (
        settingsRec.get('reminder_enable_24h') !== undefined &&
        settingsRec.get('reminder_enable_24h') !== null
      ) {
        enable24h = settingsRec.getBool('reminder_enable_24h')
      }
      if (
        settingsRec.get('reminder_enable_2h') !== undefined &&
        settingsRec.get('reminder_enable_2h') !== null
      ) {
        enable2h = settingsRec.getBool('reminder_enable_2h')
      }
      if (
        settingsRec.get('reminder_test_mode') !== undefined &&
        settingsRec.get('reminder_test_mode') !== null
      ) {
        testMode = settingsRec.getBool('reminder_test_mode')
      }
    }

    var kind = rem.getString('kind') // '24h' ou '2h'
    if (kind === '24h' && !enable24h) {
      console.log('Lembrete 24h desativado nas configurações. Ignorando id: ' + rem.id)
      return { ok: false, error: 'Lembrete 24h desativado nas configurações.' }
    }
    if (kind === '2h' && !enable2h) {
      console.log('Lembrete 2h desativado nas configurações. Ignorando id: ' + rem.id)
      return { ok: false, error: 'Lembrete 2h desativado nas configurações.' }
    }

    if (appt.getString('status') === 'cancelado') {
      rem.set('status', 'cancelado')
      $app.save(rem)
      return { ok: false, error: 'Agendamento cancelado.' }
    }

    var formSubId = appt.getString('form_submission')
    if (!formSubId) {
      return { ok: false, error: 'Agendamento sem ficha vinculada.' }
    }
    var formRec = null
    try {
      formRec = $app.findRecordById('form_submissions', formSubId)
    } catch (_) {}
    if (!formRec || formRec.getString('status') !== 'preenchida') {
      return { ok: false, error: 'Ficha ainda não foi assinada pelo paciente.' }
    }

    var realPatientEmail = (
      formRec.getString('patient_email') ||
      appt.getString('patient_email') ||
      ''
    ).trim()
    if (!realPatientEmail) {
      return { ok: false, error: 'Paciente sem e-mail cadastrado na ficha.' }
    }

    var recipient = realPatientEmail
    if (testMode) {
      recipient = clinicEmail || 'gihobaicn@hotmail.com'
    }

    var procMap = {
      geral: 'Anamnese Geral',
      labios: 'Lábios / Micropigmentação',
      botox: 'Toxina Botulínica (Botox)',
    }
    var rawProc = appt.getString('procedure') || formRec.getString('form_type') || 'geral'
    var procedureName = procMap[rawProc] || rawProc

    var patientName =
      formRec.getString('patient_name') || appt.getString('patient_name') || 'Paciente'
    var apptTimeStr = (appt.getString('procedure_time') || '').trim() || '09:00'
    var apptDateVal = appt.getString('procedure_date')

    var dayNames = [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ]
    var monthNames = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    var dateStrBR = ''
    var mDate = String(apptDateVal)
      .substring(0, 10)
      .match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (mDate) {
      var yyyy = parseInt(mDate[1], 10)
      var mmNum = parseInt(mDate[2], 10)
      var ddNum = parseInt(mDate[3], 10)
      var dTemp = new Date(Date.UTC(yyyy, mmNum - 1, ddNum, 12, 0, 0))
      var dayOfWeek = dayNames[dTemp.getUTCDay()]
      var dayFormatted = ddNum < 10 ? '0' + ddNum : '' + ddNum
      var monthFormatted = monthNames[mmNum - 1]
      dateStrBR = dayOfWeek + ', ' + dayFormatted + ' de ' + monthFormatted + ' de ' + yyyy
    } else {
      dateStrBR = String(apptDateVal || '')
    }

    var subject = ''
    if (kind === '24h') {
      subject = 'Lembrete: seu procedimento é amanhã às ' + apptTimeStr
    } else {
      subject = 'Lembrete: seu procedimento é hoje às ' + apptTimeStr
    }
    if (testMode) {
      subject = '[TESTE] ' + subject
    }

    var bodyText =
      'Olá, ' +
      patientName +
      '.\n\n' +
      'Este é um lembrete do seu procedimento na ' +
      clinicName +
      '.\n\n' +
      'Procedimento: ' +
      procedureName +
      '.\n' +
      'Data: ' +
      dateStrBR +
      '.\n' +
      'Horário: ' +
      apptTimeStr +
      '.\n' +
      'Endereço: ' +
      clinicAddr +
      '.\n' +
      'Telefone: ' +
      clinicPhone +
      '.\n\n' +
      'Em caso de dúvida, fale com a clínica pelo telefone acima.'

    var bodyHtml =
      '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">' +
      '<div style="border-bottom: 2px solid #881337; padding-bottom: 12px; margin-bottom: 20px;">' +
      '<h2 style="margin: 0; color: #881337; font-size: 20px; font-weight: 700;">' +
      clinicName +
      '</h2>' +
      (testMode
        ? '<div style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 6px;">MODO DE TESTE ATIVO — Destino original da paciente: ' +
          realPatientEmail +
          '</div>'
        : '') +
      '</div>' +
      '<p style="font-size: 15px; margin: 0 0 16px 0;">Olá, <strong>' +
      patientName +
      '</strong>.</p>' +
      '<p style="font-size: 14px; margin: 0 0 16px 0;">Este é um lembrete do seu procedimento na <strong>' +
      clinicName +
      '</strong>.</p>' +
      '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">' +
      '<div style="margin-bottom: 8px;"><strong>Procedimento:</strong> ' +
      procedureName +
      '</div>' +
      '<div style="margin-bottom: 8px;"><strong>Data:</strong> ' +
      dateStrBR +
      '</div>' +
      '<div style="margin-bottom: 8px;"><strong>Horário:</strong> ' +
      apptTimeStr +
      '</div>' +
      '<div style="margin-bottom: 8px;"><strong>Endereço:</strong> ' +
      clinicAddr +
      '</div>' +
      '<div><strong>Telefone:</strong> ' +
      clinicPhone +
      '</div>' +
      '</div>' +
      '<p style="font-size: 13px; color: #64748b; margin: 0;">Em caso de dúvida, fale com a clínica pelo telefone acima.</p>' +
      '</div>'

    var currentAttempts = (rem.getInt('attempts') || 0) + 1
    rem.set('attempts', currentAttempts)
    rem.set('last_attempt_at', new Date().toISOString())

    try {
      var res = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: reminderSender,
          to: [recipient],
          subject: subject,
          text: bodyText,
          html: bodyHtml,
        }),
        timeout: 30,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        rem.set('status', 'enviado')
        rem.set('sent_at', new Date().toISOString())
        rem.set('sent_to', recipient)
        rem.set('last_error', '')
        $app.save(rem)

        appt.set('reminder_state', 'enviado')
        $app.save(appt)

        console.log(
          'Lembrete ' +
            kind +
            ' (' +
            rem.id +
            ') enviado com sucesso para ' +
            recipient +
            ' (Resend status ' +
            res.statusCode +
            ')',
        )
        return { ok: true, recipient: recipient }
      } else {
        var errBody = ''
        try {
          errBody = res.rawText || JSON.stringify(res.json)
        } catch (_) {}
        var errMsg = 'Resend HTTP ' + res.statusCode + ': ' + errBody
        console.log('Falha ao enviar lembrete ' + rem.id + ': ' + errMsg)

        rem.set('last_error', errMsg.substring(0, 990))
        if (currentAttempts >= 3) {
          rem.set('status', 'falha')
          appt.set('reminder_state', 'falha no envio')
          $app.save(appt)
        }
        $app.save(rem)
        return { ok: false, error: errMsg }
      }
    } catch (netErr) {
      var netErrMsg = 'Erro de rede Resend: ' + netErr.message
      console.log('Exceção ao disparar lembrete ' + rem.id + ': ' + netErrMsg)
      rem.set('last_error', netErrMsg.substring(0, 990))
      if (currentAttempts >= 3) {
        rem.set('status', 'falha')
        appt.set('reminder_state', 'falha no envio')
        $app.save(appt)
      }
      $app.save(rem)
      return { ok: false, error: netErrMsg }
    }
  }

  try {
    var now = Date.now()

    // 1. Agendamentos ainda "aguardando ficha" cujo horário já passou
    var aguardando = $app.findRecordsByFilter(
      'procedure_appointments',
      "reminder_state = 'aguardando ficha' && status != 'cancelado'",
      '-created',
      0,
      0,
    )
    for (var a = 0; a < aguardando.length; a++) {
      var apptA = aguardando[a]
      var dateVal = apptA.getString('procedure_date')
      var timeVal = (apptA.getString('procedure_time') || '').trim()
      if (!dateVal) continue
      var m = String(dateVal)
        .substring(0, 10)
        .match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (!m) continue
      var hh = 0
      var mm = 0
      var tm = timeVal.match(/^(\d{1,2}):(\d{2})/)
      if (tm) {
        hh = parseInt(tm[1], 10)
        mm = parseInt(tm[2], 10)
      }
      var apptTs = Date.UTC(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        hh + 3,
        mm,
        0,
        0,
      )
      if (apptTs <= now) {
        apptA.set('reminder_state', 'sem ficha, lembrete não enviado')
        $app.save(apptA)
      }
    }

    // 2. Buscar lembretes programados ou que falharam com menos de 3 tentativas
    var pendentes = $app.findRecordsByFilter(
      'appointment_reminders',
      "status = 'programado' || (status = 'falha' && attempts < 3)",
      'scheduled_for',
      50,
      0,
    )

    for (var i = 0; i < pendentes.length; i++) {
      var rem = pendentes[i]
      var apptId = rem.getString('appointment')
      if (!apptId) continue

      var appt = null
      try {
        appt = $app.findRecordById('procedure_appointments', apptId)
      } catch (_) {}
      if (!appt) continue

      if (appt.getString('status') === 'cancelado') {
        rem.set('status', 'cancelado')
        $app.save(rem)
        continue
      }

      var schedStr = rem.getString('scheduled_for')
      if (!schedStr) continue
      var schedTime = new Date(schedStr).getTime()
      if (isNaN(schedTime)) continue

      // Janela de atraso: entre agora e 30 minutos atrás
      var diffMinutes = (now - schedTime) / 60000

      if (diffMinutes < -1) {
        // Horário previsto no futuro — aguarda próximo ciclo
        continue
      }

      if (diffMinutes > 30) {
        rem.set('status', 'atrasado')
        rem.set('last_error', 'Lembrete não enviado por atraso: janela de 30 minutos expirada.')
        $app.save(rem)

        appt.set('reminder_state', 'não enviado por atraso')
        $app.save(appt)
        console.log('Lembrete ' + rem.id + ' marcado como atrasado (>30 min)')
        continue
      }

      // Intervalo de retry: se já tentou, esperar ao menos 10 minutos entre tentativas
      var attempts = rem.getInt('attempts') || 0
      if (attempts > 0) {
        var lastAttemptStr = rem.getString('last_attempt_at')
        if (lastAttemptStr) {
          var lastAttemptTs = new Date(lastAttemptStr).getTime()
          var minutesSinceLastAttempt = (now - lastAttemptTs) / 60000
          if (minutesSinceLastAttempt < 10) {
            continue
          }
        }
      }

      enviarLembreteResend(rem, appt, false)
    }
  } catch (err) {
    console.log('Erro no cron enviarLembretesAgendamento: ' + err.message)
  }
})

// -------------------------------------------------------------
// Rota de disparo manual / reenvio de lembrete do painel
// POST /backend/v1/appointments/retry-reminder
// -------------------------------------------------------------
routerAdd('POST', '/backend/v1/appointments/retry-reminder', (e) => {
  function enviarLembreteResendInline(rem, appt) {
    var resendKey = $os.getenv('RESEND_API_KEY')
    if (!resendKey) {
      return { ok: false, error: 'Chave RESEND_API_KEY ausente no cofre do Skip Cloud.' }
    }

    var settingsRec = null
    try {
      var recs = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (recs && recs.length > 0) settingsRec = recs[0]
    } catch (_) {}

    var clinicName = 'Andresa Souza Clinic'
    var clinicAddr = 'Jardins, Aracaju - SE'
    var clinicPhone = '(79) 99809-1314'
    var clinicEmail = 'gihobaicn@hotmail.com'
    var reminderSender = 'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'
    var testMode = true
    var enable24h = true
    var enable2h = true

    if (settingsRec) {
      if (settingsRec.getString('clinic_name')) clinicName = settingsRec.getString('clinic_name')
      if (settingsRec.getString('clinic_address'))
        clinicAddr = settingsRec.getString('clinic_address')
      if (settingsRec.getString('phone')) clinicPhone = settingsRec.getString('phone')
      if (settingsRec.getString('notification_email'))
        clinicEmail = settingsRec.getString('notification_email')
      if (settingsRec.getString('reminder_sender_email')) {
        reminderSender = settingsRec.getString('reminder_sender_email')
      } else if (settingsRec.getString('sender_email')) {
        reminderSender = settingsRec.getString('sender_email')
      }
      if (
        settingsRec.get('reminder_enable_24h') !== undefined &&
        settingsRec.get('reminder_enable_24h') !== null
      ) {
        enable24h = settingsRec.getBool('reminder_enable_24h')
      }
      if (
        settingsRec.get('reminder_enable_2h') !== undefined &&
        settingsRec.get('reminder_enable_2h') !== null
      ) {
        enable2h = settingsRec.getBool('reminder_enable_2h')
      }
      if (
        settingsRec.get('reminder_test_mode') !== undefined &&
        settingsRec.get('reminder_test_mode') !== null
      ) {
        testMode = settingsRec.getBool('reminder_test_mode')
      }
    }

    var kind = rem.getString('kind')
    if (kind === '24h' && !enable24h) {
      return { ok: false, error: 'Lembrete 24h desativado nas configurações.' }
    }
    if (kind === '2h' && !enable2h) {
      return { ok: false, error: 'Lembrete 2h desativado nas configurações.' }
    }

    if (appt.getString('status') === 'cancelado') {
      rem.set('status', 'cancelado')
      $app.save(rem)
      return { ok: false, error: 'Agendamento cancelado.' }
    }

    var formSubId = appt.getString('form_submission')
    if (!formSubId) {
      return { ok: false, error: 'Agendamento sem ficha vinculada.' }
    }
    var formRec = null
    try {
      formRec = $app.findRecordById('form_submissions', formSubId)
    } catch (_) {}
    if (!formRec || formRec.getString('status') !== 'preenchida') {
      return { ok: false, error: 'Ficha ainda não foi assinada pelo paciente.' }
    }

    var realPatientEmail = (
      formRec.getString('patient_email') ||
      appt.getString('patient_email') ||
      ''
    ).trim()
    if (!realPatientEmail) {
      return { ok: false, error: 'Paciente sem e-mail cadastrado na ficha.' }
    }

    var recipient = realPatientEmail
    if (testMode) {
      recipient = clinicEmail || 'gihobaicn@hotmail.com'
    }

    var procMap = {
      geral: 'Anamnese Geral',
      labios: 'Lábios / Micropigmentação',
      botox: 'Toxina Botulínica (Botox)',
    }
    var rawProc = appt.getString('procedure') || formRec.getString('form_type') || 'geral'
    var procedureName = procMap[rawProc] || rawProc

    var patientName =
      formRec.getString('patient_name') || appt.getString('patient_name') || 'Paciente'
    var apptTimeStr = (appt.getString('procedure_time') || '').trim() || '09:00'
    var apptDateVal = appt.getString('procedure_date')

    var dayNames = [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ]
    var monthNames = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    var dateStrBR = ''
    var mDate = String(apptDateVal)
      .substring(0, 10)
      .match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (mDate) {
      var yyyy = parseInt(mDate[1], 10)
      var mmNum = parseInt(mDate[2], 10)
      var ddNum = parseInt(mDate[3], 10)
      var dTemp = new Date(Date.UTC(yyyy, mmNum - 1, ddNum, 12, 0, 0))
      var dayOfWeek = dayNames[dTemp.getUTCDay()]
      var dayFormatted = ddNum < 10 ? '0' + ddNum : '' + ddNum
      var monthFormatted = monthNames[mmNum - 1]
      dateStrBR = dayOfWeek + ', ' + dayFormatted + ' de ' + monthFormatted + ' de ' + yyyy
    } else {
      dateStrBR = String(apptDateVal || '')
    }

    var subject = ''
    if (kind === '24h') {
      subject = 'Lembrete: seu procedimento é amanhã às ' + apptTimeStr
    } else {
      subject = 'Lembrete: seu procedimento é hoje às ' + apptTimeStr
    }
    if (testMode) {
      subject = '[TESTE] ' + subject
    }

    var bodyText =
      'Olá, ' +
      patientName +
      '.\n\n' +
      'Este é um lembrete do seu procedimento na ' +
      clinicName +
      '.\n\n' +
      'Procedimento: ' +
      procedureName +
      '.\n' +
      'Data: ' +
      dateStrBR +
      '.\n' +
      'Horário: ' +
      apptTimeStr +
      '.\n' +
      'Endereço: ' +
      clinicAddr +
      '.\n' +
      'Telefone: ' +
      clinicPhone +
      '.\n\n' +
      'Em caso de dúvida, fale com a clínica pelo telefone acima.'

    var bodyHtml =
      '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">' +
      '<div style="border-bottom: 2px solid #881337; padding-bottom: 12px; margin-bottom: 20px;">' +
      '<h2 style="margin: 0; color: #881337; font-size: 20px; font-weight: 700;">' +
      clinicName +
      '</h2>' +
      (testMode
        ? '<div style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 6px;">MODO DE TESTE ATIVO — Destino original da paciente: ' +
          realPatientEmail +
          '</div>'
        : '') +
      '</div>' +
      '<p style="font-size: 15px; margin: 0 0 16px 0;">Olá, <strong>' +
      patientName +
      '</strong>.</p>' +
      '<p style="font-size: 14px; margin: 0 0 16px 0;">Este é um lembrete do seu procedimento na <strong>' +
      clinicName +
      '</strong>.</p>' +
      '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">' +
      '<div style="margin-bottom: 8px;"><strong>Procedimento:</strong> ' +
      procedureName +
      '</div>' +
      '<div style="margin-bottom: 8px;"><strong>Data:</strong> ' +
      dateStrBR +
      '</div>' +
      '<div style="margin-bottom: 8px;"><strong>Horário:</strong> ' +
      apptTimeStr +
      '</div>' +
      '<div style="margin-bottom: 8px;"><strong>Endereço:</strong> ' +
      clinicAddr +
      '</div>' +
      '<div><strong>Telefone:</strong> ' +
      clinicPhone +
      '</div>' +
      '</div>' +
      '<p style="font-size: 13px; color: #64748b; margin: 0;">Em caso de dúvida, fale com a clínica pelo telefone acima.</p>' +
      '</div>'

    var currentAttempts = (rem.getInt('attempts') || 0) + 1
    rem.set('attempts', currentAttempts)
    rem.set('last_attempt_at', new Date().toISOString())

    try {
      var res = $http.send({
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + resendKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: reminderSender,
          to: [recipient],
          subject: subject,
          text: bodyText,
          html: bodyHtml,
        }),
        timeout: 30,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        rem.set('status', 'enviado')
        rem.set('sent_at', new Date().toISOString())
        rem.set('sent_to', recipient)
        rem.set('last_error', '')
        $app.save(rem)

        appt.set('reminder_state', 'enviado')
        $app.save(appt)

        console.log(
          'Reenvio manual: Lembrete ' + kind + ' (' + rem.id + ') enviado para ' + recipient,
        )
        return { ok: true, recipient: recipient }
      } else {
        var errBody = ''
        try {
          errBody = res.rawText || JSON.stringify(res.json)
        } catch (_) {}
        var errMsg = 'Resend HTTP ' + res.statusCode + ': ' + errBody
        console.log('Falha no reenvio manual do lembrete ' + rem.id + ': ' + errMsg)

        rem.set('last_error', errMsg.substring(0, 990))
        rem.set('status', 'falha')
        appt.set('reminder_state', 'falha no envio')
        $app.save(appt)
        $app.save(rem)
        return { ok: false, error: errMsg }
      }
    } catch (netErr) {
      var netErrMsg = 'Erro de rede Resend: ' + netErr.message
      rem.set('last_error', netErrMsg.substring(0, 990))
      rem.set('status', 'falha')
      appt.set('reminder_state', 'falha no envio')
      $app.save(appt)
      $app.save(rem)
      return { ok: false, error: netErrMsg }
    }
  }

  try {
    var reqInfo = e.requestInfo()
    var auth = reqInfo.auth
    if (!auth) {
      return e.json(401, { error: 'Não autorizado. Faça login.' })
    }

    var data = {}
    try {
      data = reqInfo.body || {}
    } catch (_) {}

    var appointmentId = (data.appointment_id || '').trim()
    if (!appointmentId) {
      return e.json(400, { error: 'ID do agendamento é obrigatório.' })
    }

    var appt = $app.findRecordById('procedure_appointments', appointmentId)
    if (!appt) {
      return e.json(404, { error: 'Agendamento não encontrado.' })
    }

    var rems = $app.findRecordsByFilter(
      'appointment_reminders',
      'appointment = {:aid}',
      '-scheduled_for',
      5,
      0,
      { aid: appt.id },
    )

    if (!rems || rems.length === 0) {
      return e.json(400, {
        error:
          'Nenhum lembrete registrado para este agendamento. Verifique se a ficha já foi assinada.',
      })
    }

    var targetRem = null
    for (var i = 0; i < rems.length; i++) {
      var r = rems[i]
      var st = r.getString('status')
      if (st === 'falha' || st === 'atrasado' || st === 'programado') {
        targetRem = r
        break
      }
    }
    if (!targetRem) targetRem = rems[0]

    targetRem.set('status', 'programado')
    var result = enviarLembreteResendInline(targetRem, appt)

    if (result.ok) {
      return e.json(200, {
        success: true,
        message: 'Lembrete enviado com sucesso para ' + result.recipient + '!',
      })
    } else {
      return e.json(500, {
        success: false,
        error: result.error || 'Falha ao reenviar lembrete via Resend.',
      })
    }
  } catch (err) {
    return e.json(500, { error: 'Erro ao processar reenvio de lembrete: ' + err.message })
  }
})
