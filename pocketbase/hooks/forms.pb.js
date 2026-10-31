// pocketbase/hooks/forms.pb.js

// Hook triggered after a form submission record is successfully updated in the DB
onRecordAfterUpdateSuccess((e) => {
  e.next()

  const record = e.record
  const status = record.getString('status')
  const patientEmail = record.getString('patient_email')
  const signedAt = record.getString('signed_at')
  const currentDeliveryStatus = record.getString('email_delivery_status')

  // Only act when the form has been signed/submitted and email hasn't been sent yet
  if (status === 'preenchida' && patientEmail && signedAt && currentDeliveryStatus !== 'enviado') {
    let emailSuccess = false
    let deliveryError = ''

    try {
      // Find clinic settings for notification email
      let clinicEmail = 'gihobaicn@hotmail.com'
      try {
        const settings = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
        if (settings.length > 0 && settings[0].getString('notification_email')) {
          clinicEmail = settings[0].getString('notification_email')
        }
      } catch (errSettings) {
        console.log('Error fetching clinic settings in hook:', errSettings)
      }

      const patientName = record.getString('patient_name') || 'Paciente'
      const patientCpf = record.getString('patient_cpf') || '-'
      const formType = record.getString('form_type')
      const docHash = record.getString('document_hash')
      const termTitle = record.getString('accepted_term_title')

      const typeLabelMap = {
        geral: 'Anamnese Geral',
        labios: 'Lábios & Micropigmentação Labial',
        botox: 'Toxina Botulínica (Botox)',
      }
      const formTypeLabel = typeLabelMap[formType] || formType || 'Anamnese'

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="background-color: #831843; color: white; padding: 16px 20px; border-radius: 6px 6px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 600;">Andresa Souza Clinic</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Comprovante de Preenchimento de Ficha & Termo</p>
          </div>
          
          <div style="padding: 20px;">
            <p>Olá, <strong>${patientName}</strong>!</p>
            <p>Confirmamos o preenchimento e assinatura digital da sua ficha de anamnese com sucesso.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold; width: 40%;">Tipo de Procedimento:</td>
                <td style="padding: 10px;">${formTypeLabel}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold;">Paciente:</td>
                <td style="padding: 10px;">${patientName}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold;">CPF:</td>
                <td style="padding: 10px;">${patientCpf}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold;">Data e Hora do Aceite:</td>
                <td style="padding: 10px;">${signedAt}</td>
              </tr>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold;">Hash de Integridade:</td>
                <td style="padding: 10px; word-break: break-all; font-family: monospace; font-size: 12px;">${docHash || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold;">Termo Aceito:</td>
                <td style="padding: 10px;">${termTitle || 'Termo de Consentimento Livre e Esclarecido'}</td>
              </tr>
            </table>

            <div style="background-color: #fdf2f8; border-left: 4px solid #db2777; padding: 12px; margin: 20px 0; font-size: 13px; color: #831843;">
              <strong>Registro de Auditoria Digital:</strong><br/>
              IP de Origem: ${record.getString('ip_address') || 'Registrado'}<br/>
              Dispositivo: ${record.getString('user_agent') || 'Navegador Web'}
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              Este documento eletrônico possui validade jurídica conforme a legislação brasileira e fica arquivado com segurança na base da Andresa Souza Clinic.
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 6px 6px;">
            Andresa Souza Clinic &bull; Estética Avançada &bull; Segurança e Cuidado com Você
          </div>
        </div>
      `

      // 1. Send to Patient (isolated try-catch so clinic delivery can still proceed)
      try {
        const msgPatient = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress || 'clinica@andresasouza.com',
            name: $app.settings().meta.senderName || 'Andresa Souza Clinic',
          },
          to: [{ address: patientEmail, name: patientName }],
          subject: `Comprovante: Ficha de Anamnese Assinada - ${formTypeLabel}`,
          html: htmlBody,
        })
        $app.newMailClient().send(msgPatient)
        emailSuccess = true
      } catch (errPatient) {
        console.log('Error sending receipt email to patient:', errPatient)
        deliveryError = String(errPatient)
      }

      // 2. Send copy to Clinic notification email (isolated try-catch)
      if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
        try {
          const msgClinic = new MailerMessage({
            from: {
              address: $app.settings().meta.senderAddress || 'clinica@andresasouza.com',
              name: ($app.settings().meta.senderName || 'Andresa Souza Clinic') + ' - Sistema',
            },
            to: [{ address: clinicEmail, name: 'Andresa Souza Clinic' }],
            subject: `[Nova Ficha Concluída] ${patientName} - ${formTypeLabel}`,
            html: `
              <p>Uma nova ficha foi preenchida e assinada digitalmente por <strong>${patientName}</strong> (${formTypeLabel}).</p>
              ${htmlBody}
            `,
          })
          $app.newMailClient().send(msgClinic)
        } catch (errClinic) {
          console.log('Error sending copy to clinic:', errClinic)
        }
      }
    } catch (errGlobal) {
      console.log('General error during email notification processing:', errGlobal)
      deliveryError = String(errGlobal)
    }

    // Persist email delivery status without triggering hooks again
    try {
      const nowIso = new Date().toISOString()
      const statusToSet = emailSuccess ? 'enviado' : 'falha'
      $app
        .db()
        .newQuery(
          `UPDATE form_submissions 
         SET email_delivery_status = {:status}, 
             email_sent_at = {:sentAt}, 
             email_delivery_error = {:error} 
         WHERE id = {:id}`,
        )
        .bind({
          status: statusToSet,
          sentAt: emailSuccess ? nowIso : '',
          error: deliveryError ? deliveryError.slice(0, 500) : '',
          id: record.id,
        })
        .execute()
    } catch (errDb) {
      console.log('Error updating email delivery status on record:', errDb)
    }
  }
}, 'form_submissions')

// Custom endpoint to resend notification email manually
routerAdd('POST', '/backend/v1/forms/resend-email', (e) => {
  const info = e.requestInfo()
  const id = info.body.id
  if (!id) {
    return e.json(400, { error: 'ID da ficha é obrigatório' })
  }

  try {
    const record = $app.findRecordById('form_submissions', id)
    const patientEmail = record.getString('patient_email')
    if (!patientEmail) {
      return e.json(400, { error: 'Ficha não possui e-mail de paciente preenchido' })
    }

    let clinicEmail = 'gihobaicn@hotmail.com'
    try {
      const settings = $app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
      if (settings.length > 0 && settings[0].getString('notification_email')) {
        clinicEmail = settings[0].getString('notification_email')
      }
    } catch (_) {}

    const patientName = record.getString('patient_name') || 'Paciente'
    const patientCpf = record.getString('patient_cpf') || '-'
    const formType = record.getString('form_type')
    const signedAt = record.getString('signed_at') || 'Registrado no envio'
    const docHash = record.getString('document_hash')
    const termTitle = record.getString('accepted_term_title')

    const typeLabelMap = {
      geral: 'Anamnese Geral',
      labios: 'Lábios & Micropigmentação Labial',
      botox: 'Toxina Botulínica (Botox)',
    }
    const formTypeLabel = typeLabelMap[formType] || formType || 'Anamnese'

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #831843; color: white; padding: 16px 20px; text-align: center; border-radius: 6px 6px 0 0;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Andresa Souza Clinic</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">(Reenvio) Comprovante de Ficha de Anamnese & Termo</p>
        </div>
        <div style="padding: 20px;">
          <p>Olá, <strong>${patientName}</strong>!</p>
          <p>Reenviamos abaixo a confirmação de recebimento da sua ficha.</p>
          <p><strong>Procedimento:</strong> ${formTypeLabel}<br/>
             <strong>CPF:</strong> ${patientCpf}<br/>
             <strong>Assinado em:</strong> ${signedAt}<br/>
             <strong>Termo:</strong> ${termTitle || 'Termo de Consentimento'}<br/>
             <strong>Hash do Documento:</strong> ${docHash || 'N/A'}</p>
        </div>
      </div>
    `

    let emailSent = false
    let sendErr = ''

    try {
      const msg = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress || 'clinica@andresasouza.com',
          name: $app.settings().meta.senderName || 'Andresa Souza Clinic',
        },
        to: [{ address: patientEmail, name: patientName }],
        subject: `[Reenvio] Comprovante de Anamnese - Andresa Souza Clinic`,
        html: htmlBody,
      })
      $app.newMailClient().send(msg)
      emailSent = true
    } catch (errPatient) {
      console.log('Error resending to patient:', errPatient)
      sendErr = String(errPatient)
    }

    // Also resend to clinic if exists
    if (clinicEmail && clinicEmail.toLowerCase() !== patientEmail.toLowerCase()) {
      try {
        const msgClinic = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress || 'clinica@andresasouza.com',
            name: ($app.settings().meta.senderName || 'Andresa Souza Clinic') + ' - Sistema',
          },
          to: [{ address: clinicEmail, name: 'Andresa Souza Clinic' }],
          subject: `[Reenvio Clínico] Ficha de ${patientName}`,
          html: htmlBody,
        })
        $app.newMailClient().send(msgClinic)
      } catch (errClinic) {
        console.log('Error resending to clinic:', errClinic)
      }
    }

    const nowIso = new Date().toISOString()
    $app
      .db()
      .newQuery(
        `UPDATE form_submissions 
       SET email_delivery_status = {:status}, 
           email_sent_at = {:sentAt}, 
           email_delivery_error = {:error} 
       WHERE id = {:id}`,
      )
      .bind({
        status: emailSent ? 'enviado' : 'falha',
        sentAt: emailSent ? nowIso : '',
        error: sendErr ? sendErr.slice(0, 500) : '',
        id: record.id,
      })
      .execute()

    if (emailSent) {
      return e.json(200, { success: true, message: 'E-mail reenviado com sucesso!' })
    } else {
      return e.json(500, {
        error: 'Falha ao reenviar e-mail: ' + (sendErr || 'Erro no serviço de envio.'),
      })
    }
  } catch (err) {
    return e.json(500, { error: 'Erro ao processar reenvio de e-mail: ' + String(err) })
  }
})
