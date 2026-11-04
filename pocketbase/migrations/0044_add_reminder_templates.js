// 0044: adiciona campos de configuração de textos dos lembretes (assunto e corpo para 24h e 2h)
migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('clinic_settings')

    if (!settingsCol.fields.getByName('reminder_subject_24h')) {
      settingsCol.fields.add(new TextField({ name: 'reminder_subject_24h', max: 500 }))
    }
    if (!settingsCol.fields.getByName('reminder_body_24h')) {
      settingsCol.fields.add(new TextField({ name: 'reminder_body_24h', max: 5000 }))
    }
    if (!settingsCol.fields.getByName('reminder_subject_2h')) {
      settingsCol.fields.add(new TextField({ name: 'reminder_subject_2h', max: 500 }))
    }
    if (!settingsCol.fields.getByName('reminder_body_2h')) {
      settingsCol.fields.add(new TextField({ name: 'reminder_body_2h', max: 5000 }))
    }

    app.save(settingsCol)

    const defaultSubject24h = 'Lembrete: seu procedimento é amanhã às {{hora}}'
    const defaultSubject2h = 'Lembrete: seu procedimento é hoje às {{hora}}'
    const defaultBody = [
      'Lembrete de Agendamento',
      '',
      'Olá, {{nome}}!',
      '',
      'Este é um lembrete do seu procedimento em {{data_extenso}} às {{hora}}, na {{nome_clinica}}.',
      '',
      'Procedimento: {{procedimento}}',
      'Data: {{data_extenso}}',
      'Horário: {{hora}}',
      'Local: {{endereco}}',
      '',
      'Em caso de dúvida, fale com a clínica: {{telefone}}',
      '',
      '{{nome_clinica}}',
    ].join('\n')

    try {
      const records = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (records && records.length > 0) {
        const s = records[0]
        if (!s.getString('reminder_subject_24h')) {
          s.set('reminder_subject_24h', defaultSubject24h)
        }
        if (!s.getString('reminder_body_24h')) {
          s.set('reminder_body_24h', defaultBody)
        }
        if (!s.getString('reminder_subject_2h')) {
          s.set('reminder_subject_2h', defaultSubject2h)
        }
        if (!s.getString('reminder_body_2h')) {
          s.set('reminder_body_2h', defaultBody)
        }
        app.save(s)
      }
    } catch (e) {
      console.log('Aviso ao inicializar textos de lembrete em clinic_settings: ' + e.message)
    }
  },
  (app) => {
    try {
      const settingsCol = app.findCollectionByNameOrId('clinic_settings')
      if (settingsCol.fields.getByName('reminder_subject_24h')) {
        settingsCol.fields.removeByName('reminder_subject_24h')
      }
      if (settingsCol.fields.getByName('reminder_body_24h')) {
        settingsCol.fields.removeByName('reminder_body_24h')
      }
      if (settingsCol.fields.getByName('reminder_subject_2h')) {
        settingsCol.fields.removeByName('reminder_subject_2h')
      }
      if (settingsCol.fields.getByName('reminder_body_2h')) {
        settingsCol.fields.removeByName('reminder_body_2h')
      }
      app.save(settingsCol)
    } catch (_) {}
  },
)
