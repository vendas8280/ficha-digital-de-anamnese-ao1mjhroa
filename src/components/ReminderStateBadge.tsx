import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  MailCheck,
  UserX,
} from 'lucide-react'
import type { ProcedureAppointmentRecord } from '@/services/forms'

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
  'sem ficha, lembrete não enviado': {
    label: 'Sem ficha, lembrete não enviado',
    className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100',
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

// Coluna "Lembrete" da listagem do painel: estado do lembrete do
// agendamento vinculado à ficha + destaque quando o e-mail da ficha
// difere de um e-mail já registrado no agendamento (conferir possível
// erro de digitação).
export function ReminderStateBadge({
  appointment,
  formEmail,
}: {
  appointment?: ProcedureAppointmentRecord
  formEmail?: string
}) {
  if (!appointment) {
    return <span className="text-slate-400">—</span>
  }

  const meta = STATE_META[appointment.reminder_state || ''] || FALLBACK
  const apptEmail = (appointment.patient_email || '').toLowerCase().trim()
  const form = (formEmail || '').toLowerCase().trim()
  // Destaque de divergência: só faz sentido quando os dois e-mails existem
  // e são diferentes (a clínica deve conferir se não foi erro de digitação).
  const emailMismatch = !!apptEmail && !!form && apptEmail !== form

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge className={`${meta.className} font-medium text-[10px] gap-0.5`}>
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
          Procedimento agendado
        </span>
      )}
    </div>
  )
}
