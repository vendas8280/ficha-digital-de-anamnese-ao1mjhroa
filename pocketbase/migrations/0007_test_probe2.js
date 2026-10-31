/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('email_verifications')
    if (col) {
      const rec = new Record(col)
      rec.set('form_submission', '5m68wxtq3eldbdr')
      rec.set('email', 'test_probe2@andresasouza.com.br')
      rec.set('code', 'PROBE_MSG')
      rec.set('verified', false)
      rec.set('expires_at', new Date().toISOString())
      app.save(rec)
    }
  },
  (app) => {},
)
