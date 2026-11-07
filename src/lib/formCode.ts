// Helper de código de identificação de ficha e nomes padronizados de arquivo
// Formato do código: "AN-2026-0001" (sequencial por ano)
import { FormSubmissionRecord } from '@/services/forms'

/**
 * Retorna o código da ficha formatado ("AN-YYYY-XXXX").
 * Se a ficha já possuir form_code gravado, retorna-o.
 * Caso contrário, gera um código determinístico baseado no ano de criação e ID/timestamp.
 */
export function getFormCode(form: Partial<FormSubmissionRecord>): string {
  if (form.form_code && form.form_code.trim()) {
    return form.form_code.trim()
  }

  const dateStr = form.created || form.signed_at || new Date().toISOString()
  const year = dateStr.substring(0, 4) || '2026'

  // Se não tem form_code ainda, usa os últimos dígitos do id ou fallback
  const idPart = (form.id || '0001')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-4)
    .toUpperCase()
  return `AN-${year}-${idPart.padStart(4, '0')}`
}

/**
 * Sanitiza partes de nome de arquivo para evitar caracteres inválidos no sistema de arquivos.
 */
export function sanitizeFileName(name?: string): string {
  if (!name) return 'Paciente'
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50) || 'Paciente'
  )
}

/**
 * Nome padrão do PDF da ficha assinada:
 * Ficha_Anamnese_[Nome]_[Codigo].pdf
 */
export function getFichaPdfFilename(form: Partial<FormSubmissionRecord>): string {
  const patientSafe = sanitizeFileName(form.patient_name)
  const code = getFormCode(form)
  return `Ficha_Anamnese_${patientSafe}_${code}.pdf`
}

/**
 * Nome padrão do Comprovante de Assinatura:
 * "Comprovante de Assinatura — [Nome] — [código da ficha].pdf"
 */
export function getProofPdfFilename(form: Partial<FormSubmissionRecord>): string {
  const patientName = form.patient_name ? form.patient_name.trim() : 'Paciente'
  const code = getFormCode(form)
  return `Comprovante de Assinatura — ${patientName} — ${code}.pdf`
}
