import pb from '@/lib/pocketbase/client'
import type { FormType, FormStatus, EmailDeliveryStatus } from '@/types/form'

export interface FormSubmissionRecord {
  id: string
  token: string
  form_code?: string
  form_type: FormType
  status: FormStatus
  patient_name?: string
  patient_cpf?: string
  patient_email?: string
  patient_phone?: string
  patient_birth_date?: string
  patient_rg?: string
  patient_address?: string
  patient_profession?: string
  patient_emergency_contact?: string
  answers?: Record<string, string | boolean | string[]>
  signature_data?: string
  accepted_term_text?: string
  accepted_term_title?: string
  signed_at?: string
  ip_address?: string
  user_agent?: string
  document_hash?: string
  expires_at?: string
  email_delivery_status?: EmailDeliveryStatus
  email_delivery_error?: string
  email_sent_at?: string
  email_code_verified_at?: string
  pdf_attached_to_email?: boolean
  pdf_file?: string
  created: string
  updated: string
}

export interface AppointmentReminderRecord {
  id: string
  appointment: string
  kind: '24h' | '2h'
  scheduled_for: string
  status: 'programado' | 'enviado' | 'falha' | 'atrasado' | 'cancelado'
  attempts?: number
  last_attempt_at?: string
  last_error?: string
  sent_at?: string
  sent_to?: string
  created: string
  updated: string
}

export interface ProcedureAppointmentRecord {
  id: string
  form_submission: string
  patient_name?: string
  patient_phone?: string
  patient_email?: string
  procedure_date?: string
  procedure_time?: string
  procedure?: string
  notify_patient?: boolean
  notify_clinic?: boolean
  status?: string
  reminder_state?: string
  created: string
  updated: string
}

export interface ClinicSettingsRecord {
  id: string
  clinic_name: string
  notification_email: string
  phone?: string
  sender_email?: string
  technical_responsible?: string
  professional_register?: string
  clinic_cnpj?: string
  clinic_address?: string
  reminder_sender_email?: string
  reminder_min_advance_hours?: '6' | '12' | '24' | string
  reminder_enable_24h?: boolean
  reminder_enable_2h?: boolean
  reminder_test_mode?: boolean
  reminder_subject_24h?: string
  reminder_body_24h?: string
  reminder_subject_2h?: string
  reminder_body_2h?: string
  last_backup_export_at?: string
  created: string
  updated: string
}

export interface AuditEventRecord {
  id: string
  form_submission: string
  event_type: string
  description: string
  step_number?: number
  ip_address?: string
  user_agent?: string
  previous_hash?: string
  chain_hash?: string
  metadata?: Record<string, unknown>
  timestamp: string
  created: string
  updated: string
}

// Generate random safe 32-character token
export function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const cryptoArray = new Uint8Array(32)
  window.crypto.getRandomValues(cryptoArray)
  for (let i = 0; i < 32; i++) {
    result += chars[cryptoArray[i] % chars.length]
  }
  return result
}

