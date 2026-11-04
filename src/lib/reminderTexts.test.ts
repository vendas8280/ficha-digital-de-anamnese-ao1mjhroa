import { describe, it, expect } from 'vitest'
import {
  FIXED_REMINDER_SUBJECT_24H,
  FIXED_REMINDER_SUBJECT_2H,
  FIXED_REMINDER_BODY,
  buildReminderSubject,
  buildReminderBody,
  ReminderInterpolationData,
} from './reminderTexts'

describe('reminderTexts', () => {
  it('contém os assuntos fixos oficiais de 24h e 2h', () => {
    expect(FIXED_REMINDER_SUBJECT_24H).toBe('Lembrete: seu procedimento é amanhã às {{hora}}')
    expect(FIXED_REMINDER_SUBJECT_2H).toBe('Lembrete: seu procedimento é hoje às {{hora}}')
  })

  it('monta assunto substituindo a hora corretamente', () => {
    expect(buildReminderSubject('24h', '14:30')).toBe(
      'Lembrete: seu procedimento é amanhã às 14:30',
    )
    expect(buildReminderSubject('2h', '09:00')).toBe('Lembrete: seu procedimento é hoje às 09:00')
  })

  it('contém o corpo fixo oficial conforme a especificação', () => {
    expect(FIXED_REMINDER_BODY).toContain('Olá, {{nome}}!')
    expect(FIXED_REMINDER_BODY).toContain(
      'Este é um lembrete do seu procedimento em {{data_extenso}} às {{hora}}, na {{nome_clinica}}.',
    )
    expect(FIXED_REMINDER_BODY).toContain('Procedimento: {{procedimento}}')
    expect(FIXED_REMINDER_BODY).toContain('Data: {{data_extenso}}')
    expect(FIXED_REMINDER_BODY).toContain('Horário: {{hora}}')
    expect(FIXED_REMINDER_BODY).toContain('Local: {{endereco}}')
    expect(FIXED_REMINDER_BODY).toContain('Em caso de dúvida, fale com a clínica: {{telefone}}')
  })

  it('não contém termos proibidos (CPF, R$, valor, pedidos de resposta)', () => {
    expect(FIXED_REMINDER_BODY.toLowerCase()).not.toContain('cpf')
    expect(FIXED_REMINDER_BODY).not.toContain('R$')
    expect(FIXED_REMINDER_BODY.toLowerCase()).not.toContain('valor')
    expect(FIXED_REMINDER_BODY.toLowerCase()).not.toContain('responda')
  })

  it('interpola todos os campos do agendamento e da clínica', () => {
    const data: ReminderInterpolationData = {
      nome: 'Maria Clara Oliveira',
      procedimento: 'Lábios / Micropigmentação',
      data_extenso: 'terça-feira, 04 de novembro de 2026',
      hora: '14:30',
      endereco: 'Jardins, Aracaju - SE',
      telefone: '(79) 99809-1314',
      nome_clinica: 'Andresa Souza Clinic',
    }

    const body = buildReminderBody(data)
    expect(body).toContain('Olá, Maria Clara Oliveira!')
    expect(body).toContain('Lábios / Micropigmentação')
    expect(body).toContain('terça-feira, 04 de novembro de 2026')
    expect(body).toContain('Horário: 14:30')
    expect(body).toContain('Local: Jardins, Aracaju - SE')
    expect(body).toContain('(79) 99809-1314')
    expect(body).toContain('Andresa Souza Clinic')
    expect(body).not.toContain('{{')
    expect(body).not.toContain('}}')
  })
})
