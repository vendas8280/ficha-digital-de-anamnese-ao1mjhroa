// pocketbase/migrations/0029_test_pdf_signature_and_layout.js
migrate(
  (app) => {
    // Teste temporário end-to-end para geração e envio do PDF com assinatura
    // PNG 100x40 traço de assinatura em base64:
    // Um traço de assinatura real
    const pngSigBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAoCAYAAAAeTfL6AAAAKElEQVR42u3BAQEAAACAkP6v7ggKAAAAAAAAAAAAAAAAAAAAAAAAAHgNGpQAAfVsoZAAAAAASUVORK5CYII='

    try {
      const col = app.findCollectionByNameOrId('form_submissions')
      const rec = new Record(col)
      rec.set('patient_name', 'Juliana Alcantara Mendes')
      rec.set('patient_cpf', '123.456.789-00')
      rec.set('patient_email', 'gihobaicn@hotmail.com')
      rec.set('patient_phone', '(79) 99988-7766')
      rec.set('patient_birth_date', '15/04/1992')
      rec.set('patient_rg', '12.345.678-9')
      rec.set('patient_profession', 'Arquiteta')
      rec.set('patient_emergency_contact', 'Carlos Mendes (79) 98877-6655')
      rec.set('patient_address', 'Rua das Flores, 120, Jardins, Aracaju - SE')
      rec.set('form_type', 'labios')
      rec.set('status', 'iniciada')
      rec.set('token', 'test_e2e_pdf_sig_' + Date.now())
      rec.set('signature_data', pngSigBase64)
      rec.set(
        'answers',
        JSON.stringify({
          queixa_principal: 'Assimetria labial e perda de volume nos lábios',
          objetivo_labios: 'Micropigmentação e Revitalização labial natural',
          alergias: 'Nenhuma alergia conhecida',
          cicatrizacao: 'Normal, sem histórico de queloides',
          doencas_cronicas: 'Não possui',
          medicamentos_em_uso: 'Não faz uso contínuo',
          fumante: false,
          gestante_ou_lactante: false,
          procedimentos_anteriores: 'Preenchimento com ácido hialurônico há 1 ano',
        }),
      )
      rec.set('accepted_term_title', 'Termo de Consentimento - Lábios & Micropigmentação Labial')
      rec.set(
        'accepted_term_text',
        '1. Declaro estar ciente dos cuidados pré e pós-procedimento de micropigmentação labial e revitalização.\n\n2. Fui informada sobre as possíveis reações comuns, como leve edema e descamação temporária nos primeiros dias.\n\n3. Comprometo-me a seguir rigorosamente todas as orientações fornecidas pela profissional Andresa Souza.\n\n4. Autorizo a realização do procedimento estético nos lábios com plena ciência e concordância dos termos.',
      )
      rec.set('document_hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
      rec.set('ip_address', '177.105.42.18')
      rec.set(
        'user_agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      )
      rec.set('signed_at', new Date().toISOString())
      app.save(rec)

      // Agora atualiza para 'preenchida' para disparar onRecordAfterUpdateSuccess
      rec.set('status', 'preenchida')
      app.save(rec)
      console.log('Ficha de teste E2E criada e concluida com ID: ' + rec.id)
    } catch (err) {
      console.log('Erro ao criar ficha de teste: ' + err.message)
    }
  },
  (app) => {
    try {
      const recs = app.findRecordsByFilter(
        'form_submissions',
        'token ~ "test_e2e_pdf_sig_"',
        '',
        10,
        0,
      )
      for (const r of recs) {
        app.delete(r)
      }
    } catch (_) {}
  },
)
