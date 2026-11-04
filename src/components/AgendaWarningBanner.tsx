import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'

interface AgendaWarningBannerProps {
  pendingTomorrowCount: number
  failedRemindersCount: number
  onFilterPendingTomorrow: () => void
  onFilterFailedReminders: () => void
}

export function AgendaWarningBanner({
  pendingTomorrowCount,
  failedRemindersCount,
  onFilterPendingTomorrow,
  onFilterFailedReminders,
}: AgendaWarningBannerProps) {
  // Só aparece se houver pendência real
  if (pendingTomorrowCount === 0 && failedRemindersCount === 0) {
    return null
  }

  const pendingTomorrowText =
    pendingTomorrowCount === 1
      ? '1 ficha pendente para procedimentos de amanhã'
      : `${pendingTomorrowCount} fichas pendentes para procedimentos de amanhã`

  const failedRemindersText =
    failedRemindersCount === 1
      ? '1 lembrete não foi enviado'
      : `${failedRemindersCount} lembretes não foram enviados`

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 sm:p-4 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#D99A00]/15 text-[#D99A00] flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-amber-950 tracking-tight">
            Atenção às pendências da agenda
          </p>
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-amber-900">
            {pendingTomorrowCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3 text-[#D99A00]" />
                {pendingTomorrowText}
              </span>
            )}
            {failedRemindersCount > 0 && (
              <span className="inline-flex items-center gap-1 font-medium">
                <RefreshCw className="w-3 h-3 text-[#C0392B]" />
                {failedRemindersText}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {pendingTomorrowCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFilterPendingTomorrow}
            className="text-xs h-7 border-amber-300 text-amber-900 bg-white hover:bg-amber-100/70"
          >
            Ver amanhã
          </Button>
        )}
        {failedRemindersCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFilterFailedReminders}
            className="text-xs h-7 border-amber-300 text-amber-900 bg-white hover:bg-amber-100/70"
          >
            Ver falhas
          </Button>
        )}
      </div>
    </div>
  )
}
