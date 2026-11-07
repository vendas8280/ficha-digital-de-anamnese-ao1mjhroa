import React, { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Copy, Check, MessageCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formsService, appointmentsService } from '@/services/forms'
import type { FormType } from '@/types/form'
import { buildWhatsAppLinkUrl } from './dashboardHelpers'

interface GenerateLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export const GenerateLinkDialog: React.FC<GenerateLinkDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [newFormType, setNewFormType] = useState<FormType>('geral')
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [createdLinkUrl, setCreatedLinkUrl] = useState<string | null>(null)
  const [copiedModal, setCopiedModal] = useState(false)

  // Agendamento opcional
  const [showScheduling, setShowScheduling] = useState(false)
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [notifyPatient, setNotifyPatient] = useState(true)

  const resetAll = () => {
    setCreatedLinkUrl(null)
    setNewPatientName('')
    setNewPatientPhone('')
    setShowScheduling(false)
    setSchedDate('')
    setSchedTime('')
    setNotifyPatient(true)
    setCopiedModal(false)
  }

  const formatSchedDateBR = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
  }

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (showScheduling && (schedDate.trim() || schedTime.trim())) {
      if (!schedDate.trim() || !schedTime.trim()) {
        toast({
          title: 'Agendamento incompleto',
          description: 'Preencha data e hora do procedimento, ou deixe os dois em branco.',
          variant: 'destructive',
        })
        return
      }
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      if (schedDate.trim() < todayStr) {
        toast({
          title: 'Data inválida',
          description: 'A data do procedimento não pode ser no passado.',
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
        description: 'Válido por 7 dias. Você já pode enviar para o paciente.',
      })
      onSuccess()
    } catch {
      toast({
        title: 'Erro ao criar link',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCreatingLink(false)
    }
  }

  const copyCreatedLink = () => {
    if (!createdLinkUrl) return
    navigator.clipboard.writeText(createdLinkUrl)
    setCopiedModal(true)
    toast({
      title: 'Link copiado!',
      description: 'Pronto para colar no WhatsApp ou enviar por e-mail.',
    })
    setTimeout(() => setCopiedModal(false), 2500)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) resetAll()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Gerar Link de Ficha de Anamnese</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            O link gerado tem validade de 7 dias e expira assim que o paciente assinar.
          </DialogDescription>
        </DialogHeader>

        {!createdLinkUrl ? (
          <form onSubmit={handleCreateLink} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tipo" className="text-xs font-semibold text-slate-800">
                Tipo de Ficha / Procedimento *
              </Label>
              <Select value={newFormType} onValueChange={(val) => setNewFormType(val as FormType)}>
                <SelectTrigger id="tipo" className="text-xs">
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral" className="text-xs">
                    Anamnese Geral (Faciais e Corporais)
                  </SelectItem>
                  <SelectItem value="labios" className="text-xs">
                    Lábios & Micropigmentação Labial
                  </SelectItem>
                  <SelectItem value="botox" className="text-xs">
                    Toxina Botulínica (Botox)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold text-slate-800">
                Nome do Paciente (opcional)
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Maria Eduarda Silva"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tel" className="text-xs font-semibold text-slate-800">
                WhatsApp / Telefone (opcional)
              </Label>
              <Input
                id="tel"
                placeholder="Ex: (79) 99809-1314"
                value={newPatientPhone}
                onChange={(e) => setNewPatientPhone(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Seção opcional de agendamento */}
            <div className="border border-purple-100 rounded-lg p-3 bg-purple-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label
                    htmlFor="toggle-sched"
                    className="text-xs font-semibold text-[#6B3FA0] cursor-pointer"
                  >
                    Agendar procedimento junto
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    Cria o agendamento e programa lembretes automáticos
                  </p>
                </div>
                <Switch
                  id="toggle-sched"
                  checked={showScheduling}
                  onCheckedChange={(checked) => {
                    setShowScheduling(checked)
                    if (!checked) {
                      setSchedDate('')
                      setSchedTime('')
                    }
                  }}
                />
              </div>

              {showScheduling && (
                <div className="space-y-2.5 pt-2 border-t border-purple-100">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label
                        htmlFor="sched-date"
                        className="text-[11px] font-medium text-slate-700"
                      >
                        Data *
                      </Label>
                      <Input
                        id="sched-date"
                        type="date"
                        value={schedDate}
                        onChange={(e) => setSchedDate(e.target.value)}
                        className="text-xs h-8 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="sched-time"
                        className="text-[11px] font-medium text-slate-700"
                      >
                        Horário *
                      </Label>
                      <Input
                        id="sched-time"
                        type="time"
                        value={schedTime}
                        onChange={(e) => setSchedTime(e.target.value)}
                        className="text-xs h-8 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-600">
                      Disparar lembrete de 24h e 2h por e-mail
                    </span>
                    <Switch
                      id="notify-sched"
                      checked={notifyPatient}
                      onCheckedChange={setNotifyPatient}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  resetAll()
                }}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creatingLink}
                className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5"
              >
                {creatingLink ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  'Gerar Link'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs">
              <p className="font-semibold mb-1">Link criado com sucesso!</p>
              <p className="text-[11px] text-emerald-800">
                Envie para a paciente preencher no celular ou computador.
              </p>
              {showScheduling && schedDate && (
                <p className="text-[11px] text-emerald-800 mt-1 font-medium">
                  Procedimento agendado para {formatSchedDateBR(schedDate)}
                  {schedTime ? ` às ${schedTime}` : ''}.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-800">Link de acesso direto:</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={createdLinkUrl} className="text-xs bg-slate-50 font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyCreatedLink}
                  className="shrink-0"
                >
                  {copiedModal ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {newPatientPhone && (
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="w-full text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <a
                    href={buildWhatsAppLinkUrl(newPatientPhone, newPatientName, createdLinkUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar link via WhatsApp
                  </a>
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  resetAll()
                  onOpenChange(false)
                }}
                className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs"
              >
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
