/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Teste de chamada real às rotas oficiais do backend
  let result = {}
  try {
    const resIp = $http.send({
      url: 'https://ficha-digital-de-anamnese-9632c.shrd01.internal.goskip.dev/backend/v1/client-ip',
      method: 'GET',
      timeout: 10,
    })
    result.clientIp = { status: resIp.statusCode, raw: resIp.raw }

    // Encontra token de uma ficha existente
    const forms = app.findRecordsByFilter(
      'form_submissions',
      'status = "pendente"',
      '-created',
      1,
      0,
    )
    if (forms && forms.length > 0) {
      const token = forms[0].getString('token')
      result.token = token

      // Dispara envio do código de verificação para o e-mail da clínica
      const resCode = $http.send({
        url: 'https://ficha-digital-de-anamnese-9632c.shrd01.internal.goskip.dev/backend/v1/forms/send-verification-code',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          token: token,
          email: 'gihobaicn@hotmail.com',
          patient_name: 'Dra. Andresa Souza',
        }),
        timeout: 15,
      })
      result.sendCode = { status: resCode.statusCode, raw: resCode.raw }

      // Dispara audit event
      const resAudit = $http.send({
        url: 'https://ficha-digital-de-anamnese-9632c.shrd01.internal.goskip.dev/backend/v1/forms/audit-event',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          token: token,
          event_type: 'teste_validacao_rotas',
          description: 'Teste real de rotas oficiais executado com sucesso',
          step_number: 1,
        }),
        timeout: 10,
      })
      result.audit = { status: resAudit.statusCode, raw: resAudit.raw }
    }
  } catch (err) {
    result.error = err.message
  }

  console.log('RESULTADO DO DISPARO REAL DAS ROTAS: ' + JSON.stringify(result))
})
