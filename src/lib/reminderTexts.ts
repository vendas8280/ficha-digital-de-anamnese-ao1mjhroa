/**
 * Textos fixos oficiais dos lembretes de agendamento — Andresa Souza Clinic.
 *
 * Conforme especificação:
 * - O texto dos lembretes é fixo no código (centralizado neste único arquivo).
 * - Mudanças futuras de redação são feitas diretamente aqui em apenas três linhas.
 * - Assunto 24h: "Lembrete: seu procedimento é amanhã às [hora]"
 * - Assunto 2h: "Lembrete: seu procedimento é hoje às [hora]"
 * - Sem CPF, sem dados clínicos, sem termo, sem hash, sem valor financeiro.
 * - Sem pedido de resposta e sem reply-to em nenhuma hipótese.
 */

export const FIXED_REMINDER_SUBJECT_24H = 'Lembrete: seu procedimento é amanhã às {{hora}}'
export const FIXED_REMINDER_SUBJECT_2H = 'Lembrete: seu procedimento é hoje às {{hora}}'

export const FIXED_REMINDER_BODY = [
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

export interface ReminderInterpolationData {
  nome: string
  procedimento: string
  data_extenso: string
  hora: string
  endereco: string
  telefone: string
  nome_clinica: string
}

/**
 * Monta o assunto do lembrete com a hora preenchida.
 */
export function buildReminderSubject(kind: '24h' | '2h', hora: string): string {
  const template = kind === '24h' ? FIXED_REMINDER_SUBJECT_24H : FIXED_REMINDER_SUBJECT_2H
  return template.replace(/\{\{hora\}\}/g, hora)
}

/**
 * Monta o corpo em texto puro do lembrete substituindo as variáveis oficiais.
 */
export function buildReminderBody(data: ReminderInterpolationData): string {
  return FIXED_REMINDER_BODY.replace(/\{\{nome\}\}/g, data.nome)
    .replace(/\{\{procedimento\}\}/g, data.procedimento)
    .replace(/\{\{data_extenso\}\}/g, data.data_extenso)
    .replace(/\{\{hora\}\}/g, data.hora)
    .replace(/\{\{endereco\}\}/g, data.endereco)
    .replace(/\{\{telefone\}\}/g, data.telefone)
    .replace(/\{\{nome_clinica\}\}/g, data.nome_clinica)
}
