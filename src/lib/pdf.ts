import type { FormSubmissionRecord } from '@/services/forms'
import { formatDateBR } from '@/lib/formatters'

export function printFormPDF(form: FormSubmissionRecord) {
  const formLabels: Record<string, string> = {
    geral: 'Anamnese Estética Geral',
    labios: 'Lábios & Micropigmentação Labial (Revitalização)',
    botox: 'Toxina Botulínica (Botox)',
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1000')
  if (!printWindow) {
    alert('Por favor, permita pop-ups no navegador para gerar e baixar o PDF.')
    return
  }

  const answersHtml = form.answers
    ? Object.entries(form.answers)
        .map(([key, val]) => {
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
          let displayVal = String(val)
          if (typeof val === 'boolean') displayVal = val ? 'Sim' : 'Não'
          if (Array.isArray(val)) displayVal = val.join(', ')

          return `
        <div style="margin-bottom: 10px; padding: 8px 12px; background-color: #f8fafc; border-radius: 6px; border-left: 3px solid #db2777;">
          <div style="font-weight: bold; font-size: 12px; color: #475569;">${formattedKey}:</div>
          <div style="font-size: 13px; color: #0f172a; margin-top: 2px;">${displayVal || 'Não informado'}</div>
        </div>
      `
        })
        .join('')
    : '<p>Nenhuma resposta registrada.</p>'

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Ficha de Anamnese - ${form.patient_name || 'Paciente'}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          line-height: 1.5;
          margin: 0;
          padding: 24px;
          background: #ffffff;
        }
        .header {
          border-bottom: 2px solid #831843;
          padding-bottom: 16px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .clinic-name {
          font-size: 24px;
          font-weight: 700;
          color: #831843;
          margin: 0;
        }
        .clinic-sub {
          font-size: 12px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
        .badge {
          background-color: #fdf2f8;
          color: #9d174d;
          border: 1px solid #fbcfe8;
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
        }
        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: #831843;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin: 20px 0 12px 0;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .info-item {
          background-color: #f8fafc;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
        }
        .info-label {
          color: #64748b;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
        }
        .term-box {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          font-size: 12px;
          color: #334155;
          white-space: pre-wrap;
          max-height: 250px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .audit-footer {
          margin-top: 30px;
          padding: 16px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background-color: #f1f5f9;
          font-size: 12px;
        }
        .signature-img {
          max-width: 260px;
          max-height: 90px;
          border-bottom: 2px solid #0f172a;
          margin-top: 8px;
        }
        @media print {
          body { padding: 12px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="clinic-name">Andresa Souza Clinic</h1>
          <p class="clinic-sub">Prontuário Digital & Ficha de Anamnese Oficial</p>
        </div>
        <div class="badge">
          ${formLabels[form.form_type] || form.form_type}
        </div>
      </div>

      <div class="section-title">1. Dados Cadastrais do Paciente</div>
      <div class="grid-2">
        <div class="info-item">
          <div class="info-label">Nome Completo</div>
          <strong>${form.patient_name || 'Não informado'}</strong>
        </div>
        <div class="info-item">
          <div class="info-label">CPF</div>
          <strong>${form.patient_cpf || 'Não informado'}</strong>
        </div>
        <div class="info-item">
          <div class="info-label">E-mail</div>
          <div>${form.patient_email || 'Não informado'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">WhatsApp / Telefone</div>
          <div>${form.patient_phone || 'Não informado'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Data de Nascimento</div>
          <div>${form.patient_birth_date || 'Não informado'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">RG</div>
          <div>${form.patient_rg || 'Não informado'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Profissão</div>
          <div>${form.patient_profession || 'Não informado'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Contato de Emergência</div>
          <div>${form.patient_emergency_contact || 'Não informado'}</div>
        </div>
      </div>
      <div class="info-item" style="margin-bottom: 20px;">
        <div class="info-label">Endereço Residencial</div>
        <div>${form.patient_address || 'Não informado'}</div>
      </div>

      <div class="section-title">2. Questionário de Anamnese & Saúde</div>
      ${answersHtml}

      <div class="section-title">3. Termo de Consentimento Aceito Integralmente</div>
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #831843;">
        ${form.accepted_term_title || 'Termo de Consentimento Livre e Esclarecido'}
      </div>
      <div class="term-box">
${form.accepted_term_text || 'Termo aceito pelo paciente no momento da assinatura digital.'}
      </div>

      <div class="audit-footer">
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">CERTIFICADO DE ASSINATURA ELETRÔNICA</div>
            <div><strong>Data e Hora:</strong> ${formatDateBR(form.signed_at || form.created)} (Horário de Brasília)</div>
            <div><strong>IP de Origem Real:</strong> ${form.ip_address || 'Registrado via Cloud'}</div>
            <div style="word-break: break-all; margin-top: 4px;"><strong>Hash SHA-256 de Integridade:</strong> <br/><code style="font-family: monospace; font-size: 11px;">${form.document_hash || 'SHA256-REGISTRADO'}</code></div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Código de verificação de integridade — garante que este documento não foi alterado após a assinatura.</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Dispositivo: ${form.user_agent || 'Navegador Mobile/Web'}</div>
            <div style="font-size: 11px; color: #065f46; margin-top: 6px; font-weight: 600;">Esta é a sua via do documento assinado. Guarde para seus registros.</div>
          </div>
          <div style="text-align: center; min-width: 240px;">
            ${
              form.signature_data
                ? `<img src="${form.signature_data}" alt="Assinatura" class="signature-img" />`
                : '<div style="height: 60px; border-bottom: 1px solid #000;">Assinado Eletronicamente</div>'
            }
            <div style="font-size: 11px; margin-top: 4px; font-weight: 600;">Assinatura Digital do Paciente</div>
            <div style="font-size: 10px; color: #64748b;">${form.patient_name || ''}</div>
          </div>
        </div>
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #64748b; text-align: center;">
          Andresa Souza Clinic &bull; Horário de Brasília (UTC-3)
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;" class="no-print">
        <button onclick="window.print()" style="background-color: #831843; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px;">
          Imprimir / Salvar como PDF
        </button>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
