// 0056: Imutabilidade e encadeamento criptográfico da trilha de auditoria (audit_events)
migrate(
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_events')

    // 1. Regras de imutabilidade estrita: leitura controlada, criação controlada, sem UPDATE e sem DELETE
    auditCol.listRule = "@request.auth.id != '' || form_submission.token = @request.query.token"
    auditCol.viewRule = "@request.auth.id != '' || form_submission.token = @request.query.token"
    auditCol.updateRule = null // Bloqueia UPDATE em qualquer nível de API
    auditCol.deleteRule = null // Bloqueia DELETE em qualquer nível de API

    // 2. Adiciona campos de encadeamento criptográfico (hash chain) se não existirem
    if (!auditCol.fields.getByName('previous_hash')) {
      auditCol.fields.add(
        new TextField({
          name: 'previous_hash',
          required: false,
          max: 128,
        }),
      )
    }

    if (!auditCol.fields.getByName('chain_hash')) {
      auditCol.fields.add(
        new TextField({
          name: 'chain_hash',
          required: false,
          max: 128,
        }),
      )
    }

    app.save(auditCol)
  },
  (app) => {
    try {
      const auditCol = app.findCollectionByNameOrId('audit_events')
      auditCol.updateRule = "@request.auth.id != ''"
      auditCol.deleteRule = "@request.auth.id != ''"
      if (auditCol.fields.getByName('previous_hash')) {
        auditCol.fields.removeByName('previous_hash')
      }
      if (auditCol.fields.getByName('chain_hash')) {
        auditCol.fields.removeByName('chain_hash')
      }
      app.save(auditCol)
    } catch (_) {}
  },
)
