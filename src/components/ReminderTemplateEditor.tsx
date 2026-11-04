import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Eye, Send, RotateCcw, Loader2, AlertCircle, HelpCircle, Check } from 'lucide-react'
import {
  ALLOWED_TEMPLATE_FIELDS,
  getDefaultSampleData,
  renderReminderPreview,
  validateReminderTemplate,
} from '@/lib/reminderTemplates'

interface ReminderTemplateEditorProps {
  kind: '24h' | '2h'
  title: string
  description: string
  subject: string
  body: string
  defaultSubject: string
  defaultBody: string
  clinicName: string
  clinicAddress: string
  clinicPhone: string
  notificationEmail: string
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
  onResetToDefault: () => void
  onSendTest: () => Promise<void>
  sendingTest: boolean
}

export function ReminderTemplateEditor({
  kind,
  title,
  description,
  subject,
  body,
  defaultSubject,
  defaultBody,
  clinicName,
  clinicAddress,
  clinicPhone,
  notificationEmail,
  onSubjectChange,
  onBodyChange,
  onResetToDefault,
  onSendTest,
  sendingTest,
}: ReminderTemplateEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const sampleData = getDefaultSampleData(clinicName, clinicAddress, clinicPhone)
  const previewSubject = renderReminderPreview(subject || defaultSubject, sampleData)
  const previewBody = renderReminderPreview(body || defaultBody, sampleData)

  const validation = validateReminderTemplate(subject, body)

  const handleInsertField = (field: string) => {
    onBodyChange(
      (body || '') + (body && !body.endsWith(' ') && !body.endsWith('\n') ? ' ' : '') + field,
    )
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/40 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold text-rose-800 border-rose-200 bg-rose-50"
            >
              {kind}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="text-xs h-8 gap-1.5 bg-white hover:bg-slate-50 text-slate-700"
          >
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            Ver prévia
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSendTest}
            disabled={sendingTest}
            className="text-xs h-8 gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border-rose-200 hover:text-rose-900"
          >
            {sendingTest ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-800" />
            ) : (
              <Send className="w-3.5 h-3.5 text-rose-800" />
            )}
            Enviar teste para mim
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetToDefault}
            className="text-xs h-8 gap-1 text-slate-500 hover:text-slate-800"
            title="Restaurar assunto e corpo originais recomendados"
          >
            <RotateCcw className="w-3 h-3 mr-0.5" />
            Restaurar texto padrão
          </Button>
        </div>
      </div>

      {!validation.valid && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Atenção ao modelo:</p>
            <p>{validation.error}</p>
          </div>
        </div>
      )}

      {/* Editor de Assunto */}
      <div className="space-y-1.5">
        <Label htmlFor={`subject-${kind}`} className="text-xs font-semibold text-slate-700">
          Assunto do e-mail *
        </Label>
        <Input
          id={`subject-${kind}`}
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder={defaultSubject}
          className="text-xs bg-white"
        />
      </div>

      {/* Editor de Corpo */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={`body-${kind}`} className="text-xs font-semibold text-slate-700">
            Corpo da mensagem (multi-linha) *
          </Label>
          <span className="text-[11px] text-muted-foreground">
            Obrigatório conter {'{{nome}}'} e {'{{hora}}'}
          </span>
        </div>
        <Textarea
          id={`body-${kind}`}
          rows={9}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={defaultBody}
          className="text-xs font-mono bg-white leading-relaxed resize-y"
        />
      </div>

      {/* Lista de tags disponíveis */}
      <div className="bg-white border border-slate-200 rounded-md p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Campos disponíveis para substituição automática:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALLOWED_TEMPLATE_FIELDS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => handleInsertField(f)}
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-900 border border-slate-200 hover:border-rose-300 text-slate-800 transition-colors flex items-center gap-1"
              title={`Clique para inserir ${f} no corpo`}
            >
              {f}
              {copiedField === f && <Check className="w-3 h-3 text-emerald-600" />}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Clique no campo para inseri-lo no final do corpo. Na hora do envio, os campos entre chaves
          duplas serão substituídos automaticamente pelos dados do paciente e da clínica.
        </p>
      </div>

      {/* Modal de Prévia */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-rose-800" />
              Prévia do Lembrete ({kind})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Veja exatamente como a paciente receberá o e-mail em sua caixa de entrada, com dados
              de exemplo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-xs space-y-1">
              <p>
                <strong className="text-slate-700">De:</strong> Lembrete - {clinicName}{' '}
                &lt;ficha@andresasouza.com.br&gt;
              </p>
              <p>
                <strong className="text-slate-700">Para:</strong> Maria Clara Oliveira
                &lt;maria.exemplo@gmail.com&gt;
              </p>
              <p>
                <strong className="text-slate-700">Assunto:</strong>{' '}
                <span className="font-semibold text-rose-900">{previewSubject}</span>
              </p>
            </div>

            {/* Layout de e-mail estilizado idêntico ao entregue via Resend */}
            <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-sm font-sans space-y-4 text-sm text-slate-800">
              <div className="border-b-2 border-rose-900 pb-3">
                <h2 className="m-0 text-rose-900 font-bold text-lg">{clinicName}</h2>
              </div>

              <div className="space-y-3 leading-relaxed whitespace-pre-line text-slate-700 text-xs sm:text-sm">
                {previewBody}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setPreviewOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
