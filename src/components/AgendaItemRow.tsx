import { useState, useMemo } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MoreVertical,
  MessageCircle,
  RefreshCw,
  Send,
  CalendarClock,
  XCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
} from 'lucide-react'
import { formatPhone } from '@/lib/formatters'
import { formsService, appointmentsService } from '@/services/forms'
import { useToast } from '@/hooks/use-toast'
import {
  AgendaItem,
  getProcedureLabel,
  getAgendaReminderText,
  getAgendaReminderColorClass,
} from '@/lib/agendaHelpers'

interface AgendaItemRowProps {
  item: AgendaItem
  onRefresh: () => void
  onOpenReschedule: (item: AgendaItem) => void
}

export function AgendaItemRow({ item, onRefresh, onOpenReschedule }: AgendaItemRowProps) {
  const { toast } = useToast()
  const { appointment, form, timeKey } = item

  const [confirmRealizadoOpen, setConfirmRealizadoOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const patientName = appointment.patient_name || form?.patient_name || 'Paciente sem nome'
  const rawPhone = appointment.patient_phone || form?.patient_phone || ''
  const phoneFormatted = rawPhone ? formatPhone(rawPhone) : ''
  const phoneDigits = rawPhone.replace(/\D/g, '')

  const isFormSigned = form?.status === 'preenchida'
  const procedureLabel = getProcedureLabel(appointment.procedure || form?.form_type)
  const reminderText = getAgendaReminderText(appointment)
  const reminderColorClass = getAgendaReminderColorClass(reminderText)
  const apptStatus = (appointment.status || 'agendado').toLowerCase()

  const handleConfirmRealizado = async () => {
    setActionLoading(true)
    try {
      await appointmentsService.markAsRealizado(appointment.id)
      toast({
        title: 'Atendimento Realizado',
        description: `${patientName} marcado como realizado.`,
      })
      onRefresh()
    } catch {
      toast({
        title: 'Erro ao atualizar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
      setConfirmRealizadoOpen(false)
    }
  }

  const handleConfirmCancel = async () => {
    setActionLoading(true)
    try {
      await appointmentsService.cancelAppointment(appointment.id)
      toast({
        title: 'Atendimento cancelado',
        description: 'O atendimento foi marcado como cancelado.',
      })
      onRefresh()
    } catch {
      toast({
        title: 'Erro ao cancelar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
      setConfirmCancelOpen(false)
    }
  }

  const handleRetryReminder = async () => {
    try {
      const res = await appointmentsService.retryReminder(appointment.id)
      if (res.success) {
        toast({
          title: 'Lembrete reenviado',
          description: res.message || 'Lembrete disparado com sucesso via Resend!',
        })
        onRefresh()
      } else {
        toast({
          title: 'Falha no reenvio',
          description: 'Não foi possível disparar o lembrete.',
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reenviar lembrete.'
      toast({
        title: 'Erro ao reenviar lembrete',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const handleResendForm = async () => {
    if (!form) {
      toast({
        title: 'Sem ficha vinculada',
        description: 'Este atendimento não possui ficha associada.',
        variant: 'destructive',
      })
      return
    }

    if (form.status === 'pendente') {
      const linkUrl = `${window.location.origin}/f/${form.token}`
      if (phoneDigits) {
        const text = encodeURIComponent(
          `Olá ${patientName}! Segue o link para preenchimento da sua ficha de anamnese da Andresa Souza Clinic: ${linkUrl}`,
        )
        window.open(`https://wa.me/55${phoneDigits}?text=${text}`, '_blank')
        toast({ title: 'Link aberto no WhatsApp' })
      } else {
        await navigator.clipboard.writeText(linkUrl)
        toast({
          title: 'Link copiado!',
          description: 'Cole no WhatsApp ou envie por e-mail para a paciente.',
        })
      }
    } else {
      try {
        const res = await formsService.resendReceiptEmail(form.id)
        if (res.success) {
          toast({
            title: 'Comprovante reenviado',
            description: 'E-mail com PDF da ficha disparado com sucesso.',
          })
          onRefresh()
        } else {
          toast({
            title: 'Falha ao reenviar',
            description: 'Não foi possível reenviar o comprovante.',
            variant: 'destructive',
          })
        }
      } catch {
        toast({
          title: 'Erro ao reenviar comprovante',
          description: 'Tente novamente.',
          variant: 'destructive',
        })
      }
    }
  }

  const statusBadge = useMemo(() => {
    if (apptStatus === 'realizado') {
      return (
        <Badge className="bg-[#2E9E5B] hover:bg-[#2E9E5B] text-white text-[10px] font-semibold tracking-wide border-0 px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Realizado
        </Badge>
      )
    }
    if (apptStatus === 'faltou') {
      return (
        <Badge className="bg-slate-600 hover:bg-slate-600 text-white text-[10px] font-semibold tracking-wide border-0 px-2 py-0.5 rounded-full flex items-center gap-1">
          <UserX className="w-3 h-3" />
          Faltou
        </Badge>
      )
    }
    if (apptStatus === 'cancelado') {
      return (
        <Badge className="bg-[#C0392B] hover:bg-[#C0392B] text-white text-[10px] font-semibold tracking-wide border-0 px-2 py-0.5 rounded-full flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Cancelado
        </Badge>
      )
    }
    return null
  }, [apptStatus])

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200/90 p-3 sm:p-4 transition-all duration-150 hover:shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Esquerda: Horário + Paciente + Telefone */}
        <div className="flex items-start gap-3 sm:gap-4 min-w-[220px]">
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 md:hidden" />
            <span className="text-sm sm:text-base font-bold text-slate-900 font-mono tracking-tight">
              {timeKey}
            </span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900 tracking-tight">{patientName}</span>
              {statusBadge}
            </div>

            {phoneFormatted ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-mono text-[11px]">{phoneFormatted}</span>
                {phoneDigits && (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = encodeURIComponent(`Olá ${patientName}, tudo bem?`)
                      window.open(`https://wa.me/55${phoneDigits}?text=${msg}`, '_blank')
                    }}
                    className="inline-flex items-center text-emerald-600 hover:text-emerald-700 transition-colors p-0.5"
                    title="Conversar no WhatsApp"
                    aria-label={`WhatsApp de ${patientName}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-emerald-50 text-emerald-600" />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">Sem telefone</p>
            )}
          </div>
        </div>

        {/* Centro: Pílula Procedimento + Pílula Ficha + Lembrete */}
        <div className="flex items-center flex-wrap gap-2 md:gap-3 text-xs">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EDE7F6] text-[#6B3FA0] border border-purple-200/60 shrink-0">
            {procedureLabel}
          </span>

          {isFormSigned ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-[#2E9E5B] border border-emerald-200 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
              Ficha assinada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-[#D99A00] border border-amber-200 shrink-0">
              <Clock className="w-3 h-3" />
              Ficha pendente
            </span>
          )}

          <span className={`text-xs ${reminderColorClass} shrink-0`}>{reminderText}</span>
        </div>

        {/* Direita: Botão Realizado + Menu 3 pontos */}
        <div className="flex items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          {apptStatus === 'agendado' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRealizadoOpen(true)}
              className="text-xs h-8 border-[#6B3FA0] text-[#6B3FA0] hover:bg-[#EDE7F6] hover:text-[#583385] font-medium transition-colors"
            >
              Realizado
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                aria-label="Ações do atendimento"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-xs">
              <DropdownMenuItem
                onClick={handleRetryReminder}
                className="flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reenviar lembrete</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleResendForm}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-slate-500" />
                <span>Reenviar ficha</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onOpenReschedule(item)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                <span>Remarcar</span>
              </DropdownMenuItem>

              {apptStatus !== 'cancelado' && (
                <DropdownMenuItem
                  onClick={() => setConfirmCancelOpen(true)}
                  className="flex items-center gap-2 text-[#C0392B] focus:text-[#C0392B] cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-[#C0392B]" />
                  <span>Cancelar atendimento</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modal de confirmação: Realizado */}
      <AlertDialog open={confirmRealizadoOpen} onOpenChange={setConfirmRealizadoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#2E9E5B]" />
              Confirmar atendimento realizado?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Deseja marcar o atendimento de <strong>{patientName}</strong> às{' '}
              <strong>{timeKey}</strong> como <strong>Realizado</strong>? Essa ação exibe a etiqueta
              na linha e desativa disparos futuros de lembretes deste atendimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading} className="text-xs">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRealizado}
              disabled={actionLoading}
              className="bg-[#2E9E5B] hover:bg-[#258249] text-white text-xs font-medium"
            >
              Sim, confirmar realizado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de confirmação: Cancelar atendimento */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#C0392B] flex items-center gap-2">
              <XCircle className="w-4 h-4 text-[#C0392B]" />
              Cancelar atendimento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600">
              Deseja realmente cancelar o atendimento de <strong>{patientName}</strong>? Nenhum
              lembrete futuro será enviado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading} className="text-xs">
              Não, manter
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={actionLoading}
              className="bg-[#C0392B] hover:bg-[#a53125] text-white text-xs font-medium"
            >
              Sim, cancelar atendimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
