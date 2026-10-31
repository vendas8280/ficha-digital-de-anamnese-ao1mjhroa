// pocketbase/hooks/test_pdf.pb.js

onRecordAfterCreateSuccess((e) => {
  e.next()
  if (e.record.getString('code') === 'PROBE_MSG4') {
    try {
      const res = $connectors.executeAsOwner('RESEND_SEND_EMAIL', {
        from: 'onboarding@resend.dev',
        to: ['delivered@resend.dev'],
        subject: 'Teste de envio com anexo PDF 2 - Andresa Souza Clinic',
        html: '<p>Teste de envio com PDF anexado</p>',
        attachments: [
          {
            filename: 'Ficha-Teste.pdf',
            content:
              'JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNTk1IDg0Ml0vQ29udGVudHMgNCAwIFI+PmVuZG9iago0IDAgb2JqPDwvTGVuZ3RoIDY+PnN0cmVhbQpCVCBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY4IDAwMDAwIG4gCjAwMDAwMDAxMjAgMDAwMDAgbiAKMDAwMDAwMDE5OSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgNS9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjI1NAolJUVPRgo=',
            content_type: 'application/pdf',
          },
        ],
      })
      e.record.set('code', 'RES4:' + JSON.stringify(res).slice(0, 200))
      $app.save(e.record)
    } catch (err) {
      e.record.set('code', 'ERR4:' + String(err).slice(0, 200))
      $app.save(e.record)
    }
  }
}, 'email_verifications')
