export const ALLOWED_TEMPLATE_FIELDS = [
  '{{nome}}',
  '{{procedimento}}',
  '{{data_extenso}}',
  '{{hora}}',
  '{{endereco}}',
  '{{telefone}}',
  '{{nome_clinica}}',
] as const

export const DEFAULT_REMINDER_SUBJECT_24H = 'Lembrete: seu procedimento é amanhã às {{hora}}'
export const DEFAULT_REMINDER_SUBJECT_2H = 'Lembrete: seu procedimento é hoje às {{hora}}'

export const DEFAULT_REMINDER_BODY = [
  'Lembrete de Agendamento',
  '',
  'Olá, {{nome}}!',
  '',
  'Este é um lembrete do seu procedimento em {{data_extenso}} às {{hora}}, na {{nome_clinica}}.',
  '',
  'Procedimento: {{procedimento}}',
  'Data: {{data_extenso}}',
  'Horário: {{hora}}',
  'Local: {{endereco}}',
  '',
  'Em caso de dúvida, fale com a clínica: {{telefone}}',
  '',
  '{{nome_clinica}}',
].join('\n')

export interface TemplateValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validação ao salvar conforme as regras da Etapa 5:
 * - assunto ou corpo estiverem vazios;
 * - o corpo não contiver {{nome}} ou {{hora}};
 * - houver campo escrito errado (ex.: {{data}} em vez de {{data_extenso}}) —
 *   mensagem exata: "Campo não reconhecido: {{campo}}. Use um dos campos da lista."
 * - o texto contiver termos proibidos: CPF, valor, R$, ou pedido de resposta ao e-mail.
 */
export function validateReminderTemplate(subject: string, body: string): TemplateValidationResult {
  const cleanSubject = (subject || '').trim()
  const cleanBody = (body || '').trim()

  if (!cleanSubject) {
    return { valid: false, error: 'O assunto do e-mail não pode ficar vazio.' }
  }

  if (!cleanBody) {
    return { valid: false, error: 'O corpo do e-mail não pode ficar vazio.' }
  }

  // Verifica se o corpo contém {{nome}} e {{hora}}
  if (!cleanBody.includes('{{nome}}')) {
    return {
      valid: false,
      error: 'O corpo do e-mail deve conter o campo {{nome}}.',
    }
  }

  if (!cleanBody.includes('{{hora}}')) {
    return {
      valid: false,
      error: 'O corpo do e-mail deve conter o campo {{hora}}.',
    }
  }

  // Detecta qualquer tag no formato {{...}} no assunto e no corpo
  const tagRegex = /\{\{[^}]+\}\}/g
  const combinedText = `${cleanSubject}\n${cleanBody}`
  const matches = combinedText.match(tagRegex) || []

  for (const match of matches) {
    if (!ALLOWED_TEMPLATE_FIELDS.includes(match as (typeof ALLOWED_TEMPLATE_FIELDS)[number])) {
      return {
        valid: false,
        error: `Campo não reconhecido: ${match}. Use um dos campos da lista.`,
      }
    }
  }

  // Termos proibidos: CPF, valor, R$, ou pedido de resposta ao e-mail
  // (case-insensitive para CPF, valor, R$, e termos como responder, responda a este e-mail, etc.)
  const cpfRegex = /\bCPF\b/i
  if (cpfRegex.test(combinedText)) {
    return {
      valid: false,
      error: 'Termo proibido encontrado: CPF não pode constar no lembrete.',
    }
  }

  const rsRegex = /R\$/i
  if (rsRegex.test(combinedText)) {
    return {
      valid: false,
      error: 'Termo proibido encontrado: R$ (valores financeiros) não pode constar no lembrete.',
    }
  }

  const valorRegex = /\bvalor\b|\bvalores\b/i
  if (valorRegex.test(combinedText)) {
    return {
      valid: false,
      error: 'Termo proibido encontrado: menções a valor não podem constar no lembrete.',
    }
  }

  const replyRegex =
    /(responda\s+(a\s+)?este|responder\s+(a\s+)?este|resposta\s+(a\s+)?este|não\s+responda|nao\s+responda)/i
  if (replyRegex.test(combinedText)) {
    return {
      valid: false,
      error:
        'Termo proibido encontrado: pedidos de resposta ou menções a responder ao e-mail são proibidos.',
    }
  }

  return { valid: true }
}

export interface SampleTemplateData {
  nome: string
  procedimento: string
  data_extenso: string
  hora: string
  endereco: string
  telefone: string
  nome_clinica: string
}

export function getDefaultSampleData(
  clinicName?: string,
  clinicAddress?: string,
  clinicPhone?: string,
): SampleTemplateData {
  return {
    nome: 'Maria Clara Oliveira',
    procedimento: 'Lábios / Micropigmentação',
    data_extenso: 'terça-feira, 04 de novembro de 2026',
    hora: '14:30',
    endereco: clinicAddress || 'Jardins, Aracaju - SE',
    telefone: clinicPhone || '(79) 99809-1314',
    nome_clinica: clinicName || 'Andresa Souza Clinic',
  }
}

export function renderReminderPreview(template: string, data: SampleTemplateData): string {
  if (!template) return ''
  return template
    .replace(/\{\{nome\}\}/g, data.nome)
    .replace(/\{\{procedimento\}\}/g, data.procedimento)
    .replace(/\{\{data_extenso\}\}/g, data.data_extenso)
    .replace(/\{\{hora\}\}/g, data.hora)
    .replace(/\{\{endereco\}\}/g, data.endereco)
    .replace(/\{\{telefone\}\}/g, data.telefone)
    .replace(/\{\{nome_clinica\}\}/g, data.nome_clinica)
}
