import { describe, it, expect } from 'vitest'
import {
  validateReminderTemplate,
  renderReminderPreview,
  getDefaultSampleData,
  DEFAULT_REMINDER_SUBJECT_24H,
  DEFAULT_REMINDER_SUBJECT_2H,
  DEFAULT_REMINDER_BODY,
} from './reminderTemplates'

describe('validateReminderTemplate', () => {
  it('aprova templates padrão de 24h e 2h', () => {
    const res24h = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, DEFAULT_REMINDER_BODY)
    expect(res24h.valid).toBe(true)

    const res2h = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_2H, DEFAULT_REMINDER_BODY)
    expect(res2h.valid).toBe(true)
  })

  it('bloqueia se assunto estiver vazio', () => {
    const res = validateReminderTemplate('   ', DEFAULT_REMINDER_BODY)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('assunto do e-mail não pode ficar vazio')
  })

  it('bloqueia se corpo estiver vazio', () => {
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, '')
    expect(res.valid).toBe(false)
    expect(res.error).toContain('corpo do e-mail não pode ficar vazio')
  })

  it('bloqueia se o corpo não contiver {{nome}}', () => {
    const semNome = DEFAULT_REMINDER_BODY.replace(/\{\{nome\}\}!/g, 'Paciente!')
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, semNome)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('deve conter o campo {{nome}}')
  })

  it('bloqueia se o corpo não contiver {{hora}}', () => {
    const semHora = DEFAULT_REMINDER_BODY.replace(/\{\{hora\}\}/g, 'horário marcado')
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, semHora)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('deve conter o campo {{hora}}')
  })

  it('bloqueia campo escrito errado ex.: {{data}} com a mensagem exata', () => {
    const corpoComData = DEFAULT_REMINDER_BODY.replace('{{data_extenso}}', '{{data}}')
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, corpoComData)
    expect(res.valid).toBe(false)
    expect(res.error).toBe('Campo não reconhecido: {{data}}. Use um dos campos da lista.')
  })

  it('bloqueia termos proibidos: CPF', () => {
    const comCpf = DEFAULT_REMINDER_BODY + '\nTraga seu CPF no dia.'
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, comCpf)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('CPF')
  })

  it('bloqueia termos proibidos: R$', () => {
    const comRs = DEFAULT_REMINDER_BODY + '\nValor restante: R$ 150,00'
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, comRs)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('R$')
  })

  it('bloqueia termos proibidos: valor', () => {
    const comValor = DEFAULT_REMINDER_BODY + '\nConsulte o valor do procedimento'
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, comValor)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('valor')
  })

  it('bloqueia pedido de resposta ao e-mail', () => {
    const comResposta = DEFAULT_REMINDER_BODY + '\nPor favor responda a este e-mail para confirmar.'
    const res = validateReminderTemplate(DEFAULT_REMINDER_SUBJECT_24H, comResposta)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('responder')
  })

  it('renderiza prévia com dados de exemplo corretamente', () => {
    const data = getDefaultSampleData('Clínica Teste', 'Rua 1, 100', '(79) 9999-9999')
    const subject = renderReminderPreview(DEFAULT_REMINDER_SUBJECT_2H, data)
    expect(subject).toBe('Lembrete: seu procedimento é hoje às 14:30')

    const body = renderReminderPreview(DEFAULT_REMINDER_BODY, data)
    expect(body).toContain('Olá, Maria Clara Oliveira!')
    expect(body).toContain('Clínica Teste')
    expect(body).toContain('terça-feira, 04 de novembro de 2026')
  })
})
