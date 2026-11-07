import type { FormSubmissionRecord, ProcedureAppointmentRecord } from '@/services/forms'

export type PatientCardCategory = 'com_pendencia' | 'fichas_prontas' | 'aguardando_paciente'

export type PeriodFilter = '7d' | '30d' | 'ano' | 'todos'

export const REMINDER_PENDING_STATES = new Set([
  'falha no envio',
  'falha',
  'não enviado por atraso',
  'fora do prazo',
  'sem ficha, lembrete não enviado',
  'sem ficha, não enviado',
])

export function isAppointmentWithin24Hours(
  appointment?: ProcedureAppointmentRecord,
  now: Date = new Date(),
): boolean {
  if (!appointment?.procedure_date) return false
  const dateStr = appointment.procedure_date.trim()
  const timeStr = (appointment.procedure_time || '00:00').trim()
  const apptDateTime = new Date(`${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`)
  if (isNaN(apptDateTime.getTime())) return false

  const diffMs = apptDateTime.getTime() - now.getTime()
  return diffMs <= 24 * 60 * 60 * 1000
}

export function classifyFormCategory(
  form: FormSubmissionRecord,
  appointment?: ProcedureAppointmentRecord,
  now: Date = new Date(),
): PatientCardCategory {
  const isSigned = form.status === 'preenchida'
  const rawProofStatus = String(form.email_delivery_status || '').toLowerCase()
  const remState = (appointment?.reminder_state || '').trim().toLowerCase()

  const hasReminderIssue = REMINDER_PENDING_STATES.has(remState)

  const hasProofIssue =
    isSigned &&
    (rawProofStatus === 'falha' ||
      rawProofStatus === 'nao_enviado' ||
      rawProofStatus === '' ||
      rawProofStatus === 'pendente')

  const isUrgentUnsigned = !isSigned && isAppointmentWithin24Hours(appointment, now)

  if (hasReminderIssue || hasProofIssue || isUrgentUnsigned) {
    return 'com_pendencia'
  }

  if (isSigned && rawProofStatus === 'enviado') {
    return 'fichas_prontas'
  }

  return 'aguardando_paciente'
}

export const TYPE_LABEL_MAP: Record<string, string> = {
  geral: 'Anamnese Geral',
  labios: 'Lábios & Micropigmentação',
  botox: 'Toxina Botulínica (Botox)',
}

/**
 * Normaliza número de telefone para apenas dígitos.
 * Ex: "(79) 99809-1314" -> "79998091314"
 */
export function normalizeDigits(val?: string | null): string {
  if (!val) return ''
  return val.replace(/\D/g, '')
}

/**
 * Mascara o CPF para exibição mobile: "***.***.915-73"
 * Se não tiver dígitos suficientes, retorna o que tem ou "***"
 */
export function maskCpfMobile(cpf?: string | null): string {
  if (!cpf) return ''
  const digits = normalizeDigits(cpf)
  if (digits.length < 5) return '***'
  const lastFive = digits.slice(-5)
  // últimos 5 dígitos: 3 antes do traço, 2 depois: Ex "91573" -> "915-73"
  const p1 = lastFive.slice(0, 3)
  const p2 = lastFive.slice(3)
  return `***.***.${p1}-${p2}`
}

/**
 * Retorna o primeiro nome da paciente.
 */
export function getFirstName(fullName?: string | null): string {
  if (!fullName) return 'paciente'
  const trimmed = fullName.trim()
  if (!trimmed) return 'paciente'
  return trimmed.split(/\s+/)[0] || 'paciente'
}

/**
 * Constrói URL de WhatsApp (wa.me) para envio do link da ficha.
 */
export function buildWhatsAppLinkUrl(phone: string, patientName: string, linkUrl: string): string {
  const digits = normalizeDigits(phone)
  const phoneWithCountry = digits.startsWith('55') ? digits : `55${digits}`
  const firstName = getFirstName(patientName)
  const message = `Olá, ${firstName}! Segue o link da sua ficha: ${linkUrl}`
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
}
