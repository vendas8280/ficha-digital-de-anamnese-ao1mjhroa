// Garante o estado inicial do lembrete em TODO agendamento novo:
// sempre "aguardando ficha" (nunca "falhou" nem "enviado"), mesmo se o
// cliente não enviar o campo.
onRecordCreate((e) => {
  if (!e.record.getString('reminder_state')) {
    e.record.set('reminder_state', 'aguardando ficha')
  }
  e.next()
}, 'procedure_appointments')
