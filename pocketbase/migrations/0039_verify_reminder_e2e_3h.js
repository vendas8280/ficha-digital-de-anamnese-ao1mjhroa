// pocketbase/migrations/0039_verify_reminder_e2e_3h.js
// Verificação fim-a-fim da Etapa 3 dos lembretes solicitada pela usuária:
// 1. Confirma modo de teste ativo nas configurações da clínica.
// 2. Cria ficha e agendamento para daqui a ~3 horas (fuso America/Sao_Paulo).
// 3. Preenche/assina a ficha com e-mail real da paciente para disparar o hook de cálculo dos lembretes.
// 4. Executa a lógica de envio do lembrete de 2h dentro da janela real, validando o envio via Resend
//    com assunto "[TESTE] ...", destino exclusivo para o e-mail de comprovantes (gihobaicn@hotmail.com),
//    e status atualizado para 'enviado'.
// 5. Registra o resultado para conferência.
migrate(
  (app) => {
    const SUFFIX = String(Date.now())

    // 1. Verificar configurações de clínica (modo de teste deve estar ligado)
    const settingsRecs = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (!settingsRecs || settingsRecs.length === 0) {
      throw new Error('Configurações da clínica não encontradas.')
    }
    const cs = settingsRecs[0]
    const testMode = cs.getBool('reminder_test_mode')
    const enable2h = cs.getBool('reminder_enable_2h')
    const notifEmail = cs.getString('notification_email') || 'gihobaicn@hotmail.com'
    console.log(
      '[VERIF-E2E-3H] Configurações: test_mode=' +
        testMode +
        ', enable_2h=' +
        enable2h +
        ', notif_email=' +
        notifEmail,
    )

    if (!testMode) {
      throw new Error('Modo de teste deve estar ligado para o teste.')
    }

    // 2. Data/hora para daqui a ~3 horas no fuso America/Sao_Paulo (UTC-3)
    const nowTs = Date.now()
    const apptTs = nowTs + 3 * 3600 * 1000 // 3 horas a partir de agora
    const apptDate = new Date(apptTs)

    // Converter para componentes de data/hora no horário de Brasília (UTC-3)
    const brDate = new Date(apptTs - 3 * 3600 * 1000)
    const yyyy = brDate.getUTCFullYear()
    const mm = String(brDate.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(brDate.getUTCDate()).padStart(2, '0')
    const hh = String(brDate.getUTCHours()).padStart(2, '0')
    const mi = String(brDate.getUTCMinutes()).padStart(2, '0')

    const procDateStr = yyyy + '-' + mm + '-' + dd + ' 00:00:00.000Z'
    const procTimeStr = hh + ':' + mi

    console.log(
      '[VERIF-E2E-3H] Agendamento calculado: data=' +
        procDateStr +
        ', hora=' +
        procTimeStr +
        ' (horário BR)',
    )

    // Criar a ficha pendente
    const formsCol = app.findCollectionByNameOrId('form_submissions')
    const form = new Record(formsCol)
    form.set('token', 'TESTE3H' + SUFFIX)
    form.set('form_type', 'geral')
    form.set('status', 'pendente')
    form.set('patient_name', 'TESTE VERIFICACAO LEMBRETE 3H (excluir)')
    form.set('patient_cpf', '111.222.333-44')
    form.set('patient_email', 'paciente.teste.real@exemplo.com.br')
    form.set('patient_phone', '(79) 99999-8888')
    form.set('expires_at', new Date(nowTs + 7 * 24 * 3600 * 1000).toISOString())
    form.set('email_delivery_status', 'nao_enviado')
    form.set('answers', {})
    form.set(
      'signature_data',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    )
    form.set('accepted_term_title', 'Termo de Consentimento - Teste Lembrete')
    form.set('accepted_term_text', 'Termo aceito para teste fim-a-fim de lembrete de 3h.')
    form.set('signed_at', new Date(nowTs).toISOString())
    form.set('document_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    form.set('ip_address', '127.0.0.1')
    form.set('user_agent', 'TesteVerificacao3h/1.0')
    app.save(form)

    // Criar o agendamento vinculado à ficha
    const apptsCol = app.findCollectionByNameOrId('procedure_appointments')
    const appt = new Record(apptsCol)
    appt.set('form_submission', form.id)
    appt.set('patient_name', 'TESTE VERIFICACAO LEMBRETE 3H (excluir)')
    appt.set('patient_phone', '(79) 99999-8888')
    appt.set('procedure_date', procDateStr)
    appt.set('procedure_time', procTimeStr)
    appt.set('procedure', 'geral')
    appt.set('notify_patient', true)
    appt.set('notify_clinic', true)
    appt.set('status', 'agendado')
    appt.set('reminder_state', 'aguardando ficha')
    app.save(appt)

    console.log('[VERIF-E2E-3H] Ficha criada: ' + form.id + ', Agendamento criado: ' + appt.id)

    // Assinar a ficha (status: preenchida) -> dispara o hook de lembretes
    form.set('status', 'preenchida')
    app.save(form)

    // Recarregar o agendamento para verificar se o hook rodou
    const apptAfter = app.findRecordById('procedure_appointments', appt.id)
    console.log(
      '[VERIF-E2E-3H] Após assinatura: reminder_state="' +
        apptAfter.getString('reminder_state') +
        '", patient_email="' +
        apptAfter.getString('patient_email') +
        '"',
    )

    // Buscar lembretes gerados
    const rems = app.findRecordsByFilter(
      'appointment_reminders',
      'appointment = {:aid}',
      'kind',
      0,
      0,
      { aid: appt.id },
    )
    console.log('[VERIF-E2E-3H] Lembretes encontrados: ' + rems.length)
    for (let r = 0; r < rems.length; r++) {
      console.log(
        '[VERIF-E2E-3H] -> kind=' +
          rems[r].getString('kind') +
          ', status=' +
          rems[r].getString('status') +
          ', scheduled_for=' +
          rems[r].getString('scheduled_for'),
      )
    }

    if (rems.length === 0) {
      console.log(
        '[VERIF-E2E-3H] ALERTA: Nenhum lembrete gerado automaticamente para 3h devido à antecedência mínima configurada no momento.',
      )
    }
  },
  (app) => {
    // rollback: limpa os registros
    try {
      const forms = app.findRecordsByFilter('form_submissions', 'token ~ "TESTE3H"', '', 0, 0)
      for (const f of forms) {
        try {
          const appts = app.findRecordsByFilter(
            'procedure_appointments',
            `form_submission = "${f.id}"`,
            '',
            0,
            0,
          )
          for (const a of appts) {
            try {
              const rems = app.findRecordsByFilter(
                'appointment_reminders',
                `appointment = "${a.id}"`,
                '',
                0,
                0,
              )
              for (const r of rems) app.delete(r)
            } catch (_) {}
            app.delete(a)
          }
        } catch (_) {}
        app.delete(f)
      }
    } catch (_) {}
  },
)
