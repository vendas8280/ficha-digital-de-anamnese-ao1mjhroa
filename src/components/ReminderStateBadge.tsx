import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarClock,
  Clock,
  MailCheck,
  RefreshCw,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AppointmentReminderRecord, ProcedureAppointmentRecord } from '@/services/forms'

// Estado do lembrete gravado no banco (procedure_appointments.reminder_state),
// calculado no servidor quando a ficha é assinada e mantido pelo cron de 15 min.
const STATE_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  'aguardando ficha': {
    label: 'Aguardando ficha',
    className: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
    icon: <Clock className="w-3 h-3 mr-1" />,
  },
  'lembretes programados': {
    label: 'Lembretes programados',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
    icon: <BellRing className="w-3 h-3 mr-1" />,
  },
  'parcial: apenas 2h': {
    label: 'Só lembrete de 2h',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
    icon: <CalendarClock className="w-3 h-3 mr-1" />,
  },
  'fora do prazo': {
    label: 'Não enviado',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <AlertTriangle className="w-3 h-3 mr-1" />,
  },
  enviado: {
    label: 'Enviado',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    icon: <MailCheck className="w-3 h-3 mr-1" />,
  },
  'falha no envio': {
    label: 'Falha no envio',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <AlertTriangle className="w-3 h-3 mr-1" />,
  },
  falha: {
    label: 'Falha no envio',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <AlertTriangle className="w-3 h-3 mr-1" />,
  },
  'não enviado por atraso': {
    label: 'Não enviado',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <Clock className="w-3 h-3 mr-1" />,
  },
  'sem ficha, lembrete não enviado': {
    label: 'Não enviado',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <UserX className="w-3 h-3 mr-1" />,
  },
  'sem ficha, não enviado': {
    label: 'Não enviado',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <UserX className="w-3 h-3 mr-1" />,
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100',
    icon: <CalendarClock className="w-3 h-3 mr-1" />,
  },
}

const FALLBACK = {
  label: 'Aguardando ficha',
  className: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
  icon: <Clock className="w-3 h-3 mr-1" />,
}

// Estados negativos onde nenhum lembrete é enviado / programado para envio
const NEGATIVE_STATES = new Set([
  'fora do prazo',
  'sem ficha, lembrete não enviado',
  'sem ficha, não enviado',
  'falha no envio',
  'falha',
  'não enviado por atraso',
  'cancelado',
  'aguardando ficha',
])

/**
 * Formata um timestamp UTC (ISO ou Date) no fuso America/Sao_Paulo (UTC-3)
 * Retorna no formato "dd/mm/aaaa às hh:mm"
 */
export function formatInSaoPaulo(dateInput?: string | Date | null): string {
  if (!dateInput) return ''
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return ''

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })

    const parts = formatter.formatToParts(d)
    const day = parts.find((p) => p.type === 'day')?.value || ''
    const month = parts.find((p) => p.type === 'month')?.value || ''
    const year = parts.find((p) => p.type === 'year')?.value || ''
    const hour = parts.find((p) => p.type === 'hour')?.value || ''
    const minute = parts.find((p) => p.type === 'minute')?.value || ''

    if (!day || !month || !year || !hour || !minute) return ''
    return `${day}/${month}/${year} às ${hour}:${minute}`
  } catch {
    return ''
  }
}

/**
 * Formata a data e hora do procedimento a partir do procedure_date (armazenado como YYYY-MM-DD...)
 * e procedure_time (armazenado como HH:MM no fuso local da clínica).
 * Retorna "dd/mm/aaaa às hh:mm"
 */
