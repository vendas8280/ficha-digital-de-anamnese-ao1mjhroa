import { describe, it, expect } from 'vitest'
import { classifyFormCategory, isAppointmentWithin24Hours } from './DashboardPage'
import type { FormSubmissionRecord, ProcedureAppointmentRecord } from '@/services/forms'

describe('classifyFormCategory e concordância de contagem com filtros', () => {
  it('classifica em Com Pendência quando lembrete está com falha de envio', () => {
    const form: FormSubmissionRecord = {
      id: 'f-falha-lembrete',
      form_type: 'geral',
      token: 'tok-1',
      status: 'preenchida',
      patient_name: 'Paciente Falha Lembrete',
      email_delivery_status: 'enviado',
      created: '2026-11-04 01:21:18.178Z',
      updated: '2026-11-04 01:21:18.178Z',
    }
    const appt: ProcedureAppointmentRecord = {
      id: 'a-1',
      form_submission: 'f-falha-lembrete',
      procedure_date: '2026-11-10',
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

  it('classifica em Com Pendência quando lembrete não foi enviado por atraso (caso do usuário)', () => {
    const form: FormSubmissionRecord = {
      id: 'f-atraso',
      form_type: 'labios',
      token: 'tok-2',
      status: 'preenchida',
      patient_name: 'Paciente Não Enviado Atraso',
      email_delivery_status: 'enviado',
      created: '2026-11-03 22:20:00.000Z',
      updated: '2026-11-03 22:22:00.000Z',
    }
    const appt: ProcedureAppointmentRecord = {
      id: 'a-atraso',
      form_submission: 'f-atraso',
      patient_name: 'Paciente Não Enviado Atraso',
      procedure: 'labios',
      procedure_date: '2026-11-04',
      procedure_time: '10:00',
      reminder_state: 'não enviado por atraso',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: true,
      created: '2026-11-03',
      updated: '2026-11-03',
    }
    expect(classifyFormCategory(form, appt)).toBe('com_pendencia')
  })

  it('classifica em Com Pendência quando lembrete está marcado como "fora do prazo" ou "sem ficha, lembrete não enviado"', () => {
    const form: FormSubmissionRecord = {
      id: 'f-fora-prazo',
      form_type: 'botox',
      token: 'tok-3',
      status: 'pendente',
      created: '2026-11-01',
      updated: '2026-11-01',
    }
    const appt: ProcedureAppointmentRecord = {
      id: 'a-fora-prazo',
      form_submission: 'f-fora-prazo',
      procedure_date: '2026-11-15',
      procedure: 'botox',
      reminder_state: 'fora do prazo',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: false,
      created: '2026-11-01',
      updated: '2026-11-01',
    }
    expect(classifyFormCategory(form, appt)).toBe('com_pendencia')
  })

  it('classifica em Com Pendência quando comprovante não foi entregue (falha de envio)', () => {
    const form: FormSubmissionRecord = {
      id: 'f-falha-comprovante',
      form_type: 'geral',
      token: 'tok-4',
      status: 'preenchida',
      email_delivery_status: 'falha',
      created: '2026-11-04',
      updated: '2026-11-04',
    }
    expect(classifyFormCategory(form)).toBe('com_pendencia')
  })

  it('classifica em Com Pendência quando comprovante não foi entregue mesmo com ficha assinada (não enviado / pendente)', () => {
    const formNaoEnviado: FormSubmissionRecord = {
      id: 'f-comprovante-nao-enviado',
      form_type: 'geral',
      token: 'tok-5',
      status: 'preenchida',
      email_delivery_status: 'nao_enviado',
      created: '2026-11-04',
      updated: '2026-11-04',
    }
    expect(classifyFormCategory(formNaoEnviado)).toBe('com_pendencia')
  })

  it('classifica em Com Pendência quando ficha está gerada e não assinada com procedimento em menos de 24h', () => {
    const now = new Date('2026-11-07T10:00:00.000Z')
    const form: FormSubmissionRecord = {
      id: 'f-urgente',
      form_type: 'geral',
      token: 'tok-6',
      status: 'pendente',
      patient_name: 'Paciente Urgente Amanhã',
      created: '2026-11-07T08:00:00.000Z',
      updated: '2026-11-07T08:00:00.000Z',
    }
    // Procedimento daqui a 14h: hoje 24:00 (ou amanhã cedo)
    const appt: ProcedureAppointmentRecord = {
      id: 'a-urgente',
      form_submission: 'f-urgente',
      procedure_date: '2026-11-08',
      procedure_time: '00:00',
      procedure: 'geral',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: false,
      created: '2026-11-07',
      updated: '2026-11-07',
    }

    expect(isAppointmentWithin24Hours(appt, now)).toBe(true)
    expect(classifyFormCategory(form, appt, now)).toBe('com_pendencia')
  })

  it('classifica em Aguardando a paciente quando ficha não assinada tem procedimento em mais de 24h ou sem agendamento', () => {
    const now = new Date('2026-11-07T10:00:00.000Z')
    const form: FormSubmissionRecord = {
      id: 'f-aguardando',
      form_type: 'geral',
      token: 'tok-7',
      status: 'pendente',
      created: '2026-11-07',
      updated: '2026-11-07',
    }
    // Procedimento daqui a 5 dias
    const appt: ProcedureAppointmentRecord = {
      id: 'a-futuro',
      form_submission: 'f-aguardando',
      procedure_date: '2026-11-12',
      procedure_time: '14:00',
      procedure: 'geral',
      status: 'agendado',
      notify_patient: true,
      notify_clinic: false,
      created: '2026-11-07',
      updated: '2026-11-07',
    }

    expect(isAppointmentWithin24Hours(appt, now)).toBe(false)
    expect(classifyFormCategory(form, appt, now)).toBe('aguardando_paciente')
  })

  it('classifica em Fichas Prontas somente quando termo assinado, comprovante entregue e sem pendência no lembrete', () => {
    const form: FormSubmissionRecord = {
      id: 'f-pronta',
      form_type: 'geral',
      token: 'tok-8',
      status: 'preenchida',
      patient_name: 'Paciente Pronta',
      email_delivery_status: 'enviado',
      created: '2026-11-04',
      updated: '2026-11-04',
    }
    const appt: ProcedureAppointmentRecord = {
      id: 'a-pronta',
      form_submission: 'f-pronta',
      procedure_date: '2026-11-05',
      procedure: 'geral',
      reminder_state: 'enviado',
      status: 'realizado',
      notify_patient: true,
      notify_clinic: false,
      created: '2026-11-04',
      updated: '2026-11-04',
    }
    expect(classifyFormCategory(form, appt)).toBe('fichas_prontas')
  })

  it('REGRA DE OURO: o número contado no cartão Com Pendência e o número de linhas filtradas coincidem sempre', () => {
    // Cenário com conjunto de pacientes contendo diferentes estados
    const now = new Date('2026-11-07T12:00:00.000Z')

    const mockForms: FormSubmissionRecord[] = [
      // 1. Lembrete com falha no envio -> pendência
      {
        id: '1',
        form_type: 'geral',
        token: 't1',
        status: 'preenchida',
        email_delivery_status: 'enviado',
        created: '2026-11-01',
        updated: '2026-11-01',
      },
      // 2. Lembrete não enviado por atraso -> pendência
      {
        id: '2',
        form_type: 'labios',
        token: 't2',
        status: 'preenchida',
        email_delivery_status: 'enviado',
        created: '2026-11-02',
        updated: '2026-11-02',
      },
      // 3. Comprovante em falha -> pendência
      {
        id: '3',
        form_type: 'botox',
        token: 't3',
        status: 'preenchida',
        email_delivery_status: 'falha',
        created: '2026-11-03',
        updated: '2026-11-03',
      },
      // 4. Não assinado com procedimento em < 24h -> pendência
      {
        id: '4',
        form_type: 'geral',
        token: 't4',
        status: 'pendente',
        created: '2026-11-04',
        updated: '2026-11-04',
      },
      // 5. Ficha pronta normal (enviado + 24h ok) -> fichas_prontas
      {
        id: '5',
        form_type: 'geral',
        token: 't5',
        status: 'preenchida',
        email_delivery_status: 'enviado',
        created: '2026-11-05',
        updated: '2026-11-05',
      },
      // 6. Aguardando normal (procedimento daqui a 10 dias) -> aguardando_paciente
      {
        id: '6',
        form_type: 'labios',
        token: 't6',
        status: 'pendente',
        created: '2026-11-06',
        updated: '2026-11-06',
      },
      // 7. Ficha pronta sem agendamento -> fichas_prontas
      {
        id: '7',
        form_type: 'botox',
        token: 't7',
        status: 'preenchida',
        email_delivery_status: 'enviado',
        created: '2026-11-07',
        updated: '2026-11-07',
      },
    ]

    const mockAppointments = new Map<string, ProcedureAppointmentRecord>([
      [
        '1',
        {
          id: 'a1',
          form_submission: '1',
          procedure_date: '2026-11-08',
          reminder_state: 'falha no envio',
          procedure: 'geral',
          status: 'agendado',
          notify_patient: true,
          notify_clinic: false,
          created: '2026-11-01',
          updated: '2026-11-01',
        },
      ],
      [
        '2',
        {
          id: 'a2',
          form_submission: '2',
          procedure_date: '2026-11-03',
          reminder_state: 'não enviado por atraso',
          procedure: 'labios',
          status: 'agendado',
          notify_patient: true,
          notify_clinic: false,
          created: '2026-11-02',
          updated: '2026-11-02',
        },
      ],
      [
        '3',
        {
          id: 'a3',
          form_submission: '3',
          procedure_date: '2026-11-09',
          reminder_state: 'enviado',
          procedure: 'botox',
          status: 'agendado',
          notify_patient: true,
          notify_clinic: false,
          created: '2026-11-03',
          updated: '2026-11-03',
        },
      ],
      [
        '4',
        {
          id: 'a4',
          form_submission: '4',
          procedure_date: '2026-11-07',
          procedure_time: '18:00',
          procedure: 'geral',
          status: 'agendado',
          notify_patient: true,
          notify_clinic: false,
          created: '2026-11-04',
          updated: '2026-11-04',
        },
      ],
      [
        '5',
        {
          id: 'a5',
          form_submission: '5',
          procedure_date: '2026-11-10',
          reminder_state: 'enviado',
          procedure: 'geral',
          status: 'agendado',
          notify_patient: true,
          notify_clinic: false,
          created: '2026-11-05',
          updated: '2026-11-05',
        },
      ],
      [
        '6',
        {
          id: 'a6',
          form_submission: '6',
          procedure_date: '2026-11-17',
          procedure: 'labios',
          status: 'agendado',
          notify_patient: true,
          notify_clinic: false,
          created: '2026-11-06',
          updated: '2026-11-06',
        },
      ],
    ])

    // 1. Contagem do cartão
    const countComPendencia = mockForms.reduce((acc, form) => {
      const appt = mockAppointments.get(form.id)
      return classifyFormCategory(form, appt, now) === 'com_pendencia' ? acc + 1 : acc
    }, 0)

    // 2. Linhas filtradas quando o cartão "com_pendencia" é clicado
    const linhasFiltradasComPendencia = mockForms.filter((form) => {
      const appt = mockAppointments.get(form.id)
      return classifyFormCategory(form, appt, now) === 'com_pendencia'
    })

    // Se divergirem, o teste falha:
    expect(countComPendencia).toBe(linhasFiltradasComPendencia.length)
    expect(countComPendencia).toBe(4)

    // Também para as outras duas categorias:
    const countProntas = mockForms.reduce((acc, form) => {
      const appt = mockAppointments.get(form.id)
      return classifyFormCategory(form, appt, now) === 'fichas_prontas' ? acc + 1 : acc
    }, 0)
    const linhasProntas = mockForms.filter((form) => {
      const appt = mockAppointments.get(form.id)
      return classifyFormCategory(form, appt, now) === 'fichas_prontas'
    })
    expect(countProntas).toBe(linhasProntas.length)
    expect(countProntas).toBe(2)

    const countAguardando = mockForms.reduce((acc, form) => {
      const appt = mockAppointments.get(form.id)
      return classifyFormCategory(form, appt, now) === 'aguardando_paciente' ? acc + 1 : acc
    }, 0)
    const linhasAguardando = mockForms.filter((form) => {
      const appt = mockAppointments.get(form.id)
      return classifyFormCategory(form, appt, now) === 'aguardando_paciente'
    })
    expect(countAguardando).toBe(linhasAguardando.length)
    expect(countAguardando).toBe(1)
  })
})
