/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Teste de submissão completa:
  // Cria uma ficha temporária com status pendente e atualiza para preenchida para testar o hook onRecordAfterUpdateSuccess
  try {
    const formsCol = app.findCollectionByNameOrId('form_submissions')
    const rec = new Record(formsCol)
    rec.set('token', 'real-e2e-subm-test-' + Date.now())
    rec.set('form_type', 'geral')
    rec.set('status', 'pendente')
    rec.set('patient_name', 'Andresa Souza Teste E2E')
    rec.set('patient_cpf', '123.456.789-00')
    rec.set('patient_email', 'gihobaicn@hotmail.com')
    rec.set('patient_phone', '(79) 99809-1314')
    rec.set('patient_birth_date', '1990-01-01')
    rec.set('patient_profession', 'Biomedica Esteta')
    rec.set('patient_address', 'Jardins, Aracaju - SE')
    rec.set(
      'answers',
      JSON.stringify({
        alergias: 'Nenhuma alergia relatada',
        medicamentos_em_uso: 'Nenhum',
        historico_saude: 'Excelente estado de saude geral',
      }),
    )
    rec.set(
      'signature_data',
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    )
    rec.set('accepted_term_title', 'Termo de Consentimento - Anamnese Geral')
    rec.set('signed_at', new Date().toISOString())
    rec.set('ip_address', '187.64.120.45')
    rec.set('user_agent', 'Mozilla/5.0 Teste Integracao E2E/1.0')
    rec.set('document_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    rec.set('email_delivery_status', 'nao_enviado')
    app.save(rec)

    // Atualiza status para 'preenchida' disparando onRecordAfterUpdateSuccess
    rec.set('status', 'preenchida')
    app.save(rec)

    // Limpa a ficha de teste após o disparo
    try {
      app.delete(rec)
    } catch (_) {}
  } catch (err) {
    console.log('Erro no teste de submissao e2e: ' + err.message)
  }
})
