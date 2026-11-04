// pocketbase/migrations/0043_test_e2e_5h_real.js
// TESTE OBRIGATÓRIO 1:
// "Criar agendamento para daqui a 5 horas, assinar a ficha (fluxo real via link de teste)
// e confirmar: lembrete 2h gravado com scheduled_for = procedimento menos 2h
// (≈ 3 horas à frente da assinatura) e NENHUM envio na hora da assinatura."
migrate((app) => {
  const SUFFIX = String(Date.now())
  const nowTs = Date.now()

  // 1. Procedimento para daqui a 5 horas (em America/Sao_Paulo UTC-3)
  const apptTs = nowTs + 5 * 3600 * 1000
  const brDate = new Date(apptTs - 3 * 3600 * 1000)
  const yyyy = brDate.getUTCFullYear()
  const mm = String(brDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(brDate.getUTCDate()).padStart(2, '0')
  const hh = String(brDate.getUTCHours()).padStart(2, '0')
  const mi = String(brDate.getUTCMinutes()).padStart(2, '0')

  const procDateStr = yyyy + '-' + mm + '-' + dd + ' 00:00:00.000Z'
  const procTimeStr = hh + ':' + mi

  // 2. Criar a ficha pendente
  const formsCol = app.findCollectionByNameOrId('form_submissions')
  const form = new Record(formsCol)
  const token = 'TESTE5H' + SUFFIX
  form.set('token', token)
  form.set('form_type', 'geral')
  form.set('status', 'pendente')
  form.set('patient_name', 'TESTE VERIFICACAO LEMBRETE 5H (excluir)')
  form.set('patient_cpf', '222.333.444-55')
  form.set('patient_email', 'paciente.teste5h@exemplo.com.br')
  form.set('patient_phone', '(79) 99809-1314')
  form.set('expires_at', new Date(nowTs + 7 * 24 * 3600 * 1000).toISOString())
  form.set('email_delivery_status', 'nao_enviado')
  form.set('answers', {})
  form.set(
    'signature_data',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  )
  form.set('accepted_term_title', 'Termo de Consentimento - Teste 5h')
  form.set('accepted_term_text', 'Termo de consentimento aceito no teste de 5h.')
  form.set('signed_at', new Date(nowTs).toISOString())
  form.set('document_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  form.set('ip_address', '127.0.0.1')
  form.set('user_agent', 'TesteVerificacao5h/1.0')
  app.save(form)

  // 3. Criar agendamento vinculado à ficha
  const apptsCol = app.findCollectionByNameOrId('procedure_appointments')
  const appt = new Record(apptsCol)
  appt.set('form_submission', form.id)
  appt.set('patient_name', 'TESTE VERIFICACAO LEMBRETE 5H (excluir)')
  appt.set('patient_phone', '(79) 99809-1314')
  appt.set('procedure_date', procDateStr)
  appt.set('procedure_time', procTimeStr)
  appt.set('procedure', 'geral')
  appt.set('notify_patient', true)
  appt.set('notify_clinic', true)
  appt.set('status', 'agendado')
  appt.set('reminder_state', 'aguardando ficha')
  app.save(appt)

  console.log('[TESTE-5H] Ficha criada: ' + form.id + ', Agendamento criado: ' + appt.id)

  // 4. Assinar a ficha (status: 'preenchida') -> dispara hook onRecordAfterUpdateSuccess
  form.set('status', 'preenchida')
  app.save(form)

  // 5. Validar resultado no agendamento e nos lembretes
  const apptAfter = app.findRecordById('procedure_appointments', appt.id)
  console.log(
    '[TESTE-5H] Após assinatura: reminder_state="' +
      apptAfter.getString('reminder_state') +
      '", patient_email="' +
      apptAfter.getString('patient_email') +
      '"',
  )

  const rems = app.findRecordsByFilter(
    'appointment_reminders',
    'appointment = {:aid}',
    'kind',
    0,
    0,
    { aid: appt.id },
  )

  console.log('[TESTE-5H] Quantidade de lembretes gerados: ' + rems.length)
  for (let r = 0; r < rems.length; r++) {
    const rem = rems[r]
    console.log(
      '[TESTE-5H] -> kind: ' +
        rem.getString('kind') +
        ', status: ' +
        rem.getString('status') +
        ', scheduled_for: ' +
        rem.getString('scheduled_for') +
        ', sent_at: ' +
        rem.getString('sent_at'),
    )
  }
})
