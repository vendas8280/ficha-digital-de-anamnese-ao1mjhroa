import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  MoreVertical,
  ExternalLink,
  Copy,
  Check,
  Send,
  RefreshCw,
  Trash2,
  Loader2,
} from 'lucide-react'
import type { FormSubmissionRecord, ProcedureAppointmentRecord } from '@/services/forms'
import { REMINDER_PENDING_STATES } from './dashboardHelpers'

interface FichaActionsMenuProps {
  form: FormSubmissionRecord
  appointment?: ProcedureAppointmentRecord
  copiedId: string | null
  resendingId: string | null
  retryingReminderId: string | null
  onCopyLink: (url: string, id: string) => void
  onResendEmail: (id: string) => void
  onRetryReminder: (appointmentId: string) => void
  onOpenDelete: (form: FormSubmissionRecord) => void
}

export const FichaActionsMenu: React.FC<FichaActionsMenuProps> = ({
  form,
  appointment,
  copiedId,
  resendingId,
  retryingReminderId,
  onCopyLink,
  onResendEmail,
  onRetryReminder,
  onOpenDelete,
}) => {
  const isSigned = form.status === 'preenchida'
  const isCopied = copiedId === form.id
  const url = `${window.location.origin}/f/${form.token}`
  const rawProofStatus = String(form.email_delivery_status || '').toLowerCase()
  const hasProofFailure =
    isSigned && (rawProofStatus === 'falha' || rawProofStatus === 'nao_enviado')
  const remState = (appointment?.reminder_state || '').trim().toLowerCase()
  const hasReminderFailure = REMINDER_PENDING_STATES.has(remState)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:text-slate-900"
          aria-label="Ações da ficha"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs">
        {/* Abrir ficha / ver detalhes */}
        <DropdownMenuItem asChild>
          <a
            href={isSigned ? `/painel/ficha/${form.id}` : `/f/${form.token}`}
            target={isSigned ? undefined : '_blank'}
            rel={isSigned ? undefined : 'noreferrer'}
            className="cursor-pointer flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>{isSigned ? 'Ver detalhes da ficha' : 'Abrir link da paciente'}</span>
          </a>
        </DropdownMenuItem>

        {/* Copiar link (se pendente) */}
        {!isSigned && (
          <DropdownMenuItem
            onClick={() => onCopyLink(url, form.id)}
            className="cursor-pointer flex items-center gap-2"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{isCopied ? 'Link copiado!' : 'Copiar link da ficha'}</span>
          </DropdownMenuItem>
        )}

        {/* Reenviar comprovante por e-mail */}
        {isSigned && (
          <DropdownMenuItem
            onClick={() => onResendEmail(form.id)}
            disabled={resendingId === form.id}
            className={`cursor-pointer flex items-center gap-2 ${
              hasProofFailure ? 'text-[#C0392B] font-semibold focus:text-[#C0392B]' : ''
            }`}
          >
            {resendingId === form.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Reenviar comprovante por e-mail</span>
          </DropdownMenuItem>
        )}

        {/* Reenviar lembrete */}
        {appointment && (
          <DropdownMenuItem
            onClick={() => onRetryReminder(appointment.id)}
            disabled={retryingReminderId === appointment.id}
            className={`cursor-pointer flex items-center gap-2 ${
              hasReminderFailure ? 'text-[#C0392B] font-semibold focus:text-[#C0392B]' : ''
            }`}
          >
            {retryingReminderId === appointment.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Reenviar lembrete</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Excluir ficha */}
        <DropdownMenuItem
          onClick={() => onOpenDelete(form)}
          className="cursor-pointer text-red-600 focus:text-red-700 flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Excluir ficha</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
