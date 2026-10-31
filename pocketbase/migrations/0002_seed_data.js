migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Seed default clinic admin user
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'gihobaicn@hotmail.com')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('gihobaicn@hotmail.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Andresa Souza Clinic')
      app.save(record)
    }

    // Seed default clinic settings
    const settingsCol = app.findCollectionByNameOrId('clinic_settings')
    const existingSettings = app.findRecordsByFilter('clinic_settings', '', '', 1, 0)
    if (existingSettings.length === 0) {
      const s = new Record(settingsCol)
      s.set('clinic_name', 'Andresa Souza Clinic')
      s.set('notification_email', 'gihobaicn@hotmail.com')
      s.set('phone', '(11) 99999-8888')
      app.save(s)
    }

    // Seed initial sample form submissions to showcase the dashboard
    const formsCol = app.findCollectionByNameOrId('form_submissions')
    const existingForms = app.findRecordsByFilter('form_submissions', '', '', 1, 0)
    if (existingForms.length === 0) {
      const sampleToken1 = $security.randomString(32)
      const sampleToken2 = $security.randomString(32)
      const now = new Date()
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const f1 = new Record(formsCol)
      f1.set('token', sampleToken1)
      f1.set('form_type', 'labios')
      f1.set('status', 'preenchida')
      f1.set('patient_name', 'Mariana Oliveira Santos')
      f1.set('patient_cpf', '123.456.789-00')
      f1.set('patient_email', 'mariana.santos.exemplo@gmail.com')
      f1.set('patient_phone', '(11) 98765-4321')
      f1.set('patient_birth_date', '1992-05-14')
      f1.set('patient_rg', '45.123.789-X')
      f1.set('patient_address', 'Av. Paulista, 1500, Apto 82, São Paulo - SP')
      f1.set('patient_profession', 'Arquiteta')
      f1.set('patient_emergency_contact', 'Carlos (Esposo) - (11) 99887-6655')
      f1.set(
        'answers',
        JSON.stringify({
          alergias: 'Nenhuma conhecida',
          medicamentos: 'Anticoncepcional',
          doencas_cronicas: 'Não',
          historico_herpes: 'Sim, esporádico (tomando aciclovir profilático)',
          fumante: 'Não',
          gestante_lactante: 'Não',
          procedimentos_anteriores: 'Preenchimento labial há 1 ano com ácido hialurônico',
          expectativas: 'Realce de contorno e hidratação com naturalidade',
        }),
      )
      f1.set(
        'signature_data',
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><path d="M10 40 Q 60 10 110 35 T 190 20" stroke="%233b49df" fill="transparent" stroke-width="2"/></svg>',
      )
      f1.set(
        'accepted_term_title',
        'Termo de Consentimento - Micropigmentação e Revitalização Labial',
      )
      f1.set(
        'accepted_term_text',
        'Declaro ter sido devidamente informada(o) pela Andresa Souza Clinic sobre todos os cuidados, técnicas, pigmentos utilizados, riscos normais de cicatrização e cuidados pós-procedimento para lábios...',
      )
      f1.set('signed_at', now.toISOString())
      f1.set('ip_address', '177.18.92.14')
      f1.set(
        'user_agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      )
      f1.set(
        'document_hash',
        $security.sha256('Mariana Oliveira Santos' + sampleToken1 + now.toISOString()),
      )
      f1.set('expires_at', expires.toISOString())
      f1.set('email_delivery_status', 'enviado')
      f1.set('email_sent_at', now.toISOString())
      app.save(f1)

      const f2 = new Record(formsCol)
      f2.set('token', sampleToken2)
      f2.set('form_type', 'botox')
      f2.set('status', 'pendente')
      f2.set('expires_at', expires.toISOString())
      f2.set('email_delivery_status', 'nao_enviado')
      app.save(f2)
    }
  },
  (app) => {
    // down logic
  },
)
