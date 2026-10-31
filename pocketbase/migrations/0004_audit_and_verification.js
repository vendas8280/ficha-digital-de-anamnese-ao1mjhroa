migrate(
  (app) => {
    // 1. Update form_submissions collection to support new status 'codigo_validado'
    const formsCol = app.findCollectionByNameOrId('form_submissions')
    const statusField = formsCol.fields.getByName('status')
    if (statusField) {
      statusField.values = ['pendente', 'preenchida', 'expirada', 'codigo_validado']
      statusField.maxSelect = 1
    }

    if (!formsCol.fields.getByName('email_code_verified_at')) {
      formsCol.fields.add(new TextField({ name: 'email_code_verified_at' }))
    }
    app.save(formsCol)

    // 2. Update clinic_settings with sender and technical professional fields
    const settingsCol = app.findCollectionByNameOrId('clinic_settings')
    if (!settingsCol.fields.getByName('sender_email')) {
      settingsCol.fields.add(new TextField({ name: 'sender_email' }))
    }
    if (!settingsCol.fields.getByName('technical_responsible')) {
      settingsCol.fields.add(new TextField({ name: 'technical_responsible' }))
    }
    if (!settingsCol.fields.getByName('professional_register')) {
      settingsCol.fields.add(new TextField({ name: 'professional_register' }))
    }
    if (!settingsCol.fields.getByName('clinic_cnpj')) {
      settingsCol.fields.add(new TextField({ name: 'clinic_cnpj' }))
    }
    if (!settingsCol.fields.getByName('clinic_address')) {
      settingsCol.fields.add(new TextField({ name: 'clinic_address' }))
    }
    app.save(settingsCol)

    // Ensure default settings have values
    try {
      const existing = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (existing.length > 0) {
        const s = existing[0]
        if (!s.getString('sender_email'))
          s.set(
            'sender_email',
            'Ficha Digital - Andresa Souza Clinic <ficha@andresasouzaclinic.com.br>',
          )
        if (!s.getString('technical_responsible'))
          s.set('technical_responsible', 'Dra. Andresa Souza')
        if (!s.getString('professional_register'))
          s.set('professional_register', 'CRBM 12345 / Esteta')
        if (!s.getString('clinic_cnpj')) s.set('clinic_cnpj', '45.123.789/0001-90')
        if (!s.getString('clinic_address'))
          s.set('clinic_address', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100')
        app.save(s)
      }
    } catch (_) {}

    // 3. Create audit_events collection
    const formSubmissionsId = formsCol.id
    const auditCol = new Collection({
      name: 'audit_events',
      type: 'base',
      listRule: "@request.auth.id != '' || form_submission.token = @request.query.token",
      viewRule: "@request.auth.id != '' || form_submission.token = @request.query.token",
      createRule: '',
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'form_submission',
          type: 'relation',
          required: true,
          collectionId: formSubmissionsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'event_type', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'step_number', type: 'number' },
        { name: 'ip_address', type: 'text' },
        { name: 'user_agent', type: 'text' },
        { name: 'metadata', type: 'json' },
        { name: 'timestamp', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_form_submission ON audit_events (form_submission, created ASC)',
      ],
    })
    app.save(auditCol)

    // 4. Create email_verifications collection for code checking
    const verifCol = new Collection({
      name: 'email_verifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: '',
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'form_submission',
          type: 'relation',
          required: true,
          collectionId: formSubmissionsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'email', type: 'email', required: true },
        { name: 'code', type: 'text', required: true },
        { name: 'verified', type: 'bool' },
        { name: 'expires_at', type: 'text', required: true },
        { name: 'verified_at', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_verif_form_email ON email_verifications (form_submission, email)',
      ],
    })
    app.save(verifCol)
  },
  (app) => {
    try {
      const v = app.findCollectionByNameOrId('email_verifications')
      app.delete(v)
    } catch (_) {}
    try {
      const a = app.findCollectionByNameOrId('audit_events')
      app.delete(a)
    } catch (_) {}
  },
)
