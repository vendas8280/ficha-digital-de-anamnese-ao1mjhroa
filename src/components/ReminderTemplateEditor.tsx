import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Eye,
  Send,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Save,
  Undo2,
  Check,
  Sparkles,
} from 'lucide-react'
import {
  validateReminderTemplate,
  DEFAULT_REMINDER_SUBJECT_24H,
  DEFAULT_REMINDER_SUBJECT_2H,
  DEFAULT_REMINDER_BODY,
} from '@/lib/reminderTemplates'
import {
  ReminderPreviewModal,
  RestoreTemplateModal,
  FullscreenEditorModal,
} from '@/components/ReminderPreviewModal'

export interface ReminderCardProps {
  kind: '24h' | '2h'
  title: string
  timingBadge: string
  initialSubject: string
  initialBody: string
  defaultSubject: string
  defaultBody: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  isOpen: boolean
  onToggleOpen: () => void
  onSaveCard: (subject: string, body: string) => Promise<boolean>
  onSendTest: (subject: string, body: string) => Promise<void>
  isSaving?: boolean
  sendingTest?: boolean
}

// Chips agrupados conforme o requisito:
// Primeiro {{nome}}, {{data_extenso}}, {{hora}}, depois {{procedimento}}, {{endereco}}, {{telefone}}, {{nome_clinica}}
const PRIMARY_FIELDS = [
  { tag: '{{nome}}', label: 'Nome do paciente' },
  { tag: '{{data_extenso}}', label: 'Data do procedimento' },
  { tag: '{{hora}}', label: 'Horário' },
]

const SECONDARY_FIELDS = [
  { tag: '{{procedimento}}', label: 'Procedimento' },
  { tag: '{{endereco}}', label: 'Endereço da clínica' },
  { tag: '{{telefone}}', label: 'Telefone da clínica' },
  { tag: '{{nome_clinica}}', label: 'Nome da clínica' },
]

