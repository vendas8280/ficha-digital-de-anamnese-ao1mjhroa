// 0034: adiciona o campo de estado do lembrete (reminder_state) à collection
// procedure_appointments. Todo agendamento nasce como "aguardando ficha"
// (primeiro estado do fluxo de lembretes); registros já existentes são
// preenchidos com esse mesmo valor.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('procedure_appointments')

    if (!col.fields.getByName('reminder_state')) {
      col.fields.add(new TextField({ name: 'reminder_state' }))
      app.save(col)
    }

    // Backfill idempotente: registros antigos ficam "aguardando ficha"
    const records = app.findRecordsByFilter('procedure_appointments', '', '-created', 0, 0)
    for (const record of records) {
      if (!record.getString('reminder_state')) {
        record.set('reminder_state', 'aguardando ficha')
        app.save(record)
      }
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('procedure_appointments')
    if (col.fields.getByName('reminder_state')) {
      col.fields.removeByName('reminder_state')
      app.save(col)
    }
  },
)
