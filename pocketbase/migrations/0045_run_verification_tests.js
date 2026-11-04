// Migration 0045: Verificação dos testes da Etapa 5
// Idempotente para futuras execuções ou clonagens do projeto
migrate((app) => {
  // Verificação idempotente: garante campos de templates populados
  const records = app.findRecordsByFilter('clinic_settings', '', '-created', 1, 0)
  if (!records || records.length === 0) return
  const s = records[0]

  const defaultSubject24h = 'Lembrete: seu procedimento é amanhã às {{hora}}'
  const defaultSubject2h = 'Lembrete: seu procedimento é hoje às {{hora}}'
  const defaultBody = [
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

  let changed = false
  if (!s.getString('reminder_subject_24h')) {
    s.set('reminder_subject_24h', defaultSubject24h)
    changed = true
  }
  if (!s.getString('reminder_body_24h')) {
    s.set('reminder_body_24h', defaultBody)
    changed = true
  }
  if (!s.getString('reminder_subject_2h')) {
    s.set('reminder_subject_2h', defaultSubject2h)
    changed = true
  }
  if (!s.getString('reminder_body_2h')) {
    s.set('reminder_body_2h', defaultBody)
    changed = true
  }

  // Garante que o modo de teste permaneça LIGADO
  if (!s.getBool('reminder_test_mode')) {
    s.set('reminder_test_mode', true)
    changed = true
  }

  if (changed) {
    app.save(s)
  }
})
