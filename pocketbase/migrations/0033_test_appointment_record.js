migrate(
  (app) => {
    // TESTE solicitado: ficha com agendamento 05/11/2026 às 14:30.
    // Idempotente: se o registro de teste já existir, não faz nada.
    // A ficha de teste aparece no painel e pode ser excluída por lá
    // (a exclusão da ficha apaga o agendamento em cascata).
    const MARKER = 'TESTE AGENDAMENTO (excluir)'
    try {
      const existing = app.findRecordsByFilter(
        'procedure_appointments',
        `patient_name = "${MARKER}"`,
        '',
        1,
        0,
      )
      if (existing.length > 0) return
    } catch (_) {}

    const formsCol = app.findCollectionByNameOrId('form_submissions')
    const token = 'TESTEAGENDA' + '0511261430' + 'ABCDEFGHIJKLMN'
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const rec = new Record(formsCol)
    rec.set('token', token)
    rec.set('form_type', 'geral')
    rec.set('status', 'pendente')
    rec.set('patient_name', MARKER)
    rec.set('patient_phone', '(11) 90000-0000')
    rec.set('patient_email', 'teste.agendamento@exemplo.com')
    rec.set('expires_at', expires)
    rec.set('email_delivery_status', 'nao_enviado')
    rec.set('answers', {})
    app.save(rec)

    const apptsCol = app.findCollectionByNameOrId('procedure_appointments')
    const appt = new Record(apptsCol)
    appt.set('form_submission', rec.id)
    appt.set('patient_name', MARKER)
    appt.set('patient_phone', '(11) 90000-0000')
    appt.set('patient_email', 'teste.agendamento@exemplo.com')
    appt.set('procedure_date', '2026-11-05 00:00:00.000Z')
    appt.set('procedure_time', '14:30')
    appt.set('procedure', 'geral')
    appt.set('notify_patient', true)
    appt.set('notify_clinic', true)
    appt.set('status', 'agendado')
    app.save(appt)
  },
  (app) => {
    // rollback: remove a ficha de teste (o agendamento é apagado em cascata)
    try {
      const appts = app.findRecordsByFilter(
        'procedure_appointments',
        'patient_name = "TESTE AGENDAMENTO (excluir)"',
        '',
        10,
        0,
      )
      for (const a of appts) {
        try {
          const rec = app.findRecordById('form_submissions', a.getString('form_submission'))
          app.delete(rec)
        } catch (_) {}
      }
    } catch (_) {}
  },
)