// Simple SHA-256 in browser
export async function computeHash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const formsService = {
  // Clinic creates a new link for a patient
  async createLink(
    form_type: FormType,
    patient_name?: string,
    patient_phone?: string,
  ): Promise<FormSubmissionRecord> {
    const token = generateSecureToken()
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const record = await pb.collection('form_submissions').create({
      token,
      form_type,
      status: 'pendente',
      patient_name: patient_name || '',
      patient_phone: patient_phone || '',
      expires_at: expires,
      email_delivery_status: 'nao_enviado',
      answers: {},
    })
    return record as unknown as FormSubmissionRecord
  },

  // Clinic lists all forms with search and filter
  async listForms(filterQuery?: string, sort = '-created'): Promise<FormSubmissionRecord[]> {
    const records = await pb.collection('form_submissions').getFullList({
      filter: filterQuery || '',
      sort,
    })
    return records as unknown as FormSubmissionRecord[]
  },

  // Get single form by ID (Clinic panel)
  async getById(id: string): Promise<FormSubmissionRecord> {
    const record = await pb.collection('form_submissions').getOne(id)
    return record as unknown as FormSubmissionRecord
  },

  // Public: get form by token
  async getByToken(token: string): Promise<FormSubmissionRecord | null> {
    try {
      const records = await pb.collection('form_submissions').getFullList({
        filter: `token = "${token}"`,
        query: { token },
      })
      if (records.length === 0) return null
      return records[0] as unknown as FormSubmissionRecord
    } catch {
      return null
    }
  },

  // Fetch real client IP address from backend
  async getRealClientIp(): Promise<string> {
    try {
      const res = await pb.send('/backend/v1/client-ip', { method: 'GET' })
      return (res as { ip?: string }).ip || 'Não disponível'
    } catch {
      return 'Não disponível'
    }
  },

  // Send verification code to patient email
  async sendVerificationCode(
    token: string,
    email: string,
    patient_name?: string,
  ): Promise<{ success: boolean; message?: string }> {
    const res = await pb.send('/backend/v1/forms/send-verification-code', {
      method: 'POST',
      body: { token, email, patient_name },
    })
    return res as { success: boolean; message?: string }
  },

  // Verify code sent to patient email
  async verifyEmailCode(
    token: string,
    email: string,
    code: string,
  ): Promise<{ success: boolean; message?: string }> {
    const res = await pb.send('/backend/v1/forms/verify-email-code', {
      method: 'POST',
      body: { token, email, code },
    })
    return res as { success: boolean; message?: string }
  },

  // Record audit trail event
  async recordAuditEvent(data: {
    token: string
    event_type: string
    description: string
    step_number?: number
    metadata?: Record<string, unknown>
  }): Promise<void> {
    try {
      await pb.send('/backend/v1/forms/audit-event', {
        method: 'POST',
        body: data,
      })
    } catch (err) {
      console.warn('Falha ao registrar evento de auditoria:', err)
    }
  },

  // List audit events for a form submission
  async listAuditEvents(formSubmissionId: string, token?: string): Promise<AuditEventRecord[]> {
    try {
      const records = await pb.collection('audit_events').getFullList({
        filter: `form_submission = "${formSubmissionId}"`,
        sort: 'created',
        query: token ? { token } : undefined,
      })
      return records as unknown as AuditEventRecord[]
    } catch {
      return []
    }
  },

  // Public: Patient submits filled form and signs
  async submitForm(
    id: string,
    token: string,
    data: {
      patient_name: string
      patient_cpf: string
      patient_email: string
      patient_phone: string
      patient_birth_date: string
      patient_rg: string
      patient_address: string
      patient_profession: string
      patient_emergency_contact: string
      answers: Record<string, unknown>
      signature_data: string
      accepted_term_text: string
      accepted_term_title: string
      signed_at: string
      ip_address: string
      user_agent: string
      document_hash: string
    },
  ): Promise<FormSubmissionRecord> {
    const payload = {
      ...data,
      status: 'preenchida' as const,
      token,
    }
    const record = await pb.collection('form_submissions').update(id, payload, {
      query: { token },
    })
    return record as unknown as FormSubmissionRecord
  },

  // Re-send email receipt via custom backend endpoint
  async resendReceiptEmail(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await pb.send('/backend/v1/forms/resend-email', {
        method: 'POST',
        body: { id },
      })
      return res as { success: boolean; message?: string }
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Falha ao reenviar e-mail')
    }
  },

  // Enviar comprovante completo com trilha de auditoria anexada
  async sendAuditProofEmail(idOrToken: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await pb.send('/backend/v1/forms/send-audit-proof', {
        method: 'POST',
        body: {
          id: idOrToken,
          form_submission_id: idOrToken,
          token: idOrToken,
        },
      })
      return res as { success: boolean; message?: string }
    } catch (err: unknown) {
      throw new Error(
        err instanceof Error ? err.message : 'Falha ao enviar comprovante completo com trilha',
      )
    }
  },

  // Delete form (clinic only)
  async deleteForm(id: string): Promise<boolean> {
    return await pb.collection('form_submissions').delete(id)
  },

  // Registra download ou impressão de PDF pela administradora
  async recordPdfExportAudit(
    formSubmissionId: string,
    action: 'download' | 'impressao',
    extraDetails?: string,
  ): Promise<void> {
    try {
      const desc =
        action === 'impressao'
          ? `Administradora abriu para impressão o documento PDF da ficha${extraDetails ? ` (${extraDetails})` : ''}`
          : `Administradora realizou o download do documento PDF da ficha${extraDetails ? ` (${extraDetails})` : ''}`

      await pb.send('/backend/v1/forms/audit-event', {
        method: 'POST',
        body: {
          form_submission_id: formSubmissionId,
          event_type: action === 'impressao' ? 'pdf_impressao_admin' : 'pdf_download_admin',
          description: desc,
          step_number: 6,
          metadata: {
            action,
            source: 'admin_panel',
          },
        },
      })
    } catch (err) {
      console.warn('Falha ao registrar auditoria de exportação de PDF:', err)
    }
  },
}

