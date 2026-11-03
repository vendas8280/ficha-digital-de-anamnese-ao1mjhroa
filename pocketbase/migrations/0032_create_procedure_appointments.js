migrate(
  (app) => {
    // Cria a coleção de agendamentos de procedimentos (opcional, gerado no painel)
    const collection = new Collection({
      name: 'procedure_appointments',
      type: 'base',
      // Painel autenticado lista/vê/edita/exclui; criação pública liberada
      // (mesmo padrão de audit_events/email_verifications: gravar via server-side
      //  ou pela clínica autenticada, sem expor dados a anônimos)
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '',
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'form_submission',
          type: 'relation',
          required: true,
          collectionId: app.findCollectionByNameOrId('form_submissions').id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'patient_name', type: 'text', required: false, max: 200 },
        { name: 'patient_phone', type: 'text', required: false, max: 40 },
        { name: 'patient_email', type: 'text', required: false, max: 200 },
        { name: 'procedure_date', type: 'date', required: false },
        { name: 'procedure_time', type: 'text', required: false, max: 5 },
        { name: 'procedure', type: 'text', required: false, max: 200 },
        { name: 'notify_patient', type: 'bool', required: false },
        { name: 'notify_clinic', type: 'bool', required: false },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['agendado', 'confirmado', 'remarcado', 'realizado', 'faltou', 'cancelado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_appointment_form ON procedure_appointments (form_submission)',
        'CREATE INDEX idx_appointment_date_time ON procedure_appointments (procedure_date, procedure_time)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('procedure_appointments')
      app.delete(collection)
    } catch (_) {}
  },
)
