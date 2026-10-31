/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let probe = {}
  try {
    const res = $http.send({
      url: 'https://ficha-digital-de-anamnese-9632c.shrd01.internal.goskip.dev/backend/v1/test-resend-raw8',
      method: 'GET',
      timeout: 10,
    })
    const body = JSON.parse(res.raw)
    const settings = JSON.parse(body.fullSettings)
    probe = {
      keys: Object.keys(settings),
      hasResendInStr: body.fullSettings.indexOf('re_') !== -1,
      resendIndex: body.fullSettings.indexOf('resend'),
    }
    if (probe.hasResendInStr) {
      const idx = body.fullSettings.indexOf('re_')
      probe.reSnippet = body.fullSettings.substring(idx, idx + 25)
    }
  } catch (err) {
    probe = { err: err.message }
  }

  try {
    const auditCol = app.findCollectionByNameOrId('audit_events')
    const forms = app.findRecordsByFilter('form_submissions', '', '-created', 1, 0)
    if (forms.length > 0) {
      const rec = new Record(auditCol)
      rec.set('form_submission', forms[0].id)
      rec.set('event_type', 'probe_resend_raw8_result')
      rec.set('description', JSON.stringify(probe))
      rec.set('timestamp', new Date().toISOString())
      app.save(rec)
    }
  } catch (_) {}
})
