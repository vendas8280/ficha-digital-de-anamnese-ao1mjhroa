import { describe, it, expect } from 'vitest'
import {
  extractDateKey,
  extractTimeKey,
  formatDayHeaderBR,
  getAgendaReminderText,
  getCurrentWeekRange,
  getProcedureLabel,
} from './agendaHelpers'
import type { ProcedureAppointmentRecord } from '@/services/forms'

describe('agendaHelpers', () => {
  it('extractDateKey extrai corretamente YYYY-MM-DD mesmo com timestamps ISO', () => {
    expect(extractDateKey('2026-11-04 00:00:00.000Z')).toBe('2026-11-04')
    expect(extractDateKey('2026-11-05T14:30:00Z')).toBe('2026-11-05')
    expect(extractDateKey('2026-11-12')).toBe('2026-11-12')
    expect(extractDateKey('')).toBe('')
    expect(extractDateKey(undefined)).toBe('')
  })

  it('extractTimeKey padroniza o horário em HH:MM', () => {
    expect(extractTimeKey('9:30')).toBe('09:30')
    expect(extractTimeKey('14:05')).toBe('14:05')
    expect(extractTimeKey('')).toBe('09:00')
    expect(extractTimeKey(undefined)).toBe('09:00')
  })

  it('formatDayHeaderBR formata cabeçalho exatamente na especificação "TERÇA, 04/11/2026"', () => {
    // 04/11/2026 é uma quarta-feira no calendário padrão (ou verificamos dia da semana real)
    const header = formatDayHeaderBR('2026-11-04')
    expect(header).toMatch(/\d{2}\/11\/2026/)
    expect(header).toContain('04/11/2026')
    // 2026-11-03 é terça-feira
    const tuesdayHeader = formatDayHeaderBR('2026-11-03')
    expect(tuesdayHeader).toBe('TERÇA, 03/11/2026')
  })

  it('getProcedureLabel mapeia os nomes de procedimentos institucionais', () => {
    expect(getProcedureLabel('geral')).toBe('Anamnese Geral')
    expect(getProcedureLabel('labios')).toBe('Micropigmentação Labial')
    expect(getProcedureLabel('botox')).toBe('Toxina Botulínica (Botox)')
  })

  it('getAgendaReminderText mapeia para as 4 frases exatas da especificação', () => {
    const baseAppt: ProcedureAppointmentRecord = {
      id: 'a1',
      form_submission: '',
      procedure: 'geral',
      procedure_date: '2026-11-04',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: false,
      created: '',
      updated: '',
    }

    // 1. Falha no envio
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'falha no envio' })).toBe(
      'Falha no envio',
    )

    // 2. Lembrete enviado
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'enviado' })).toBe(
      'Lembrete enviado',
    )

    // 3. Lembrete programado
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'programado' })).toBe(
      'Lembrete programado',
    )
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'parcial' })).toBe(
      'Lembrete programado',
    )

    // 4. Não enviado (para cancelado, nenhum, fora do prazo, etc.)
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'não enviado por atraso' })).toBe(
      'Não enviado',
    )
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'nenhum' })).toBe('Não enviado')
    expect(getAgendaReminderText({ ...baseAppt, reminder_state: 'cancelado' })).toBe('Não enviado')
  })

  it('getCurrentWeekRange retorna início (segunda) e fim (domingo)', () => {
    // Quarta-feira 04/11/2026 -> Segunda 02/11/2026, Domingo 08/11/2026
    const refDate = new Date(2026, 10, 4, 12, 0, 0)
    const week = getCurrentWeekRange(refDate)
    expect(week.start).toBe('2026-11-02')
    expect(week.end).toBe('2026-11-08')
  })
})
