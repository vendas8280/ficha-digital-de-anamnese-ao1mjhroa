// pocketbase/migrations/0041_set_reminder_state_enviado.js
// Marca o agendamento de teste uworiasan5yanml como 'enviado' no banco
// (o lembrete qth4lo1lppsvgnx já foi enviado com sucesso via Resend HTTP 200).
migrate((app) => {
  try {
    const appt = app.findRecordById('procedure_appointments', 'uworiasan5yanml')
    if (appt) {
      appt.set('reminder_state', 'enviado')
      app.save(appt)
      console.log('[0041] Agendamento uworiasan5yanml atualizado para reminder_state = "enviado"')
    }
  } catch (err) {
    console.log('[0041] Erro: ' + err.message)
  }
})
