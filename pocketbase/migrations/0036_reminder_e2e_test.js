// pocketbase/migrations/0036_reminder_e2e_test.js
// TESTE REAL dos lembretes de agendamento (etapa B): cria dois cenários,
// assina as fichas de teste (dispara o hook de form_submissions em produção)
// e registra no log os resultados verificáveis. A limpeza dos registros de
// teste fica na migration 0037 (roda depois da verificação no banco).
//
// Cenário (a): procedimento daqui a ~30h  -> DOIS lembretes (24h e 2h),
//              estado "lembretes programados", e-mail capturado no agendamento.
// Cenário (b): procedimento daqui a ~5h   -> APENAS o lembrete de 2h,
//              estado "parcial: apenas 2h", e-mail já registrado preservado.
migrate(
  (app) => {
    const SUFFIX = String(Date.now())

    function apptAt(hoursFromNow) {
      return new Date(Date.now() + hoursFromNow * 3600 * 1000)
    }

    function isoDate(d) {
      return d.toISOString()
    }

    function hhmm(d) {
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mm = String(d.getUTCMinutes()).padStart(2, '0')
      return hh + ':' + mm
    }

    function createTestForm(tokenSuffix, patientEmail) {
      const formsCol = app.findCollectionByNameOrId('form_submissions')
      const rec = new Record(formsCol)
      rec.set('token', 'TESTELEMB' + tokenSuffix + SUFFIX)
      rec.set('form_type', 'geral')
      rec.set('status', 'pendente')
      rec.set('patient_name', 'TESTE LEMBRETE (excluir)')
      rec.set('patient_cpf', '000.000.000-00')
      rec.set('patient_email', patientEmail)
      rec.set('patient_phone', '(00) 00000-0000')
      rec.set('expires_at', new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString())
      rec.set('email_delivery_status', 'nao_enviado')
      rec.set('answers', {})
      rec.set(
        'signature_data',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      )
      rec.set('accepted_term_title', 'Termo de Teste - Lembretes')
      rec.set('accepted_term_text', 'Registro de teste dos lembretes de agendamento.')
      rec.set('signed_at', new Date().toISOString())
      rec.set('document_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
      rec.set('ip_address', '127.0.0.1')
      rec.set('user_agent', 'Teste Lembretes/1.0')
      app.save(rec)
      return rec
    }

    function createTestAppointment(formId, patientEmail, at) {
      const apptsCol = app.findCollectionByNameOrId('procedure_appointments')
      const appt = new Record(apptsCol)
      appt.set('form_submission', formId)
      appt.set('patient_name', 'TESTE LEMBRETE (excluir)')
      appt.set('patient_phone', '(00) 00000-0000')
      if (patientEmail) appt.set('patient_email', patientEmail)
      appt.set('procedure_date', isoDate(at))
      appt.set('procedure_time', hhmm(at))
      appt.set('procedure', 'geral')
      appt.set('notify_patient', true)
      appt.set('notify_clinic', true)
      appt.set('status', 'agendado')
      appt.set('reminder_state', 'aguardando ficha')
      app.save(appt)
      return appt
    }

    function signForm(rec) {
      // Assinatura/conclusão da ficha: dispara onRecordAfterUpdateSuccess
      rec.set('status', 'preenchida')
      app.save(rec)
    }

    function verifyScenario(tag, expectedReminders, expectedState) {
      const appts = app.findRecordsByFilter(
        'procedure_appointments',
        `form_submission = "${tag.formId}"`,
        '',
        1,
        0,
      )
      if (appts.length === 0) {
        console.log('[TESTE-LEMBRETE ' + tag.label + '] FALHOU: agendamento não encontrado')
        return
      }
      const appt = appts[0]
      const rems = app.findRecordsByFilter(
        'appointment_reminders',
        `appointment = "${appt.id}"`,
        'kind',
        0,
        0,
      )
      const kinds = rems.map((r) => r.getString('kind')).sort().join(',')
      const ok =
        rems.length === expectedReminders && appt.getString('reminder_state') === expectedState
      console.log(
        '[TESTE-LEMBRETE ' +
          tag.label +
          '] ' +
          (ok ? 'PASSOU' : 'FALHOU') +
          ' | agendamento=' +
          appt.id +
          ' | estado="' +
          appt.getString('reminder_state') +
          '" (esperado "' +
          expectedState +
          '")' +
          ' | lembretes=' +
          rems.length +
          ' (esperado ' +
          expectedReminders +
          ')' +
          ' | tipos=' +
          kinds +
          ' | email_no_agendamento="' +
          appt.getString('patient_email') +
          '"',
      )
      for (const r of rems) {
        console.log(
          '[TESTE-LEMBRETE ' +
            tag.label +
            '] lembrete kind=' +
            r.getString('kind') +
            ' status=' +
            r.getString('status') +
            ' scheduled_for=' +
            r.getString('scheduled_for'),
        )
      }
    }

    try {
      // ---- Cenário (a): procedimento daqui a ~30 horas ----
      const recA = createTestForm('30H', 'paciente30h@teste-exemplo.com')
      const atA = apptAt(30)
      const apptA = createTestAppointment(recA.id, '', atA) // sem e-mail registrado: hook deve capturar
      signForm(recA)
      // Segunda conclusão (mesma ficha assinada duas vezes): NÃO deve duplicar lembretes
      signForm(recA)
      verifyScenario(
        { label: '30h', formId: recA.id },
        2,
        'lembretes programados',
      )

      // ---- Cenário (b): procedimento daqui a ~5 horas ----
      const recB = createTestForm('5H', 'paciente5h@teste-exemplo.com')
      const atB = apptAt(5)
      // E-mail JÁ registrado no agendamento, diferente do da ficha:
      // o hook deve preservar ambos (divergência sinalizada no painel)
      const apptB = createTestAppointment(recB.id, 'registrado5h@teste-exemplo.com', atB)
      signForm(recB)
      verifyScenario({ label: '5h', formId: recB.id }, 1, 'parcial: apenas 2h')

      console.log('[TESTE-LEMBRETE] tokens de teste: TESTELEMB30H' + SUFFIX + ' / TESTELEMB5H' + SUFFIX)
    } catch (err) {
      console.log('[TESTE-LEMBRETE] Erro no teste e2e: ' + err.message)
    }
  },
  (app) => {
    // rollback: remove as fichas de teste e seus derivados
    try {
      const forms = app.findRecordsByFilter('form_submissions', 'token ~ "TESTELEMB"', '', 0, 0)
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