export function formatProcedureDateTime(procedureDate?: string, procedureTime?: string): string {
  if (!procedureDate) return ''
  const m = String(procedureDate)
    .substring(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const [, yyyy, mm, dd] = m
  const dateFormatted = `${dd}/${mm}/${yyyy}`

  const timeVal = (procedureTime || '').trim()
  const tm = timeVal.match(/^(\d{1,2}):(\d{2})/)
  if (tm) {
    const hh = tm[1].padStart(2, '0')
    const min = tm[2]
    return `${dateFormatted} às ${hh}:${min}`
  }
  return dateFormatted
}

/**
 * Calcula a data/hora teórica prevista de um lembrete (24h ou 2h antes do procedimento).
 * procedure_date (YYYY-MM-DD) e procedure_time (HH:MM) são a data/hora no fuso America/Sao_Paulo (UTC-3).
 * Retorna "dd/mm/aaaa às hh:mm"
 */
export function computeProjectedTime(
  procedureDate?: string,
  procedureTime?: string,
  hoursBefore = 24,
): string {
  if (!procedureDate) return ''
  const m = String(procedureDate)
    .substring(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  let hh = 9
  let mm = 0
  if (procedureTime) {
    const tm = procedureTime.match(/^(\d{1,2}):(\d{2})/)
    if (tm) {
      hh = parseInt(tm[1], 10)
      mm = parseInt(tm[2], 10)
    }
  }

  // Cria timestamp UTC do procedimento sabendo que no horário de Brasília UTC = local + 3h
  const procUtc = Date.UTC(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    hh + 3,
    mm,
    0,
    0,
  )
  if (isNaN(procUtc)) return ''

  const reminderUtc = new Date(procUtc - hoursBefore * 3600 * 1000)
  return formatInSaoPaulo(reminderUtc)
}

/**
 * Retorna o texto exato para cada tipo de lembrete (2h ou 24h):
 * - "enviado em [dd/mm/aaaa] às [hh:mm]" se enviado
 * - "previsto [dd/mm/aaaa] às [hh:mm]" se existe ou programado mas não enviado
 * - "nenhum" se não existe
 */
export function formatReminderLine(
  kind: '2h' | '24h',
  reminder: AppointmentReminderRecord | undefined,
  normalizedState: string,
  procedureDate?: string,
  procedureTime?: string,
): string {
  const prefix = kind === '2h' ? 'Lembrete 2h:' : 'Lembrete 24h:'

  // 1. Se tem registro no banco:
  if (reminder) {
    if (reminder.status === 'enviado' && reminder.sent_at) {
      const formatted = formatInSaoPaulo(reminder.sent_at)
      return `${prefix} enviado em ${formatted || formatInSaoPaulo(reminder.scheduled_for)}`
    }
    if (reminder.scheduled_for) {
      const formatted = formatInSaoPaulo(reminder.scheduled_for)
      if (formatted) {
        return `${prefix} previsto ${formatted}`
      }
    }
  }

  // 2. Se não tem registro no banco, verificar se há previsão conforme o estado:
  if (kind === '24h') {
    // 24h não existe em parcial 2h, fora do prazo, cancelado
    if (
      normalizedState === 'parcial: apenas 2h' ||
      normalizedState === 'fora do prazo' ||
      normalizedState === 'cancelado'
    ) {
      return `${prefix} nenhum`
    }
    if (normalizedState === 'lembretes programados' || normalizedState === 'aguardando ficha') {
      const proj = computeProjectedTime(procedureDate, procedureTime, 24)
      if (proj) return `${prefix} previsto ${proj}`
    }
    return `${prefix} nenhum`
  }

  if (kind === '2h') {
    if (normalizedState === 'fora do prazo' || normalizedState === 'cancelado') {
      return `${prefix} nenhum`
    }
    if (
      normalizedState === 'lembretes programados' ||
      normalizedState === 'parcial: apenas 2h' ||
      normalizedState === 'aguardando ficha'
    ) {
      const proj = computeProjectedTime(procedureDate, procedureTime, 2)
      if (proj) return `${prefix} previsto ${proj}`
    }
    return `${prefix} nenhum`
  }

  return `${prefix} nenhum`
}

export interface ReminderStateBadgeProps {
  appointment?: ProcedureAppointmentRecord
  formEmail?: string
  signedAt?: string
  reminders?: AppointmentReminderRecord[]
  onRetry?: (appointmentId: string) => void
  isRetrying?: boolean
}

// Coluna "Lembrete" da listagem do painel: estado real do agendamento
// com selo, cor própria, destaque de divergência e Tooltip completo no hover.
export function ReminderStateBadge({
  appointment,
  formEmail,
  signedAt,
  reminders,
  onRetry,
  isRetrying,
}: ReminderStateBadgeProps) {
  const normalizedState = (appointment?.reminder_state || '').trim().toLowerCase()
  const meta = STATE_META[normalizedState] || FALLBACK

  // E-mail que vai receber o lembrete (prioriza e-mail do agendamento ou da ficha)
  const apptEmail = (appointment?.patient_email || '').trim()
  const cleanFormEmail = (formEmail || '').trim()
  const destinationEmail = apptEmail || cleanFormEmail || ''

  // Destaque de divergência: quando ambos existem e diferem
  const emailMismatch =
    !!apptEmail && !!cleanFormEmail && apptEmail.toLowerCase() !== cleanFormEmail.toLowerCase()

  // Lembretes reais vinculados a este agendamento (se carregados)
  const apptReminders =
    reminders && appointment ? reminders.filter((r) => r.appointment === appointment.id) : []
  const reminder24h = apptReminders.find((r) => r.kind === '24h')
  const reminder2h = apptReminders.find((r) => r.kind === '2h')

  // Lembrete enviado com destinatário real (campo sent_to do registro)
  const sentReminder = apptReminders.find((r) => r.status === 'enviado' && !!r.sent_to)
  const actualSentTo = sentReminder?.sent_to?.trim() || ''

  // Horário de envio formatado para o rótulo da coluna (ex.: "Lembrete 2h enviado em 04/11 às 00:09")
  const sentSummaryLabel = React.useMemo(() => {
    if (normalizedState !== 'enviado' && !sentReminder) return null
    const target = sentReminder || reminder2h || reminder24h
    if (!target || target.status !== 'enviado') return null
    const kindLabel = target.kind === '24h' ? 'Lembrete 24h' : 'Lembrete 2h'
    const ts = target.sent_at || target.scheduled_for
    if (!ts) return `${kindLabel} enviado`
    const formatted = formatInSaoPaulo(ts)
    if (!formatted) return `${kindLabel} enviado`
    // "04/11/2026 às 00:09" -> extrai "04/11 às 00:09" ou usa formatted
    const shortDate = formatted.replace(/\/20\d\d/, '')
    return `${kindLabel} enviado em ${shortDate}`
  }, [normalizedState, sentReminder, reminder2h, reminder24h])

  // 1. Sem agendamento -> traço "—" em cinza, SEM selo (após todos os hooks)
  if (!appointment) {
    return <span className="text-slate-400 font-medium">—</span>
  }

  // Linhas formatadas do Tooltip:
  // 1. "Procedimento: [dd/mm/aaaa] às [hh:mm]"
  const procedureFormatted = formatProcedureDateTime(
    appointment.procedure_date,
    appointment.procedure_time,
  )

  // 2. "Ficha assinada: [dd/mm/aaaa] às [hh:mm]" (só quando a ficha já foi assinada; senão omitir)
  const signedFormatted = signedAt ? formatInSaoPaulo(signedAt) : ''

  // 3. "Lembrete 2h:"
  const line2h = formatReminderLine(
    '2h',
    reminder2h,
    normalizedState,
    appointment.procedure_date,
    appointment.procedure_time,
  )

  // 4. "Lembrete 24h:"
  const line24h = formatReminderLine(
    '24h',
    reminder24h,
    normalizedState,
    appointment.procedure_date,
    appointment.procedure_time,
  )

  // 5. Linha final do Tooltip:
  // "Enviado para: [e-mail]" mostrando SEMPRE o endereço que realmente recebeu a mensagem (sent_to),
  // OU "Nenhum lembrete enviado" nos estados negativos.
  const isNegativeState = NEGATIVE_STATES.has(normalizedState)
  const emailToShow = actualSentTo || destinationEmail || ''

  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false)

  return (
    <>
      {/* 1. Computador (>= 768px): Balão flutuante (Tooltip) inalterado no hover */}
      <div className="hidden md:inline-flex items-center">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1.5 cursor-pointer flex-wrap">
                <Badge
                  className={`${meta.className} font-medium text-[10px] gap-0.5 shadow-none transition-opacity hover:opacity-90 whitespace-nowrap`}
                >
                  {meta.icon}
                  {meta.label}
                </Badge>

                {emailMismatch && (
                  <Badge className="bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-50 font-medium text-[10px] gap-0.5 whitespace-nowrap">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Conferir e-mail
                  </Badge>
                )}

                {(normalizedState === 'falha no envio' || normalizedState === 'falha') &&
                  onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRetrying}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRetry(appointment.id)
                      }}
                      className="h-5 px-1.5 text-[10px] text-[#C0392B] border-red-300 hover:bg-red-50 hover:text-red-800 gap-1"
                      title="Tentar reenviar lembrete via Resend"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isRetrying ? 'animate-spin' : ''}`} />
                      Reenviar
                    </Button>
                  )}
              </div>
            </TooltipTrigger>

            <TooltipContent
              side="top"
              align="start"
              className="bg-slate-900 text-slate-100 border-slate-800 p-2.5 text-xs max-w-xs shadow-xl space-y-1.5"
            >
              <div className="font-semibold text-slate-200 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-400" />
                <span>Detalhes do Agendamento & Lembretes</span>
              </div>

              <div className="space-y-1 text-[11px]">
                {procedureFormatted && (
                  <div className="text-slate-200">
                    <span className="text-slate-400">Procedimento: </span>
                    <span className="font-medium text-slate-200">{procedureFormatted}</span>
                  </div>
                )}

                {signedFormatted && (
                  <div className="text-slate-200">
                    <span className="text-slate-400">Ficha assinada: </span>
                    <span className="font-medium text-slate-200">{signedFormatted}</span>
                  </div>
                )}

                <div className="text-slate-200">
                  <span className="text-slate-400">Lembrete 2h: </span>
                  <span
                    className={`font-medium ${
                      line2h.includes('enviado em')
                        ? 'text-emerald-400'
                        : line2h.includes('previsto')
                          ? 'text-amber-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {line2h.replace(/^Lembrete 2h:\s*/, '')}
                  </span>
                </div>

                <div className="text-slate-200">
                  <span className="text-slate-400">Lembrete 24h: </span>
                  <span
                    className={`font-medium ${
                      line24h.includes('enviado em')
                        ? 'text-emerald-400'
                        : line24h.includes('previsto')
                          ? 'text-blue-300'
                          : 'text-slate-400'
                    }`}
                  >
                    {line24h.replace(/^Lembrete 24h:\s*/, '')}
                  </span>
                </div>

                <div className="pt-0.5 border-t border-slate-800 text-slate-200">
                  {isNegativeState ? (
                    <span className="font-medium text-slate-400 italic">
                      Nenhum lembrete enviado
                    </span>
                  ) : (
                    <>
                      <span className="text-slate-400">Enviado para: </span>
                      <span
                        className={`font-medium break-all ${
                          emailToShow ? 'text-slate-200' : 'text-amber-400 italic'
                        }`}
                      >
                        {emailToShow || 'sem e-mail'}
                      </span>
                    </>
                  )}
                </div>

                {emailMismatch && (
                  <div className="pt-1 text-[10px] text-amber-300 border-t border-slate-800/80">
                    Atenção: e-mail do agendamento ({apptEmail}) difere do e-mail da ficha (
                    {cleanFormEmail}).
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 2. Celular (< 768px): Toque abre folha (bottom sheet) subindo da base, ocupando até 60% */}
      <div className="md:hidden inline-flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setMobileSheetOpen(true)}
          className="inline-flex items-center min-h-[44px] cursor-pointer text-left focus:outline-none"
          aria-label="Ver detalhes do lembrete"
        >
          <Badge
            className={`${meta.className} font-medium text-xs gap-1 shadow-none transition-opacity hover:opacity-90 whitespace-nowrap py-1 px-2.5`}
          >
            {meta.icon}
            {meta.label}
          </Badge>
        </button>

        {emailMismatch && (
          <Badge className="bg-amber-50 text-amber-900 border-amber-300 font-medium text-[11px] gap-0.5 whitespace-nowrap py-1 px-2">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Conferir e-mail
          </Badge>
        )}

        {(normalizedState === 'falha no envio' || normalizedState === 'falha') && onRetry && (
          <Button
            variant="outline"
            size="sm"
            disabled={isRetrying}
            onClick={(e) => {
              e.stopPropagation()
              onRetry(appointment.id)
            }}
            className="min-h-[44px] px-2 text-xs text-[#C0392B] border-red-300 hover:bg-red-50 hover:text-red-800 gap-1"
            title="Tentar reenviar lembrete via Resend"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            Reenviar
          </Button>
        )}

        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[60vh] rounded-t-[20px] rounded-b-none p-5 flex flex-col overflow-y-auto bg-white border-t border-slate-200 z-50 shadow-2xl"
          >
            {/* Alça de arrastar no topo */}
            <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-300 -mt-1 mb-3 shrink-0" />

            {/* Título com ícone */}
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 pr-8">
              <Calendar className="w-4 h-4 text-[#6B3FA0] shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                Detalhes do Agendamento & Lembretes
              </h3>
            </div>

            {/* Os cinco campos rotulados */}
            <div className="space-y-2.5 text-xs">
              {/* Campo 1: Procedimento */}
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Procedimento
                </span>
                <span className="font-medium text-slate-900 mt-0.5 text-xs">
                  {procedureFormatted || 'Não informado'}
                </span>
              </div>

              {/* Campo 2: Ficha assinada */}
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Ficha assinada
                </span>
                <span className="font-medium text-slate-900 mt-0.5 text-xs">
                  {signedFormatted || 'Não assinada'}
                </span>
              </div>

              {/* Campo 3: Lembrete 2h */}
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Lembrete 2h
                </span>
                <span
                  className={`font-medium mt-0.5 text-xs ${
                    line2h.includes('enviado em')
                      ? 'text-emerald-700'
                      : line2h.includes('previsto')
                        ? 'text-amber-700'
                        : 'text-slate-600'
                  }`}
                >
                  {line2h.replace(/^Lembrete 2h:\s*/, '')}
                </span>
              </div>

              {/* Campo 4: Lembrete 24h */}
              <div className="flex flex-col py-1 border-b border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Lembrete 24h
                </span>
                <span
                  className={`font-medium mt-0.5 text-xs ${
                    line24h.includes('enviado em')
                      ? 'text-emerald-700'
                      : line24h.includes('previsto')
                        ? 'text-blue-700'
                        : 'text-slate-600'
                  }`}
                >
                  {line24h.replace(/^Lembrete 24h:\s*/, '')}
                </span>
              </div>

              {/* Campo 5: Enviado para */}
              <div className="flex flex-col py-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Enviado para
                </span>
                <span className="font-medium text-slate-900 mt-0.5 break-all text-xs">
                  {isNegativeState ? (
                    <span className="text-slate-500 italic">Nenhum lembrete enviado</span>
                  ) : (
                    emailToShow || <span className="text-amber-600 italic">sem e-mail</span>
                  )}
                </span>
              </div>

              {emailMismatch && (
                <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-800 border border-amber-200">
                  Atenção: e-mail do agendamento ({apptEmail}) difere do e-mail da ficha (
                  {cleanFormEmail}).
                </div>
              )}
            </div>

            {/* Botão roxo "Fechar" na base */}
            <div className="mt-4 pt-2">
              <SheetClose asChild>
                <Button className="w-full min-h-[44px] bg-[#6B3FA0] hover:bg-[#583385] text-white font-medium text-xs">
                  Fechar
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
