import { useState, FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { FormType } from '@/types/form'
import { formsService, appointmentsService } from '@/services/forms'
import { useToast } from '@/hooks/use-toast'

interface NewAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  // Quando aberto pela Agenda, a data ou agendamento pode vir pré-selecionado como obrigatório ou aberto
  defaultSchedulingOpen?: boolean
  defaultDate?: string
  title?: string
  description?: string
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultSchedulingOpen = false,
  defaultDate = '',
  title = 'Novo Agendamento & Ficha Digital',
  description = 'Gere o link seguro da ficha e, se desejar, agende o procedimento para ativar os lembretes automáticos.',
}: NewAppointmentDialogProps) {
  const { toast } = useToast()

  const [newFormType, setNewFormType] = useState<FormType>('geral')
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Agendamento opcional / ativo
  const [showScheduling, setShowScheduling] = useState(defaultSchedulingOpen)
  const [schedDate, setSchedDate] = useState(defaultDate)
  const [schedTime, setSchedTime] = useState('')
  const [notifyPatient, setNotifyPatient] = useState(true)

  const formatSchedDateBR = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
  }

  const handleClose = (openState: boolean) => {
    if (!openState) {
      setCreatedLinkUrl(null)
      setCopiedLink(false)
      setNewPatientName('')
      setNewPatientPhone('')
      setNewFormType('geral')
      setSchedDate(defaultDate)
      setSchedTime('')
      setShowScheduling(defaultSchedulingOpen)
      setNotifyPatient(true)
    }
    onOpenChange(openState)
  }

  const handleCreateLink = async (e: FormEvent) => {
    e.preventDefault()

    // Validação se ativou agendamento
    if (showScheduling && (schedDate.trim() || schedTime.trim())) {
      if (!schedDate.trim() || !schedTime.trim()) {
        toast({
          title: 'Agendamento incompleto',
          description: 'Preencha data e hora do procedimento, ou deixe os dois em branco.',
          variant: 'destructive',
        })
        return
      }
    }

    setCreatingLink(true)
    try {
      const created = await formsService.createLink(
        newFormType,
        newPatientName.trim() || undefined,
        newPatientPhone.trim() || undefined,
      )

      if (showScheduling && schedDate.trim()) {
        try {
          await appointmentsService.createAppointment({
            form_submission: created.id,
            patient_name: newPatientName.trim() || undefined,
            patient_phone: newPatientPhone.trim() || undefined,
            procedure_date: schedDate,
            procedure_time: schedTime.trim() || undefined,
            procedure: newFormType,
            notify_patient: notifyPatient,
            notify_clinic: false,
          })
        } catch (err) {
          console.warn('Falha ao salvar agendamento:', err)
          toast({
            title: 'Ficha criada, mas o agendamento não foi salvo',
            description: 'A ficha foi gerada normalmente. Tente cadastrar o agendamento novamente.',
            variant: 'destructive',
          })
        }
      }

      const url = `${window.location.origin}/f/${created.token}`
      setCreatedLinkUrl(url)
      toast({
        title: 'Link gerado com sucesso!',
        description: 'Válido por 7 dias. Você já pode enviar para a paciente.',
      })
      onSuccess?.()
    } catch {
      toast({
        title: 'Erro ao criar agendamento',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCreatingLink(false)
    }
  }

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    toast({
      title: 'Link copiado!',
      description: 'Pronto para colar no WhatsApp ou enviar por e-mail.',
    })
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#6B3FA0]" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">{description}</DialogDescription>
        </DialogHeader>

        {!createdLinkUrl ? (
          <form onSubmit={handleCreateLink} className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="formType" className="text-xs font-semibold text-slate-800">
                Procedimento
              </Label>
              <Select value={newFormType} onValueChange={(val: FormType) => setNewFormType(val)}>
                <SelectTrigger id="formType" className="text-xs">
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral" className="text-xs">
                    Anamnese Geral (Estética Avançada)
                  </SelectItem>
                  <SelectItem value="labios" className="text-xs">
                    Micropigmentação Labial
                  </SelectItem>
                  <SelectItem value="botox" className="text-xs">
                    Toxina Botulínica (Botox)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nomePac" className="text-xs font-semibold text-slate-800">
                Nome da Paciente (opcional)
              </Label>
              <Input
                id="nomePac"
                placeholder="Ex: Maria Silva Santos"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telPac" className="text-xs font-semibold text-slate-800">
                WhatsApp da Paciente (opcional)
              </Label>
              <Input
                id="telPac"
                placeholder="(79) 99000-0000"
                value={newPatientPhone}
                onChange={(e) => setNewPatientPhone(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Seção Agendamento do procedimento */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <button
                type="button"
                onClick={() => setShowScheduling((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#6B3FA0]" />
                  <span className="text-xs font-semibold text-slate-800">
                    Agendamento do procedimento
                  </span>
                  <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-500">
                    opcional
                  </Badge>
                </span>
                <span className="text-[10px] font-medium text-[#6B3FA0]">
                  {showScheduling ? 'Ocultar' : 'Preencher'}
                </span>
              </button>

              {showScheduling && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="schedData" className="text-xs font-semibold">
                        Data do procedimento
                      </Label>
                      <Input
                        id="schedData"
                        type="date"
                        value={schedDate}
                        onChange={(e) => setSchedDate(e.target.value)}
                        className="text-xs"
                      />
                      {schedDate && (
                        <p className="text-[10px] text-slate-500">{formatSchedDateBR(schedDate)}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="schedHora" className="text-xs font-semibold">
                        Hora do procedimento
                      </Label>
                      <Input
                        id="schedHora"
                        type="time"
                        value={schedTime}
                        onChange={(e) => setSchedTime(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Label
                      htmlFor="lembrarPaciente"
                      className="text-xs font-medium text-slate-700 cursor-pointer"
                    >
                      Enviar lembrete à paciente
                    </Label>
                    <Switch
                      id="lembrarPaciente"
                      checked={notifyPatient}
                      onCheckedChange={setNotifyPatient}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={creatingLink}
                className="w-full bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 font-medium"
              >
                {creatingLink ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando agendamento...
                  </>
                ) : (
                  'Criar Agendamento'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 text-[#2E9E5B]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-emerald-950 text-sm">
                Agendamento e Link Criados!
              </h4>
              <p className="text-xs text-emerald-800 mt-1">
                Copie abaixo e envie à paciente por WhatsApp ou e-mail.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={createdLinkUrl}
                className="text-xs font-mono bg-slate-50 select-all"
              />
              <Button
                size="sm"
                onClick={() => copyToClipboard(createdLinkUrl)}
                className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs shrink-0 gap-1.5"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(createdLinkUrl, '_blank')}
                className="text-xs gap-1.5 text-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Testar Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `Olá! Segue o link para preenchimento da sua ficha de anamnese da Andresa Souza Clinic: ${createdLinkUrl}`,
                  )
                  window.open(`https://wa.me/?text=${msg}`, '_blank')
                }}
                className="text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </Button>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleClose(false)}
                className="w-full text-xs text-slate-600"
              >
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
