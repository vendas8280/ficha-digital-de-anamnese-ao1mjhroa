import { describe, it, expect } from 'vitest'
import { generateFormPdfBytes } from './pdfBinary'
import { FormSubmissionRecord } from '@/services/forms'

describe('pdfBinary', () => {
  it('generates a valid PDF byte array starting with %PDF-1.4', () => {
    const fakeForm: FormSubmissionRecord = {
      id: 'test-123',
      patient_name: 'Maria Teste de Souza',
      patient_cpf: '123.456.789-00',
      patient_email: 'maria@example.com',
      patient_phone: '(79) 99999-8888',
      form_type: 'botox',
      status: 'preenchida',
      token: 'fake-tok',
      document_hash: 'abc123hash',
      signed_at: '2026-11-01T14:30:00.000Z',
      accepted_term_title: 'Termo de Botox',
      accepted_term_text: 'Autorizo o procedimento sem restrições.',
      answers: { queixa_principal: 'Rugas na testa', alergias: 'Nenhuma' },
      created: '2026-11-01T14:00:00.000Z',
      updated: '2026-11-01T14:30:00.000Z',
    }

    const bytes = generateFormPdfBytes(fakeForm, null)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)

    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.includes('%%EOF')).toBe(true)
    expect(text.includes('Maria Teste de Souza')).toBe(true)
    expect(text.includes('SEÇÃO 5 — REGISTRO DA ASSINATURA ELETRÔNICA')).toBe(true)
    expect(text.includes('O registro técnico completo')).toBe(true)
    expect(text.includes('IP de Origem Real')).toBe(false)
    expect(text.includes('Hash SHA-256 de Integridade')).toBe(false)
    expect(text.includes('Certificação de Autenticidade')).toBe(false)
  })
})
