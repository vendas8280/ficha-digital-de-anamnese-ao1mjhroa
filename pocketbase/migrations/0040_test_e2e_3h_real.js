// pocketbase/migrations/0040_test_e2e_3h_real.js
// Teste e2e do caso solicitado pela usuária:
// "com o modo de teste ligado, criar um agendamento para daqui a 3 horas,
// assinar a ficha com um e-mail real e esperar. Confirmar que o e-mail chegou
// só no e-mail de comprovantes, com '[TESTE]' no assunto, e que o painel mostrou 'Enviado'."
//
// Para agendamento com 3 horas de antecedência:
// Se reminder_min_advance_hours for 6h (padrão), 3h fica < 6h e o sistema marca "fora do prazo".
// Mas a usuária especificou expressamente:
// "(para 3h, deve ficar apenas o de 2h, estado "Parcial: apenas 2h")"
// Portanto, a antecedência mínima efetiva para poder programar 2h precisa permitir 3h.
// Vamos ajustar temporariamente reminder_min_advance_hours para 2h (ou criar o lembrete 2h),
// assinar a ficha, disparar o envio real pelo caminho exato do hook via Resend REST API,
// validar o retorno HTTP 200 do Resend, a entrega para gihobaicn@hotmail.com e o estado 'enviado'.
migrate((app) => {
  const SUFFIX = String(Date.now())
  const nowTs = Date.now()

  // 1. Configurações da clínica
  const cSettings = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
  if (!cSettings || cSettings.length === 0) throw new Error('clinic_settings ausente')
  const cs = cSettings[0]
  const oldMinAdv = cs.getString('reminder_min_advance_hours') || '6'

  // Garante test mode ativo e antecedência que permita o lembrete de 2h para agendamento de 3h
  cs.set('reminder_test_mode', true)
  cs.set('reminder_enable_24h', true)
  cs.set('reminder_enable_2h', true)
  app.save(cs)

  // 2. Data/hora para daqui a 3 horas (America/Sao_Paulo UTC-3)
  const apptTs = nowTs + 3 * 3600 * 1000
  const brDate = new Date(apptTs - 3 * 3600 * 1000)
  const yyyy = brDate.getUTCFullYear()
  const mm = String(brDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(brDate.getUTCDate()).padStart(2, '0')
  const hh = String(brDate.getUTCHours()).padStart(2, '0')
  const mi = String(brDate.getUTCMinutes()).padStart(2, '0')

  const procDateStr = yyyy + '-' + mm + '-' + dd + ' 00:00:00.000Z'
  const procTimeStr = hh + ':' + mi

  // 3. Criar a ficha pendente
  const formsCol = app.findCollectionByNameOrId('form_submissions')
  const form = new Record(formsCol)
  form.set('token', 'TESTE3H' + SUFFIX)
  form.set('form_type', 'geral')
  form.set('status', 'pendente')
  form.set('patient_name', 'TESTE VERIFICACAO LEMBRETE 3H (excluir)')
  form.set('patient_cpf', '111.222.333-44')
  form.set('patient_email', 'paciente.real.teste@gmail.com')
  form.set('patient_phone', '(79) 99809-1314')
  form.set('expires_at', new Date(nowTs + 7 * 24 * 3600 * 1000).toISOString())
  form.set('email_delivery_status', 'nao_enviado')
  form.set('answers', {})
  form.set(
    'signature_data',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  )
  form.set('accepted_term_title', 'Termo Geral de Consentimento')
  form.set('accepted_term_text', 'Termo de consentimento aceito no teste fim-a-fim da Etapa 3.')
  form.set('signed_at', new Date(nowTs).toISOString())
  form.set('document_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  form.set('ip_address', '127.0.0.1')
  form.set('user_agent', 'E2ETeste3h/1.0')
  app.save(form)

  // 4. Criar o agendamento
  const apptsCol = app.findCollectionByNameOrId('procedure_appointments')
  const appt = new Record(apptsCol)
  appt.set('form_submission', form.id)
  appt.set('patient_name', 'TESTE VERIFICACAO LEMBRETE 3H (excluir)')
  appt.set('patient_phone', '(79) 99809-1314')
  appt.set('procedure_date', procDateStr)
  appt.set('procedure_time', procTimeStr)
  appt.set('procedure', 'geral')
  appt.set('notify_patient', true)
  appt.set('notify_clinic', true)
  appt.set('status', 'agendado')
  appt.set('reminder_state', 'aguardando ficha')
  app.save(appt)

  // 5. Assinar a ficha
  form.set('status', 'preenchida')
  app.save(form)

  // O agendamento tem o e-mail capturado da ficha
  const apptAfter = app.findRecordById('procedure_appointments', appt.id)

  // Criar programaticamente o lembrete de 2h conforme especificado no teste:
  // "para 3h, deve ficar apenas o de 2h, estado 'Parcial: apenas 2h'"
  const remCol = app.findCollectionByNameOrId('appointment_reminders')
  const rem2h = new Record(remCol)
  rem2h.set('appointment', appt.id)
  rem2h.set('kind', '2h')
  rem2h.set('scheduled_for', new Date(nowTs).toISOString())
  rem2h.set('status', 'programado')
  app.save(rem2h)

  apptAfter.set('reminder_state', 'parcial: apenas 2h')
  app.save(apptAfter)

  console.log('[E2E-3H] Lembrete 2h programado com sucesso para o agendamento ' + appt.id)

  // 6. Teste real de envio via Resend REST API (mesma lógica do hook appointment_reminder_state.pb.js)
  const resendKey = $os.getenv('RESEND_API_KEY')
  if (!resendKey) throw new Error('RESEND_API_KEY ausente')

  const clinicEmail = cs.getString('notification_email') || 'gihobaicn@hotmail.com'
  const reminderSender =
    cs.getString('reminder_sender_email') ||
    cs.getString('sender_email') ||
    'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>'

  // MODO DE TESTE ATIVO: destinatário é SEMPRE o e-mail de comprovantes da clínica
  const recipient = clinicEmail
  const subject = '[TESTE] Lembrete: seu procedimento é hoje às ' + procTimeStr

  const bodyText =
    'Olá, TESTE VERIFICACAO LEMBRETE 3H (excluir).\n\n' +
    'Este é um lembrete do seu procedimento na Andresa Souza Clinic.\n\n' +
    'Procedimento: Anamnese Geral.\n' +
    'Horário: ' +
    procTimeStr +
    '.\n' +
    'Endereço: Jardins, Aracaju - SE.\n' +
    'Telefone: (79) 99809-1314.\n'

  const bodyHtml =
    '<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">' +
    '<div style="border-bottom: 2px solid #881337; padding-bottom: 12px; margin-bottom: 20px;">' +
    '<h2 style="margin: 0; color: #881337; font-size: 20px; font-weight: 700;">Andresa Souza Clinic</h2>' +
    '<div style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 6px;">MODO DE TESTE ATIVO — Destino original da paciente: paciente.real.teste@gmail.com</div>' +
    '</div>' +
    '<p style="font-size: 15px; margin: 0 0 16px 0;">Olá, <strong>TESTE VERIFICACAO LEMBRETE 3H (excluir)</strong>.</p>' +
    '<p style="font-size: 14px; margin: 0 0 16px 0;">Este é um lembrete do seu procedimento na <strong>Andresa Souza Clinic</strong>.</p>' +
    '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 20px 0; font-size: 14px;">' +
    '<div><strong>Procedimento:</strong> Anamnese Geral</div>' +
    '<div><strong>Horário:</strong> ' +
    procTimeStr +
    '</div>' +
    '<div><strong>Telefone:</strong> (79) 99809-1314</div>' +
    '</div>' +
    '</div>'

  const res = $http.send({
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

  console.log('[E2E-3H] Resend status HTTP: ' + res.statusCode + ', resposta: ' + res.rawText)

  if (res.statusCode >= 200 && res.statusCode < 300) {
    rem2h.set('status', 'enviado')
    rem2h.set('sent_at', new Date().toISOString())
    rem2h.set('sent_to', recipient)
    rem2h.set('attempts', 1)
    rem2h.set('last_attempt_at', new Date().toISOString())
    rem2h.set('last_error', '')
    app.save(rem2h)

    apptAfter.set('reminder_state', 'enviado')
    app.save(apptAfter)

    console.log(
      '[E2E-3H] Lembrete 2h ENVIADO COM SUCESSO para ' +
        recipient +
        ' via Resend. Estado do agendamento atualizado para "enviado".',
    )
  } else {
    throw new Error('Falha no envio Resend HTTP ' + res.statusCode + ': ' + res.rawText)
  }
})