export function ReminderCardEditor({
  kind,
  title,
  timingBadge,
  initialSubject,
  initialBody,
  defaultSubject,
  defaultBody,
  clinicName,
  clinicAddress,
  clinicPhone,
  isOpen,
  onToggleOpen,
  onSaveCard,
  onSendTest,
  isSaving = false,
  sendingTest = false,
}: ReminderCardProps) {
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)

  useEffect(() => {
    setSubject(initialSubject)
  }, [initialSubject])

  useEffect(() => {
    setBody(initialBody)
  }, [initialBody])

  const [previewOpen, setPreviewOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [lastInsertedField, setLastInsertedField] = useState<string | null>(null)

  const lastFocusedRef = useRef<'subject' | 'body'>('body')
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const isDirty = subject !== initialSubject || body !== initialBody
  const isDefault = subject === defaultSubject && body === defaultBody
  const validation = validateReminderTemplate(subject, body)

  const subjectLength = subject.length
  const subjectExceeded = subjectLength > 120

  const handleInsertTag = (tag: string) => {
    if (lastFocusedRef.current === 'subject') {
      const el = subjectInputRef.current
      if (el) {
        const start = el.selectionStart ?? subject.length
        const end = el.selectionEnd ?? subject.length
        const newSubject = subject.substring(0, start) + tag + subject.substring(end)
        setSubject(newSubject)
        setTimeout(() => {
          el.focus()
          el.setSelectionRange(start + tag.length, start + tag.length)
        }, 10)
      } else {
        setSubject((prev) => prev + tag)
      }
    } else {
      const el = bodyTextareaRef.current
      if (el) {
        const start = el.selectionStart ?? body.length
        const end = el.selectionEnd ?? body.length
        const newBody = body.substring(0, start) + tag + body.substring(end)
        setBody(newBody)
        setTimeout(() => {
          el.focus()
          el.setSelectionRange(start + tag.length, start + tag.length)
        }, 10)
      } else {
        setBody((prev) => prev + tag)
      }
    }

    setLastInsertedField(tag)
    setTimeout(() => setLastInsertedField(null), 1400)
  }

  const handleDiscard = () => {
    setSubject(initialSubject)
    setBody(initialBody)
  }

  const handleSave = async () => {
    await onSaveCard(subject, body)
  }

  const handleConfirmRestore = () => {
    setSubject(defaultSubject)
    setBody(defaultBody)
    setRestoreModalOpen(false)
  }

  return (
    <div className="bg-white rounded-[12px] border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200">
      {/* Barra de alterações não salvas */}
      {isDirty && (
        <div className="bg-[#EDE7F6] border-b border-[#D1C4E9] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 text-[#4A148C] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#6B3FA0] animate-pulse" />
            <span>Alterações não salvas</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              disabled={isSaving}
              className="h-7 px-2.5 text-xs text-[#6B3FA0] hover:bg-[#D1C4E9]/60 hover:text-[#4A148C] font-medium cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 mr-1" />
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 px-3 text-xs bg-[#6B3FA0] hover:bg-[#593288] text-white font-semibold shadow-sm cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Cabeçalho do Card com Chevron, títulos, selos e assunto atual visível */}
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3FA0]/30 cursor-pointer"
      >
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-[#2B2B33]">{title}</h3>

            {isDefault ? (
              <Badge
                variant="outline"
                className="text-[11px] font-medium text-[#6B6B76] bg-slate-100/90 border-slate-200"
              >
                Padrão
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[11px] font-semibold text-[#6B3FA0] bg-[#EDE7F6] border-[#D1C4E9]"
              >
                Personalizado
              </Badge>
            )}

            <Badge
              variant="outline"
              className="text-[11px] font-medium text-slate-700 bg-slate-50 border-slate-200"
            >
              {timingBadge}
            </Badge>
          </div>

          <p className="text-xs text-[#6B6B76] truncate font-normal">
            <span className="font-semibold text-slate-500">Assunto: </span>
            {subject || defaultSubject}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <span className="text-xs text-[#6B3FA0] font-medium hidden sm:inline">
            {isOpen ? 'Recolher' : 'Editar'}
          </span>
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 hover:text-slate-900">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Conteúdo expandido */}
      {isOpen && (
        <div className="px-5 sm:px-6 pb-6 pt-1 space-y-6 border-t border-slate-100 animate-in fade-in duration-150">
          {!validation.valid && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-900">Atenção ao modelo:</p>
                <p className="text-amber-800">{validation.error}</p>
              </div>
            </div>
          )}

          {/* Assunto */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor={`subject-input-${kind}`}
                className="text-xs font-semibold text-[#2B2B33]"
              >
                Assunto do e-mail *
              </Label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={
                    subjectExceeded ? 'font-bold text-amber-700' : 'text-[#6B6B76] font-medium'
                  }
                >
                  {subjectLength}/120
                </span>
                {subjectExceeded && (
                  <span className="text-amber-700 font-medium">
                    (recomendado até 120 para melhor leitura)
                  </span>
                )}
              </div>
            </div>
            <Input
              id={`subject-input-${kind}`}
              ref={subjectInputRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => {
                lastFocusedRef.current = 'subject'
              }}
              placeholder={defaultSubject}
              className={`text-xs bg-white border-slate-200 focus-visible:ring-[#6B3FA0] ${
                subjectExceeded ? 'border-amber-300 focus-visible:ring-amber-500' : ''
              }`}
            />
          </div>

          {/* Corpo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`body-input-${kind}`}
                  className="text-xs font-semibold text-[#2B2B33]"
                >
                  Corpo do e-mail *
                </Label>
                <span className="text-[11px] text-[#6B6B76]">
                  (obrigatório conter {'{{nome}}'} e {'{{hora}}'})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFullscreenOpen(true)}
                className="h-7 px-2 text-xs text-[#6B3FA0] hover:text-[#4A148C] hover:bg-[#EDE7F6] gap-1 font-medium cursor-pointer"
                title="Expandir editor em tela cheia"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Expandir
              </Button>
            </div>

            <Textarea
              id={`body-input-${kind}`}
              ref={bodyTextareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => {
                lastFocusedRef.current = 'body'
              }}
              placeholder={defaultBody}
              className="text-xs leading-relaxed bg-white border-slate-200 focus-visible:ring-[#6B3FA0] min-h-[260px] max-h-[600px] font-sans resize-y"
            />
          </div>

          {/* Chips como botões reais */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2B2B33]">
                <Sparkles className="w-3.5 h-3.5 text-[#6B3FA0]" />
                <span>Campos disponíveis para substituição automática</span>
              </div>
              <p className="text-[11px] text-[#6B6B76] font-medium">
                Clique para inserir no ponto do cursor.
              </p>
            </div>

            {/* Grupo 1: principais */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#6B6B76]">
                Dados do paciente e horário
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRIMARY_FIELDS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-[#EDE7F6] text-[#4A148C] border border-[#D1C4E9] hover:bg-[#D1C4E9] hover:border-[#B39DDB] active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                    title={`Inserir ${item.tag} (${item.label})`}
                  >
                    <span>{item.tag}</span>
                    {lastInsertedField === item.tag && (
                      <Check className="w-3 h-3 text-emerald-700 animate-in zoom-in-50" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Grupo 2: clínica e procedimento */}
            <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#6B6B76]">
                Dados do procedimento e da clínica
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SECONDARY_FIELDS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTag(item.tag)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-[#EDE7F6] text-[#4A148C] border border-[#D1C4E9] hover:bg-[#D1C4E9] hover:border-[#B39DDB] active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                    title={`Inserir ${item.tag} (${item.label})`}
                  >
                    <span>{item.tag}</span>
                    {lastInsertedField === item.tag && (
                      <Check className="w-3 h-3 text-emerald-700 animate-in zoom-in-50" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé de Ações do Card */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => setRestoreModalOpen(true)}
                className="text-xs text-[#6B6B76] hover:text-[#2B2B33] underline underline-offset-4 font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar texto padrão
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                className="text-xs h-9 px-3.5 gap-1.5 text-[#6B3FA0] border-[#6B3FA0] hover:bg-[#EDE7F6] hover:text-[#4A148C] font-semibold cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Ver prévia
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => onSendTest(subject, body)}
                disabled={sendingTest}
                className="text-xs h-9 px-4 gap-1.5 bg-[#6B3FA0] hover:bg-[#593288] text-white font-semibold shadow-sm cursor-pointer"
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando teste...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Enviar teste para mim
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modais extraídos para manter o componente cirúrgico */}
      <RestoreTemplateModal
        open={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        title={title}
        defaultSubject={defaultSubject}
        onConfirm={handleConfirmRestore}
      />

      <FullscreenEditorModal
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        title={title}
        subject={subject}
        body={body}
        onSubjectChange={setSubject}
        onBodyChange={setBody}
        onInsertTag={handleInsertTag}
        primaryFields={PRIMARY_FIELDS}
        secondaryFields={SECONDARY_FIELDS}
      />

      <ReminderPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={title}
        subject={subject}
        body={body}
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
        clinicName={clinicName}
        clinicAddress={clinicAddress}
        clinicPhone={clinicPhone}
      />
    </div>
  )
}

export interface ReminderTemplateEditorSectionProps {
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  notificationEmail?: string
  reminderSubject24h: string
  reminderBody24h: string
  reminderSubject2h: string
  reminderBody2h: string
  onSaveCard24h: (subject: string, body: string) => Promise<boolean>
  onSaveCard2h: (subject: string, body: string) => Promise<boolean>
  onSendTest24h: (subject: string, body: string) => Promise<void>
  onSendTest2h: (subject: string, body: string) => Promise<void>
  saving24h?: boolean
  saving2h?: boolean
  sendingTest24h?: boolean
  sendingTest2h?: boolean
}

export function ReminderTemplateEditor({
  clinicName,
  clinicAddress,
  clinicPhone,
  reminderSubject24h,
  reminderBody24h,
  reminderSubject2h,
  reminderBody2h,
  onSaveCard24h,
  onSaveCard2h,
  onSendTest24h,
  onSendTest2h,
  saving24h = false,
  saving2h = false,
  sendingTest24h = false,
  sendingTest2h = false,
}: ReminderTemplateEditorSectionProps) {
  // Padrão: 24h aberto, 2h recolhido — a tela não mostra dois editores ao mesmo tempo.
  const [openCard, setOpenCard] = useState<'24h' | '2h' | null>('24h')

  return (
    <div className="space-y-4">
      {/* Card 1: Lembrete de 24 horas */}
      <ReminderCardEditor
        kind="24h"
        title="Lembrete de 24 horas"
        timingBadge="Enviado na véspera"
        initialSubject={reminderSubject24h}
        initialBody={reminderBody24h}
        defaultSubject={DEFAULT_REMINDER_SUBJECT_24H}
        defaultBody={DEFAULT_REMINDER_BODY}
        clinicName={clinicName}
        clinicAddress={clinicAddress}
        clinicPhone={clinicPhone}
        isOpen={openCard === '24h'}
        onToggleOpen={() => setOpenCard((prev) => (prev === '24h' ? null : '24h'))}
        onSaveCard={onSaveCard24h}
        onSendTest={onSendTest24h}
        isSaving={saving24h}
        sendingTest={sendingTest24h}
      />

      {/* Card 2: Lembrete de 2 horas */}
      <ReminderCardEditor
        kind="2h"
        title="Lembrete de 2 horas"
        timingBadge="Enviado no dia"
        initialSubject={reminderSubject2h}
        initialBody={reminderBody2h}
        defaultSubject={DEFAULT_REMINDER_SUBJECT_2H}
        defaultBody={DEFAULT_REMINDER_BODY}
        clinicName={clinicName}
        clinicAddress={clinicAddress}
        clinicPhone={clinicPhone}
        isOpen={openCard === '2h'}
        onToggleOpen={() => setOpenCard((prev) => (prev === '2h' ? null : '2h'))}
        onSaveCard={onSaveCard2h}
        onSendTest={onSendTest2h}
        isSaving={saving2h}
        sendingTest={sendingTest2h}
      />
    </div>
  )
}
