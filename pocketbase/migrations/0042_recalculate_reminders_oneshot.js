// pocketbase/migrations/0042_recalculate_reminders_oneshot.js
// Migration one-shot de recálculo de lembretes para agendamentos existentes.
//
// Regras do recálculo:
// 1. Recalcula o estado e os horários previstos com base na data/hora do procedimento (America/Sao_Paulo).
// 2. Lembrete 24h = data+hora do procedimento menos 24 horas.
// 3. Lembrete 2h = data+hora do procedimento menos 2 horas.
// 4. Se o horário previsto recalculado já passou no momento do recálculo:
//    - Se já foi enviado com sucesso ('enviado'), MANTÉM 'enviado' (não regride).
//    - Caso contrário, marca o lembrete como 'atrasado' e o agendamento como 'não enviado por atraso'
//      (NUNCA cria envio retroativo).
// 5. Se o horário previsto recalculado ainda estiver no futuro:
//    - Cria ou atualiza o lembrete com status 'programado' e scheduled_for correto.
// 6. Grava relatório detalhado no console do PocketBase: quantos corrigidos e de qual estado para qual estado.
migrate((app) => {
  const nowTs = Date.now()

  function getApptDateTime(a) {
    const dateVal = a.getString('procedure_date')
    const timeVal = (a.getString('procedure_time') || '').trim()
    if (!dateVal) return null
    const m = String(dateVal)
      .substring(0, 10)
      .match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    let hh = 0
    let mm = 0
    const tm = timeVal.match(/^(\d{1,2}):(\d{2})/)
    if (tm) {
      hh = parseInt(tm[1], 10)
      mm = parseInt(tm[2], 10)
      if (isNaN(hh) || hh < 0 || hh > 23) hh = 0
      if (isNaN(mm) || mm < 0 || mm > 59) mm = 0
    }
    const ts = Date.UTC(
      parseInt(m[1], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[3], 10),
      hh + 3, // Converte hora local America/Sao_Paulo (UTC-3) para UTC
      mm,
      0,
      0,
    )
    if (isNaN(ts)) return null
    return new Date(ts)
  }

  // Obter configurações ativas de lembretes
  let enable24h = true
  let enable2h = true
  try {
    const cSettings = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
    if (cSettings && cSettings.length > 0) {
      const cs = cSettings[0]
      if (cs.get('reminder_enable_24h') !== undefined && cs.get('reminder_enable_24h') !== null) {
        enable24h = cs.getBool('reminder_enable_24h')
      }
      if (cs.get('reminder_enable_2h') !== undefined && cs.get('reminder_enable_2h') !== null) {
        enable2h = cs.getBool('reminder_enable_2h')
      }
    }
  } catch (_) {}

  const remCol = app.findCollectionByNameOrId('appointment_reminders')
  const allAppts = app.findRecordsByFilter('procedure_appointments', '', '-created', 0, 0)

  let totalProcessed = 0
  let totalChanged = 0
  const transitions = []

  for (let i = 0; i < allAppts.length; i++) {
    const appt = allAppts[i]
    totalProcessed++

    const apptId = appt.id
    const oldState = appt.getString('reminder_state') || 'aguardando ficha'
    const status = appt.getString('status') || 'agendado'

    if (status === 'cancelado') {
      if (oldState !== 'cancelado') {
        appt.set('reminder_state', 'cancelado')
        app.save(appt)
        totalChanged++
        transitions.push({
          id: apptId,
          from: oldState,
          to: 'cancelado',
          reason: 'agendamento cancelado',
        })
      }
      continue
    }

    // Verificar se há ficha assinada
    const formId = appt.getString('form_submission')
    let formSigned = false
    if (formId) {
      try {
        const formRec = app.findRecordById('form_submissions', formId)
        if (formRec && formRec.getString('status') === 'preenchida') {
          formSigned = true
        }
      } catch (_) {}
    }

    const apptDate = getApptDateTime(appt)
    if (!apptDate) {
      continue
    }

    const procTs = apptDate.getTime()
    const target24hTs = procTs - 24 * 3600 * 1000
    const target2hTs = procTs - 2 * 3600 * 1000

    // Se o procedimento já passou e não tinha ficha assinada
    if (procTs <= nowTs && !formSigned) {
      const expectedState = 'sem ficha, lembrete não enviado'
      if (oldState !== expectedState) {
        appt.set('reminder_state', expectedState)
        app.save(appt)
        totalChanged++
        transitions.push({
          id: apptId,
          from: oldState,
          to: expectedState,
          reason: 'procedimento passou sem ficha assinada',
        })
      }
      continue
    }

    // Se não tem ficha assinada e o procedimento ainda não passou -> aguardando ficha
    if (!formSigned) {
      const expectedState = 'aguardando ficha'
      if (oldState !== expectedState) {
        appt.set('reminder_state', expectedState)
        app.save(appt)
        totalChanged++
        transitions.push({
          id: apptId,
          from: oldState,
          to: expectedState,
          reason: 'ficha ainda pendente',
        })
      }
      continue
    }

    // COM FICHA ASSINADA:
    // Buscar lembretes existentes deste agendamento
    const existingRems = app.findRecordsByFilter(
      'appointment_reminders',
      'appointment = {:aid}',
      '',
      0,
      0,
      { aid: apptId },
    )
    const remMap = {}
    for (let r = 0; r < existingRems.length; r++) {
      remMap[existingRems[r].getString('kind')] = existingRems[r]
    }

    // Se algum lembrete já foi enviado com sucesso, o estado deve ser 'enviado'
    let hasSent = false
    for (let r = 0; r < existingRems.length; r++) {
      if (existingRems[r].getString('status') === 'enviado') {
        hasSent = true
        break
      }
    }

    if (hasSent) {
      // Já foi enviado: manter 'enviado', mas corrigir scheduled_for do lembrete se estiver inconsistente
      const rem2h = remMap['2h']
      if (rem2h) {
        const expected2hIso = new Date(target2hTs).toISOString()
        // Atualiza scheduled_for para o horário teórico correto sem alterar status enviado
        if (rem2h.getString('scheduled_for') !== expected2hIso) {
          rem2h.set('scheduled_for', expected2hIso)
          app.save(rem2h)
        }
      }
      if (oldState !== 'enviado') {
        appt.set('reminder_state', 'enviado')
        app.save(appt)
        totalChanged++
        transitions.push({
          id: apptId,
          from: oldState,
          to: 'enviado',
          reason: 'lembrete já enviado com sucesso',
        })
      }
      continue
    }

    // Caso NÃO enviado: calcular para cada tipo (24h e 2h)
    // 1. Lembrete 24h:
    let rem24hObj = remMap['24h']
    if (enable24h) {
      if (target24hTs <= nowTs) {
        // Já passou da hora de 24h atrás: se existe e não enviado, marca atrasado
        if (rem24hObj && rem24hObj.getString('status') === 'programado') {
          rem24hObj.set('status', 'atrasado')
          rem24hObj.set('scheduled_for', new Date(target24hTs).toISOString())
          rem24hObj.set('last_error', 'Lembrete não enviado por atraso: janela expirada.')
          app.save(rem24hObj)
        }
      } else {
        // Ainda está no futuro: programa
        if (!rem24hObj) {
          rem24hObj = new Record(remCol)
          rem24hObj.set('appointment', apptId)
          rem24hObj.set('kind', '24h')
          rem24hObj.set('status', 'programado')
        }
        rem24hObj.set('scheduled_for', new Date(target24hTs).toISOString())
        app.save(rem24hObj)
      }
    }

    // 2. Lembrete 2h:
    let rem2hObj = remMap['2h']
    let is2hFuture = false
    if (enable2h) {
      if (target2hTs <= nowTs) {
        // Já passou das 2h antes:
        // Se já existe e não enviado, marca atrasado com scheduled_for correto
        if (rem2hObj && rem2hObj.getString('status') !== 'enviado') {
          rem2hObj.set('status', 'atrasado')
          rem2hObj.set('scheduled_for', new Date(target2hTs).toISOString())
          rem2hObj.set('last_error', 'Lembrete não enviado por atraso: janela expirada.')
          app.save(rem2hObj)
        } else if (!rem2hObj) {
          // Cria como atrasado para registrar formalmente
          rem2hObj = new Record(remCol)
          rem2hObj.set('appointment', apptId)
          rem2hObj.set('kind', '2h')
          rem2hObj.set('status', 'atrasado')
          rem2hObj.set('scheduled_for', new Date(target2hTs).toISOString())
          rem2hObj.set('last_error', 'Lembrete não enviado por atraso: janela expirada.')
          app.save(rem2hObj)
        }
      } else {
        // Ainda no futuro: programa!
        is2hFuture = true
        if (!rem2hObj) {
          rem2hObj = new Record(remCol)
          rem2hObj.set('appointment', apptId)
          rem2hObj.set('kind', '2h')
          rem2hObj.set('status', 'programado')
        } else {
          rem2hObj.set('status', 'programado')
        }
        rem2hObj.set('scheduled_for', new Date(target2hTs).toISOString())
        app.save(rem2hObj)
      }
    }

    // Determinar o novo estado do agendamento:
    let newState = ''
    if (is2hFuture) {
      if (target24hTs > nowTs && enable24h) {
        newState = 'lembretes programados'
      } else {
        newState = 'parcial: apenas 2h'
      }
    } else {
      // 2h já passou e não foi enviado -> 'não enviado por atraso'
      newState = 'não enviado por atraso'
    }

    if (oldState !== newState) {
      appt.set('reminder_state', newState)
      app.save(appt)
      totalChanged++
      transitions.push({
        id: apptId,
        from: oldState,
        to: newState,
        reason: is2hFuture
          ? 'horário previsto futuro programado (' + new Date(target2hTs).toISOString() + ')'
          : 'horário previsto de 2h já passou (' + new Date(target2hTs).toISOString() + ')',
      })
    }
  }

  console.log('====================================================================')
  console.log('[MIGRATION 0042] RELATÓRIO DO RECÁLCULO ONE-SHOT DE LEMBRETES')
  console.log('Total de agendamentos processados: ' + totalProcessed)
  console.log('Total de agendamentos com estado corrigido: ' + totalChanged)
  console.log('Transições realizadas:')
  for (let t = 0; t < transitions.length; t++) {
    console.log(
      ' - ID ' +
        transitions[t].id +
        ': "' +
        transitions[t].from +
        '" -> "' +
        transitions[t].to +
        '" (' +
        transitions[t].reason +
        ')',
    )
  }
  console.log('====================================================================')
})