export const appointmentsService = {
  // Cria o registro de agendamento opcional vinculado à ficha (se data preenchida)
  async createAppointment(data: {
    form_submission: string
    patient_name?: string
    patient_phone?: string
    patient_email?: string
    procedure_date?: string
    procedure_time?: string
    procedure?: string
    notify_patient?: boolean
    notify_clinic?: boolean
  }): Promise<ProcedureAppointmentRecord> {
    const record = await pb.collection('procedure_appointments').create({
      ...data,
      status: 'agendado',
      reminder_state: 'aguardando ficha',
    })
    return record as unknown as ProcedureAppointmentRecord
  },

  // Lista todos os agendamentos (painel — base da coluna Lembrete)
  async listAll(): Promise<ProcedureAppointmentRecord[]> {
    try {
      const records = await pb.collection('procedure_appointments').getFullList({
        sort: '-created',
      })
      return records as unknown as ProcedureAppointmentRecord[]
    } catch {
      return []
    }
  },

  // Lista agendamentos de uma ficha
  async listByForm(formSubmissionId: string): Promise<ProcedureAppointmentRecord[]> {
    try {
      const records = await pb.collection('procedure_appointments').getFullList({
        filter: `form_submission = "${formSubmissionId}"`,
        sort: '-created',
      })
      return records as unknown as ProcedureAppointmentRecord[]
    } catch {
      return []
    }
  },

  // Lista todos os lembretes programados/enviados (painel para detalhes/tooltips)
  async listAllReminders(): Promise<AppointmentReminderRecord[]> {
    try {
      const records = await pb.collection('appointment_reminders').getFullList({
        sort: 'scheduled_for',
      })
      return records as unknown as AppointmentReminderRecord[]
    } catch {
      return []
    }
  },

  // Atualiza um agendamento (status, data, hora, etc.)
  async updateAppointment(
    id: string,
    data: Partial<ProcedureAppointmentRecord>,
  ): Promise<ProcedureAppointmentRecord> {
    const record = await pb.collection('procedure_appointments').update(id, data)
    return record as unknown as ProcedureAppointmentRecord
  },

  // Marca agendamento como realizado
  async markAsRealizado(id: string): Promise<ProcedureAppointmentRecord> {
    return this.updateAppointment(id, { status: 'realizado' })
  },

  // Marca agendamento como faltou
  async markAsFaltou(id: string): Promise<ProcedureAppointmentRecord> {
    return this.updateAppointment(id, { status: 'faltou' })
  },

  // Cancela agendamento
  async cancelAppointment(id: string): Promise<ProcedureAppointmentRecord> {
    return this.updateAppointment(id, { status: 'cancelado' })
  },

  // Remarca agendamento (atualiza data e horário, e se estiver cancelado/faltou volta para agendado)
  async rescheduleAppointment(
    id: string,
    procedureDate: string,
    procedureTime?: string,
  ): Promise<ProcedureAppointmentRecord> {
    return this.updateAppointment(id, {
      procedure_date: procedureDate,
      procedure_time: procedureTime || '',
      status: 'agendado',
    })
  },

  // Exclui agendamento (usado em testes/limpeza)
  async deleteAppointment(id: string): Promise<boolean> {
    return pb.collection('procedure_appointments').delete(id)
  },

  // Disparo manual/reenvio de lembrete do agendamento (usado pelo botão Reenviar em falha)
  async retryReminder(appointmentId: string): Promise<{ success: boolean; message?: string }> {
    const res = await pb.send('/backend/v1/appointments/retry-reminder', {
      method: 'POST',
      body: { appointment_id: appointmentId },
    })
    return res as { success: boolean; message?: string }
  },
}

export const clinicSettingsService = {
  async getSettings(): Promise<ClinicSettingsRecord | null> {
    try {
      const records = await pb.collection('clinic_settings').getFullList({
        sort: '-created',
        limit: 1,
      })
      if (records.length === 0) return null
      return records[0] as unknown as ClinicSettingsRecord
    } catch {
      return null
    }
  },

  async updateSettings(data: {
    clinic_name?: string
    notification_email?: string
    phone?: string
    sender_email?: string
    technical_responsible?: string
    professional_register?: string
    clinic_cnpj?: string
    clinic_address?: string
    reminder_sender_email?: string
    reminder_min_advance_hours?: '6' | '12' | '24' | string
    reminder_enable_24h?: boolean
    reminder_enable_2h?: boolean
    reminder_test_mode?: boolean
    reminder_subject_24h?: string
    reminder_body_24h?: string
    reminder_subject_2h?: string
    reminder_body_2h?: string
    last_backup_export_at?: string
  }): Promise<ClinicSettingsRecord> {
    const existing = await this.getSettings()
    if (existing) {
      const updated = await pb.collection('clinic_settings').update(existing.id, data)
      return updated as unknown as ClinicSettingsRecord
    } else {
      const defaultData = {
        clinic_name: data.clinic_name || 'Andresa Souza Clinic',
        notification_email: data.notification_email || '',
        ...data,
      }
      const created = await pb.collection('clinic_settings').create(defaultData)
      return created as unknown as ClinicSettingsRecord
    }
  },

  // Disparo de teste de lembretes (dispara ambos os modelos 24h e 2h para o e-mail de comprovantes)
  async sendTestReminders(params?: { kind?: '24h' | '2h' | 'both' }): Promise<{
    success: boolean
    recipient: string
    count: number
    dispatched: Array<{ kind: string; success: boolean; recipient: string; subject: string }>
    message: string
  }> {
    const res = await pb.send('/backend/v1/appointments/test-reminder-template', {
      method: 'POST',
      body: { kind: params?.kind || 'both' },
    })
    return res as {
      success: boolean
      recipient: string
      count: number
      dispatched: Array<{ kind: string; success: boolean; recipient: string; subject: string }>
      message: string
    }
  },

  // Compatibilidade caso algum código ainda chame testReminderTemplate
  async testReminderTemplate(params: {
    kind: '24h' | '2h'
    subject?: string
    body?: string
  }): Promise<{ success: boolean; recipient: string; subject: string; message: string }> {
    const res = await pb.send('/backend/v1/appointments/test-reminder-template', {
      method: 'POST',
      body: params,
    })
    return res as { success: boolean; recipient: string; subject: string; message: string }
  },
}
