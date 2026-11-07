// Serviço para download direto do Comprovante de Assinatura
import {
  formsService,
  clinicSettingsService,
  appointmentsService,
  FormSubmissionRecord,
} from '@/services/forms'
import { generateAuditProofPdfBytes } from '@/lib/auditProofPdf'
import { getProofPdfFilename } from '@/lib/formCode'

export async function downloadAuditProofPdf(form: FormSubmissionRecord): Promise<void> {
  // Busca eventos de auditoria e configurações da clínica
  const [audits, settings, appointments] = await Promise.all([
    formsService.listAuditEvents(form.id).catch(() => []),
    clinicSettingsService.getSettings().catch(() => null),
    appointmentsService.listByForm(form.id).catch(() => []),
  ])

  const appt = appointments && appointments.length > 0 ? appointments[0] : null
  const pdfBytes = generateAuditProofPdfBytes(form, audits, settings, appt)

  const filename = getProofPdfFilename(form)
  const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)

  // Registra auditoria de download do comprovante pela clínica
  try {
    await formsService.recordPdfExportAudit(
      form.id,
      'download',
      `Comprovante de Assinatura: ${filename}`,
    )
  } catch (err) {
    console.warn('Aviso ao registrar auditoria de download do comprovante:', err)
  }
}
