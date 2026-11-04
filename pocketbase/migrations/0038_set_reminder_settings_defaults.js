// 0038: garante os interruptores de lembrete ligados como true por padrão
migrate((app) => {
  const records = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
  if (records && records.length > 0) {
    const s = records[0]
    s.set('reminder_enable_24h', true)
    s.set('reminder_enable_2h', true)
    s.set('reminder_test_mode', true)
    if (!s.getString('reminder_min_advance_hours')) {
      s.set('reminder_min_advance_hours', '6')
    }
    if (!s.getString('reminder_sender_email')) {
      s.set(
        'reminder_sender_email',
        s.getString('sender_email') ||
          'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
      )
    }
    app.save(s)
  }
})
