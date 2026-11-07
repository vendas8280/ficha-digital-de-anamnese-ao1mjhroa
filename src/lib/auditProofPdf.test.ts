import { describe, it, expect } from 'vitest'
import { generateAuditProofPdfBytes } from './auditProofPdf'
import { getFormCode, getProofPdfFilename, getFichaPdfFilename } from './formCode'
import { formatFriendlyDevice } from './deviceFormatter'
import type { FormSubmissionRecord, AuditEventRecord } from '@/services/forms'

describe('Comprovante de Assinatura Eletrônica', () => {
  const mockForm: FormSubmissionRecord = {
    id: 'rec_test_123',
    token: 'tok_test_abc',
    form_type: 'geral',
    status: 'preenchida',
    form_code: 'AN-2026-0001',
    patient_name: 'Beatriz Carvalho',
    patient_cpf: '015.814.915-73',
    patient_email: 'prime.impr@gmail.com',
    signed_at: '2026-11-04T01:22:01.666Z',
    document_hash: '0babb1654e424a70e9c38035884e68ec183136781372044e07476574e1c2452c',
    ip_address: '191.15.16.45',
    user_agent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    created: '2026-11-04T01:21:18.178Z',
    updated: '2026-11-04T01:22:04.655Z',
  }

  const mockAudits: AuditEventRecord[] = [
    {
      id: 'a1',
      form_submission: 'rec_test_123',
      event_type: 'link_aberto',
      description: 'Paciente abriu o link seguro da ficha de anamnese',
      ip_address: '191.15.16.45',
      created: '2026-11-04T01:21:20.000Z',
    },
    {
      id: 'a2',
      form_submission: 'rec_test_123',
      event_type: 'codigo_enviado',
      description: 'Código de verificação 849201 enviado para prime.impr@gmail.com',
      ip_address: '', // IP ausente
      created: '2026-11-04T01:21:30.000Z',
    },
    {
      id: 'a3',
      form_submission: 'rec_test_123',
      event_type: 'codigo_validado',
      description: 'Código de e-mail validado com sucesso para prime.impr@gmail.com',
      ip_address: '191.15.16.45',
      created: '2026-11-04T01:21:45.000Z',
    },
    {
      id: 'a4',
      form_submission: 'rec_test_123',
      event_type: 'termo_assinado',
      description:
        'Paciente concluiu a assinatura eletrônica da ficha de anamnese (Hash: 0babb1654e424a70e9c38035884e68ec183136781372044e07476574e1c2452c)',
      ip_address: '191.15.16.45',
      created: '2026-11-04T01:22:01.000Z',
    },
  ]

  it('formata o código da ficha de forma consistente', () => {
    expect(getFormCode(mockForm)).toBe('AN-2026-0001')
    expect(getFormCode({ created: '2026-03-01T00:00:00Z', id: 'abcd1234' })).toBe('AN-2026-1234')
  })

  it('gera nomes padronizados com o mesmo código', () => {
    const proofName = getProofPdfFilename(mockForm)
    const fichaName = getFichaPdfFilename(mockForm)

    expect(proofName).toBe('Comprovante de Assinatura — Beatriz Carvalho — AN-2026-0001.pdf')
    expect(fichaName).toContain('AN-2026-0001')
  })

  it('traduz user agent para dispositivo e navegador legíveis (sem UA bruto)', () => {
    const friendly = formatFriendlyDevice(mockForm.user_agent)
    expect(friendly).toBe('Mac — Google Chrome')
    expect(friendly).not.toContain('Mozilla')
    expect(friendly).not.toContain('AppleWebKit')
  })

  it('gera bytes de PDF válidos com cabeçalho %PDF-1.4 e hash correspondente', () => {
    const bytes = generateAuditProofPdfBytes(mockForm, mockAudits, null, null)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(1000)

    const pdfString = String.fromCharCode(...bytes)
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true)
    expect(pdfString).toContain('COMPROVANTE DE ASSINATURA')
    expect(pdfString).toContain('0babb1654e424a70e9c38035884e68ec183136781372044e07476574e1c2452c')
    expect(pdfString).toContain('AN-2026-0001')
    // Verifica que IP ausente virou "não registrado"
    expect(pdfString).toContain('não registrado')
    // Verifica que código de verificação numérico foi ocultado
    expect(pdfString).not.toContain('849201')
  })
})
