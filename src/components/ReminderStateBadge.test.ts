import { describe, it, expect } from 'vitest'
import {
  formatInSaoPaulo,
  formatProcedureDateTime,
  computeProjectedTime,
  formatReminderLine,
} from './ReminderStateBadge'
import type { AppointmentReminderRecord } from '@/services/forms'

describe('ReminderStateBadge helpers', () => {
  it('converte timestamp UTC para fuso America/Sao_Paulo (UTC-3)', () => {
    // 2026-11-04 02:09:56Z = 03/11/2026 às 23:09 no horário de Brasília
    const res = formatInSaoPaulo('2026-11-04T02:09:56.745Z')
    expect(res).toBe('03/11/2026 às 23:09')
  })

  it('formata data e hora do procedimento sem distorção de fuso', () => {
    // procedure_date 2026-11-04 + procedure_time "02:09"
    const res = formatProcedureDateTime('2026-11-04 00:00:00.000Z', '02:09')
    expect(res).toBe('04/11/2026 às 02:09')
  })

  it('calcula lembrete 2h e 24h a partir do horário local do procedimento', () => {
    // Procedimento: 04/11/2026 às 02:09
    // 2h antes: 04/11/2026 às 00:09
    // 24h antes: 03/11/2026 às 02:09
    const proj2h = computeProjectedTime('2026-11-04 00:00:00.000Z', '02:09', 2)
    expect(proj2h).toBe('04/11/2026 às 00:09')

    const proj24h = computeProjectedTime('2026-11-04 00:00:00.000Z', '02:09', 24)
    expect(proj24h).toBe('03/11/2026 às 02:09')
  })

  it('formata linha de lembrete quando enviado', () => {
    const rem: AppointmentReminderRecord = {
      id: 'rem1',
      appointment: 'appt1',
      kind: '2h',
      scheduled_for: '2026-11-04T02:09:56.745Z',
      sent_at: '2026-11-04T02:09:57.358Z',
      sent_to: 'teste@exemplo.com',
      status: 'enviado',
      attempts: 1,
      last_attempt_at: '2026-11-04T02:09:57.358Z',
      created: '2026-11-04T02:09:56.745Z',
      updated: '2026-11-04T02:09:57.358Z',
    }
    const line = formatReminderLine('2h', rem, 'enviado', '2026-11-04', '02:09')
    expect(line).toBe('Lembrete 2h: enviado em 03/11/2026 às 23:09')
  })

  it('formata data e hora do procedimento para tooltip de agendamento', () => {
    // Validação estática de tipagem e coerência dos helpers
    expect(formatProcedureDateTime('2026-11-04 00:00:00.000Z', '02:09')).toBe('04/11/2026 às 02:09')
  })

  it('formata linha de lembrete quando previsto ou nenhum', () => {
    const line24h = formatReminderLine(
      '24h',
      undefined,
      'parcial: apenas 2h',
      '2026-11-04',
      '02:09',
    )
    expect(line24h).toBe('Lembrete 24h: nenhum')

    const line2h = formatReminderLine(
      '2h',
      undefined,
      'lembretes programados',
      '2026-11-04',
      '02:09',
    )
    expect(line2h).toBe('Lembrete 2h: previsto 04/11/2026 às 00:09')
  })
})
