import pb from '@/lib/pocketbase/client'
import {
  FormSubmissionRecord,
  ProcedureAppointmentRecord,
  ClinicSettingsRecord,
  clinicSettingsService,
} from '@/services/forms'
import { generateFormPdfBytes } from '@/lib/pdfBinary'
import { createZipBlob, ZipFileEntry } from '@/lib/zipWriter'

export interface BackupProgress {
  current: number
  total: number
  message: string
}

export interface BackupExportResult {
  totalExported: number
  zipBlob: Blob
  fileName: string
}

/**
 * Remove acentos e caracteres especiais para nomes de arquivo seguros
 */
export function sanitizeFileNamePart(str?: string): string {
  if (!str) return 'SemNome'
  return (
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .trim() || 'SemNome'
  )
}

/**
 * Extrai AAAA-MM-DD a partir de uma data ISO ou string YYYY-MM-DD
 */
export function extractDateYMD(isoOrYmd?: string): string {
  if (!isoOrYmd) return '0000-00-00'
  const match = String(isoOrYmd)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`
  }
  try {
    const d = new Date(isoOrYmd)
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  } catch {
    /* intentionally ignored */
  }
  return '0000-00-00'
}

/**
 * Mapeia o tipo da ficha para o nome legível do procedimento
 */
export function getProcedureLabel(formType?: string): string {
  switch (formType) {
    case 'labios':
      return 'Labios'
    case 'botox':
      return 'Botox'
    case 'geral':
    default:
      return 'Geral'
  }
}

/**
 * Escapa valores para CSV padrão (com aspas se contiver vírgula, quebra ou aspas)
 */
function escapeCsv(val?: string | null): string {
  if (val === undefined || val === null) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export const backupService = {
  /**
   * Exporta todas as fichas assinadas (status = 'preenchida')
   * Gera um zip com:
   * - Um PDF por ficha: "AAAA-MM-DD_NomeDaPaciente_Procedimento.pdf"
   * - Planilha relatorio_fichas_assinadas.csv com as colunas requeridas
   * Atualiza e persiste a data da última exportação em clinic_settings
   */
  async exportAllSignedForms(
    onProgress?: (p: BackupProgress) => void,
  ): Promise<BackupExportResult> {
    onProgress?.({ current: 0, total: 0, message: 'Buscando fichas assinadas...' })

    // 1. Busca todas as fichas preenchidas
    const forms = await pb.collection('form_submissions').getFullList<FormSubmissionRecord>({
      filter: "status = 'preenchida'",
      sort: '-signed_at,-created',
    })

    const total = forms.length

    if (total === 0) {
      // Atualiza data do backup mesmo se vazio
      const nowIso = new Date().toISOString()
      await this.updateLastBackupDate(nowIso)

      // Gera um zip com CSV vazio
      const emptyCsv =
        '\uFEFFpaciente,cpf,procedimento,data_procedimento,data_assinatura,hash_documento,arquivo_pdf\n'
      const zipBlob = createZipBlob([
        {
          name: 'relatorio_fichas_assinadas.csv',
          data: emptyCsv,
        },
      ])

      const now = new Date()
      const ymd = extractDateYMD(now.toISOString())
      const fileName = `backup_fichas_assinadas_${ymd}.zip`

      return { totalExported: 0, zipBlob, fileName }
    }

    // 2. Busca configurações da clínica para cabeçalho dos PDFs
    let settings: ClinicSettingsRecord | null = null
    try {
      settings = await clinicSettingsService.getSettings()
    } catch {
      /* intentionally ignored */
    }

    // 3. Busca agendamentos associados para saber a data do procedimento exata
    const formIds = forms.map((f) => f.id)
    const appointmentsByFormId = new Map<string, ProcedureAppointmentRecord>()

    try {
      // Busca agendamentos em lotes de 50
      for (let i = 0; i < formIds.length; i += 50) {
        const slice = formIds.slice(i, i + 50)
        const filterStr = slice.map((id) => `form_submission = "${id}"`).join(' || ')
        const appts = await pb
          .collection('procedure_appointments')
          .getFullList<ProcedureAppointmentRecord>({
            filter: filterStr,
          })
        for (const appt of appts) {
          if (appt.form_submission && !appointmentsByFormId.has(appt.form_submission)) {
            appointmentsByFormId.set(appt.form_submission, appt)
          }
        }
      }
    } catch {
      /* intentionally ignored */
    }

    // 4. Prepara entradas do ZIP e linhas do CSV
    const zipEntries: ZipFileEntry[] = []
    const csvRows: string[] = [
      '\uFEFFpaciente,cpf,procedimento,data_procedimento,data_assinatura,hash_documento,arquivo_pdf',
    ]

    const usedFileNames = new Set<string>()

    for (let i = 0; i < total; i++) {
      const form = forms[i]
      const currentNum = i + 1

      onProgress?.({
        current: currentNum,
        total,
        message: `Gerando PDF ${currentNum} de ${total}: ${form.patient_name || 'Paciente'}...`,
      })

      const appt = appointmentsByFormId.get(form.id)
      const procDateStr = appt?.procedure_date || form.signed_at || form.created
      const dateYmd = extractDateYMD(procDateStr)
      const patientSafeName = sanitizeFileNamePart(form.patient_name)
      const procSafeLabel = sanitizeFileNamePart(getProcedureLabel(form.form_type))

      let pdfBaseName = `${dateYmd}_${patientSafeName}_${procSafeLabel}`
      let pdfFileName = `${pdfBaseName}.pdf`
      let counter = 2
      while (usedFileNames.has(pdfFileName)) {
        pdfFileName = `${pdfBaseName}_${counter}.pdf`
        counter++
      }
      usedFileNames.add(pdfFileName)

      // Gerar PDF binário
      const pdfBytes = generateFormPdfBytes(form, settings)

      zipEntries.push({
        name: pdfFileName,
        data: pdfBytes,
        date: form.signed_at ? new Date(form.signed_at) : new Date(form.created),
      })

      // Linha CSV: paciente, CPF, procedimento, data do procedimento, data da assinatura, hash do documento e nome do arquivo PDF
      const csvLine = [
        escapeCsv(form.patient_name || 'Não informado'),
        escapeCsv(form.patient_cpf || 'Não informado'),
        escapeCsv(getProcedureLabel(form.form_type)),
        escapeCsv(appt?.procedure_date || dateYmd),
        escapeCsv(form.signed_at || form.created),
        escapeCsv(form.document_hash || 'SHA-256'),
        escapeCsv(pdfFileName),
      ].join(',')

      csvRows.push(csvLine)

      // Permite ao navegador atualizar a tela e a barra de progresso
      if (i % 5 === 0 || i === total - 1) {
        await new Promise((r) => setTimeout(r, 10))
      }
    }

    onProgress?.({
      current: total,
      total,
      message: 'Compactando arquivo .zip...',
    })

    // Adiciona o CSV no zip
    zipEntries.push({
      name: 'relatorio_fichas_assinadas.csv',
      data: csvRows.join('\r\n'),
      date: new Date(),
    })

    const zipBlob = createZipBlob(zipEntries)

    // Atualiza a data da última exportação
    const nowIso = new Date().toISOString()
    await this.updateLastBackupDate(nowIso)

    const now = new Date()
    const ymd = extractDateYMD(now.toISOString())
    const fileName = `backup_fichas_assinadas_${ymd}.zip`

    return {
      totalExported: total,
      zipBlob,
      fileName,
    }
  },

  /**
   * Salva a data da última exportação no registro clinic_settings
   */
  async updateLastBackupDate(isoString: string): Promise<void> {
    try {
      const settings = await clinicSettingsService.getSettings()
      if (settings?.id) {
        // Formatar para formato compatível com PocketBase date (ex.: 'YYYY-MM-DD HH:mm:ss' ou ISO limpo)
        const dateObj = new Date(isoString)
        const formattedDate = !isNaN(dateObj.getTime())
          ? dateObj.toISOString().replace('T', ' ').substring(0, 19)
          : isoString
        await pb.collection('clinic_settings').update(settings.id, {
          last_backup_export_at: formattedDate,
        })
      }
    } catch (err) {
      console.warn('Não foi possível persistir last_backup_export_at:', err)
    }
  },

  /**
   * Dispara o download automático do Blob no navegador
   */
  triggerBrowserDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
  },
}
