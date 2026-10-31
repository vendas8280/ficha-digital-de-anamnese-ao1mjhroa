import pb from '@/lib/pocketbase/client'
import type { FormType, FormStatus, EmailDeliveryStatus } from '@/types/form'

export interface FormSubmissionRecord {
  id: string
  token: string
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
  created: string
  updated: string
}

export interface ClinicSettingsRecord {
  id: string
  clinic_name: string
  notification_email: string
  phone?: string
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
    const record = await pb.collection('form_submissions').update(
      id,
      {
        ...data,
        status: 'preenchida',
        token, // maintain token
      },
      {
        query: { token },
      },
    )
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

  // Delete form (clinic only)
  async deleteForm(id: string): Promise<boolean> {
    return await pb.collection('form_submissions').delete(id)
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
    clinic_name: string
    notification_email: string
    phone?: string
  }): Promise<ClinicSettingsRecord> {
    const existing = await this.getSettings()
    if (existing) {
      const updated = await pb.collection('clinic_settings').update(existing.id, data)
      return updated as unknown as ClinicSettingsRecord
    } else {
      const created = await pb.collection('clinic_settings').create(data)
      return created as unknown as ClinicSettingsRecord
    }
  },
}
