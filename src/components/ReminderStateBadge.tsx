import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  BellRing,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Mail,
  MailCheck,
  RefreshCw,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AppointmentReminderRecord, ProcedureAppointmentRecord } from '@/services/forms'
import { formatDateBR } from '@/lib/formatters'

// Estado do lembrete gravado no banco (procedure_appointments.reminder_state),
// calculado no servidor quando a ficha é assinada e mantido pelo cron de 15 min.
//
// Mapeamento exato de cores e rótulos especificados:
// - "Aguardando ficha" -> cinza
// - "Lembretes programados" -> azul ou roxo
// - "Parcial: apenas 2h" -> âmbar
// - "Fora do prazo" -> vermelho
// - "Enviado" -> verde
// - "Sem ficha, não enviado" (ou "sem ficha, lembrete não enviado") -> vermelho
// - "Cancelado" -> cinza
// - Sem agendamento -> "—" em cinza, sem selo
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
    label: 'Parcial: apenas 2h',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
    icon: <CalendarClock className="w-3 h-3 mr-1" />,
  },
  'fora do prazo': {
    label: 'Fora do prazo',
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
    label: 'Não enviado por atraso',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <Clock className="w-3 h-3 mr-1" />,
  },
  'sem ficha, lembrete não enviado': {
    label: 'Sem ficha, não enviado',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
    icon: <UserX className="w-3 h-3 mr-1" />,
  },
  'sem ficha, não enviado': {
    label: 'Sem ficha, não enviado',
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

function formatDateTimePretty(isoDate?: string, timeStr?: string): string {
  if (!isoDate) return 'Não definida'
  const dateFormatted = formatDateBR(isoDate)
  if (timeStr && timeStr.trim()) {
    return `${dateFormatted} às ${timeStr.trim()}`
  }
  return dateFormatted
}

function formatReminderTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    // Exibe formato DD/MM/AAAA às HH:MM
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} às ${hours}:${minutes}`
  } catch {
    return isoString
  }
}

// Calcula horários teóricos previstos caso ainda não existam registros gravados
// em appointment_reminders (ex: antes da assinatura da ficha).
function computeProjectedReminderTimes(
  procedureDate?: string,
  procedureTime?: string,
): { time24h?: string; time2h?: string } {
  if (!procedureDate) return {}
  const m = String(procedureDate)
    .substring(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return {}
  let hh = 9 // default horário comercial se vazio
  let mm = 0
  if (procedureTime) {
    const tm = procedureTime.match(/^(\d{1,2}):(\d{2})/)
    if (tm) {
      hh = parseInt(tm[1], 10)
      mm = parseInt(tm[2], 10)
    }
  }
  const apptDate = new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    hh,
    mm,
    0,
  )
  if (isNaN(apptDate.getTime())) return {}

  const d24 = new Date(apptDate.getTime() - 24 * 3600 * 1000)
  const d2 = new Date(apptDate.getTime() - 2 * 3600 * 1000)

  return {
    time24h: formatReminderTime(d24.toISOString()),
    time2h: formatReminderTime(d2.toISOString()),
  }
}

// Coluna "Lembrete" da listagem do painel: estado real do agendamento
// com selo, cor própria, destaque de divergência e Tooltip completo no hover.
export function ReminderStateBadge({
  appointment,
  formEmail,
  reminders,
  onRetry,
  isRetrying,
}: {
  appointment?: ProcedureAppointmentRecord
  formEmail?: string
  reminders?: AppointmentReminderRecord[]
  onRetry?: (appointmentId: string) => void
  isRetrying?: boolean
}) {
  // 1. Sem agendamento -> traço "—" em cinza, SEM selo (nunca "Sim")
  if (!appointment) {
    return <span className="text-slate-400 font-medium">—</span>
  }

  const normalizedState = (appointment.reminder_state || '').trim().toLowerCase()
  const meta = STATE_META[normalizedState] || FALLBACK

  // E-mail que vai receber o lembrete (prioriza e-mail do agendamento ou da ficha)
  const apptEmail = (appointment.patient_email || '').trim()
  const cleanFormEmail = (formEmail || '').trim()
  const destinationEmail = apptEmail || cleanFormEmail || ''

  // Destaque de divergência: quando ambos existem e diferem
  const emailMismatch =
    !!apptEmail && !!cleanFormEmail && apptEmail.toLowerCase() !== cleanFormEmail.toLowerCase()

  // Lembretes reais vinculados a este agendamento (se carregados)
  const apptReminders = reminders ? reminders.filter((r) => r.appointment === appointment.id) : []
  const reminder24h = apptReminders.find((r) => r.kind === '24h')
  const reminder2h = apptReminders.find((r) => r.kind === '2h')

  // Horários previstos dos lembretes
  const projected = computeProjectedReminderTimes(
    appointment.procedure_date,
    appointment.procedure_time,
  )

  let display24h = reminder24h ? formatReminderTime(reminder24h.scheduled_for) : ''
  let display2h = reminder2h ? formatReminderTime(reminder2h.scheduled_for) : ''

  // Se o estado for 'lembretes programados' e ainda não tiver registro em banco, usa projeção
  if (!display24h && normalizedState === 'lembretes programados' && projected.time24h) {
    display24h = projected.time24h
  }
  if (
    !display2h &&
    (normalizedState === 'lembretes programados' || normalizedState === 'parcial: apenas 2h') &&
    projected.time2h
  ) {
    display2h = projected.time2h
  }
  // Se ainda estiver 'aguardando ficha', projeta ambos como previsão para o hover
  if (!display24h && normalizedState === 'aguardando ficha' && projected.time24h) {
    display24h = `${projected.time24h} (previsto)`
  }
  if (!display2h && normalizedState === 'aguardando ficha' && projected.time2h) {
    display2h = `${projected.time2h} (previsto)`
  }

  // Se o estado for 'parcial: apenas 2h' ou 'fora do prazo', o de 24h não existe
  if (normalizedState === 'parcial: apenas 2h' || normalizedState === 'fora do prazo') {
    display24h = ''
  }
  // Se o estado for 'fora do prazo', nenhum existe
  if (normalizedState === 'fora do prazo' || normalizedState === 'cancelado') {
    display24h = ''
    display2h = ''
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 items-start cursor-pointer inline-flex">
            <Badge
              className={`${meta.className} font-medium text-[10px] gap-0.5 shadow-none transition-opacity hover:opacity-90`}
            >
              {meta.icon}
              {meta.label}
            </Badge>

            {emailMismatch && (
              <Badge className="bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-50 font-medium text-[10px] gap-0.5">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                Conferir e-mail
              </Badge>
            )}

            {appointment.procedure_date && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5 text-slate-400" />
                {formatDateTimePretty(appointment.procedure_date, appointment.procedure_time)}
              </span>
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
                className="h-6 px-1.5 text-[10px] text-red-700 border-red-300 hover:bg-red-50 hover:text-red-800 mt-0.5 gap-1"
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
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-400">Procedimento:</span>
              <span className="font-medium text-slate-200 text-right">
                {formatDateTimePretty(appointment.procedure_date, appointment.procedure_time)}
              </span>
            </div>

            {display24h && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-400">Lembrete 24h:</span>
                <span className="font-medium text-blue-300 text-right">{display24h}</span>
              </div>
            )}

            {display2h && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-400">Lembrete 2h:</span>
                <span className="font-medium text-amber-300 text-right">{display2h}</span>
              </div>
            )}

            {!display24h && !display2h && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-400">Lembretes:</span>
                <span className="font-medium text-slate-400 italic text-right">
                  {normalizedState === 'fora do prazo'
                    ? 'Nenhum (fora do prazo)'
                    : normalizedState === 'cancelado'
                      ? 'Cancelados'
                      : 'Não programados'}
                </span>
              </div>
            )}

            <div className="flex items-start justify-between gap-2 pt-0.5 border-t border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" /> E-mail:
              </span>
              <span
                className={`font-medium text-right break-all ${
                  destinationEmail ? 'text-slate-200' : 'text-amber-400 italic'
                }`}
              >
                {destinationEmail || 'sem e-mail'}
              </span>
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
  )
}
