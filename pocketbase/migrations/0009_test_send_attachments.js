migrate((app) => {
  // Test probe migration: triggers the email send flow on a temporary test record
  // and records the exact Resend API response in a log or checks attachments.
  const formsCol = app.findCollectionByNameOrId('form_submissions')
  const testRecord = new Record(formsCol)
  const testToken = 'probe-' + String(Date.now()).slice(-8)
  const testPatientName = 'Paciente Teste'
  const testPatientEmail = 'gihobaicn@hotmail.com'

  testRecord.set('token', testToken)
  testRecord.set('form_type', 'geral')
  testRecord.set('patient_name', testPatientName)
  testRecord.set('patient_cpf', '111.222.333-44')
  testRecord.set('patient_email', testPatientEmail)
  testRecord.set('status', 'preenchida')
  testRecord.set('signed_at', new Date().toISOString())
  testRecord.set('ip_address', '187.64.120.45')
  testRecord.set('user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Teste/1.0')
  testRecord.set(
    'document_hash',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
  testRecord.set('accepted_term_title', 'Termo de Consentimento Livre e Esclarecido - Versao 2.1')
  testRecord.set(
    'accepted_term_text',
    'Texto integral do termo de consentimento aceito e esclarecido para fins de teste.',
  )
  testRecord.set(
    'answers',
    JSON.stringify({
      alergias: 'Nenhuma alergia conhecida',
      medicamentos: 'Nenhum medicamento',
      queixa_principal: 'Procedimento estetico geral',
    }),
  )
  testRecord.set(
    'signature_data',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  )

  app.save(testRecord)
  console.log('TEST PROBE RECORD CREATED:', testRecord.id)
})
