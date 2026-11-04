import { ProcedureAppointmentRecord, FormSubmissionRecord } from '@/services/forms'

export interface AgendaItem {
  appointment: ProcedureAppointmentRecord
  form?: FormSubmissionRecord
  dateKey: string // YYYY-MM-DD
  timeKey: string // HH:MM
}

/**
 * Obtém a data corrente de hoje no fuso local da clínica (formato YYYY-MM-DD)
 */
export function getTodayDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Obtém a data de amanhã no fuso local (YYYY-MM-DD)
 */
export function getTomorrowDateString(d: Date = new Date()): string {
  const tomorrow = new Date(d)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return getTodayDateString(tomorrow)
}

/**
 * Obtém o intervalo [segunda, domingo] da semana corrente para uma dada data de referência
 */
export function getCurrentWeekRange(d: Date = new Date()): { start: string; end: string } {
  // Dia da semana: 0 (domingo) .. 6 (sábado)
  const current = new Date(d)
  const dayOfWeek = current.getDay() // 0 = dom, 1 = seg ...
  // Segunda-feira da semana (se domingo, volta 6 dias; se seg, volta 0 dias; etc.)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(current)
  monday.setDate(current.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    start: getTodayDateString(monday),
    end: getTodayDateString(sunday),
  }
}

/**
 * Extrai YYYY-MM-DD puro de um campo procedure_date
 */
export function extractDateKey(dateStr?: string): string {
  if (!dateStr) return ''
  const m = String(dateStr)
    .substring(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

/**
 * Extrai HH:MM padronizado de procedure_time
 */
export function extractTimeKey(timeStr?: string): string {
  if (!timeStr) return '09:00'
  const m = String(timeStr)
    .trim()
    .match(/^(\d{1,2}):(\d{2})/)
  if (!m) return '09:00'
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

/**
 * Formata o cabeçalho de dia no formato exato da especificação:
 * "TERÇA, 04/11/2026"
 */
export function formatDayHeaderBR(dateKey: string): string {
  if (!dateKey) return ''
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey
  const [yyyy, mm, dd] = parts

  // Instancia com meio-dia para evitar desvios de fuso
  const d = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10), 12, 0, 0)
  const dayNames = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO']
  const dayName = dayNames[d.getDay()] || ''

  return `${dayName}, ${dd}/${mm}/${yyyy}`
}

/**
 * Mapeia código de procedimento para nome legível
 */
export function getProcedureLabel(raw?: string): string {
  if (!raw) return 'Anamnese Geral'
  const map: Record<string, string> = {
    geral: 'Anamnese Geral',
    labios: 'Micropigmentação Labial',
    botox: 'Toxina Botulínica (Botox)',
  }
  return map[raw] || raw
}

/**
 * Normaliza e simplifica o estado do lembrete para a especificação da Agenda:
 * "Lembrete enviado", "Lembrete programado", "Falha no envio" ou "Não enviado"
 */
export function getAgendaReminderText(appointment: ProcedureAppointmentRecord): string {
  const raw = (appointment.reminder_state || '').trim().toLowerCase()
  if (!raw || raw === 'nenhum' || raw === 'aguardando ficha') {
    return 'Não enviado'
  }
  if (raw.includes('falha')) {
    return 'Falha no envio'
  }
  if (raw.includes('enviado') && !raw.includes('não enviado')) {
    return 'Lembrete enviado'
  }
  if (raw.includes('programado') || raw.includes('parcial')) {
    return 'Lembrete programado'
  }
  if (raw.includes('atraso') || raw.includes('não enviado') || raw.includes('fora do prazo')) {
    return 'Não enviado'
  }
  if (raw.includes('cancelado')) {
    return 'Não enviado'
  }
  return 'Não enviado'
}

/**
 * Retorna classe de cor para o texto do estado do lembrete
 */
export function getAgendaReminderColorClass(text: string): string {
  if (text === 'Falha no envio') return 'text-[#C0392B] font-medium'
  if (text === 'Lembrete enviado') return 'text-[#2E9E5B] font-medium'
  return 'text-slate-500'
}
