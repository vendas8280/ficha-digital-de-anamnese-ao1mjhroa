// Hook de lembretes de agendamento — etapa B (calcula e registra o estado).
// Nenhum e-mail é enviado aqui: esta etapa apenas grava no banco o estado
// do lembrete de cada agendamento, a partir da assinatura da ficha.
//
// O cálculo na assinatura (e-mail capturado -> 24h/2h/fora do prazo) vive
// em pocketbase/hooks/forms.pb.js, no observador de form_submissions.
// Este arquivo mantém vivo o cron de 15 minutos que marca "sem ficha,
// lembrete não enviado" quando o horário do procedimento passa sem a
// ficha assinada. O agendamento NUNCA é apagado.
// Autocontido: o JSVM executa callbacks em um pool separado — nada de
// declarações top-level referenciadas dentro do callback.

cronAdd('marcarSemFicha', '*/15 * * * *', () => {
  // --- auxiliares locais (self-contidos) ---
  function apptDateTime(appt) {
    var dateVal = appt.getString('procedure_date')
    var timeVal = (appt.getString('procedure_time') || '').trim()
    if (!dateVal) return null
    var m = String(dateVal)
      .substring(0, 10)
      .match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    var hh = 0
    var mm = 0
    var tm = timeVal.match(/^(\d{1,2}):(\d{2})/)
    if (tm) {
      hh = parseInt(tm[1], 10)
      mm = parseInt(tm[2], 10)
      if (isNaN(hh) || hh < 0 || hh > 23) hh = 0
      if (isNaN(mm) || mm < 0 || mm > 59) mm = 0
    }
    var ts = Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), hh, mm, 0, 0)
    if (isNaN(ts)) return null
    return new Date(ts)
  }

  try {
    // Agendamentos ainda "aguardando ficha" cujo horário do procedimento
    // já passou: marca "sem ficha, lembrete não enviado". Antes disso o
    // agendamento continua em "aguardando ficha", nunca "falhou".
    var aguardando = $app.findRecordsByFilter(
      'procedure_appointments',
      "reminder_state = 'aguardando ficha' && status != 'cancelado'",
      '-created',
      0,
      0,
    )
    var marcados = 0
    for (var i = 0; i < aguardando.length; i++) {
      var appt = aguardando[i]
      var apptAt = apptDateTime(appt)
      if (!apptAt) continue
      if (apptAt.getTime() <= Date.now()) {
        appt.set('reminder_state', 'sem ficha, lembrete não enviado')
        $app.save(appt)
        marcados++
      }
    }
    if (marcados > 0) {
      console.log('marcarSemFicha: ' + marcados + ' agendamento(s) marcado(s) como sem ficha.')
    }
  } catch (err) {
    console.log('Erro no cron marcarSemFicha: ' + err.message)
  }
})
