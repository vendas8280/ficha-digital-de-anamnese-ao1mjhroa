/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Limpa todos os eventos de auditoria gerados pelas investigações e sondagens de teste
  try {
    const probeEvents = app.findRecordsByFilter(
      'audit_events',
      'event_type ~ "probe" || event_type ~ "teste" || description ~ "probe" || description ~ "Dump:"',
      '',
      500,
      0,
    )
    for (const rec of probeEvents) {
      try {
        app.delete(rec)
      } catch (_) {}
    }
  } catch (_) {}

  // Limpa também registros de teste em email_verifications se houver
  try {
    const testVerifs = app.findRecordsByFilter(
      'email_verifications',
      'email ~ "probe" || email ~ "teste" || code ~ "PROBE"',
      '',
      100,
      0,
    )
    for (const v of testVerifs) {
      try {
        app.delete(v)
      } catch (_) {}
    }
  } catch (_) {}
})
