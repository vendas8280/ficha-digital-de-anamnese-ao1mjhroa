import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Eye,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Code2,
  RotateCcw,
  Minimize2,
} from 'lucide-react'
import {
  SampleTemplateData,
  getDefaultSampleData,
  renderReminderPreview,
} from '@/lib/reminderTemplates'

export interface ReminderPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subject: string
  body: string
  defaultSubject: string
  defaultBody: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
}

export function ReminderPreviewModal({
  open,
  onOpenChange,
  title,
  subject,
  body,
  defaultSubject,
  defaultBody,
  clinicName,
  clinicAddress,
  clinicPhone,
}: ReminderPreviewModalProps) {
  const [previewMode, setPreviewMode] = useState<'patient' | 'code'>('patient')

  const sampleData: SampleTemplateData = getDefaultSampleData(
    clinicName,
    clinicAddress,
    clinicPhone,
  )
  const previewSubject = renderReminderPreview(subject || defaultSubject, sampleData)
  const previewBody = renderReminderPreview(body || defaultBody, sampleData)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-bold text-[#2B2B33] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#6B3FA0]" />
                Prévia do E-mail — {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B76]">
                Confira o layout final exatamente como chega à caixa da paciente.
              </DialogDescription>
            </div>

            {/* Alternância entre as duas visões */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewMode('patient')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  previewMode === 'patient'
                    ? 'bg-white text-[#6B3FA0] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Como a paciente vê
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('code')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                  previewMode === 'code'
                    ? 'bg-white text-[#6B3FA0] shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3 h-3" />
                Código com os campos preenchidos
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-3">
          {/* Cabeçalho do Remetente e Destinatário */}
          <div className="bg-[#F7F7FA] border border-slate-200/90 rounded-xl p-3.5 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="font-semibold text-slate-500 w-12">De:</span>
              <span className="font-mono text-slate-800">
                Lembrete - {clinicName} &lt;ficha@andresasouza.com.br&gt;
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="font-semibold text-slate-500 w-12">Para:</span>
              <span className="text-slate-800">
                Maria Clara Oliveira &lt;maria.exemplo@gmail.com&gt;
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 pt-0.5 border-t border-slate-200/60">
              <span className="font-semibold text-slate-500 w-12">Assunto:</span>
              <span className="font-bold text-[#2B2B33]">{previewSubject}</span>
            </div>
          </div>

          {/* Visão 1: Como a paciente vê */}
          {previewMode === 'patient' && (
            <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
              {/* Topo do e-mail da clínica */}
              <div className="bg-[#6B3FA0] p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#EDE7F6]" />
                  <span className="font-bold text-sm tracking-wide">{clinicName}</span>
                </div>
                <Badge className="bg-white/15 text-white hover:bg-white/20 border-transparent text-[10px]">
                  Lembrete Oficial
                </Badge>
              </div>

              <div className="p-6 space-y-5">
                {/* Corpo do texto */}
                <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                  {previewBody}
                </div>

                {/* Card estilizado de dados do procedimento */}
                <div className="bg-[#F7F7FA] border border-[#D1C4E9]/60 rounded-xl p-4 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B3FA0]">
                    Resumo do Procedimento
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#6B3FA0] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-[#6B6B76]">Procedimento</p>
                        <p className="font-semibold text-slate-900">{sampleData.procedimento}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[#6B3FA0] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-[#6B6B76]">Data</p>
                        <p className="font-semibold text-slate-900">{sampleData.data_extenso}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#6B3FA0] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-[#6B6B76]">Horário</p>
                        <p className="font-semibold text-slate-900">{sampleData.hora}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6B3FA0] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[11px] text-[#6B6B76]">Local</p>
                        <p className="font-semibold text-slate-900">{sampleData.endereco}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[#6B6B76] border-t border-slate-100 pt-3">
                  Em caso de dúvidas ou necessidade de reagendamento, entre em contato pelo telefone{' '}
                  <span className="font-semibold text-slate-800">{sampleData.telefone}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Visão 2: Código com os campos preenchidos */}
          {previewMode === 'code' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">Assunto após substituição:</p>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {previewSubject}
                </pre>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  Corpo do e-mail após substituição de todas as variáveis:
                </p>
                <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[350px]">
                  {previewBody}
                </pre>
              </div>

              <div className="p-3 bg-[#EDE7F6] border border-[#D1C4E9] rounded-lg text-xs text-[#4A148C]">
                <p className="font-semibold">Mapeamento de variáveis nesta prévia:</p>
                <ul className="mt-1 list-disc list-inside space-y-0.5 font-mono text-[11px]">
                  <li>
                    {`{{nome}}`} → {sampleData.nome}
                  </li>
                  <li>
                    {`{{procedimento}}`} → {sampleData.procedimento}
                  </li>
                  <li>
                    {`{{data_extenso}}`} → {sampleData.data_extenso}
                  </li>
                  <li>
                    {`{{hora}}`} → {sampleData.hora}
                  </li>
                  <li>
                    {`{{endereco}}`} → {sampleData.endereco}
                  </li>
                  <li>
                    {`{{telefone}}`} → {sampleData.telefone}
                  </li>
                  <li>
                    {`{{nome_clinica}}`} → {sampleData.nome_clinica}
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar prévia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface RestoreTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  defaultSubject: string
  onConfirm: () => void
}

export function RestoreTemplateModal({
  open,
  onOpenChange,
  title,
  defaultSubject,
  onConfirm,
}: RestoreTemplateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-[#2B2B33] flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[#6B3FA0]" />
            Restaurar texto padrão ({title})?
          </DialogTitle>
          <DialogDescription className="text-xs text-[#6B6B76] pt-1">
            Esta ação substituirá o assunto e o corpo atuais pelo modelo padrão oficial da clínica.
            Você ainda poderá revisar antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-slate-900">Novo assunto padrão:</p>
          <p className="font-mono text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
            {defaultSubject}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            className="text-xs bg-[#6B3FA0] hover:bg-[#593288] text-white font-semibold"
          >
            Confirmar restauração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface FullscreenEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subject: string
  body: string
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
  onInsertTag: (tag: string) => void
  primaryFields: Array<{ tag: string; label: string }>
  secondaryFields: Array<{ tag: string; label: string }>
}

export function FullscreenEditorModal({
  open,
  onOpenChange,
  title,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onInsertTag,
  primaryFields,
  secondaryFields,
}: FullscreenEditorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-bold text-[#2B2B33]">
                Editor em tela cheia — {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B76]">
                Edite com amplo espaço e insira variáveis diretamente.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs gap-1"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Fechar tela cheia
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 py-3 min-h-0">
          {/* Barra de inserção rápida em tela cheia */}
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 mr-1">Inserir:</span>
            {[...primaryFields, ...secondaryFields].map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => onInsertTag(item.tag)}
                className="px-2 py-0.5 rounded text-xs font-mono bg-[#EDE7F6] text-[#4A148C] border border-[#D1C4E9] hover:bg-[#D1C4E9] transition-colors cursor-pointer"
              >
                {item.tag}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#2B2B33]">Assunto</label>
            <input
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2"
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0 space-y-1">
            <label className="text-xs font-semibold text-[#2B2B33]">Corpo da mensagem</label>
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="flex-1 text-xs font-sans leading-relaxed resize-none bg-white p-3 border border-slate-200 rounded-md"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
          <p className="text-[11px] text-[#6B6B76]">
            As alterações feitas aqui refletem automaticamente no card.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs bg-[#6B3FA0] hover:bg-[#593288] text-white font-semibold"
          >
            Concluir edição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
