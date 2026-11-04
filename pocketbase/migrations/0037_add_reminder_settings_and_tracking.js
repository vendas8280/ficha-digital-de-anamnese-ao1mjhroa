// 0037: adiciona campos de configuração de lembretes em clinic_settings
// e campos de tentativas/erro/disparo em appointment_reminders.
migrate(
  (app) => {
    // 1. Atualizar clinic_settings
    const settingsCol = app.findCollectionByNameOrId('clinic_settings')

    if (!settingsCol.fields.getByName('reminder_sender_email')) {
      settingsCol.fields.add(new TextField({ name: 'reminder_sender_email' }))
    }
    if (!settingsCol.fields.getByName('reminder_min_advance_hours')) {
      settingsCol.fields.add(
        new SelectField({
          name: 'reminder_min_advance_hours',
          values: ['6', '12', '24'],
          maxSelect: 1,
        }),
      )
    }
    if (!settingsCol.fields.getByName('reminder_enable_24h')) {
      settingsCol.fields.add(new BoolField({ name: 'reminder_enable_24h' }))
    }
    if (!settingsCol.fields.getByName('reminder_enable_2h')) {
      settingsCol.fields.add(new BoolField({ name: 'reminder_enable_2h' }))
    }
    if (!settingsCol.fields.getByName('reminder_test_mode')) {
      settingsCol.fields.add(new BoolField({ name: 'reminder_test_mode' }))
    }
    app.save(settingsCol)

    // Preenche defaults no registro existente de clinic_settings
    try {
      const records = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (records && records.length > 0) {
        const s = records[0]
        if (!s.getString('reminder_sender_email')) {
          s.set(
            'reminder_sender_email',
            s.getString('sender_email') ||
              'Ficha Digital - Andresa Souza Clinic <ficha@andresasouza.com.br>',
          )
        }
        if (!s.getString('reminder_min_advance_hours')) {
          s.set('reminder_min_advance_hours', '6')
        }
        // Os três interruptores nascem ligados (true)
        if (s.get('reminder_enable_24h') === undefined || s.get('reminder_enable_24h') === null) {
          s.set('reminder_enable_24h', true)
        }
        if (s.get('reminder_enable_2h') === undefined || s.get('reminder_enable_2h') === null) {
          s.set('reminder_enable_2h', true)
        }
        if (s.get('reminder_test_mode') === undefined || s.get('reminder_test_mode') === null) {
          s.set('reminder_test_mode', true)
        }
        app.save(s)
      }
    } catch (e) {
      console.log('Aviso ao inicializar defaults de clinic_settings: ' + e.message)
    }

    // 2. Atualizar appointment_reminders
    const remCol = app.findCollectionByNameOrId('appointment_reminders')

    // Atualizar select de status para incluir novos estados
    // status possíveis: programado | enviado | falha | atrasado | cancelado
    const statusField = remCol.fields.getByName('status')
    if (statusField) {
      statusField.values = ['programado', 'enviado', 'falha', 'atrasado', 'cancelado']
    }

    if (!remCol.fields.getByName('attempts')) {
      remCol.fields.add(new NumberField({ name: 'attempts', onlyInt: true }))
    }
    if (!remCol.fields.getByName('last_attempt_at')) {
      remCol.fields.add(new DateField({ name: 'last_attempt_at' }))
    }
    if (!remCol.fields.getByName('last_error')) {
      remCol.fields.add(new TextField({ name: 'last_error', max: 1000 }))
    }
    if (!remCol.fields.getByName('sent_at')) {
      remCol.fields.add(new DateField({ name: 'sent_at' }))
    }
    if (!remCol.fields.getByName('sent_to')) {
      remCol.fields.add(new TextField({ name: 'sent_to', max: 200 }))
    }
    app.save(remCol)
  },
  (app) => {
    // rollback gracioso
    try {
      const settingsCol = app.findCollectionByNameOrId('clinic_settings')
      if (settingsCol.fields.getByName('reminder_sender_email')) {
        settingsCol.fields.removeByName('reminder_sender_email')
      }
      if (settingsCol.fields.getByName('reminder_min_advance_hours')) {
        settingsCol.fields.removeByName('reminder_min_advance_hours')
      }
      if (settingsCol.fields.getByName('reminder_enable_24h')) {
        settingsCol.fields.removeByName('reminder_enable_24h')
      }
      if (settingsCol.fields.getByName('reminder_enable_2h')) {
        settingsCol.fields.removeByName('reminder_enable_2h')
      }
      if (settingsCol.fields.getByName('reminder_test_mode')) {
        settingsCol.fields.removeByName('reminder_test_mode')
      }
      app.save(settingsCol)
    } catch (_) {}

    try {
      const remCol = app.findCollectionByNameOrId('appointment_reminders')
      if (remCol.fields.getByName('attempts')) remCol.fields.removeByName('attempts')
      if (remCol.fields.getByName('last_attempt_at')) remCol.fields.removeByName('last_attempt_at')
      if (remCol.fields.getByName('last_error')) remCol.fields.removeByName('last_error')
      if (remCol.fields.getByName('sent_at')) remCol.fields.removeByName('sent_at')
      if (remCol.fields.getByName('sent_to')) remCol.fields.removeByName('sent_to')
      app.save(remCol)
    } catch (_) {}
  },
)
