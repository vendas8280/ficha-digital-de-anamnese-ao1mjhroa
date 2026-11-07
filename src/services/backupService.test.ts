import { describe, it, expect } from 'vitest'
import { sanitizeFileNamePart, extractDateYMD, getProcedureLabel } from './backupService'

describe('backupService helpers', () => {
  it('sanitizes file name parts properly', () => {
    expect(sanitizeFileNamePart('Andresa Souza')).toBe('AndresaSouza')
    expect(sanitizeFileNamePart('Érika Conceição')).toBe('ErikaConceicao')
    expect(sanitizeFileNamePart("Ana-Maria D'Ávila")).toBe('AnaMariaDAvila')
    expect(sanitizeFileNamePart('')).toBe('SemNome')
  })

  it('extracts date YMD correctly', () => {
    expect(extractDateYMD('2026-11-08T15:20:00.000Z')).toBe('2026-11-08')
    expect(extractDateYMD('2026-11-08')).toBe('2026-11-08')
    expect(extractDateYMD('')).toBe('0000-00-00')
  })

  it('maps procedure labels correctly', () => {
    expect(getProcedureLabel('botox')).toBe('Botox')
    expect(getProcedureLabel('labios')).toBe('Labios')
    expect(getProcedureLabel('geral')).toBe('Geral')
    expect(getProcedureLabel(undefined)).toBe('Geral')
  })
})
