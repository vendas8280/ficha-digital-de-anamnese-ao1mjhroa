import { describe, it, expect } from 'vitest'
import { classifyFormCategory } from './DashboardPage'
import type { FormSubmissionRecord, ProcedureAppointmentRecord } from '@/services/forms'

describe('classifyFormCategory', () => {
  it('classifica a paciente real Beatriz Carvalho em Fichas Prontas (termo assinado e comprovante entregue)', () => {
    const beatrizForm: FormSubmissionRecord = {
      id: '6w3l1vvrv2gqd7l',
      form_type: 'geral',
      token: 'oGFJukwUV2OF2VP6BEPR1hUM2Jb9pjG5',
      status: 'preenchida',
      patient_name: 'Beatriz Carvalho Martins de Freitas',
      patient_cpf: '015.814.915-73',
      patient_email: 'prime.impr@gmail.com',
      email_delivery_status: 'enviado',
      pdf_attached_to_email: true,
      signed_at: '2026-11-04T01:22:01.666Z',
      created: '2026-11-04 01:21:18.178Z',
      updated: '2026-11-04 01:22:04.655Z',
    }

    const beatrizAppointment: ProcedureAppointmentRecord = {
      id: '5hzcydnxfc2qwi4',
      form_submission: '6w3l1vvrv2gqd7l',
      patient_name: 'Beatriz Carvalho Martins de Freitas',
      procedure: 'geral',
      procedure_date: '2026-11-04 00:00:00.000Z',
      procedure_time: '00:23',
      reminder_state: 'não enviado por atraso',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: true,
      created: '2026-11-04 01:21:18.470Z',
      updated: '2026-11-04 02:30:43.523Z',
    }

    // Deve entrar em exatamente UM cartão: fichas_prontas
    const category = classifyFormCategory(beatrizForm, beatrizAppointment)
    expect(category).toBe('fichas_prontas')
  })

  it('classifica em Com Pendência quando há falha no envio do comprovante', () => {
    const form: FormSubmissionRecord = {
      id: 'f1',
      form_type: 'geral',
      token: 'tok1',
      status: 'preenchida',
      patient_name: 'Paciente Teste',
      email_delivery_status: 'falha',
      created: '2026-11-04 01:21:18.178Z',
      updated: '2026-11-04 01:21:18.178Z',
    }
    expect(classifyFormCategory(form)).toBe('com_pendencia')
  })

  it('classifica em Com Pendência quando há falha no envio do lembrete', () => {
    const form: FormSubmissionRecord = {
      id: 'f2',
      form_type: 'geral',
      token: 'tok2',
      status: 'preenchida',
      patient_name: 'Paciente Teste',
      email_delivery_status: 'enviado',
      created: '2026-11-04 01:21:18.178Z',
      updated: '2026-11-04 01:21:18.178Z',
    }
    const appt: ProcedureAppointmentRecord = {
      id: 'a2',
      form_submission: 'f2',
      procedure_date: '2026-11-05',
      procedure: 'geral',
      reminder_state: 'falha no envio',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: false,
      created: '2026-11-04',
      updated: '2026-11-04',
    }
    expect(classifyFormCategory(form, appt)).toBe('com_pendencia')
  })

  it('classifica em Aguardando a paciente quando ficha ainda não foi assinada', () => {
    const form: FormSubmissionRecord = {
      id: 'f3',
      form_type: 'geral',
      token: 'tok3',
      status: 'pendente',
      created: '2026-11-04 01:21:18.178Z',
      updated: '2026-11-04 01:21:18.178Z',
    }
    expect(classifyFormCategory(form)).toBe('aguardando_paciente')
  })
})
