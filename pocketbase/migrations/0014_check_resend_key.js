/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let settingsDump = ''
  try {
    const s = app.settings()
    settingsDump = JSON.stringify({
      meta: s && s.meta ? Object.keys(s.meta) : null,
      smtp: s && s.smtp ? { enabled: s.smtp.enabled, host: s.smtp.host } : null,
    })
  } catch (err) {
    settingsDump = 'Err: ' + err.message
  }

  try {
    const auditCol = app.findCollectionByNameOrId('audit_events')
    const forms = app.findRecordsByFilter('form_submissions', '', '-created', 1, 0)
    if (forms.length > 0) {
      const rec = new Record(auditCol)
      rec.set('form_submission', forms[0].id)
      rec.set('event_type', 'probe_resend_apikey_check')
      rec.set('description', 'Dump: ' + settingsDump)
      rec.set('timestamp', new Date().toISOString())
      app.save(rec)
    }
  } catch (_) {}
})
