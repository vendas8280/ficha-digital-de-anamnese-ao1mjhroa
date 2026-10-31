migrate(
  (app) => {
    // 1. clinic_settings collection (for recipient email and clinic preferences)
    const settingsCol = new Collection({
      name: 'clinic_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'clinic_name', type: 'text', required: true },
        { name: 'notification_email', type: 'email', required: true },
        { name: 'phone', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(settingsCol)

    // 2. form_submissions collection
    // public can view by token or create with status pending, clinic auth can manage
    const formsCol = new Collection({
      name: 'form_submissions',
      type: 'base',
      listRule: "@request.auth.id != '' || (token != '' && token = @request.query.token)",
      viewRule: "@request.auth.id != '' || (token != '' && token = @request.query.token)",
      createRule: '',
      updateRule: "@request.auth.id != '' || (token != '' && token = @request.query.token)",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'token', type: 'text', required: true },
        {
          name: 'form_type',
          type: 'select',
          required: true,
          values: ['geral', 'labios', 'botox'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'preenchida', 'expirada'],
          maxSelect: 1,
        },
        { name: 'patient_name', type: 'text' },
        { name: 'patient_cpf', type: 'text' },
        { name: 'patient_email', type: 'text' },
        { name: 'patient_phone', type: 'text' },
        { name: 'patient_birth_date', type: 'text' },
        { name: 'patient_rg', type: 'text' },
        { name: 'patient_address', type: 'text' },
        { name: 'patient_profession', type: 'text' },
        { name: 'patient_emergency_contact', type: 'text' },
        { name: 'answers', type: 'json' },
        { name: 'signature_data', type: 'text' },
        { name: 'accepted_term_text', type: 'text' },
        { name: 'accepted_term_title', type: 'text' },
        { name: 'signed_at', type: 'text' },
        { name: 'ip_address', type: 'text' },
        { name: 'user_agent', type: 'text' },
        { name: 'document_hash', type: 'text' },
        { name: 'expires_at', type: 'text' },
        {
          name: 'email_delivery_status',
          type: 'select',
          values: ['nao_enviado', 'enviado', 'falha'],
          maxSelect: 1,
        },
        { name: 'email_delivery_error', type: 'text' },
        { name: 'email_sent_at', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_form_token ON form_submissions (token)',
        'CREATE INDEX idx_form_status_created ON form_submissions (status, created DESC)',
        'CREATE INDEX idx_form_patient_name ON form_submissions (patient_name)',
      ],
    })
    app.save(formsCol)
  },
  (app) => {
    try {
      const f = app.findCollectionByNameOrId('form_submissions')
      app.delete(f)
    } catch (_) {}
    try {
      const s = app.findCollectionByNameOrId('clinic_settings')
      app.delete(s)
    } catch (_) {}
  },
)
