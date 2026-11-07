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

    // 3. Busca agendamentos associados e trilhas de auditoria para cada ficha
    const formIds = forms.map((f) => f.id)
    const appointmentsByFormId = new Map<string, ProcedureAppointmentRecord>()
    const auditEventsByFormId = new Map<string, AuditEventRecord[]>()

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

        const audits = await pb.collection('audit_events').getFullList<AuditEventRecord>({
          filter: filterStr,
          sort: 'created',
        })
        for (const a of audits) {
          if (!auditEventsByFormId.has(a.form_submission)) {
            auditEventsByFormId.set(a.form_submission, [])
          }
          auditEventsByFormId.get(a.form_submission)!.push(a)
        }
      }
    } catch {
      /* intentionally ignored */
    }

    // 4. Prepara entradas do ZIP, manifesto e linhas do CSV
    const zipEntries: ZipFileEntry[] = []
    const csvRows: string[] = [
      '\uFEFFpaciente,cpf,procedimento,data_procedimento,data_assinatura,hash_documento,arquivo_pdf,pasta_ficha',
    ]

    const usedFileNames = new Set<string>()
    const manifestItems: Array<{
      paciente: string
      cpf: string
      procedimento: string
      data_assinatura: string
      hash_documento: string
      pasta: string
      arquivos: string[]
    }> = []

    for (let i = 0; i < total; i++) {
      const form = forms[i]
      const currentNum = i + 1

      onProgress?.({
        current: currentNum,
        total,
        message: `Processando ficha ${currentNum} de ${total}: ${form.patient_name || 'Paciente'}...`,
      })

      const appt = appointmentsByFormId.get(form.id)
      const procDateStr = appt?.procedure_date || form.signed_at || form.created
      const dateYmd = extractDateYMD(procDateStr)
      const patientSafeName = sanitizeFileNamePart(form.patient_name)
      const procSafeLabel = sanitizeFileNamePart(getProcedureLabel(form.form_type))

      let folderBaseName = `${dateYmd}_${patientSafeName}_${procSafeLabel}`
      let folderName = folderBaseName
      let counter = 2
      while (usedFileNames.has(folderName)) {
        folderName = `${folderBaseName}_${counter}`
        counter++
      }
      usedFileNames.add(folderName)

      const pdfFileName = `${folderName}.pdf`
      const pdfFilePath = `${folderName}/${pdfFileName}`

      // 1. Gerar PDF binário
      const pdfBytes = generateFormPdfBytes(form, settings)
      const formDate = form.signed_at ? new Date(form.signed_at) : new Date(form.created)

      zipEntries.push({
        name: pdfFilePath,
        data: pdfBytes,
        date: formDate,
      })

      // 2. Trilha de auditoria legível (.txt)
      const audits = auditEventsByFormId.get(form.id) || []
      const auditLines: string[] = [
        '================================================================================',
        'TRILHA DE AUDITORIA DIGITAL — ANDRESA SOUZA CLINIC',
        '================================================================================',
        `Paciente: ${form.patient_name || 'Não informado'}`,
        `CPF: ${form.patient_cpf || 'Não informado'}`,
        `Procedimento: ${getProcedureLabel(form.form_type)}`,
        `Data e Hora da Assinatura: ${form.signed_at || 'Não assinada'}`,
        `Hash SHA-256 do Documento: ${form.document_hash || 'SHA-256'}`,
        `E-mail do Paciente: ${form.patient_email || 'Não informado'}`,
        `Telefone: ${form.patient_phone || 'Não informado'}`,
        `Status Atual: ${form.status}`,
        '--------------------------------------------------------------------------------',
        'REGISTROS CRONOLÓGICOS DE EVENTOS:',
        '--------------------------------------------------------------------------------',
      ]

      if (audits.length === 0) {
        auditLines.push('(Nenhum evento adicional registrado)')
      } else {
        audits.forEach((a, idx) => {
          auditLines.push(`[${idx + 1}] Data/Hora: ${a.timestamp || a.created}`)
          auditLines.push(`    Tipo: ${a.event_type} | Etapa: ${a.step_number || '-'}`)
          auditLines.push(`    Descrição: ${a.description}`)
          if (a.ip_address) auditLines.push(`    IP: ${a.ip_address}`)
          if (a.user_agent) auditLines.push(`    Navegador/Dispositivo: ${a.user_agent}`)
          if (a.previous_hash) auditLines.push(`    Hash Precedente: ${a.previous_hash}`)
          if (a.chain_hash) auditLines.push(`    Hash do Elo (Chain Hash): ${a.chain_hash}`)
          if (a.metadata && Object.keys(a.metadata).length > 0) {
            auditLines.push(`    Metadados: ${JSON.stringify(a.metadata)}`)
          }
          auditLines.push('')
        })
      }
      auditLines.push(
        '================================================================================',
      )
      auditLines.push('Registro de auditoria. Não pode ser alterado.')
      auditLines.push(
        '================================================================================',
      )

      const auditTxtPath = `${folderName}/trilha-auditoria.txt`
      zipEntries.push({
        name: auditTxtPath,
        data: auditLines.join('\r\n'),
        date: formDate,
      })

      // 3. Trilha de auditoria estruturada (.json)
      const auditJsonData = {
        paciente: form.patient_name,
        cpf: form.patient_cpf,
        email: form.patient_email,
        procedimento: getProcedureLabel(form.form_type),
        data_assinatura: form.signed_at,
        hash_documento: form.document_hash,
        status: form.status,
        eventos_auditoria: audits.map((a) => ({
          id: a.id,
          event_type: a.event_type,
          description: a.description,
          step_number: a.step_number,
          ip_address: a.ip_address,
          user_agent: a.user_agent,
          metadata: a.metadata,
          timestamp: a.timestamp,
          previous_hash: a.previous_hash || null,
          chain_hash: a.chain_hash || null,
          created: a.created,
        })),
      }
      const auditJsonPath = `${folderName}/trilha-auditoria.json`
      zipEntries.push({
        name: auditJsonPath,
        data: JSON.stringify(auditJsonData, null, 2),
        date: formDate,
      })

      // 4. Registro da assinatura e termo (.json)
      const signatureRecordData = {
        paciente: {
          nome: form.patient_name,
          cpf: form.patient_cpf,
          email: form.patient_email,
          telefone: form.patient_phone,
          data_nascimento: form.patient_birth_date,
          rg: form.patient_rg,
          endereco: form.patient_address,
          profissao: form.patient_profession,
          contato_emergencia: form.patient_emergency_contact,
        },
        termo: {
          titulo: form.accepted_term_title,
          texto: form.accepted_term_text,
        },
        assinatura: {
          data_hora: form.signed_at,
          ip: form.ip_address,
          navegador: form.user_agent,
          hash_documento: form.document_hash,
          tem_imagem_assinatura: !!form.signature_data,
        },
        respostas_anamnese: form.answers,
      }
      const signatureRecordPath = `${folderName}/registro-assinatura.json`
      zipEntries.push({
        name: signatureRecordPath,
        data: JSON.stringify(signatureRecordData, null, 2),
        date: formDate,
      })

      manifestItems.push({
        paciente: form.patient_name,
        cpf: form.patient_cpf,
        procedimento: getProcedureLabel(form.form_type),
        data_assinatura: form.signed_at,
        hash_documento: form.document_hash,
        pasta: folderName,
        arquivos: [
          pdfFileName,
          'trilha-auditoria.txt',
          'trilha-auditoria.json',
          'registro-assinatura.json',
        ],
      })

      // Linha CSV: paciente, CPF, procedimento, data do procedimento, data da assinatura, hash do documento, arquivo PDF e pasta
      const csvLine = [
        escapeCsv(form.patient_name || 'Não informado'),
        escapeCsv(form.patient_cpf || 'Não informado'),
        escapeCsv(getProcedureLabel(form.form_type)),
        escapeCsv(appt?.procedure_date || dateYmd),
        escapeCsv(form.signed_at || form.created),
        escapeCsv(form.document_hash || 'SHA-256'),
        escapeCsv(pdfFileName),
        escapeCsv(folderName),
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

    // Adiciona o CSV e o Manifesto com Hash no zip
    zipEntries.push({
      name: 'relatorio_fichas_assinadas.csv',
      data: csvRows.join('\r\n'),
      date: new Date(),
    })

    const manifestData = {
      gerado_em: new Date().toISOString(),
      clinica: settings?.clinic_name || 'Andresa Souza Clinic',
      cnpj: settings?.clinic_cnpj || '45.123.789/0001-90',
      responsavel_tecnica: settings?.technical_responsible || 'Dra. Andresa Souza',
      total_fichas: total,
      pacotes_por_ficha: manifestItems,
    }
    zipEntries.push({
      name: 'manifesto_backup.json',
      data: JSON.stringify(manifestData, null, 2),
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
