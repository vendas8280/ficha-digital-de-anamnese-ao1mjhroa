// 0046: Limpa o registro temporário de teste 'TESTE FINAL REAL (excluir)' criado na Etapa 4
// Preserva intactos os registros de pacientes reais
migrate((app) => {
  try {
    const appts = app.findRecordsByFilter(
      'procedure_appointments',
      'patient_name ~ "TESTE FINAL REAL"',
      '-created',
      10,
      0,
    )
    for (let i = 0; i < appts.length; i++) {
      const a = appts[i]
      // Exclui lembretes associados
      try {
        const rems = app.findRecordsByFilter(
          'appointment_reminders',
          'appointment = "' + a.id + '"',
          '-created',
          20,
          0,
        )
        for (let j = 0; j < rems.length; j++) {
          app.delete(rems[j])
        }
      } catch (_) {}

      // Exclui form submission associada se for de teste
      const formId = a.getString('form_submission')
      if (formId) {
        try {
          const f = app.findRecordById('form_submissions', formId)
          if (f && f.getString('patient_name').indexOf('TESTE FINAL REAL') !== -1) {
            app.delete(f)
          }
        } catch (_) {}
      }

      app.delete(a)
    }
  } catch (err) {
    console.log('Erro ao limpar testes: ' + err.message)
  }
})
