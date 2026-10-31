/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Limpa o evento de erro de teste registrado na coleção audit_events
  try {
    var recs = app.findRecordsByFilter(
      'audit_events',
      'event_type = "migracao_teste_erro"',
      '',
      10,
      0,
    )
    for (var i = 0; i < recs.length; i++) {
      app.delete(recs[i])
    }
  } catch (_) {}
})
